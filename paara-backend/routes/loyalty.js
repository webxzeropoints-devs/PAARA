const express = require('express');
const db = require('../db/database');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
const THRESHOLD = 599;
const CARD_SIZE = 6;
const VALIDITY_MONTHS = 6;
// Loyalty stamps are earned when a payment completes checkout. Manual UPI is
// intentionally still pending verification at this point, but the customer
// has completed the payment flow and should see the earned stamp immediately.
const QUALIFYING_PAYMENT_STATUSES = new Set([
  'paid',
  'verified',
  'pending_verification',
  'auto-confirmed - unverified',
]);

const addMonths = (date, months) => {
  const result = new Date(date);
  result.setMonth(result.getMonth() + months);
  return result.toISOString();
};

const serializeCard = (card) => ({
  stampCount: Number(card?.stamp_count || 0),
  totalStamps: Number(card?.total_stamps || 0),
  cardsCompleted: Number(card?.cards_completed || 0),
  firstStampAt: card?.first_stamp_at || null,
  expiresAt: card?.expires_at || null,
  completedAt: card?.completed_at || null,
  rewardEligible: Boolean(card?.completed_at && !card?.reward_redeemed_at),
  threshold: THRESHOLD,
  cardSize: CARD_SIZE,
  history: card?.history || [],
});

function getLoyaltyState(customerId) {
  const card = db.prepare(`
    SELECT lc.*, COALESCE(total.total_stamps, 0) AS total_stamps,
           COALESCE(completed.cards_completed, 0) AS cards_completed
    FROM loyalty_cards lc
    LEFT JOIN (
      SELECT customer_id, COUNT(*) AS total_stamps
      FROM loyalty_stamps GROUP BY customer_id
    ) total ON total.customer_id = lc.customer_id
    LEFT JOIN (
      SELECT customer_id, COUNT(*) AS cards_completed
      FROM loyalty_cards WHERE completed_at IS NOT NULL GROUP BY customer_id
    ) completed ON completed.customer_id = lc.customer_id
    WHERE lc.customer_id = ?
  `).get(customerId);
  const history = db.prepare(`
    SELECT ls.id, ls.order_id, ls.awarded_at, ls.animation_shown_at, o.order_number
    FROM loyalty_stamps ls JOIN orders o ON o.id = ls.order_id
    WHERE ls.customer_id = ? ORDER BY ls.awarded_at DESC
  `).all(customerId);
  return serializeCard({ ...(card || {}), history });
}

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
    const result = db.transaction(() => {
      const order = db.prepare(`
        SELECT id, customer_id, subtotal, payment_status, payment_method
        FROM orders WHERE id = ? AND customer_id = ?
      `).get(orderId, req.customer.id);
      if (!order) throw Object.assign(new Error('Order not found.'), { statusCode: 404 });

      const existing = db.prepare('SELECT awarded_at, animation_shown_at FROM loyalty_stamps WHERE order_id = ?').get(orderId);
      if (existing) {
        const state = getLoyaltyState(req.customer.id);
        return { state, order: { orderId, awarded: true, animationShown: Boolean(existing.animation_shown_at), newlyAwarded: false } };
      }

      const paymentStatus = String(order.payment_status || '').trim().toLowerCase();
      const paymentMethod = String(order.payment_method || '').trim().toLowerCase();
      const qualifies = paymentMethod !== 'cod'
        && QUALIFYING_PAYMENT_STATUSES.has(paymentStatus)
        && Number(order.subtotal) >= THRESHOLD;
      if (!qualifies) {
        return { state: getLoyaltyState(req.customer.id), order: { orderId, awarded: false, animationShown: false, newlyAwarded: false } };
      }

      const now = new Date();
      let card = db.prepare('SELECT * FROM loyalty_cards WHERE customer_id = ?').get(req.customer.id);
      const expired = card?.expires_at && new Date(card.expires_at) <= now && !card.completed_at;
      if (!card) {
        db.prepare('INSERT INTO loyalty_cards (customer_id) VALUES (?)').run(req.customer.id);
        card = db.prepare('SELECT * FROM loyalty_cards WHERE customer_id = ?').get(req.customer.id);
      }
      if (expired) {
        db.prepare(`
          UPDATE loyalty_cards
          SET stamp_count = 0, first_stamp_at = NULL, expires_at = NULL,
              completed_at = NULL, reward_redeemed_at = NULL, updated_at = datetime('now')
          WHERE customer_id = ?
        `).run(req.customer.id);
        card = db.prepare('SELECT * FROM loyalty_cards WHERE customer_id = ?').get(req.customer.id);
      }
      if (card.completed_at) {
        return { state: getLoyaltyState(req.customer.id), order: { orderId, awarded: false, animationShown: false, newlyAwarded: false } };
      }

      const firstStampAt = card.first_stamp_at || now.toISOString();
      const nextCount = Number(card.stamp_count || 0) + 1;
      const completedAt = nextCount >= CARD_SIZE ? now.toISOString() : null;
      db.prepare(`
        UPDATE loyalty_cards
        SET stamp_count = ?, first_stamp_at = ?, expires_at = ?, completed_at = ?,
            updated_at = datetime('now')
        WHERE customer_id = ?
      `).run(Math.min(nextCount, CARD_SIZE), firstStampAt, card.expires_at || addMonths(firstStampAt, VALIDITY_MONTHS), completedAt, req.customer.id);
      db.prepare('INSERT INTO loyalty_stamps (customer_id, order_id) VALUES (?, ?)').run(req.customer.id, orderId);
      return { state: getLoyaltyState(req.customer.id), order: { orderId, awarded: true, animationShown: false, newlyAwarded: true } };
    })();

    return res.status(200).json(result);
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
