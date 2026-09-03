const db = require('../db/database');

const THRESHOLD = 599;
const CARD_SIZE = 6;
const VALIDITY_MONTHS = 6;
const QUALIFYING_PAYMENT_STATUSES = new Set([
  'paid',
  'verified',
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

function ensureLoyaltyCard(customerId) {
  db.prepare('INSERT OR IGNORE INTO loyalty_cards (customer_id) VALUES (?)').run(customerId);
}

function getLoyaltyState(customerId) {
  ensureLoyaltyCard(customerId);
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
  return serializeCard({ ...card, history });
}

function processLoyaltyOrder(orderId, customerId) {
  return db.transaction(() => {
    const order = db.prepare(`
      SELECT id, customer_id, subtotal, payment_status, payment_method
      FROM orders WHERE id = ? AND customer_id = ?
    `).get(orderId, customerId);
    if (!order) throw Object.assign(new Error('Order not found.'), { statusCode: 404 });

    const existing = db.prepare('SELECT awarded_at, animation_shown_at FROM loyalty_stamps WHERE order_id = ?').get(orderId);
    if (existing) {
      return { state: getLoyaltyState(customerId), order: { orderId, awarded: true, animationShown: Boolean(existing.animation_shown_at), newlyAwarded: false } };
    }

    const paymentStatus = String(order.payment_status || '').trim().toLowerCase();
    const paymentMethod = String(order.payment_method || '').trim().toLowerCase();
    const qualifies = paymentMethod !== 'cod'
      && QUALIFYING_PAYMENT_STATUSES.has(paymentStatus)
      && Number(order.subtotal) >= THRESHOLD;
    if (!qualifies) {
      return { state: getLoyaltyState(customerId), order: { orderId, awarded: false, animationShown: false, newlyAwarded: false } };
    }

    const now = new Date();
    ensureLoyaltyCard(customerId);
    let card = db.prepare('SELECT * FROM loyalty_cards WHERE customer_id = ?').get(customerId);
    const expired = card?.expires_at && new Date(card.expires_at) <= now && !card.completed_at;
    if (expired) {
      db.prepare(`
        UPDATE loyalty_cards
        SET stamp_count = 0, first_stamp_at = NULL, expires_at = NULL,
            completed_at = NULL, reward_redeemed_at = NULL, updated_at = datetime('now')
        WHERE customer_id = ?
      `).run(customerId);
      card = db.prepare('SELECT * FROM loyalty_cards WHERE customer_id = ?').get(customerId);
    }
    if (card.completed_at) {
      return { state: getLoyaltyState(customerId), order: { orderId, awarded: false, animationShown: false, newlyAwarded: false } };
    }

    const firstStampAt = card.first_stamp_at || now.toISOString();
    const nextCount = Number(card.stamp_count || 0) + 1;
    const completedAt = nextCount >= CARD_SIZE ? now.toISOString() : null;
    db.prepare(`
      UPDATE loyalty_cards
      SET stamp_count = ?, first_stamp_at = ?, expires_at = ?, completed_at = ?,
          updated_at = datetime('now')
      WHERE customer_id = ?
    `).run(Math.min(nextCount, CARD_SIZE), firstStampAt, card.expires_at || addMonths(firstStampAt, VALIDITY_MONTHS), completedAt, customerId);
    db.prepare('INSERT INTO loyalty_stamps (customer_id, order_id) VALUES (?, ?)').run(customerId, orderId);
    return { state: getLoyaltyState(customerId), order: { orderId, awarded: true, animationShown: false, newlyAwarded: true } };
  })();
}

module.exports = {
  CARD_SIZE,
  getLoyaltyState,
  processLoyaltyOrder,
};
