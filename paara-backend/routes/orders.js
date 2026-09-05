const express = require('express');
const db = require('../db/database');
const { requireAuth } = require('../middleware/auth');
const { calculateGST, round2 } = require('../utils/pricing');
const { calculateShipping } = require('../utils/shipping');
const { createInvoicePdf } = require('../utils/invoice');
const { formatOrderNumber } = require('../utils/orderNumber');

const router = express.Router();

const ORDER_TRACKING_STATUSES = ['Order Confirmed', 'Packed', 'Shipped', 'Delivered'];

const normalizeOrderStatus = (status) => {
  const normalized = String(status || '').trim();
  if (ORDER_TRACKING_STATUSES.includes(normalized)) return normalized;
  if (['pending', 'paid', 'failed', 'cancelled'].includes(normalized)) return 'Order Confirmed';
  if (normalized === 'shipped') return 'Shipped';
  if (normalized === 'delivered') return 'Delivered';
  return 'Order Confirmed';
};

const getOrderStatusIndex = (status) => ORDER_TRACKING_STATUSES.indexOf(normalizeOrderStatus(status));

function buildLineItems(items) {
  const lineItems = [];
  let subtotal = 0;
  for (const item of items) {
    if (!Number.isInteger(item.quantity) || item.quantity < 1) {
      throw new Error('Each item quantity must be a positive integer.');
    }
    const product = db.prepare('SELECT * FROM products WHERE id = ? AND is_active = 1').get(item.product_id);
    if (!product) throw new Error(`Product ${item.product_id} not found.`);
    if (product.stock < item.quantity) throw new Error(`"${product.name}" only has ${product.stock} in stock.`);
    const lineTotal = round2(product.price * item.quantity);
    subtotal = round2(subtotal + lineTotal);
    const weightKg = Number(product.weight_kg);
    if (!Number.isFinite(weightKg) || weightKg <= 0) throw new Error(`Product "${product.name}" is missing a valid weight.`);
    lineItems.push({ product_id: product.id, product_name: product.name, unit_price: product.price, quantity: item.quantity, line_total: lineTotal, weight_kg: weightKg });
  }
  return { lineItems, subtotal };
}

