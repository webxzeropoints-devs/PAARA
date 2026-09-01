const express = require('express');
const crypto = require('crypto');
const db = require('../db/database');
const razorpay = require('../utils/razorpay');
const {
  getPaymentProvider,
  MANUAL_UPI_PENDING_STATUS,
  MANUAL_UPI_VERIFIED_STATUS,
  MANUAL_UPI_REJECTED_STATUS,
  MANUAL_UPI_CONFIRMED_STATUS,
} = require('../utils/paymentProviders');
const { requireAuth } = require('../middleware/auth');
const { trySendEmail } = require('../utils/email');
const { createInvoicePdf } = require('../utils/invoice');
const { maskSensitiveText } = require('../utils/validate');

const router = express.Router();

const markOrderPaid = db.transaction((orderId, paymentId) => {
  const updated = db.prepare(`
    UPDATE orders
    SET status = 'Order Confirmed', payment_status = 'paid', razorpay_payment_id = ?,
        gift_card_eligible_amount = COALESCE(
          gift_card_eligible_amount,
          (SELECT r.gift_card_value FROM gift_card_rules r
           WHERE r.is_active = 1 AND r.product_id IN
             (SELECT oi.product_id FROM order_items oi WHERE oi.order_id = orders.id)
           ORDER BY r.id ASC LIMIT 1)
        )
    WHERE id = ? AND payment_status != 'paid'
  `).run(paymentId, orderId);
  if (!updated.changes) return false;

  const items = db.prepare('SELECT product_id, quantity FROM order_items WHERE order_id = ?').all(orderId);
  const decrementStock = db.prepare('UPDATE products SET stock = stock - ? WHERE id = ?');
  items.forEach((item) => decrementStock.run(item.quantity, item.product_id));
  return true;
});

/**
 * POST /api/payment/create-razorpay-order
 * body: { order_id }
 *
 * Creates a Razorpay order for an amount that was already computed and
 * stored server-side in POST /api/orders — the amount is never taken
 * from the request body.
 */
router.post('/create', requireAuth, async (req, res) => {
  const { order_id, payment_method = 'manual_upi' } = req.body || {};
  const order = db.prepare('SELECT * FROM orders WHERE id = ? AND customer_id = ?').get(order_id, req.customer.id);
  if (!order) return res.status(404).json({ error: 'Order not found.' });

  const provider = getPaymentProvider(payment_method);
  const payload = provider.create(order, { id: req.customer.id, name: req.customer.name }, {
    baseUrl: process.env.APP_URL || 'https://www.paarajewellery.in',
  });

  if (payment_method === 'manual_upi') {
    db.prepare('UPDATE orders SET payment_method = ? WHERE id = ?')
      .run('manual_upi', order.id);
  }

  return res.json(payload);
});

router.post('/create-razorpay-order', requireAuth, async (req, res) => {
  const { order_id } = req.body;

  const order = db
    .prepare('SELECT * FROM orders WHERE id = ? AND customer_id = ?')
    .get(order_id, req.customer.id);

  if (!order) return res.status(404).json({ error: 'Order not found.' });
  if (order.payment_status === 'paid') {
    return res.status(400).json({ error: 'This order has already been paid.' });
  }

  if (!razorpay || !razorpay.orders || typeof razorpay.orders.create !== 'function') {
    return res.status(503).json({ error: 'Razorpay is not configured. Please use the manual UPI payment option.' });
  }

  try {
    const rzpOrder = await razorpay.orders.create({
      amount: Math.round(order.total_amount * 100), // paise
      currency: 'INR',
      receipt: `paara_order_${order.id}`,
      notes: { paara_order_id: String(order.id), customer_id: String(req.customer.id) }
    });

    db.prepare('UPDATE orders SET razorpay_order_id = ? WHERE id = ?').run(rzpOrder.id, order.id);

    res.json({
      key_id: process.env.RAZORPAY_KEY_ID,     // safe to expose — it's the public key
      razorpay_order_id: rzpOrder.id,
      amount: rzpOrder.amount,
      currency: rzpOrder.currency,
      paara_order_id: order.id
    });
  } catch (err) {
    console.error('Razorpay order creation failed:', { message: maskSensitiveText(err.message), name: err.name });
    res.status(502).json({ error: 'Could not initiate payment. Please try again.' });
  }
});

