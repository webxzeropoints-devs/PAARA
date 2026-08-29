require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const rateLimit = require('express-rate-limit');
const multer = require('multer');
const db = require('./db/database');

const productsRouter = require('./routes/products');
const vaultRouter = require('./routes/vault');
const shippingRouter = require('./routes/shipping');
const ordersRouter = require('./routes/orders');
const paymentRouter = require('./routes/payment');
const authRouter = require('./routes/auth');
const addressesRouter = require('./routes/addresses');
const phoneAuthRouter = require('./routes/phoneAuth');
const emailAuthRouter = require('./routes/emailAuth');
const wishlistRouter = require('./routes/wishlist');
const adminRouter = require('./routes/admin');
const adminAuthRouter = require('./routes/adminAuth');
const couponsRouter = require('./routes/coupons');
const homepageRouter = require('./routes/homepage');

const app = express();

const productColumns = db.prepare("PRAGMA table_info(products)").all().map((column) => column.name);
if (productColumns.length && !productColumns.includes('subcategory')) {
  db.exec('ALTER TABLE products ADD COLUMN subcategory TEXT');
}
if (productColumns.length && !productColumns.includes('is_vault')) {
  db.exec('ALTER TABLE products ADD COLUMN is_vault INTEGER NOT NULL DEFAULT 0');
}
if (productColumns.length && !productColumns.includes('is_bestseller')) {
  db.exec('ALTER TABLE products ADD COLUMN is_bestseller INTEGER NOT NULL DEFAULT 0');
}
db.exec(`CREATE TABLE IF NOT EXISTS vault_products (
  product_id INTEGER PRIMARY KEY REFERENCES products(id) ON DELETE CASCADE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
)`);
const paaraIrlColumns = db.prepare("PRAGMA table_info(paara_irl)").all().map((column) => column.name);
if (paaraIrlColumns.length && !paaraIrlColumns.includes('owner_image_url')) {
  db.exec('ALTER TABLE paara_irl ADD COLUMN owner_image_url TEXT');
}
if (paaraIrlColumns.length && !paaraIrlColumns.includes('updated_at')) {
  db.exec("ALTER TABLE paara_irl ADD COLUMN updated_at TEXT NOT NULL DEFAULT (datetime('now'))");
}
const couponColumns = db.prepare("PRAGMA table_info(coupons)").all().map((column) => column.name);
if (couponColumns.length && !couponColumns.includes('redeemed_at')) {
  db.exec('ALTER TABLE coupons ADD COLUMN redeemed_at TEXT');
}
const customerColumns = db.prepare("PRAGMA table_info(customers)").all().map((column) => column.name);
if (customerColumns.length && !customerColumns.includes('gift_card_balance')) {
  db.exec('ALTER TABLE customers ADD COLUMN gift_card_balance REAL NOT NULL DEFAULT 1500');
}
const orderColumns = db.prepare("PRAGMA table_info(orders)").all().map((column) => column.name);
if (orderColumns.length && !orderColumns.includes('gift_card_eligible_amount')) {
  db.exec('ALTER TABLE orders ADD COLUMN gift_card_eligible_amount REAL');
}
if (orderColumns.length && !orderColumns.includes('gift_card_granted_at')) {
  db.exec('ALTER TABLE orders ADD COLUMN gift_card_granted_at TEXT');
}
if (orderColumns.length && !orderColumns.includes('gift_card_granted_by')) {
  db.exec('ALTER TABLE orders ADD COLUMN gift_card_granted_by INTEGER REFERENCES admins(id)');
}
db.exec(`CREATE TABLE IF NOT EXISTS gift_card_rules (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id INTEGER NOT NULL UNIQUE REFERENCES products(id) ON DELETE CASCADE,
  gift_card_value REAL NOT NULL CHECK (gift_card_value > 0),
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
)`);
db.exec(`CREATE TABLE IF NOT EXISTS email_otps (
  id INTEGER PRIMARY KEY AUTOINCREMENT, email TEXT NOT NULL, code TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')), expires_at TEXT NOT NULL,
  verified INTEGER NOT NULL DEFAULT 0
)`);
db.exec(`CREATE TABLE IF NOT EXISTS customer_order_details (
  id INTEGER PRIMARY KEY AUTOINCREMENT, order_id INTEGER NOT NULL UNIQUE REFERENCES orders(id) ON DELETE CASCADE,
  customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE, full_name TEXT NOT NULL,
  email TEXT NOT NULL, phone TEXT, shipping_line1 TEXT NOT NULL, shipping_line2 TEXT,
  shipping_city TEXT NOT NULL, shipping_state TEXT NOT NULL, shipping_pincode TEXT NOT NULL,
  shipping_country TEXT NOT NULL DEFAULT 'India', billing_details TEXT,
  submitted_fields TEXT NOT NULL DEFAULT '{}', created_at TEXT NOT NULL DEFAULT (datetime('now'))
)`);