function createOrder({ customerId, items, addressId, paymentMethod = 'razorpay' }) {
  const normalizedPaymentMethod = String(paymentMethod).trim().toLowerCase();
  const paymentStatus = normalizedPaymentMethod === 'cod' ? 'pending' : normalizedPaymentMethod === 'manual_upi' ? 'pending_verification' : 'unpaid';
  if (!['razorpay', 'manual_upi', 'cod'].includes(normalizedPaymentMethod)) throw new Error('Invalid payment method.');
  if (!Array.isArray(items) || items.length === 0) throw new Error('Cart items are required.');

  const address = db.prepare('SELECT * FROM addresses WHERE id = ? AND customer_id = ?').get(addressId, customerId);
  if (!address) throw new Error('Invalid address.');
  const customer = db.prepare('SELECT name, email, phone FROM customers WHERE id = ?').get(customerId);
  if (!customer) throw new Error('Customer account not found.');

  const { lineItems, subtotal } = buildLineItems(items);
  const { gstAmount } = calculateGST(subtotal);
  const totalWeightKg = lineItems.reduce((sum, item) => sum + item.weight_kg * item.quantity, 0);
  const shipping = calculateShipping({ city: address.city, state: address.state, paymentMethod: normalizedPaymentMethod, totalWeightKg });
  const totalAmount = round2(subtotal + gstAmount + shipping.amount);

  const order = db.transaction(() => {
    const orderInfo = db.prepare(`
      INSERT INTO orders (customer_id, address_id, subtotal, gst_amount, shipping_amount, total_amount, status, payment_method, payment_status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(customerId, addressId, subtotal, gstAmount, shipping.amount, totalAmount, 'Order Confirmed', normalizedPaymentMethod, paymentStatus);
    const orderId = orderInfo.lastInsertRowid;
    const orderNumber = formatOrderNumber(new Date().toISOString(), orderId);
    db.prepare('UPDATE orders SET order_number = ? WHERE id = ?').run(orderNumber, orderId);

    const insertItem = db.prepare(`
      INSERT INTO order_items (order_id, product_id, product_name, unit_price, quantity, line_total)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    lineItems.forEach((lineItem) => insertItem.run(orderId, lineItem.product_id, lineItem.product_name, lineItem.unit_price, lineItem.quantity, lineItem.line_total));

    db.prepare(`
      INSERT INTO customer_order_details
        (order_id, customer_id, full_name, email, phone, shipping_line1, shipping_line2,
         shipping_city, shipping_state, shipping_pincode, shipping_country, submitted_fields)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      orderId, customerId, customer.name, customer.email, customer.phone || null,
      address.line1, address.line2, address.city, address.state, address.pincode, 'India',
      JSON.stringify({ items, address_id: addressId, shipping_city: address.city })
    );

    return { orderId, orderNumber };
  })();

  return {
    order_id: order.orderId,
    order_number: order.orderNumber,
    payment_method: normalizedPaymentMethod,
    payment_status: paymentStatus,
    subtotal,
    gst_amount: gstAmount,
    shipping_amount: shipping.amount,
    shipping_method: shipping.method,
    total_amount: totalAmount,
    items: lineItems,
  };
}

/**
 * POST /api/orders
 * body: { items: [{ product_id, quantity }], address_id }
 *
 * Prices and weights are always re-fetched from the DB here — never trust
 * totals sent from the client.
 */
router.post('/', requireAuth, async (req, res) => {
  try {
    const order = createOrder({ customerId: req.customer.id, items: req.body?.items, addressId: req.body?.address_id, paymentMethod: req.body?.payment_method });
    await db.persistAfterWrite();
    return res.status(201).json(order);
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
});

router.post('/proforma', requireAuth, async (req, res) => {
  const { items, address_id, payment_method: requestedPaymentMethod = 'razorpay' } = req.body;
  const paymentMethod = String(requestedPaymentMethod).trim().toLowerCase();
  if (!['razorpay', 'manual_upi', 'cod'].includes(paymentMethod)) return res.status(400).json({ error: 'Invalid payment method.' });
  if (!Array.isArray(items) || items.length === 0) return res.status(400).json({ error: 'Cart items are required.' });
  let lineItems;
  let subtotal;
  try {
    ({ lineItems, subtotal } = buildLineItems(items));
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }

  try {
    const { gstAmount } = calculateGST(subtotal);
    const customer = db.prepare('SELECT name FROM customers WHERE id = ?').get(req.customer.id);
    const address = address_id
      ? db.prepare('SELECT * FROM addresses WHERE id = ? AND customer_id = ?').get(address_id, req.customer.id)
      : null;
    if (!address) return res.status(400).json({ error: 'A valid delivery address is required for the proforma invoice.' });
    const totalWeightKg = lineItems.reduce((sum, item) => sum + item.weight_kg * item.quantity, 0);
    const shipping = calculateShipping({ city: address.city, state: address.state, paymentMethod, totalWeightKg });
    const pdf = await createInvoicePdf({ id: 'PROFORMA', created_at: new Date().toISOString(), status: 'proforma', payment_status: 'unpaid', payment_method: paymentMethod, customer_name: customer?.name, subtotal, gst_amount: gstAmount, discount_amount: 0, shipping_amount: shipping.amount, total_amount: round2(subtotal + gstAmount + shipping.amount) }, lineItems, address);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Length', pdf.length);
    res.setHeader('Content-Disposition', 'inline; filename="paara-proforma-invoice.pdf"');
    return res.end(pdf);
  } catch (error) {
    console.error('[PROFORMA_GENERATION_FAILED]', {
      message: error.message,
      name: error.name,
      stack: error.stack,
      customerId: req.customer?.id,
      itemCount: Array.isArray(items) ? items.length : 0,
    });
    return res.status(500).json({ error: 'Could not generate proforma invoice.' });
  }
});

// GET /api/orders — this customer's order history
router.get('/', requireAuth, (req, res) => {
  const orders = db
    .prepare("SELECT * FROM orders WHERE customer_id = ? AND (status = 'Delivered' OR status = 'delivered') ORDER BY created_at DESC")
    .all(req.customer.id);
  const itemsForOrder = db.prepare('SELECT * FROM order_items WHERE order_id = ? ORDER BY id ASC');
  orders.forEach((order) => {
    order.order_id = order.id;
    order.order_number = order.order_number || formatOrderNumber(order.created_at, order.id);
    order.items = itemsForOrder.all(order.id);
  });
  res.json(orders);
});

// GET /api/orders/:id — single order + items + GST breakup (used as the invoice view)
router.get('/:id', requireAuth, (req, res) => {
  const order = db
    .prepare('SELECT * FROM orders WHERE id = ? AND customer_id = ?')
    .get(req.params.id, req.customer.id);
  if (!order) return res.status(404).json({ error: 'Order not found.' });

  order.items = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(order.id);
  order.order_number = order.order_number || formatOrderNumber(order.created_at, order.id);
  res.json(order);
});

router.get('/:id/status', (req, res) => {
  const orderId = Number.parseInt(req.params.id, 10);
  const requestedOrderNumber = String(req.params.id || '').trim();
  const isNumericOrderId = /^\d+$/.test(requestedOrderNumber) && orderId > 0;
  if (!isNumericOrderId && !/^ORD-\d{8}-\d+$/.test(requestedOrderNumber)) {
    return res.status(404).json({ error: 'Order not found.' });
  }

  const order = isNumericOrderId
      ? db.prepare('SELECT id, order_number, created_at, customer_id, status FROM orders WHERE id = ?').get(orderId)
      : db.prepare('SELECT id, order_number, created_at, customer_id, status FROM orders WHERE order_number = ?').get(requestedOrderNumber);
  if (!order) return res.status(404).json({ error: 'Order not found.' });

  const submittedEmail = String(req.query.email || '').trim().toLowerCase();
  if (!submittedEmail) {
    return res.status(400).json({ error: 'Order ID and email are required.' });
  }

  const customer = db.prepare('SELECT email FROM customers WHERE id = ?').get(order.customer_id);
  if (!customer || !customer.email || customer.email.toLowerCase() !== submittedEmail) {
    return res.status(404).json({ error: 'Order not found.' });
  }

  const status = normalizeOrderStatus(order.status);
  const payload = {
    order_id: order.id,
    order_number: order.order_number || formatOrderNumber(order.created_at, order.id),
    status,
    stage_index: getOrderStatusIndex(status),
    stages: ORDER_TRACKING_STATUSES,
  };

  if (status === 'Shipped') {
    payload.message = 'Your order will be delivered in 7 working days.';
  }

  res.json(payload);
});

router.get('/:id/invoice', requireAuth, (req, res) => {
  const orderId = Number.parseInt(req.params.id, 10);
  if (!Number.isInteger(orderId) || orderId < 1) {
    return res.status(404).json({ error: 'Order not found.' });
  }

  const order = db
    .prepare('SELECT o.*, c.name AS customer_name FROM orders o JOIN customers c ON c.id = o.customer_id WHERE o.id = ? AND o.customer_id = ?')
    .get(orderId, req.customer.id);
  if (!order) {
    console.warn('[INVOICE_NOT_FOUND]', { orderId, customerId: req.customer.id });
    return res.status(404).json({ error: 'Order not found for this account.' });
  }

  const items = db.prepare('SELECT * FROM order_items WHERE order_id = ? ORDER BY id ASC').all(order.id);
  const address = db
    .prepare('SELECT * FROM addresses WHERE id = ? AND customer_id = ?')
    .get(order.address_id, req.customer.id);

  const invoiceName = `paara-invoice-${order.order_number || formatOrderNumber(order.created_at, order.id)}.pdf`;

  createInvoicePdf(order, items, address).then((pdf) => {
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Length', pdf.length);
    res.setHeader('Content-Disposition', `attachment; filename="${invoiceName}"`);
    res.end(pdf);
  }).catch((error) => {
    console.error('[INVOICE_GENERATION_FAILED]', {
      orderId: order.id,
      customerId: req.customer.id,
      message: error.message,
      name: error.name,
    });
    if (!res.headersSent) res.status(500).json({ error: 'Could not generate invoice.' });
  });
});

module.exports = router;
module.exports.createOrder = createOrder;
