const express = require('express');
const db = require('../db/database');
const publicImageUrl = require('../utils/publicImageUrl');

const router = express.Router();
// GET /api/vault/today — products released today (the homepage Vault strip)
router.get('/today', (req, res) => {
  const products = db
    .prepare(`
      SELECT p.*, c.name AS category_name
      FROM products p JOIN categories c ON c.id = p.category_id
      WHERE p.is_active = 1 AND p.is_vault = 1
      ORDER BY p.created_at DESC
    `)
    .all();
  const imagesForProduct = db.prepare(
    'SELECT image_url FROM product_images WHERE product_id = ? ORDER BY sort_order ASC'
  );
  products.forEach((product) => {
    product.images = imagesForProduct.all(product.id).map((image) => publicImageUrl(image.image_url)).filter(Boolean);
  });
  res.json(products);
});

// GET /api/vault/selected — public curated selection used by the homepage.
router.get('/selected', (req, res) => {
  const products = db.prepare(`
    SELECT p.*, c.name AS category_name
    FROM vault_products vp
    JOIN products p ON p.id = vp.product_id
    JOIN categories c ON c.id = p.category_id
    WHERE p.is_active = 1
    ORDER BY vp.sort_order ASC
  `).all();
  const imagesForProduct = db.prepare('SELECT image_url FROM product_images WHERE product_id = ? ORDER BY sort_order ASC');
  products.forEach((product) => { product.images = imagesForProduct.all(product.id).map((image) => publicImageUrl(image.image_url)).filter(Boolean); });
  res.json(products);
});

// GET /api/vault/archive — past drop days, grouped by date (for "missed a drop?")
router.get('/archive', (req, res) => {
  const days = db
    .prepare(`
      SELECT date(release_date) AS drop_date, COUNT(*) AS item_count
      FROM products
      WHERE is_active = 1 AND date(release_date) < date('now')
      GROUP BY date(release_date)
      ORDER BY drop_date DESC
      LIMIT 30
    `)
    .all();
  res.json(days);
});

// GET /api/vault/next — countdown target: earliest future release_date
router.get('/next', (req, res) => {
  const row = db
    .prepare(`
      SELECT MIN(datetime(release_date)) AS next_drop
      FROM products
      WHERE is_active = 1 AND datetime(release_date) > datetime('now')
    `)
    .get();
  res.json({ next_drop: row.next_drop || null });
});

module.exports = router;
