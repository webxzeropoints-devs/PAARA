const express = require('express');
const db = require('../db/database');
const { requireAdmin } = require('../middleware/admin');
const path = require('path');
const fs = require('fs');

const router = express.Router();
router.use(requireAdmin);

// Local dev keeps writing to disk (public/uploads); on Vercel the filesystem
// isn't writable/persistent, so uploads go to Vercel Blob storage instead.
const uploadsDir = path.join(__dirname, '../public/uploads/products');
if (!db.isServerless && !fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const imageRows = db.prepare('SELECT image_url FROM product_images WHERE product_id=? ORDER BY sort_order ASC,id ASC');
const decorate = (rows) => rows.map(p => ({ ...p, images: imageRows.all(p.id).map(r => r.image_url) }));

const cleanImages = (images) => {
  if (!Array.isArray(images)) return null;
  if (images.length > 3) throw new Error('A product can have at most 3 images.');
  return images.map(x => String(x || '').trim()).filter(Boolean);
};

const writeImages = (id, images) => {
  const clean = cleanImages(images);
  if (!clean) return;
  db.prepare('DELETE FROM product_images WHERE product_id=?').run(id);
  const add = db.prepare('INSERT INTO product_images (product_id, image_url, sort_order) VALUES (?, ?, ?)');
  clean.forEach((url, index) => add.run(id, url, index));
};

// Helper function to save uploaded files — Vercel Blob when serverless
// (persistent, public URL), local disk otherwise (unchanged dev behaviour).
const saveUploadedImages = async (files) => {
  if (!files || files.length === 0) return [];

  if (db.isServerless) {
    const { put } = require('@vercel/blob');
    return Promise.all(files.map(async (file) => {
      const timestamp = Date.now();
      const random = Math.random().toString(36).substring(2, 8);
      const filename = `product-${timestamp}-${random}${path.extname(file.originalname)}`;
      const blob = await put(`products/${filename}`, file.buffer, {
        access: 'public',
        addRandomSuffix: false,
        contentType: file.mimetype,
      });
      return blob.url;
    }));
  }

  return files.map((file) => {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    const filename = `product-${timestamp}-${random}${path.extname(file.originalname)}`;
    const filepath = path.join(uploadsDir, filename);

    fs.writeFileSync(filepath, file.buffer);
    return `/uploads/products/${filename}`;
  });
};

router.get('/products', (q, s) => s.json(decorate(db.prepare('SELECT p.*,c.name category_name FROM products p JOIN categories c ON c.id=p.category_id ORDER BY p.created_at DESC').all())));

router.get('/categories', (q, s) => s.json(db.prepare('SELECT id,name,slug,gender FROM categories ORDER BY gender,name').all()));

router.get('/customers', (q, s) => {
  const customers = db.prepare(`
    SELECT c.id, c.name, c.email, c.phone, c.created_at,
      COUNT(DISTINCT o.id) AS order_count,
      COALESCE(SUM(CASE WHEN o.payment_status = 'paid' THEN o.total_amount ELSE 0 END), 0) AS paid_total
    FROM customers c LEFT JOIN orders o ON o.customer_id = c.id
    GROUP BY c.id ORDER BY c.created_at DESC
  `).all();
  s.json(customers);
});

router.get('/customers/:id', (q, s) => {
  const customer = db.prepare('SELECT id, name, email, phone, created_at FROM customers WHERE id = ?').get(q.params.id);
  if (!customer) return s.status(404).json({ error: 'Customer not found.' });
  customer.orders = db.prepare('SELECT * FROM orders WHERE customer_id = ? ORDER BY created_at DESC').all(customer.id);
  customer.addresses = db.prepare('SELECT * FROM addresses WHERE customer_id = ? ORDER BY is_default DESC, id DESC').all(customer.id);
  customer.submissions = db.prepare(`
    SELECT d.*, o.order_number, o.status, o.payment_status FROM customer_order_details d
    JOIN orders o ON o.id = d.order_id WHERE d.customer_id = ? ORDER BY d.created_at DESC
  `).all(customer.id).map((detail) => ({ ...detail, submitted_fields: JSON.parse(detail.submitted_fields || '{}') }));
  s.json(customer);
});

router.delete('/customers/:id', (q, s) => {
  const customer = db.prepare('SELECT id, email, phone FROM customers WHERE id = ?').get(q.params.id);
  if (!customer) return s.status(404).json({ error: 'Customer not found.' });

  db.transaction(() => {
    const orderIds = db.prepare('SELECT id FROM orders WHERE customer_id = ?').all(customer.id).map((row) => row.id);

    if (orderIds.length > 0) {
      const orderPlaceholders = orderIds.map(() => '?').join(',');
      db.prepare(`DELETE FROM customer_order_details WHERE order_id IN (${orderPlaceholders})`).run(...orderIds);
      db.prepare(`DELETE FROM order_items WHERE order_id IN (${orderPlaceholders})`).run(...orderIds);
      db.prepare('DELETE FROM orders WHERE customer_id = ?').run(customer.id);
    }

    db.prepare('DELETE FROM email_otps WHERE email = ?').run(customer.email);
    db.prepare('DELETE FROM phone_otps WHERE phone = ?').run(customer.phone || '');
    db.prepare('DELETE FROM addresses WHERE customer_id = ?').run(customer.id);
    db.prepare('DELETE FROM wishlist WHERE customer_id = ?').run(customer.id);
    db.prepare('DELETE FROM customers WHERE id = ?').run(customer.id);
  })();

  s.json({ success: true, customer_id: customer.id });
});

router.post('/vault', (q, s) => {
  const ids = q.body.product_ids;
  if (!Array.isArray(ids) || ids.length !== 3 || new Set(ids).size !== 3)
    return s.status(400).json({ error: 'Select exactly three distinct products for the vault.' });
  db.transaction(() => {
    db.prepare('UPDATE products SET is_vault=0').run();
    ids.forEach((id, i) => {
      db.prepare('UPDATE products SET is_vault=1, vault_sort_order=? WHERE id=?').run(i, id);
    });
  })();
  s.json({ success: true });
});

router.post('/products', async (q, s) => {
  try {
    const { category_id, name, slug, description = null, price, material = null, subcategory = null, stock = 0, is_exclusive = false, is_bestseller = false, is_active = true, is_vault = false, release_date } = q.body;
        // Ensure req.files is an array (may be undefined when no files are uploaded)
      const filesArray = Array.isArray(q.files) ? q.files : (q.files ? [q.files] : []);
      let uploadedImages = [];
      try {
        uploadedImages = await saveUploadedImages(filesArray);
      } catch (imgErr) {
        console.error('Image upload failed:', imgErr.message);
        return s.status(400).json({ error: 'Failed to process uploaded images.' });
      }

      const existingImages = q.body.existingImages ? (Array.isArray(q.body.existingImages) ? q.body.existingImages : [q.body.existingImages]) : [];
      const allImages = [...uploadedImages, ...existingImages];

    const result = db.prepare('INSERT INTO products (category_id,name,slug,description,price,material,subcategory,stock,is_exclusive,is_bestseller,is_active,is_vault,release_date) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)').run(
      category_id, name, slug, description, price, material, subcategory, stock, is_exclusive ? 1 : 0, is_bestseller ? 1 : 0, is_active ? 1 : 0, is_vault ? 1 : 0, release_date || new Date().toISOString()
    );
    writeImages(result.lastInsertRowid, allImages);
    s.json(decorate([db.prepare('SELECT * FROM products WHERE id=?').get(result.lastInsertRowid)])[0]);
  } catch (err) {
    s.status(400).json({ error: 'Could not create the product.' });
  }
});

router.put('/products/:id', async (q, s) => {
  try {
    const current = db.prepare('SELECT * FROM products WHERE id=?').get(q.params.id);
    if (!current) return s.status(404).json({ error: 'Product not found.' });

    // Handle uploaded files
    const uploadedImages = await saveUploadedImages(q.files);
    const existingImages = q.body.existingImages ? (Array.isArray(q.body.existingImages) ? q.body.existingImages : [q.body.existingImages]) : [];
    const allImages = [...uploadedImages, ...existingImages];

    const updates = { ...q.body };
    if (allImages.length > 0) {
      writeImages(q.params.id, allImages);
    }
    delete updates.existingImages; // Remove this from product update

    db.prepare('UPDATE products SET ' + Object.keys(updates).map(k => k + '=?').join(',') + ' WHERE id=?').run(...Object.values(updates), q.params.id);
    s.json(decorate([db.prepare('SELECT * FROM products WHERE id=?').get(q.params.id)])[0]);
  } catch (err) {
    s.status(400).json({ error: 'Could not update the product.' });
  }
});

router.delete('/products/:id', (q, s) => {
  const r = db.prepare('DELETE FROM products WHERE id=?').run(q.params.id);
  if (!r.changes) return s.status(404).json({ error: 'Product not found.' });
  s.json({ success: true });
});

const keys = ['pearls', 'gold', 'ocean'];
router.get('/tile-products/:tile_key', (q, s) => {
  if (!keys.includes(q.params.tile_key)) return s.status(400).json({ error: 'Invalid tile key.' });
  s.json(decorate(db.prepare('SELECT p.*,tp.id tile_product_id FROM products p JOIN tile_products tp ON tp.product_id=p.id WHERE tp.tile_key=? ORDER BY tp.sort_order,tp.id').all(q.params.tile_key)));
});

router.post('/tile-products', (q, s) => {
  const { tile_key, product_id, sort_order = 0 } = q.body;
  if (!keys.includes(tile_key) || !product_id) return s.status(400).json({ error: 'tile_key and product_id are required.' });
  db.prepare('INSERT INTO tile_products (tile_key,product_id,sort_order) VALUES (?,?,?)').run(tile_key, product_id, sort_order);
  s.json({ success: true });
});

router.delete('/tile-products/:id', (q, s) => {
  const r = db.prepare('DELETE FROM tile_products WHERE id=?').run(q.params.id);
  if (!r.changes) return s.status(404).json({ error: 'Tile product not found.' });
  s.json({ success: true });
});

router.get('/paara-irl', (q, s) => s.json(db.prepare('SELECT * FROM paara_irl WHERE id=1').all()));

router.put('/paara-irl', (q, s) => {
  const { image_url, owner_image_url, caption } = q.body || {};
  const nextImageUrl = String(image_url ?? '').trim();
  db.prepare(`
    INSERT INTO paara_irl (id, image_url, owner_image_url, caption, sort_order, is_active, created_at, updated_at)
    VALUES (1, ?, ?, ?, 0, 1, datetime('now'), datetime('now'))
    ON CONFLICT(id) DO UPDATE SET
      image_url = excluded.image_url,
      owner_image_url = excluded.owner_image_url,
      caption = excluded.caption,
      updated_at = datetime('now')
  `).run(nextImageUrl || '', owner_image_url || null, caption || null);
  s.json(db.prepare('SELECT * FROM paara_irl WHERE id=1').get());
});

router.get('/worn-by-you', (q, s) => s.json(db.prepare('SELECT * FROM instagram_reviews WHERE product_id IS NULL ORDER BY cached_at,id LIMIT 3').all()));

router.put('/worn-by-you', (q, s) => {
  const slots = q.body?.slots;
  if (!Array.isArray(slots) || slots.length !== 3) return s.status(400).json({ error: 'Exactly 3 Worn By You slots are required.' });
  try {
    const saved = db.transaction(() => slots.map((slot) => {
      const imageUrl = String(slot?.image_url || '').trim();
      const caption = slot?.caption || null;
      const instagramPostUrl = slot?.instagram_post_url || '';
      const likes = Number(slot?.likes) || 0;

      if (!imageUrl) throw new Error('Each Worn By You slot requires an image_url.');

      const targetId = Number(slot?.id);
      if (Number.isInteger(targetId) && targetId > 0) {
        const result = db.prepare(`
          UPDATE instagram_reviews
          SET image_url = ?, caption = ?, instagram_post_url = ?, likes = ?, cached_at = datetime('now')
          WHERE id = ? AND product_id IS NULL
        `).run(imageUrl, caption, instagramPostUrl, likes, targetId);
        if (result.changes !== 1) throw new Error(`Worn By You slot ${targetId} could not be updated.`);
        return db.prepare('SELECT * FROM instagram_reviews WHERE id = ?').get(targetId);
      }

      const result = db.prepare(`
        INSERT INTO instagram_reviews (product_id, instagram_post_url, image_url, caption, likes, cached_at)
        VALUES (NULL, ?, ?, ?, ?, datetime('now'))
      `).run(instagramPostUrl, imageUrl, caption, likes);
      return db.prepare('SELECT * FROM instagram_reviews WHERE id = ?').get(result.lastInsertRowid);
    }))();
    s.json({ success: true, slots: saved });
  } catch (error) {
    return s.status(400).json({ error: error.message });
  }
});

router.get('/coupons', (q, s) => s.json(db.prepare('SELECT * FROM coupons ORDER BY created_at DESC').all()));

router.post('/coupons', (q, s) => {
  const { code, description, discount_type, discount_value, deadline, is_active } = q.body;
  if (!code || !['percent', 'flat'].includes(discount_type) || !discount_value || !deadline) return s.status(400).json({ error: 'Invalid coupon data.' });
  db.prepare('INSERT INTO coupons (code,description,discount_type,discount_value,deadline,is_active) VALUES (?,?,?,?,?,?)').run(code, description, discount_type, discount_value, deadline, is_active ? 1 : 0);
  s.json({ success: true });
});

router.put('/coupons/:id', (q, s) => {
  const { code, description, discount_type, discount_value, deadline, is_active } = q.body;
  const r = db.prepare('UPDATE coupons SET code=?,description=?,discount_type=?,discount_value=?,deadline=?,is_active=? WHERE id=?').run(code, description, discount_type, discount_value, deadline, is_active ? 1 : 0, q.params.id);
  if (!r.changes) return s.status(404).json({ error: 'Coupon not found.' });
  s.json({ success: true });
});

router.delete('/coupons/:id', (q, s) => {
  const r = db.prepare('DELETE FROM coupons WHERE id=?').run(q.params.id);
  if (!r.changes) return s.status(404).json({ error: 'Coupon not found.' });
  s.json({ success: true });
});

router.get('/gift-card-rules', (q, s) => s.json(db.prepare(`SELECT r.*,p.name product_name,p.price product_price FROM gift_card_rules r JOIN products p ON p.id=r.product_id ORDER BY r.created_at DESC`).all()));

router.post('/gift-card-rules', (q, s) => {
  const { product_id, gift_card_value, is_active = true } = q.body;
  if (!product_id || !Number.isFinite(Number(gift_card_value)) || Number(gift_card_value) <= 0) return s.status(400).json({ error: 'Invalid gift card rule data.' });
  db.prepare('INSERT INTO gift_card_rules (product_id,gift_card_value,is_active) VALUES (?,?,?)').run(product_id, gift_card_value, is_active ? 1 : 0);
  s.json({ success: true });
});

router.put('/gift-card-rules/:id', (q, s) => {
  const { product_id, gift_card_value, is_active } = q.body;
  if (!product_id || !Number.isFinite(Number(gift_card_value)) || Number(gift_card_value) <= 0) return s.status(400).json({ error: 'Invalid gift card rule data.' });
  const r = db.prepare("UPDATE gift_card_rules SET product_id=?,gift_card_value=?,is_active=?,updated_at=datetime('now') WHERE id=?").run(product_id, gift_card_value, is_active ? 1 : 0, q.params.id);
  if (!r.changes) return s.status(404).json({ error: 'Gift card rule not found.' });
  s.json({ success: true });
});

router.delete('/gift-card-rules/:id', (q, s) => {
  const r = db.prepare('DELETE FROM gift_card_rules WHERE id=?').run(q.params.id);
  if (!r.changes) return s.status(404).json({ error: 'Gift card rule not found.' });
  s.json({ success: true });
});

router.get('/orders', (q, s) => s.json(db.prepare(`SELECT o.*,c.name customer_name,c.email customer_email FROM orders o JOIN customers c ON c.id=o.customer_id ORDER BY o.created_at DESC`).all()));

const ORDER_STAGES = ['Order Confirmed', 'Packed', 'Shipped', 'Delivered'];

router.patch('/orders/:id/status', (q, s) => {
  const orderId = Number.parseInt(q.params.id, 10);
  const requestedStatus = String(q.body?.status || '').trim();

  if (!Number.isInteger(orderId) || orderId < 1) {
    return s.status(400).json({ error: 'A valid order ID is required.' });
  }
  if (!ORDER_STAGES.includes(requestedStatus)) {
    return s.status(400).json({ error: 'Invalid order status.' });
  }

  const existing = db.prepare('SELECT id, status FROM orders WHERE id = ?').get(orderId);
  if (!existing) return s.status(404).json({ error: 'Order not found.' });

  const currentIndex = ORDER_STAGES.indexOf(String(existing.status || '').trim() || 'Order Confirmed');
  const nextIndex = ORDER_STAGES.indexOf(requestedStatus);

  if (nextIndex < currentIndex) {
    return s.status(400).json({ error: 'Order statuses can only move forward.' });
  }

  db.prepare('UPDATE orders SET status = ? WHERE id = ?').run(requestedStatus, orderId);
  s.json({ success: true, order_id: orderId, status: requestedStatus });
});

router.post('/orders/:id/grant-gift-card', (q, s) => {
  const result = db.transaction(() => {
    const order = db.prepare('SELECT id,customer_id,gift_card_eligible_amount,gift_card_granted_at FROM orders WHERE id=?').get(q.params.id);
    if (!order) throw new Error('Order not found.');
    if (order.gift_card_granted_at) throw new Error('Gift card already granted for this order.');
    db.prepare("UPDATE orders SET gift_card_granted_at=datetime('now'),gift_card_granted_by=? WHERE id=?").run(q.body.admin_id || 1, q.params.id);
    db.prepare('UPDATE customers SET gift_card_balance = gift_card_balance + ? WHERE id=?').run(order.gift_card_eligible_amount, order.customer_id);
    return { success: true, amount: order.gift_card_eligible_amount };
  })();
  s.json(result);
});

module.exports = router;