// Allowed origins: always includes local dev ports, plus any extra origins
// supplied via the ALLOWED_ORIGINS env var (comma-separated), e.g.
// ALLOWED_ORIGINS=https://paara.vercel.app,https://www.paara.com
const defaultOrigins = ['http://localhost:5173', 'http://localhost:3000'];
const extraOrigins = (process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);
const allowedOrigins = [...defaultOrigins, ...extraOrigins];

app.use(cors({
  origin: allowedOrigins,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-admin-key'],
}));

// The webhook route needs the RAW request body to verify Razorpay's signature,
// so it's mounted BEFORE express.json() with its own raw parser.
app.use('/api/payment/webhook', express.raw({ type: 'application/json' }));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Serve uploaded product images (previously written to disk by routes/admin.js
// but never exposed over HTTP — fixed here so /uploads/products/<file> resolves).
// Matches UPLOADS_DIR used in routes/admin.js so this points at the same folder.
const uploadsRoot = process.env.UPLOADS_DIR || path.join(__dirname, 'public', 'uploads');
app.use('/uploads', express.static(uploadsRoot));

// Multer setup for file uploads (in-memory storage for temporary processing)
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB max per file
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  }
});

// Attach multer to request for admin routes
app.use('/api/admin', upload.array('images', 3));

const otpLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 5, standardHeaders: true, legacyHeaders: false });
app.use('/api/auth/phone', otpLimiter);

// Tighter limit on admin login + OTP verify — same window as the customer
// phone-OTP limiter, slightly more headroom since admins may retry a few
// times during the dashboard 2-step flow.
const adminLoginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 10, standardHeaders: true, legacyHeaders: false });
app.use('/api/admin-auth/login', adminLoginLimiter);
app.use('/api/admin-auth/verify-otp', adminLoginLimiter);

app.use('/api/auth', authRouter);
app.use('/api/auth/phone', phoneAuthRouter);
app.use('/api/auth/email', emailAuthRouter);
app.use('/api/addresses', addressesRouter);
app.use('/api/wishlist', wishlistRouter);
app.use('/api/admin', adminRouter);
app.use('/api/admin-auth', adminAuthRouter);
app.use('/api/coupons', couponsRouter);
app.use('/api/homepage', homepageRouter);
app.use('/api/products', productsRouter);
app.use('/api/vault', vaultRouter);
app.use('/api/shipping', shippingRouter);
app.use('/api/orders', ordersRouter);
app.use('/api/payment', paymentRouter);

app.get('/api/health', (req, res) => res.json({ ok: true }));
app.get('/', (req, res) => res.json({ ok: true, service: 'paara-backend' }));

// Central error handler
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Something went wrong.' });
});

const PORT = process.env.PORT || 4000;
const server = app.listen(PORT, () => console.log(`Paara backend running on http://localhost:${PORT}`));

server.on('error', (e) => {
  if (e.code === 'EADDRINUSE') {
    console.error(`Port ${PORT} is already in use. Stop the process using that port, then restart Paara.`);
    process.exitCode = 1;
  } else {
    console.error('Server error:', e);
    process.exitCode = 1;
  }
});

let shuttingDown = false;
const gracefulShutdown = () => {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log('Received kill signal, shutting down gracefully.');
  const forceTimer = setTimeout(() => {
    console.error('Could not close connections in time, forcefully shutting down');
    try { db.close(); } catch { /* already closed */ }
    process.exit(1);
  }, 10000);
  forceTimer.unref();
  server.close(() => {
    console.log('Closed out remaining connections.');
    console.log('Closing database connection...');
    try { db.close(); } catch { /* already closed */ }
    clearTimeout(forceTimer);
    process.exit(0);
  });
};

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
  gracefulShutdown();
});
