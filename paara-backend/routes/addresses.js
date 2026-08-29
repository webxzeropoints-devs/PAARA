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
  const { line1, line2, city, state, pincode, lat, lng, is_default } = req.body;
  if (![line1, city, state, pincode].every((value) => typeof value === 'string' && value.trim())) {
    return res.status(400).json({ error: 'line1, city, state and pincode are required.' });
  }
  if ((lat != null && !Number.isFinite(lat)) || (lng != null && !Number.isFinite(lng))) {
    return res.status(400).json({ error: 'lat and lng must be valid numbers.' });
  }

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
      lat ?? null, lng ?? null, makeDefault ? 1 : 0
    );
    return db.prepare('SELECT * FROM addresses WHERE id = ?').get(result.lastInsertRowid);
  });

  res.status(201).json(saveAddress());
});

module.exports = router;
