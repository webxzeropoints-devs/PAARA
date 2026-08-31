const express = require('express');
const db = require('../db/database');
const { requireAuth } = require('../middleware/auth');
const { calculateGST, round2 } = require('../utils/pricing');
const { calculateShipping } = require('../utils/shipping');
const { createInvoicePdf } = require('../utils/invoice');

const router = express.Router();
// Keep shipping calculation active, but temporarily exclude its charge from customer totals.
const INCLUDE_SHIPPING_IN_CUSTOMER_TOTAL = process.env.INCLUDE_SHIPPING_IN_CUSTOMER_TOTAL === 'true';

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
    lineItems.push({ product_id: product.id, product_name: product.name, unit_price: product.price, quantity: item.quantity, line_total: lineTotal });
  }
  return { lineItems, subtotal };
}

/**
 * POST /api/orders
 * body: { items: [{ product_id, quantity }], address_id }
 *
 * Prices are always re-fetched from the DB here — never trust a price or
 * total sent from the client. This is what stops someone from editing the
 * page and checking out a ₹50,000 necklace for ₹5.
 */
router.post('/', requireAuth, (req, res) => {
  const { items, address_id } = req.body;
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'Cart items are required.' });
  }

  const address = db
    .prepare('SELECT * FROM addresses WHERE id = ? AND customer_id = ?')
    .get(address_id, req.customer.id);
  if (!address) return res.status(400).json({ error: 'Invalid address.' });
  const customer = db.prepare('SELECT name, email, phone FROM customers WHERE id = ?').get(req.customer.id);

  let lineItems;
  let subtotal;
  try {
    ({ lineItems, subtotal } = buildLineItems(items));
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }

  const { gstAmount } = calculateGST(subtotal);
  const shipping = calculateShipping({ city: address.city, lat: address.lat, lng: address.lng });
  const totalAmount = round2(subtotal + gstAmount + (INCLUDE_SHIPPING_IN_CUSTOMER_TOTAL ? shipping.amount : 0));

  const insertOrder = db.prepare(`
    INSERT INTO orders (customer_id, address_id, subtotal, gst_amount, shipping_amount, total_amount, status)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  const orderInfo = insertOrder.run(
    req.customer.id, address_id, subtotal, gstAmount, shipping.amount, totalAmount, 'Order Confirmed'
  );
  const orderId = orderInfo.lastInsertRowid;

  const insertItem = db.prepare(`
    INSERT INTO order_items (order_id, product_id, product_name, unit_price, quantity, line_total)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  lineItems.forEach(li =>
    insertItem.run(orderId, li.product_id, li.product_name, li.unit_price, li.quantity, li.line_total)
  );

  db.prepare(`
    INSERT INTO customer_order_details
      (order_id, customer_id, full_name, email, phone, shipping_line1, shipping_line2,
       shipping_city, shipping_state, shipping_pincode, shipping_country, submitted_fields)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    orderId, req.customer.id, customer.name, customer.email, customer.phone || null,
    address.line1, address.line2, address.city, address.state, address.pincode, 'India',
    JSON.stringify({ items, address_id, shipping_city: address.city })
  );

  res.status(201).json({
    order_id: orderId,
    subtotal,
    gst_amount: gstAmount,
    shipping_amount: shipping.amount,
    shipping_method: shipping.method,
    total_amount: totalAmount,
    items: lineItems
  });
});

router.post('/proforma', requireAuth, async (req, res) => {
  const { items, address_id } = req.body;
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
    const pdf = await createInvoicePdf({ id: 'PROFORMA', created_at: new Date().toISOString(), status: 'proforma', payment_status: 'unpaid', customer_name: customer?.name, subtotal, gst_amount: gstAmount, discount_amount: 0, shipping_amount: 0, total_amount: round2(subtotal + gstAmount) }, lineItems, address);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Length', pdf.length);
    res.setHeader('Content-Disposition', 'inline; filename="paara-proforma-invoice.pdf"');
    return res.end(pdf);
  } catch (error) {
    console.error('[PROFORMA_GENERATION_FAILED]', { message: error.message, name: error.name, customerId: req.customer?.id });
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
  res.json(order);
});

router.get('/:id/status', (req, res) => {
  const orderId = Number.parseInt(req.params.id, 10);
  if (!Number.isInteger(orderId) || orderId < 1) {
    return res.status(404).json({ error: 'Order not found.' });
  }

  const order = db.prepare('SELECT id, customer_id, status FROM orders WHERE id = ?').get(orderId);
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

  const invoiceName = `paara-invoice-${order.id}.pdf`;

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
