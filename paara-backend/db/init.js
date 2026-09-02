// Run once with: npm run init-db
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const db = require('./database');

const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
db.exec(schema);
const productColumns = db.prepare("PRAGMA table_info(products)").all().map((column) => column.name);
const addProductColumn = (name, definition) => {
  if (!productColumns.includes(name)) db.exec(`ALTER TABLE products ADD COLUMN ${definition}`);
};
addProductColumn('subcategory', 'subcategory TEXT');
addProductColumn('is_vault', 'is_vault INTEGER NOT NULL DEFAULT 0');
addProductColumn('is_bestseller', 'is_bestseller INTEGER NOT NULL DEFAULT 0');
addProductColumn('images_json', "images_json TEXT NOT NULL DEFAULT '[]'");
addProductColumn('weight_kg', 'weight_kg REAL NOT NULL DEFAULT 0.1');
const couponColumns = db.prepare("PRAGMA table_info(coupons)").all().map((column) => column.name);
if (!couponColumns.includes('redeemed_at')) db.exec('ALTER TABLE coupons ADD COLUMN redeemed_at TEXT');
const customerColumns = db.prepare("PRAGMA table_info(customers)").all().map((column) => column.name);
if (!customerColumns.includes('gift_card_balance')) db.exec('ALTER TABLE customers ADD COLUMN gift_card_balance REAL NOT NULL DEFAULT 1500');
const orderColumns = db.prepare("PRAGMA table_info(orders)").all().map((column) => column.name);
if (!orderColumns.includes('order_number')) db.exec('ALTER TABLE orders ADD COLUMN order_number TEXT');
if (!orderColumns.includes('gift_card_eligible_amount')) db.exec('ALTER TABLE orders ADD COLUMN gift_card_eligible_amount REAL');
if (!orderColumns.includes('gift_card_granted_at')) db.exec('ALTER TABLE orders ADD COLUMN gift_card_granted_at TEXT');
if (!orderColumns.includes('gift_card_granted_by')) db.exec('ALTER TABLE orders ADD COLUMN gift_card_granted_by INTEGER REFERENCES admins(id)');
if (!orderColumns.includes('payment_method')) db.exec('ALTER TABLE orders ADD COLUMN payment_method TEXT NOT NULL DEFAULT "razorpay"');
const { formatOrderNumber } = require('../utils/orderNumber');
const missingOrderNumbers = db.prepare("SELECT id, created_at FROM orders WHERE order_number IS NULL OR order_number = ''").all();
const setOrderNumber = db.prepare('UPDATE orders SET order_number = ? WHERE id = ?');
missingOrderNumbers.forEach((order) => setOrderNumber.run(formatOrderNumber(order.created_at, order.id), order.id));
console.log('✔ Schema created.');

// SQLite's datetime comparisons expect its standard space-separated format.
// Normalize any records written by earlier seed versions that used ISO strings.
db.prepare("UPDATE products SET release_date = datetime(release_date) WHERE release_date LIKE '%T%'").run();

// ---- Seed: 10 named cities with flat shipping rates ----
const cities = [
  ['Chennai', 70],
  ['Bengaluru', 110],
  ['Hyderabad', 110],
  ['Mumbai', 130],
  ['Delhi', 130],
  ['Kolkata', 130],
  ['Pune', 110],
  ['Coimbatore', 80],
  ['Kochi', 110],
  ['Ahmedabad', 130]
];
const insertCity = db.prepare('INSERT OR IGNORE INTO cities (name, flat_shipping_rate) VALUES (?, ?)');
cities.forEach(c => insertCity.run(...c));
console.log(`✔ Seeded ${cities.length} cities. Edit db/init.js to set your real per-city rates.`);

// ---- Seed: sample categories ----
const categories = [
  ['Rings — Men', 'rings-men', 'men', 'everyday', 'silver'],
  ['Chains — Men', 'chains-men', 'men', 'statement', 'gold'],
  ['Necklaces — Women', 'necklaces-women', 'women', 'bridal', 'gold'],
  ['Earrings — Women', 'earrings-women', 'women', 'minimal', 'silver']
];
const insertCategory = db.prepare(
  'INSERT OR IGNORE INTO categories (name, slug, gender, vibe, material) VALUES (?, ?, ?, ?, ?)'
);
categories.forEach(c => insertCategory.run(...c));
console.log(`✔ Seeded ${categories.length} sample categories.`);

