const express = require('express');
const db = require('../db/database');
const { requireAuth } = require('../middleware/auth');
const { getLoyaltyState, processLoyaltyOrder } = require('../services/loyalty');

const router = express.Router();

router.get('/', requireAuth, (req, res) => {
  res.set('Cache-Control', 'no-store');
  return res.json(getLoyaltyState(req.customer.id));
});

router.get('/order/:orderId', requireAuth, (req, res) => {
  const order = db.prepare(`
    SELECT o.id, o.customer_id, ls.awarded_at, ls.animation_shown_at
    FROM orders o LEFT JOIN loyalty_stamps ls ON ls.order_id = o.id
    WHERE o.id = ? AND o.customer_id = ?
  `).get(req.params.orderId, req.customer.id);
  if (!order) return res.status(404).json({ error: 'Order not found.' });
  res.set('Cache-Control', 'no-store');
  return res.json({
    orderId: order.id,
    awarded: Boolean(order.awarded_at),
    animationShown: Boolean(order.animation_shown_at),
    awardedAt: order.awarded_at || null,
  });
});

router.post('/process-order', requireAuth, (req, res) => {
  const orderId = Number.parseInt(req.body?.order_id, 10);
  if (!Number.isInteger(orderId) || orderId < 1) return res.status(400).json({ error: 'A valid order ID is required.' });

  try {
    return res.status(200).json(processLoyaltyOrder(orderId, req.customer.id));
  } catch (error) {
    if (error.statusCode) return res.status(error.statusCode).json({ error: error.message });
    console.error('[LOYALTY_PROCESS_FAILED]', { message: error.message, name: error.name });
    return res.status(500).json({ error: 'Could not process this order for rewards.' });
  }
});

router.post('/mark-animation-shown', requireAuth, (req, res) => {
  const orderId = Number.parseInt(req.body?.order_id, 10);
  if (!Number.isInteger(orderId) || orderId < 1) return res.status(400).json({ error: 'A valid order ID is required.' });
  const updated = db.prepare(`
    UPDATE loyalty_stamps SET animation_shown_at = COALESCE(animation_shown_at, datetime('now'))
    WHERE order_id = ? AND customer_id = ?
  `).run(orderId, req.customer.id);
  if (!updated.changes) return res.status(404).json({ error: 'No loyalty stamp found for this order.' });
  return res.json({ success: true, orderId, animationShown: true });
});

module.exports = router;