/**
 * POST /api/payment/verify
 * body: { paara_order_id, razorpay_order_id, razorpay_payment_id, razorpay_signature }
 *
 * This is the step that actually confirms payment. Razorpay's checkout
 * modal returns these three values to the frontend on success — but they
 * must be verified here, server-side, before we ever mark an order paid.
 * Never trust a "payment succeeded" message from the frontend alone.
 */
router.post('/verify', requireAuth, (req, res) => {
  const { paara_order_id, razorpay_order_id, razorpay_payment_id, razorpay_signature, payment_method, payment_reference, UTR } = req.body;

  const order = db
    .prepare('SELECT * FROM orders WHERE id = ? AND customer_id = ?')
    .get(paara_order_id, req.customer.id);
  if (!order) return res.status(404).json({ error: 'Order not found.' });

  const paymentMethod = String(payment_method || order.payment_method || 'razorpay').trim().toLowerCase();

  if (paymentMethod === 'manual_upi') {
    const reference = String(payment_reference || UTR || '').trim();
    if (!reference) {
      return res.status(400).json({ error: 'UTR is required for manual UPI verification.' });
    }

    const updated = db.prepare(`
      UPDATE orders
      SET payment_status = ?,
          payment_method = 'manual_upi',
          payment_reference = ?,
          payment_verified_at = NULL,
          payment_rejected_at = NULL,
          status = ?
      WHERE id = ? AND customer_id = ?
    `).run(MANUAL_UPI_PENDING_STATUS, reference, MANUAL_UPI_CONFIRMED_STATUS, order.id, req.customer.id);

    if (!updated.changes) {
      return res.status(400).json({ error: 'Unable to record UPI payment attempt.' });
    }

    return res.json({
      success: true,
      order_id: order.id,
      payment_status: MANUAL_UPI_PENDING_STATUS,
      payment_method: 'manual_upi',
      status: MANUAL_UPI_CONFIRMED_STATUS,
      message: 'Order Confirmed! We\'ll notify you once it ships.'
    });
  }

  if (!paara_order_id || !razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
    return res.status(400).json({ error: 'Missing payment verification fields.' });
  }

  if (order.razorpay_order_id !== razorpay_order_id) {
    return res.status(400).json({ error: 'Order mismatch.' });
  }

  const expectedSignature = crypto
    .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
    .update(`${razorpay_order_id}|${razorpay_payment_id}`)
    .digest('hex');

  const expectedBuffer = Buffer.from(expectedSignature, 'utf8');
  const receivedBuffer = Buffer.from(String(razorpay_signature), 'utf8');
  const isValid = expectedBuffer.length === receivedBuffer.length
    && crypto.timingSafeEqual(expectedBuffer, receivedBuffer);

  if (!isValid) {
    db.prepare('UPDATE orders SET status = ?, payment_status = ? WHERE id = ?')
      .run('Order Confirmed', 'unpaid', order.id);
    return res.status(400).json({ error: 'Payment verification failed.' });
  }

  // Signature valid — mark the order paid, snapshot eligibility, and decrement stock once.
  markOrderPaid(order.id, razorpay_payment_id);
  sendPaidInvoice(order.id, req.customer.id).catch((error) => console.error('Invoice email flow failed:', { message: maskSensitiveText(error.message), name: error.name }));

  res.json({ success: true, order_id: order.id, message: 'Payment verified. Order confirmed.' });
});

