const express = require('express');
const db = require('../db/database');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

router.get('/', requireAuth, (req, res) => {
  const addresses = db
    .prepare('SELECT * FROM addresses WHERE customer_id = ? ORDER BY is_default DESC, id DESC')
    .all(req.customer.id);
  res.json(addresses);
});

router.post('/', requireAuth, (req, res) => {
  const { line1, line2, city, state, pincode, lat, lng, is_default } = req.body || {};
  if (![line1, city, state, pincode].every((value) => typeof value === 'string' && value.trim())) {
    return res.status(400).json({ error: 'line1, city, state and pincode are required.' });
  }
  const latitude = lat == null || lat === '' ? null : Number(lat);
  const longitude = lng == null || lng === '' ? null : Number(lng);
  if ((latitude != null && !Number.isFinite(latitude)) || (longitude != null && !Number.isFinite(longitude))) {
    return res.status(400).json({ error: 'lat and lng must be valid numbers.' });
  }

  try {
    const saveAddress = db.transaction(() => {
      const hasExistingAddress = db
        .prepare('SELECT 1 FROM addresses WHERE customer_id = ? LIMIT 1')
        .get(req.customer.id);
      const makeDefault = Boolean(is_default) || !hasExistingAddress;
      if (makeDefault) {
        db.prepare('UPDATE addresses SET is_default = 0 WHERE customer_id = ?').run(req.customer.id);
      }
      const result = db.prepare(`
        INSERT INTO addresses (customer_id, line1, line2, city, state, pincode, lat, lng, is_default)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        req.customer.id, line1.trim(), line2?.trim() || null, city.trim(), state.trim(), pincode.trim(),
        latitude, longitude, makeDefault ? 1 : 0
      );
      return db.prepare('SELECT * FROM addresses WHERE id = ?').get(result.lastInsertRowid);
    })();

    return res.status(201).json(saveAddress);
  } catch (error) {
    console.error('[ADDRESS_CREATE_FAILED]', {
      customerId: req.customer.id,
      error: error.message,
      name: error.name,
      code: error.code,
    });
    if (error.code === 'SQLITE_CONSTRAINT_FOREIGNKEY') {
      return res.status(400).json({ error: 'Your customer session is no longer valid. Please sign in again.' });
    }
    if (error.code === 'SQLITE_ERROR' && /no such (table|column)/i.test(error.message)) {
      return res.status(503).json({ error: 'Address storage is temporarily unavailable. Please try again shortly.' });
    }
    return res.status(500).json({ error: 'Address could not be saved. Please try again.' });
  }
});

module.exports = router;