const insertTile = db.prepare(`
  INSERT OR IGNORE INTO collection_tiles (tile_key, label, subtitle, image_url, link_path)
  VALUES (?, ?, ?, ?, ?)
`);
insertTile.run('pearls', 'Pearls', 'Timeless pieces with a softly luminous heart.', '/images/products/180284791331464120.jpg', '/collections?category=pearls');
insertTile.run('gold', 'Gold', 'Warm everyday glow, made for layering.', '/images/products/25332816647584589.jpg', '/collections?category=gold');
insertTile.run('ocean', 'Ocean', 'Tiny keepsakes shaped by salt, sand and sun.', '/images/products/%E2%98%86%E2%98%85.jpg', '/collections?category=ocean');
console.log('✔ Seeded 3 homepage collection tiles.');

// ---- Seed one product for every real frontend product image ----
const productsRoot = path.resolve(__dirname, '..', '..', 'public', 'images', 'products');
const imageFiles = [];
const collectImageFiles = (directory) => {
  fs.readdirSync(directory, { withFileTypes: true }).forEach((entry) => {
    const absolutePath = path.join(directory, entry.name);
    if (entry.isDirectory()) collectImageFiles(absolutePath);
    else if (/\.(avif|jpe?g|png|webp)$/i.test(entry.name)) {
      imageFiles.push(path.relative(productsRoot, absolutePath).split(path.sep).join('/'));
    }
  });
};
collectImageFiles(productsRoot);
imageFiles.sort((a, b) => a.localeCompare(b));

