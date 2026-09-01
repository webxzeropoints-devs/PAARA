const express = require('express');
const db = require('../db/database');
const { requireAuth } = require('../middleware/auth');
const { round2 } = require('../utils/pricing');

const router = express.Router();

const isCouponExpired = (deadline) => {
  if (!deadline) return true;
  const normalized = String(deadline).replace(' ', 'T');
  const candidate = normalized.includes('Z') ? normalized : `${normalized}Z`;
  return new Date(candidate) <= new Date();
};

const getCouponValidation = (code) => {
  const coupon = db.prepare('SELECT * FROM coupons WHERE code = ?').get(code);
  if (!coupon) return { error: 'Invalid coupon code.', status: 404 };
  if (!Number(coupon.is_active)) return { error: 'This coupon is inactive.', status: 400 };
  if (isCouponExpired(coupon.deadline)) return { error: 'This coupon has expired.', status: 400 };
  return { coupon };
};

// GET /api/coupons/active — currently valid, non-expired offers for the popup
router.get('/active', (req, res) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate');
  const coupons = db.prepare(`
    SELECT id, code, description, discount_type, discount_value, deadline
    FROM coupons
    WHERE is_active = 1 AND redeemed_at IS NULL AND datetime(deadline) > datetime('now')
    ORDER BY deadline ASC
  `).all();
  res.json(coupons);
});

router.post('/validate', (req, res) => {
  const code = String(req.body?.code || '').trim().toUpperCase();
  const subtotal = Number(req.body?.subtotal ?? 0);
  if (!code) return res.status(400).json({ error: 'A coupon code is required.' });

  const validation = getCouponValidation(code);
  if (validation.error) return res.status(validation.status).json({ error: validation.error });

  const { coupon } = validation;
  const discountAmount = coupon.discount_type === 'percent'
    ? round2(subtotal * (Number(coupon.discount_value) / 100))
    : round2(Number(coupon.discount_value));
  const totalAfterDiscount = round2(Math.max(0, subtotal - discountAmount));

  return res.json({
    valid: true,
    coupon: {
      id: coupon.id,
      code: coupon.code,
      description: coupon.description,
      discount_type: coupon.discount_type,
      discount_value: Number(coupon.discount_value),
      deadline: coupon.deadline,
    },
    discount_amount: discountAmount,
    subtotal,
    total_after_discount: totalAfterDiscount,
  });
});

// POST /api/coupons/redeem-gift-card — atomically consume a flat coupon once
router.post('/redeem-gift-card', requireAuth, (req, res) => {
  const code = String(req.body?.code || '').trim().toUpperCase();
  if (!code) return res.status(400).json({ error: 'A gift card code is required.' });

  const coupon = db.prepare('SELECT * FROM coupons WHERE code = ?').get(code);
  if (!coupon) return res.status(404).json({ error: 'Invalid gift card code.' });
  if (coupon.discount_type !== 'flat') {
    return res.status(400).json({ error: 'This code is not eligible for gift card redemption.' });
  }
  if (coupon.redeemed_at) return res.status(409).json({ error: 'This gift card code has already been used.' });
  if (!Number(coupon.is_active)) return res.status(400).json({ error: 'This gift card code is inactive.' });
  if (new Date(coupon.deadline.replace(' ', 'T') + (coupon.deadline.includes('Z') ? '' : 'Z')) <= new Date()) {
    return res.status(400).json({ error: 'This gift card code has expired.' });
  }

  try {
    const result = db.transaction(() => {
      const consumed = db.prepare(
        "UPDATE coupons SET redeemed_at = datetime('now') WHERE id = ? AND redeemed_at IS NULL"
      ).run(coupon.id);
      if (!consumed.changes) return null;
      const updated = db.prepare(
        'UPDATE customers SET gift_card_balance = gift_card_balance + ? WHERE id = ?'
      ).run(Number(coupon.discount_value), req.customer.id);
      if (!updated.changes) throw new Error('Customer account not found.');
      return db.prepare('SELECT gift_card_balance FROM customers WHERE id = ?').get(req.customer.id);
    })();
    if (!result) return res.status(409).json({ error: 'This gift card code has already been used.' });
    res.json({ amount: Number(coupon.discount_value), balance: result.gift_card_balance });
  } catch (err) {
    res.status(500).json({ error: err.message === 'Customer account not found.' ? err.message : 'Could not redeem this gift card code.' });
  }
});

router.get('/balance', requireAuth, (req, res) => {
  const customer = db.prepare('SELECT gift_card_balance FROM customers WHERE id = ?').get(req.customer.id);
  if (!customer) return res.status(404).json({ error: 'Customer account not found.' });
  res.json({ balance: Number(customer.gift_card_balance) });
});

module.exports = router;
