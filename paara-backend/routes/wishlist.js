const express = require('express');
const db = require('../db/database');
const { requireAuth } = require('../middleware/auth');
const { isPositiveInt } = require('../utils/validate');

const router = express.Router();

router.get('/', requireAuth, (req, res) => {
  const items = db.prepare(`
    SELECT w.id AS wishlist_id, p.*
    FROM wishlist w JOIN products p ON p.id = w.product_id
    WHERE w.customer_id = ?
    ORDER BY w.added_at DESC
  `).all(req.customer.id);
  res.json(items);
});

router.post('/', requireAuth, (req, res) => {
  const { product_id } = req.body;
  if (!isPositiveInt(product_id)) {
    return res.status(400).json({ error: 'A valid product_id is required.' });
  }
  const product = db.prepare('SELECT id FROM products WHERE id = ?').get(product_id);
  if (!product) return res.status(404).json({ error: 'Product not found.' });

  try {
    db.prepare('INSERT INTO wishlist (customer_id, product_id) VALUES (?, ?)')
      .run(req.customer.id, product_id);
    res.status(201).json({ success: true });
  } catch (err) {
    res.status(409).json({ error: 'Already in wishlist.' });
  }
});

router.delete('/:product_id', requireAuth, (req, res) => {
  const info = db.prepare('DELETE FROM wishlist WHERE customer_id = ? AND product_id = ?')
    .run(req.customer.id, req.params.product_id);
  if (info.changes === 0) return res.status(404).json({ error: 'Not in wishlist.' });
  res.json({ success: true });
});

module.exports = router;