const categoryIds = Object.fromEntries(
  db.prepare('SELECT id, slug FROM categories').all().map((category) => [category.slug, category.id])
);
const categoryForImage = (imagePath) => {
  if (imagePath.startsWith('men/')) return categoryIds['chains-men'];
  if (imagePath.startsWith('women/')) return categoryIds['necklaces-women'];
  return categoryIds['earrings-women'];
};
const materialForImage = (imagePath) => imagePath.startsWith('men/') ? 'stainless steel' : 'gold plated';
const titleFromImagePath = (imagePath) => {
  const stem = path.basename(imagePath, path.extname(imagePath))
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/([\p{L}])(\d)/gu, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const type = imagePath.startsWith('men/')
    ? 'Men Chain'
    : imagePath.startsWith('women/')
      ? 'Women Necklace'
      : 'Earrings';
  const words = stem ? stem.split(' ') : [];
  const title = words.map((word) => /^\d+$/.test(word) ? word : `${word.charAt(0).toUpperCase()}${word.slice(1).toLowerCase()}`).join(' ');
  return title && /\p{L}/u.test(title) ? title : `${type}${title ? ` ${title}` : ''}`;
};
const slugFromImagePath = (imagePath) => {
  const slug = imagePath
    .replace(/\.[^.]+$/, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();
  return slug || 'product';
};
const usedPrices = new Set();
const nextPrice = () => {
  let price;
  do price = Math.floor(Math.random() * 451) + 50;
  while (usedPrices.has(price));
  usedPrices.add(price);
  return price;
};
const insertProduct = db.prepare(`
  INSERT INTO products
    (category_id, name, slug, description, price, material, stock, is_exclusive, release_date)
  VALUES (@category_id, @name, @slug, @description, @price, @material, @stock, @is_exclusive, @release_date)
  ON CONFLICT(slug) DO UPDATE SET
    category_id = excluded.category_id,
    name = excluded.name,
    description = excluded.description,
    price = excluded.price,
    material = excluded.material,
    stock = excluded.stock,
    is_exclusive = excluded.is_exclusive,
    release_date = excluded.release_date
`);
const insertImage = db.prepare(`
  INSERT INTO product_images (product_id, image_url, sort_order, is_primary)
  VALUES (?, ?, 0, 1)
`);
const productBySlug = db.prepare('SELECT id FROM products WHERE slug = ?');
const primaryImageByProduct = db.prepare(
  'SELECT id FROM product_images WHERE product_id = ? ORDER BY is_primary DESC, sort_order ASC, id ASC LIMIT 1'
);
const secondaryImageByProduct = db.prepare(
  'SELECT id FROM product_images WHERE product_id = ? AND is_primary = 0 ORDER BY sort_order ASC, id ASC LIMIT 1'
);
const updateImage = db.prepare(
  'UPDATE product_images SET image_url = ?, sort_order = 0, is_primary = 1 WHERE id = ?'
);
const insertSecondaryImage = db.prepare(
  'INSERT INTO product_images (product_id, image_url, sort_order, is_primary) VALUES (?, ?, 1, 0)'
);
const updateSecondaryImage = db.prepare(
  'UPDATE product_images SET image_url = ?, sort_order = 1, is_primary = 0 WHERE id = ?'
);
const releaseDate = new Date().toISOString().replace('T', ' ').replace(/\.\d{3}Z$/, '');
const seededImagePaths = new Set();
const addProduct = ({ name, slug, imagePath, categoryId, material, description }) => {
  insertProduct.run({
    category_id: categoryId,
    name,
    slug,
    description,
    price: nextPrice(),
    material,
    stock: 10,
    is_exclusive: 0,
    release_date: releaseDate,
  });
  const productId = productBySlug.get(slug).id;
  const imageUrl = `/images/products/${imagePath}`;
  const existingImage = primaryImageByProduct.get(productId);
  if (existingImage) updateImage.run(imageUrl, existingImage.id);
  else insertImage.run(productId, imageUrl);
  const secondaryPath = imageFiles[(imageFiles.indexOf(imagePath) + 1) % imageFiles.length];
  const existingSecondaryImage = secondaryImageByProduct.get(productId);
  if (existingSecondaryImage) updateSecondaryImage.run(`/images/products/${secondaryPath}`, existingSecondaryImage.id);
  else insertSecondaryImage.run(productId, `/images/products/${secondaryPath}`);
  seededImagePaths.add(imagePath);
};

// Preserve the two original seeded products, fixing their price, release date, and missing image rows.
addProduct({
  name: 'Sandline Chain',
  slug: 'sandline-chain',
  imagePath: 'men/chain1.jpg',
  categoryId: categoryIds['chains-men'],
  material: 'stainless steel',
  description: 'A minimal chain for everyday wear.',
});
addProduct({
  name: 'Pearl Tide Necklace',
  slug: 'pearl-tide-necklace',
  imagePath: 'women/chain1.jpg',
  categoryId: categoryIds['necklaces-women'],
  material: 'gold plated',
  description: 'A delicate necklace with a luminous coastal feel.',
});

imageFiles.filter((imagePath) => !seededImagePaths.has(imagePath)).forEach((imagePath) => {
  const name = titleFromImagePath(imagePath);
  addProduct({
    name,
    slug: slugFromImagePath(imagePath),
    imagePath,
    categoryId: categoryForImage(imagePath),
    material: materialForImage(imagePath),
    description: `${name} from the Paara collection.`,
  });
});

console.log(`✔ Seeded ${imageFiles.length} products with primary images. Done.`);

// ---- Seed: placeholder admin (paara@gmail.com / Paara@123) ----
const defaultEmail = 'paara@gmail.com';
const defaultPasswordHash = bcrypt.hashSync('Paara@123', 10);
const existingAdmin = db.prepare('SELECT id, email FROM admins WHERE lower(email) = ?').get(defaultEmail.toLowerCase());
if (existingAdmin) {
  db.prepare('UPDATE admins SET name = ?, email = ?, password_hash = ?, must_change_password = 1 WHERE id = ?')
    .run('Paara Admin', defaultEmail, defaultPasswordHash, existingAdmin.id);
} else {
  const firstAdmin = db.prepare('SELECT id FROM admins ORDER BY id LIMIT 1').get();
  if (firstAdmin) {
    db.prepare('UPDATE admins SET name = ?, email = ?, password_hash = ?, must_change_password = 1 WHERE id = ?')
      .run('Paara Admin', defaultEmail, defaultPasswordHash, firstAdmin.id);
  } else {
    db.prepare(`
      INSERT INTO admins (name, email, password_hash, must_change_password)
      VALUES (?, ?, ?, ?)
    `).run('Paara Admin', defaultEmail, defaultPasswordHash, 1);
  }
}
console.log('✔ Seeded default admin with the dashboard login account and forced password change enabled.');


