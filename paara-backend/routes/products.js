const express = require('express');
const db = require('../db/database');

const router = express.Router();
const publicImageUrl = (value) => {
  const image = String(value || '').trim();
  return image.startsWith('data:') ? null : image || null;
};

function getDailyBestsellers(limit) {
  const allActive = db.prepare(`
    SELECT p.*, c.name AS category_name, c.gender
    FROM products p JOIN categories c ON c.id = p.category_id
    WHERE p.is_active = 1 AND p.release_date <= datetime('now')
    ORDER BY p.id ASC
  `).all();
  if (allActive.length === 0) return [];

  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD — same all day
  let hash = 0;
  for (let i = 0; i < today.length; i++) { hash = (hash * 31 + today.charCodeAt(i)) >>> 0; }
  const offset = hash % allActive.length;

  const result = [];
  for (let i = 0; i < Math.min(limit, allActive.length); i++) {
    result.push(allActive[(offset + i) % allActive.length]);
  }
  return result;
}

function addProductImages(products) {
  const imagesForProduct = db.prepare(
    'SELECT image_url FROM product_images WHERE product_id = ? ORDER BY sort_order ASC'
  );
  products.forEach((product) => {
    product.images = imagesForProduct.all(product.id).map((image) => publicImageUrl(image.image_url)).filter(Boolean);
  });
  return products;
}

// GET /api/products?gender=men&material=gold&vibe=minimal&category=necklaces&subcategory=pendant-necklaces&sort=newest
router.get('/', (req, res) => {
  if (req.query.bestseller === 'true') {
    return res.json(addProductImages(getDailyBestsellers(parseInt(req.query.limit, 10) || 9)));
  }
  const { gender, material, vibe, category, subcategory, sort } = req.query;

  let sql = `
    SELECT p.*, c.name AS category_name, c.gender, c.material AS category_material, c.vibe
    FROM products p
    JOIN categories c ON c.id = p.category_id
    WHERE p.is_active = 1 AND datetime(p.release_date) <= datetime('now')
  `;
  const params = [];

  if (gender) { sql += ' AND c.gender = ?'; params.push(gender); }
  if (material) { sql += ' AND c.material = ?'; params.push(material); }
  if (vibe) { sql += ' AND c.vibe = ?'; params.push(vibe); }
  if (category) {
    sql += ' AND (c.slug = ? OR lower(c.name) LIKE ?)';
    params.push(category, `%${String(category).toLowerCase()}%`);
  }
  if (subcategory) { sql += ' AND p.subcategory = ?'; params.push(subcategory); }
  sql += sort === 'popularity' ? ' ORDER BY p.is_bestseller DESC, p.id ASC'
    : sort === 'price_asc' ? ' ORDER BY p.price ASC'
    : sort === 'price_desc' ? ' ORDER BY p.price DESC'
    : ' ORDER BY p.release_date DESC';
  if (req.query.limit) { sql += ` LIMIT ${parseInt(req.query.limit, 10) || 9}`; }

  const products = db.prepare(sql).all(...params);
  res.json(addProductImages(products));
});

router.get('/categories', (req, res) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
  res.json(db.prepare('SELECT id, name, slug, gender, vibe, material FROM categories ORDER BY gender, name').all());
});

// GET /api/products/:slug  — full detail + gallery images for the flip-card marquee
router.get('/:slug', (req, res) => {
  const product = db
    .prepare(`
      SELECT p.*, c.name AS category_name, c.gender
      FROM products p JOIN categories c ON c.id = p.category_id
      WHERE p.slug = ? AND p.is_active = 1
    `)
    .get(req.params.slug);

  if (!product) return res.status(404).json({ error: 'Product not found.' });

  product.images = db
    .prepare('SELECT image_url, is_primary FROM product_images WHERE product_id = ? ORDER BY sort_order ASC')
    .all(product.id)
    .map((image) => publicImageUrl(image.image_url)).filter(Boolean);

  product.instagram = db
    .prepare('SELECT instagram_post_url, image_url, caption, likes FROM instagram_reviews WHERE product_id = ? ORDER BY cached_at DESC LIMIT 8')
    .all(product.id);

  res.json(product);
});

module.exports = router;