async function sendPaidInvoice(orderId, customerId) {
  const order = db.prepare('SELECT o.*, c.email, c.name FROM orders o JOIN customers c ON c.id = o.customer_id WHERE o.id = ? AND o.customer_id = ?').get(orderId, customerId);
  if (!order) return;
  const items = db.prepare('SELECT * FROM order_items WHERE order_id = ? ORDER BY id ASC').all(orderId);
  const address = db.prepare('SELECT * FROM addresses WHERE id = ? AND customer_id = ?').get(order.address_id, customerId);
  const pdf = await createInvoicePdf(order, items, address);
  const itemLines = items.map((item) => `${item.product_name} x ${item.quantity} @ INR ${item.unit_price} = INR ${item.line_total}`).join('\n');
  const addressText = address ? `${address.line1}, ${address.city}, ${address.state} - ${address.pincode}` : 'Not available';
  await trySendEmail({
    to: order.email,
    subject: `Paara invoice for order ${order.order_number}`,
    text: `Order ID: ${order.order_number}\nPayment ID: ${order.razorpay_payment_id}\n\nItems:\n${itemLines}\n\nTaxes: Included in product prices\nShipping: INR ${order.shipping_amount}\nTotal: INR ${order.total_amount}\nShipping address: ${addressText}`,
    attachments: [{ filename: `paara-invoice-${order.order_number}.pdf`, content: pdf, contentType: 'application/pdf' }],
  }, `invoice for order ${order.order_number}`);
}

/**
 * POST /api/payment/webhook
 * Razorpay server-to-server webhook — a safety net in case the customer
 * closes the tab right after paying, before the /verify call above fires.
 * Must be mounted with express.raw() (see server.js) so we can verify the
 * signature against the exact raw bytes Razorpay sent.
 *
 * Configure this URL + secret in: Razorpay Dashboard → Settings → Webhooks.
 */
router.get('/provider/:method', requireAuth, (req, res) => {
  const method = String(req.params.method || '').trim().toLowerCase();
  const orderId = Number.parseInt(String(req.query.order_id || ''), 10);
  if (!Number.isInteger(orderId) || orderId < 1) {
    return res.status(400).json({ error: 'A valid order_id is required.' });
  }

  const order = db.prepare('SELECT * FROM orders WHERE id = ? AND customer_id = ?').get(orderId, req.customer.id);
  if (!order) return res.status(404).json({ error: 'Order not found.' });

  const provider = getPaymentProvider(method);
  if (!provider || typeof provider.create !== 'function') {
    return res.status(400).json({ error: 'Unsupported payment method.' });
  }

  const payload = provider.create(order, { id: req.customer.id, name: req.customer.name }, { baseUrl: process.env.APP_URL || 'https://www.paarajewellery.in' });
  res.json(payload);
});

router.post('/webhook', (req, res) => {
  const signature = req.headers['x-razorpay-signature'];
  if (!Buffer.isBuffer(req.body) || typeof signature !== 'string') {
    return res.status(400).json({ error: 'Invalid webhook payload.' });
  }
  const expected = crypto
    .createHmac('sha256', process.env.RAZORPAY_WEBHOOK_SECRET)
    .update(req.body) // raw Buffer, see express.raw() in server.js
    .digest('hex');

  const expectedBuffer = Buffer.from(expected, 'utf8');
  const signatureBuffer = Buffer.from(signature, 'utf8');
  if (expectedBuffer.length !== signatureBuffer.length || !crypto.timingSafeEqual(expectedBuffer, signatureBuffer)) {
    return res.status(400).json({ error: 'Invalid webhook signature.' });
  }

  let event;
  try {
    event = JSON.parse(req.body.toString('utf8'));
  } catch {
    return res.status(400).json({ error: 'Invalid webhook JSON.' });
  }

  if (event.event === 'payment.captured') {
    const rzpOrderId = event.payload.payment.entity.order_id;
    const paymentId = event.payload.payment.entity.id;
    const order = db.prepare('SELECT id FROM orders WHERE razorpay_order_id = ?').get(rzpOrderId);
    if (order) markOrderPaid(order.id, paymentId);
  }

  if (event.event === 'payment.failed') {
    const rzpOrderId = event.payload.payment.entity.order_id;
    db.prepare(`
      UPDATE orders SET status = 'failed' WHERE razorpay_order_id = ? AND status != 'paid'
    `).run(rzpOrderId);
  }

  res.json({ received: true });
});

module.exports = router;
