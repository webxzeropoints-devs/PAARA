const express = require('express');
const db = require('../db/database');
const { requireAdmin } = require('../middleware/admin');
const path = require('path');
const fs = require('fs');
const publicImageUrl = require('../utils/publicImageUrl');
const { processLoyaltyOrder } = require('../services/loyalty');

const router = express.Router();

router.use(requireAdmin);
router.use((q, s, next) => {
  s.set('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
  next();
});

const normalizeFormBoolean = (value, fallback = false) => {
  if (typeof value === 'boolean') return value;
  if (value === null || value === undefined || value === '') return fallback;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (['true', '1', 'yes', 'on'].includes(normalized)) return true;
    if (['false', '0', 'no', 'off'].includes(normalized)) return false;
  }
  return Boolean(value);
};

// Local dev keeps writing to disk (public/uploads); on Vercel the filesystem
// isn't writable/persistent, so uploads go to Vercel Blob storage instead.
const uploadsDir = path.join(__dirname, '../public/uploads/products');
if (!db.isServerless && !fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const imageRows = db.prepare('SELECT image_url FROM product_images WHERE product_id=? ORDER BY sort_order ASC,id ASC');
const decorate = (rows) => rows.map(p => ({ ...p, images: imageRows.all(p.id).map(r => r.image_url) }));

const privateBlobAuthOptions = () => {
  const token = String(process.env.BLOB_READ_WRITE_TOKEN || '').trim();
  const storeId = String(process.env.BLOB_STORE_ID || '').trim();
  if (token) return { token };
  if (storeId) return { storeId };
  throw Object.assign(new Error('Persistent image storage is not configured.'), { code: 'BLOB_STORAGE_NOT_CONFIGURED' });
};

const imageBlobOptions = () => {
  const publicToken = String(process.env.BLOB_PUBLIC_READ_WRITE_TOKEN || '').trim();
  const publicStoreId = String(process.env.BLOB_PUBLIC_STORE_ID || '').trim();
  if (publicToken) return { access: 'public', token: publicToken };
  if (publicStoreId) return { access: 'public', storeId: publicStoreId };
  return { access: 'private', ...privateBlobAuthOptions() };
};

const safeUploadError = (error) => {
  const code = error?.code || error?.name || 'UPLOAD_STORAGE_ERROR';
  const safeMessages = {
    BLOB_STORAGE_NOT_CONFIGURED: 'Persistent image storage is not configured.',
    BLOB_URL_MISSING: 'Persistent image storage did not return an image URL.',
    INVALID_IMAGE_UPLOAD: 'The uploaded file is not a valid image.',
    BASE64_IMAGE_NOT_ALLOWED: 'Upload the image file instead of pasting image data.',
  };
  return { code, message: safeMessages[code] || 'Image upload failed. Please try again.' };
};

const cleanImages = (images) => {
  if (!Array.isArray(images)) return null;
  if (images.length > 3) throw new Error('A product can have at most 3 images.');
  const cleaned = images.map(x => String(x || '').trim()).filter(Boolean);
  if (cleaned.some((image) => image.startsWith('data:'))) {
    throw Object.assign(new Error('Base64 image data is not accepted. Upload the image file instead.'), { code: 'BASE64_IMAGE_NOT_ALLOWED' });
  }
  return cleaned;
};

const writeImages = (id, images) => {
  const clean = cleanImages(images);
  if (!clean) return;
  db.prepare('DELETE FROM product_images WHERE product_id=?').run(id);
  const add = db.prepare('INSERT INTO product_images (product_id, image_url, sort_order) VALUES (?, ?, ?)');
  clean.forEach((url, index) => add.run(id, url, index));
};

const asFiles = (files) => (Array.isArray(files) ? files : files ? [files] : []);

const parseSlots = (value) => {
  if (Array.isArray(value)) return value.map((slot) => Number.parseInt(slot, 10));
  if (value === undefined || value === null || value === '') return [];
  return [Number.parseInt(value, 10)];
};

const orderedImageUrls = ({ uploadedImages, existingImages, uploadSlots, existingSlots }) => {
  const slots = new Map();
  uploadedImages.forEach((url, index) => {
    const slot = Number.isInteger(uploadSlots[index]) ? uploadSlots[index] : index;
    slots.set(slot, url);
  });
  existingImages.forEach((url, index) => {
    const slot = Number.isInteger(existingSlots[index]) ? existingSlots[index] : uploadedImages.length + index;
    slots.set(slot, url);
  });
  return [...slots.entries()].sort(([left], [right]) => left - right).map(([, url]) => url);
};

// Helper function to save uploaded files — Vercel Blob when serverless
// (persistent, public URL), local disk otherwise (unchanged dev behaviour).
const saveUploadedImages = async (files) => {
  if (!files || files.length === 0) return [];

  files.forEach((file) => {
    if (!file?.buffer?.length || !file.mimetype?.startsWith('image/')) {
      throw Object.assign(new Error('The uploaded image data was empty or was not an image.'), { code: 'INVALID_IMAGE_UPLOAD' });
    }
  });

  if (db.isServerless) {
    const { put } = require('@vercel/blob');
    return Promise.all(files.map(async (file) => {
      const timestamp = Date.now();
      const random = Math.random().toString(36).substring(2, 8);
      const filename = `product-${timestamp}-${random}${path.extname(file.originalname)}`;
      const blob = await put(`products/${filename}`, file.buffer, {
        ...imageBlobOptions(),
        addRandomSuffix: false,
        contentType: file.mimetype,
      });
      if (!blob?.url || !/^https?:\/\//i.test(blob.url)) {
        throw Object.assign(new Error('Persistent image storage returned no public URL.'), { code: 'BLOB_URL_MISSING' });
      }
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

const saveUploadedImage = async (file, prefix) => {
  if (!file) return null;
  if (!file.buffer?.length || !file.mimetype?.startsWith('image/')) {
    throw Object.assign(new Error('The uploaded image data was empty or was not an image.'), { code: 'INVALID_IMAGE_UPLOAD' });
  }
  if (db.isServerless) {
    const { put } = require('@vercel/blob');
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    const filename = `${prefix}-${timestamp}-${random}${path.extname(file.originalname)}`;
    const blob = await put(`homepage/${filename}`, file.buffer, {
      ...imageBlobOptions(),
      addRandomSuffix: false,
      contentType: file.mimetype,
    });
    if (!blob?.url || !/^https?:\/\//i.test(blob.url)) {
      throw Object.assign(new Error('Persistent image storage returned no public URL.'), { code: 'BLOB_URL_MISSING' });
    }
    return blob.url;
  }

  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  const filename = `${prefix}-${timestamp}-${random}${path.extname(file.originalname)}`;
  const homepageUploadsDir = path.join(__dirname, '../public/uploads/homepage');
  if (!fs.existsSync(homepageUploadsDir)) fs.mkdirSync(homepageUploadsDir, { recursive: true });
  fs.writeFileSync(path.join(homepageUploadsDir, filename), file.buffer);
  return `/uploads/homepage/${filename}`;
};

router.get('/products', (q, s) => s.json(decorate(db.prepare('SELECT p.*,c.name category_name FROM products p JOIN categories c ON c.id=p.category_id ORDER BY p.created_at DESC').all())));

router.get('/categories', (q, s) => s.json(db.prepare('SELECT id,name,slug,gender,vibe,material FROM categories ORDER BY gender,name').all()));

router.post('/categories', (q, s) => {
  const { name, slug, gender, vibe = null, material = null } = q.body || {};
  const cleanName = String(name || '').trim();
  const cleanSlug = String(slug || '').trim();
  const cleanGender = String(gender || '').trim().toLowerCase();

  if (!cleanName || !cleanSlug || !['men', 'women', 'unisex'].includes(cleanGender)) {
    return s.status(400).json({ error: 'Category name, slug, and gender are required.' });
  }

  const normalizedSlug = cleanSlug.replace(/\s+/g, '-').toLowerCase();
  try {
    const result = db.prepare(`
      INSERT INTO categories (name, slug, gender, vibe, material)
      VALUES (?, ?, ?, ?, ?)
    `).run(cleanName, normalizedSlug, cleanGender, vibe || null, material || null);
    s.status(201).json(db.prepare('SELECT * FROM categories WHERE id = ?').get(result.lastInsertRowid));
  } catch (err) {
    if (String(err.message).includes('UNIQUE constraint failed')) {
      return s.status(409).json({ error: 'A category with this slug already exists.' });
    }
    s.status(400).json({ error: 'Could not create the category.' });
  }
});

router.put('/categories/:id', (q, s) => {
  const { name, slug, gender, vibe = null, material = null } = q.body || {};
  const cleanName = String(name || '').trim();
  const cleanSlug = String(slug || '').trim();
  const cleanGender = String(gender || '').trim().toLowerCase();

  if (!cleanName || !cleanSlug || !['men', 'women', 'unisex'].includes(cleanGender)) {
    return s.status(400).json({ error: 'Category name, slug, and gender are required.' });
  }

  const normalizedSlug = cleanSlug.replace(/\s+/g, '-').toLowerCase();
  try {
    const result = db.prepare(`
      UPDATE categories
      SET name = ?, slug = ?, gender = ?, vibe = ?, material = ?
      WHERE id = ?
    `).run(cleanName, normalizedSlug, cleanGender, vibe || null, material || null, q.params.id);
    if (!result.changes) return s.status(404).json({ error: 'Category not found.' });
    s.json(db.prepare('SELECT * FROM categories WHERE id = ?').get(q.params.id));
  } catch (err) {
    if (String(err.message).includes('UNIQUE constraint failed')) {
      return s.status(409).json({ error: 'A category with this slug already exists.' });
    }
    s.status(400).json({ error: 'Could not update the category.' });
  }
});

router.delete('/categories/:id', (q, s) => {
  const assignedProducts = db.prepare('SELECT COUNT(*) AS count FROM products WHERE category_id = ?').get(q.params.id);
  if (assignedProducts?.count > 0) {
    return s.status(409).json({ error: 'Category cannot be deleted while products are assigned to it.' });
  }
  const result = db.prepare('DELETE FROM categories WHERE id = ?').run(q.params.id);
  if (!result.changes) return s.status(404).json({ error: 'Category not found.' });
  s.json({ success: true });
});

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
    const normalizedCategoryId = Number(category_id);
    const normalizedPrice = Number(price);
    const normalizedStock = Number(stock);
    const normalizedIsExclusive = normalizeFormBoolean(is_exclusive, false);
    const normalizedIsBestseller = normalizeFormBoolean(is_bestseller, false);
    const normalizedIsActive = normalizeFormBoolean(is_active, true);
    const normalizedIsVault = normalizeFormBoolean(is_vault, false);

    if (!Number.isInteger(normalizedCategoryId) || normalizedCategoryId < 1 || !db.prepare('SELECT 1 FROM categories WHERE id = ?').get(normalizedCategoryId)) {
      return s.status(400).json({ error: 'A valid category is required.', code: 'INVALID_CATEGORY_ID' });
    }
    if (!String(name || '').trim() || !String(slug || '').trim()) {
      return s.status(400).json({ error: 'Product name and slug are required.', code: 'INVALID_PRODUCT_FIELDS' });
    }
    if (!Number.isFinite(normalizedPrice) || normalizedPrice < 0 || !Number.isFinite(normalizedStock) || normalizedStock < 0) {
      return s.status(400).json({ error: 'Product price and stock must be valid non-negative numbers.', code: 'INVALID_PRODUCT_NUMBERS' });
    }

    // Ensure req.files is an array (may be undefined when no files are uploaded)
    const filesArray = asFiles(q.files);
    let uploadedImages = [];
    try {
      uploadedImages = await saveUploadedImages(filesArray);
    } catch (imgErr) {
      const uploadError = safeUploadError(imgErr);
      console.error('Image upload failed:', uploadError);
      return s.status(400).json({ error: `Could not store uploaded images: ${uploadError.message}`, code: uploadError.code });
    }

    const hasExistingImages = Object.prototype.hasOwnProperty.call(q.body, 'existingImages');
    const existingImages = hasExistingImages ? (Array.isArray(q.body.existingImages) ? q.body.existingImages : [q.body.existingImages]) : [];
    const allImages = orderedImageUrls({
      uploadedImages,
      existingImages,
      uploadSlots: parseSlots(q.body?.upload_slots),
      existingSlots: parseSlots(q.body?.existing_slots),
    });

    const result = db.prepare('INSERT INTO products (category_id,name,slug,description,price,material,subcategory,stock,is_exclusive,is_bestseller,is_active,is_vault,release_date) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)').run(
      normalizedCategoryId, name, slug, description, normalizedPrice, material, subcategory, normalizedStock, normalizedIsExclusive ? 1 : 0, normalizedIsBestseller ? 1 : 0, normalizedIsActive ? 1 : 0, normalizedIsVault ? 1 : 0, release_date || new Date().toISOString()
    );
    writeImages(result.lastInsertRowid, allImages);
    s.status(201).json(decorate([db.prepare('SELECT * FROM products WHERE id=?').get(result.lastInsertRowid)])[0]);
  } catch (err) {
    const productError = safeUploadError(err);
    console.error('Product creation failed:', productError);
    s.status(400).json({ error: `Could not create the product: ${productError.message}`, code: productError.code });
  }
});

router.put('/products/:id', async (q, s) => {
  try {
    const current = db.prepare('SELECT * FROM products WHERE id=?').get(q.params.id);
    if (!current) return s.status(404).json({ error: 'Product not found.' });

    const uploadedImages = await saveUploadedImages(asFiles(q.files));
    const hasExistingImages = Object.prototype.hasOwnProperty.call(q.body, 'existingImages');
    const existingImages = hasExistingImages ? (Array.isArray(q.body.existingImages) ? q.body.existingImages : [q.body.existingImages]) : [];
    const allImages = orderedImageUrls({
      uploadedImages,
      existingImages,
      uploadSlots: parseSlots(q.body?.upload_slots),
      existingSlots: parseSlots(q.body?.existing_slots),
    });

    const updates = { ...q.body };
    if (uploadedImages.length > 0 || hasExistingImages) {
      writeImages(q.params.id, allImages);
    }
    delete updates.existingImages;
    delete updates.images;

    const productColumns = new Set([
      'category_id', 'name', 'slug', 'description', 'price', 'material',
      'subcategory', 'stock', 'is_exclusive', 'is_bestseller', 'is_active',
      'is_vault', 'release_date',
    ]);
    Object.keys(updates).forEach((key) => {
      if (!productColumns.has(key)) delete updates[key];
    });

    if (updates.category_id !== undefined && (!Number.isInteger(Number(updates.category_id)) || Number(updates.category_id) < 1 || !db.prepare('SELECT 1 FROM categories WHERE id = ?').get(Number(updates.category_id)))) {
      return s.status(400).json({ error: 'A valid category is required.', code: 'INVALID_CATEGORY_ID' });
    }
    if (updates.name !== undefined && !String(updates.name || '').trim()) {
      return s.status(400).json({ error: 'Product name cannot be empty.', code: 'INVALID_PRODUCT_FIELDS' });
    }
    if (updates.slug !== undefined && !String(updates.slug || '').trim()) {
      return s.status(400).json({ error: 'Product slug cannot be empty.', code: 'INVALID_PRODUCT_FIELDS' });
    }

    ['is_exclusive', 'is_bestseller', 'is_active', 'is_vault'].forEach((key) => {
      if (Object.prototype.hasOwnProperty.call(updates, key)) {
        updates[key] = normalizeFormBoolean(updates[key], false) ? 1 : 0;
      }
    });

    if (updates.category_id !== undefined) updates.category_id = Number(updates.category_id);
    if (updates.price !== undefined) updates.price = Number(updates.price);
    if (updates.stock !== undefined) updates.stock = Number(updates.stock);

    const updateKeys = Object.keys(updates);
    if (updateKeys.length > 0) {
      db.prepare('UPDATE products SET ' + updateKeys.map(k => k + '=?').join(',') + ' WHERE id=?').run(...updateKeys.map((key) => updates[key]), q.params.id);
    }
    s.json(decorate([db.prepare('SELECT * FROM products WHERE id=?').get(q.params.id)])[0]);
  } catch (err) {
    const productError = safeUploadError(err);
    console.error('Product update failed:', productError);
    s.status(400).json({ error: `Could not update the product: ${productError.message}`, code: productError.code });
  }
});

router.delete('/products/:id', (q, s) => {
  const orderReference = db.prepare('SELECT 1 FROM order_items WHERE product_id = ? LIMIT 1').get(q.params.id);
  if (orderReference) {
    return s.status(409).json({ error: 'This product is referenced by an order and cannot be deleted.' });
  }
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
  try {
    const result = db.prepare('INSERT INTO tile_products (tile_key,product_id,sort_order) VALUES (?,?,?)').run(tile_key, product_id, sort_order);
    s.status(201).json(db.prepare('SELECT * FROM tile_products WHERE id=?').get(result.lastInsertRowid));
  } catch (error) {
    if (String(error.message).includes('UNIQUE constraint failed')) return s.status(409).json({ error: 'This product is already assigned to that tile.' });
    s.status(400).json({ error: 'Could not assign the product to the tile.' });
  }
});

router.delete('/tile-products/:id', (q, s) => {
  const r = db.prepare('DELETE FROM tile_products WHERE id=?').run(q.params.id);
  if (!r.changes) return s.status(404).json({ error: 'Tile product not found.' });
  s.json({ success: true });
});

router.get('/paara-irl', (q, s) => {
  const row = db.prepare('SELECT * FROM paara_irl WHERE id=1').get() || null;
  s.json(row ? { ...row, image_url: publicImageUrl(row.image_url), owner_image_url: publicImageUrl(row.owner_image_url) } : null);
});

router.put('/paara-irl', async (q, s) => {
  try {
    const { image_url, owner_image_url, caption } = q.body || {};
    const uploadSlots = Array.isArray(q.body?.upload_slots) ? q.body.upload_slots : [q.body?.upload_slots].filter(Boolean);
    const files = asFiles(q.files);
    const uploadedImages = await Promise.all(files.map((file, index) => saveUploadedImage(file, uploadSlots[index] === 'owner' ? 'owner' : 'paara-irl')));
    const uploadedBySlot = Object.fromEntries(files.map((file, index) => [uploadSlots[index] || 'image', uploadedImages[index]]));
    const nextImageUrl = uploadedBySlot.image || publicImageUrl(image_url);
    const nextOwnerImageUrl = uploadedBySlot.owner || publicImageUrl(owner_image_url);
    if (String(image_url || '').startsWith('data:') && !uploadedBySlot.image) throw Object.assign(new Error('Upload the image file instead of pasting image data.'), { code: 'BASE64_IMAGE_NOT_ALLOWED' });
    if (String(owner_image_url || '').startsWith('data:') && !uploadedBySlot.owner) throw Object.assign(new Error('Upload the image file instead of pasting image data.'), { code: 'BASE64_IMAGE_NOT_ALLOWED' });
    db.prepare(`
      INSERT INTO paara_irl (id, image_url, owner_image_url, caption, sort_order, is_active, created_at, updated_at)
      VALUES (1, ?, ?, ?, 0, 1, datetime('now'), datetime('now'))
      ON CONFLICT(id) DO UPDATE SET
        image_url = excluded.image_url,
        owner_image_url = excluded.owner_image_url,
        caption = excluded.caption,
        updated_at = datetime('now')
    `).run(nextImageUrl || '', nextOwnerImageUrl || null, caption || null);
    const row = db.prepare('SELECT * FROM paara_irl WHERE id=1').get();
    s.json({ ...row, image_url: publicImageUrl(row.image_url), owner_image_url: publicImageUrl(row.owner_image_url) });
  } catch (error) {
    const uploadError = safeUploadError(error);
    console.error('Paara IRL image update failed:', error);
    const clientErrorCodes = new Set(['BASE64_IMAGE_NOT_ALLOWED', 'INVALID_IMAGE_UPLOAD', 'BLOB_STORAGE_NOT_CONFIGURED', 'BLOB_URL_MISSING']);
    s.status(clientErrorCodes.has(uploadError.code) ? 400 : 500).json({ error: uploadError.message, code: uploadError.code });
  }
});

router.get('/worn-by-you', (q, s) => s.json(db.prepare("SELECT id, instagram_post_url, image_url, caption, likes, sort_order, cached_at, updated_at FROM instagram_reviews WHERE product_id IS NULL AND sort_order BETWEEN 0 AND 2 ORDER BY sort_order ASC, id ASC").all()));

router.put('/worn-by-you', async (q, s) => {
  let slots = q.body?.slots;
  if (typeof slots === 'string') {
    try { slots = JSON.parse(slots); } catch { slots = null; }
  }
  if (!Array.isArray(slots) || slots.length !== 3) return s.status(400).json({ error: 'Exactly 3 Worn By You slots are required.' });
  try {
    const uploadSlots = Array.isArray(q.body?.upload_slots) ? q.body.upload_slots : [q.body?.upload_slots].filter(Boolean);
    const files = asFiles(q.files);
    const uploadedImages = await Promise.all(files.map((file) => saveUploadedImage(file, 'worn-by-you')));
    const uploadedBySlot = Object.fromEntries(files.map((file, index) => [uploadSlots[index], uploadedImages[index]]));
    const saved = db.transaction(() => slots.map((slot, slotIndex) => {
      const imageUrl = uploadedBySlot[String(slotIndex)] || publicImageUrl(slot?.image_url) || '';
      const caption = slot?.caption || null;
      const instagramPostUrl = slot?.instagram_post_url || '';
      const likes = Number(slot?.likes) || 0;

      const targetId = Number(slot?.id);
      if (Number.isInteger(targetId) && targetId > 0) {
        const result = db.prepare(`
          UPDATE instagram_reviews
          SET image_url = ?, caption = ?, instagram_post_url = ?, likes = ?, sort_order = ?, cached_at = datetime('now'), updated_at = datetime('now')
          WHERE id = ? AND product_id IS NULL
        `).run(imageUrl, caption, instagramPostUrl, likes, slotIndex, targetId);
        if (result.changes !== 1) throw new Error(`Worn By You slot ${targetId} could not be updated.`);
        return db.prepare('SELECT * FROM instagram_reviews WHERE id = ?').get(targetId);
      }

      const result = db.prepare(`
        INSERT INTO instagram_reviews (product_id, instagram_post_url, image_url, caption, likes, sort_order, cached_at, updated_at)
        VALUES (NULL, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
      `).run(instagramPostUrl, imageUrl, caption, likes, slotIndex);
      return db.prepare('SELECT * FROM instagram_reviews WHERE id = ?').get(result.lastInsertRowid);
    }))();
    s.json({ success: true, slots: saved });
  } catch (error) {
    const uploadError = safeUploadError(error);
    console.error('Worn By You image update failed:', error);
    return s.status(400).json({ error: uploadError.message, code: uploadError.code });
  }
});

router.delete('/worn-by-you/:id', (q, s) => {
  const result = db.prepare(`
    UPDATE instagram_reviews
    SET image_url = '', caption = NULL, instagram_post_url = '', likes = 0,
        updated_at = datetime('now')
    WHERE id = ? AND product_id IS NULL AND sort_order BETWEEN 0 AND 2
  `).run(q.params.id);
  if (!result.changes) return s.status(404).json({ error: 'Worn By You entry not found.' });
  s.json({ success: true, id: Number(q.params.id) });
});

router.get('/coupons', (q, s) => s.json(db.prepare('SELECT * FROM coupons ORDER BY created_at DESC').all()));

router.post('/coupons', (q, s) => {
  const { code, description, discount_type, discount_value, deadline, is_active } = q.body;
  if (!code || !['percent', 'flat'].includes(discount_type) || !discount_value || !deadline) return s.status(400).json({ error: 'Invalid coupon data.' });
  try {
    const result = db.prepare('INSERT INTO coupons (code,description,discount_type,discount_value,deadline,is_active) VALUES (?,?,?,?,?,?)').run(String(code).trim().toUpperCase(), description || null, discount_type, Number(discount_value), deadline, is_active ? 1 : 0);
    s.status(201).json(db.prepare('SELECT * FROM coupons WHERE id=?').get(result.lastInsertRowid));
  } catch (error) {
    if (String(error.message).includes('UNIQUE constraint failed')) return s.status(409).json({ error: 'A coupon with this code already exists.' });
    s.status(400).json({ error: 'Could not create the coupon.' });
  }
});

router.put('/coupons/:id', (q, s) => {
  const { code, description, discount_type, discount_value, deadline, is_active } = q.body;
  const r = db.prepare('UPDATE coupons SET code=?,description=?,discount_type=?,discount_value=?,deadline=?,is_active=? WHERE id=?').run(code, description, discount_type, discount_value, deadline, is_active ? 1 : 0, q.params.id);
  if (!r.changes) return s.status(404).json({ error: 'Coupon not found.' });
  s.json(db.prepare('SELECT * FROM coupons WHERE id=?').get(q.params.id));
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
  try {
    const result = db.prepare('INSERT INTO gift_card_rules (product_id,gift_card_value,is_active) VALUES (?,?,?)').run(product_id, gift_card_value, is_active ? 1 : 0);
    s.status(201).json(db.prepare('SELECT * FROM gift_card_rules WHERE id=?').get(result.lastInsertRowid));
  } catch (error) {
    if (String(error.message).includes('UNIQUE constraint failed')) return s.status(409).json({ error: 'A loyalty rule already exists for this product.' });
    s.status(400).json({ error: 'Could not create the loyalty rule.' });
  }
});

router.put('/gift-card-rules/:id', (q, s) => {
  const { product_id, gift_card_value, is_active } = q.body;
  if (!product_id || !Number.isFinite(Number(gift_card_value)) || Number(gift_card_value) <= 0) return s.status(400).json({ error: 'Invalid gift card rule data.' });
  const r = db.prepare("UPDATE gift_card_rules SET product_id=?,gift_card_value=?,is_active=?,updated_at=datetime('now') WHERE id=?").run(product_id, gift_card_value, is_active ? 1 : 0, q.params.id);
  if (!r.changes) return s.status(404).json({ error: 'Gift card rule not found.' });
  s.json(db.prepare('SELECT * FROM gift_card_rules WHERE id=?').get(q.params.id));
});

router.delete('/gift-card-rules/:id', (q, s) => {
  const r = db.prepare('DELETE FROM gift_card_rules WHERE id=?').run(q.params.id);
  if (!r.changes) return s.status(404).json({ error: 'Gift card rule not found.' });
  s.json({ success: true });
});

router.get('/orders', (q, s) => s.json(db.prepare(`
  SELECT o.*, c.name customer_name, c.email customer_email,
         d.shipping_line1, d.shipping_line2, d.shipping_city,
         d.shipping_state, d.shipping_pincode, d.shipping_country
  FROM orders o
  JOIN customers c ON c.id = o.customer_id
  LEFT JOIN customer_order_details d ON d.order_id = o.id
  ORDER BY o.created_at DESC
`).all()));

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

  const existing = db.prepare('SELECT id, status, payment_method, payment_status, payment_reference FROM orders WHERE id = ?').get(orderId);
  if (!existing) return s.status(404).json({ error: 'Order not found.' });

  const currentIndex = ORDER_STAGES.indexOf(String(existing.status || '').trim() || 'Order Confirmed');
  const nextIndex = ORDER_STAGES.indexOf(requestedStatus);

  if (nextIndex < currentIndex) {
    return s.status(400).json({ error: 'Order statuses can only move forward.' });
  }

  if (requestedStatus === 'Packed' && existing.payment_method === 'manual_upi' && existing.payment_status !== 'verified') {
    return s.status(400).json({ error: 'Payment must be verified before this order can be packed.' });
  }

  db.prepare('UPDATE orders SET status = ? WHERE id = ?').run(requestedStatus, orderId);
  s.json({ success: true, order_id: orderId, status: requestedStatus });
});

router.post('/orders/:id/verify-manual-payment', async (q, s) => {
  const orderId = Number.parseInt(q.params.id, 10);
  if (!Number.isInteger(orderId) || orderId < 1) {
    return s.status(400).json({ error: 'A valid order ID is required.' });
  }

  const order = db.prepare(`
    SELECT o.id, o.customer_id, o.subtotal, o.order_number, o.payment_method, o.payment_status,
           o.payment_reference, o.total_amount, c.email, c.name
    FROM orders o
    JOIN customers c ON c.id = o.customer_id
    WHERE o.id = ?
  `).get(orderId);
  if (!order) return s.status(404).json({ error: 'Order not found.' });
  if (order.payment_method !== 'manual_upi') {
    return s.status(400).json({ error: 'This order is not a manual UPI order.' });
  }
  if (q.body?.confirmed !== true) {
    return s.status(400).json({ error: 'Confirm that you verified this payment in your UPI or bank app before unlocking packing.' });
  }
  if (order.payment_status === 'verified') {
    const loyalty = processLoyaltyOrder(orderId, order.customer_id);
    return s.json({ success: true, order_id: orderId, payment_status: 'verified', loyalty, message: 'Manual UPI payment was already verified.' });
  }

  const updated = db.prepare(`
    UPDATE orders
    SET payment_status = 'verified',
        payment_verified_at = datetime('now'),
        payment_rejected_at = NULL,
        status = CASE WHEN status = 'Order Confirmed' THEN 'Order Confirmed' ELSE status END
    WHERE id = ?
  `).run(orderId);
  if (updated.changes !== 1) {
    return s.status(409).json({ error: 'The payment could not be verified. Refresh the order and try again.' });
  }

  let loyalty;
  try {
    loyalty = processLoyaltyOrder(orderId, order.customer_id);
  } catch (error) {
    console.error('[LOYALTY_ADMIN_PROCESS_FAILED]', { orderId, message: error.message, name: error.name });
    return s.status(500).json({ error: 'Payment was verified, but the loyalty stamp could not be processed.' });
  }

  if (order.email) {
    const { trySendEmail } = require('../utils/email');
    await trySendEmail({
      to: order.email,
      subject: `Order confirmed — ${order.order_number || `Order ${order.id}`}`,
      text: `Hi ${order.name || 'Customer'},\n\nYour payment has been verified and your Paara Jewellery order is confirmed.\nOrder: ${order.order_number || order.id}\nAmount: ₹${Number(order.total_amount || 0).toLocaleString('en-IN')}\n\nThank you for shopping with Paara Jewellery.`,
    }, `manual UPI confirmation email for order ${order.order_number || order.id}`);
  } else {
    console.error(`[Email failed] manual UPI confirmation email for order ${order.order_number || order.id}`, {
      message: 'Customer email address is missing.',
    });
  }

  s.json({ success: true, order_id: orderId, payment_status: 'verified', loyalty, message: 'Manual UPI payment verified.' });
});

router.post('/orders/:id/reject-manual-payment', async (q, s) => {
  const orderId = Number.parseInt(q.params.id, 10);
  if (!Number.isInteger(orderId) || orderId < 1) {
    return s.status(400).json({ error: 'A valid order ID is required.' });
  }

  const order = db.prepare('SELECT o.id, o.payment_method, o.payment_reference, o.total_amount, c.email, c.name FROM orders o JOIN customers c ON c.id = o.customer_id WHERE o.id = ?').get(orderId);
  if (!order) return s.status(404).json({ error: 'Order not found.' });
  if (order.payment_method !== 'manual_upi') {
    return s.status(400).json({ error: 'This order is not a manual UPI order.' });
  }

  db.prepare(`
    UPDATE orders
    SET payment_status = 'rejected',
        payment_rejected_at = datetime('now'),
        payment_verified_at = NULL,
        status = 'Rejected'
    WHERE id = ?
  `).run(orderId);

  if (order.email) {
    const { trySendEmail } = require('../utils/email');
    await trySendEmail({
      to: order.email,
      subject: `Payment verification update for order ${order.id}`,
      text: `Hi ${order.name || 'Customer'},\n\nWe could not verify the UPI payment reference for your order.\nOrder amount: ₹${Number(order.total_amount || 0).toLocaleString('en-IN')}\nUTR submitted: ${order.payment_reference || 'Not provided'}\n\nPlease contact customer support so we can resolve this quickly and confirm your order.`,
    }, `manual UPI rejection email for order ${order.id}`);
  }

  s.json({ success: true, order_id: orderId, payment_status: 'rejected', status: 'Rejected', message: 'Manual UPI payment rejected for follow-up.' });
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
module.exports.normalizeFormBoolean = normalizeFormBoolean;
