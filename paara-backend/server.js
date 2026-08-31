require('dotenv').config();
const REQUIRED_ENV_VARS = ['JWT_SECRET', 'ADMIN_API_KEY'];
const missingEnvVars = REQUIRED_ENV_VARS.filter((key) => !process.env[key]);
if (missingEnvVars.length > 0) {
  console.error(`\n[STARTUP ERROR] Missing required environment variables: ${missingEnvVars.join(', ')}`);
  console.error('Copy .env.example to .env and fill in these values before starting the server.\n');
  process.exit(1);
}

const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const multer = require('multer');
const db = require('./db/database');
const { maskSensitiveText } = require('./utils/validate');

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

const allowedOrigins = [
  'https://paarajewellery.in',
  'https://www.paarajewellery.in',
  'http://localhost:5173',
  'http://localhost:4000'
];

app.use(cors({
  origin: function(origin, callback) {
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-admin-key']
}));

app.options('*', cors({
  origin: function(origin, callback) {
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-admin-key']
}));

// Both Vercel and Render sit behind a reverse proxy that sets X-Forwarded-For.
// Without this, express-rate-limit can't safely derive client IPs and throws
// ERR_ERL_FORWARDED_HEADER on every rate-limited route.
app.set('trust proxy', 1);

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
if (productColumns.length && !productColumns.includes('vault_sort_order')) {
  db.exec('ALTER TABLE products ADD COLUMN vault_sort_order INTEGER NOT NULL DEFAULT 0');
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
  verified INTEGER NOT NULL DEFAULT 0, attempts INTEGER NOT NULL DEFAULT 0
)`);
const emailOtpColumns = db.prepare("PRAGMA table_info(email_otps)").all().map((column) => column.name);
if (emailOtpColumns.length && !emailOtpColumns.includes('attempts')) {
  db.exec('ALTER TABLE email_otps ADD COLUMN attempts INTEGER NOT NULL DEFAULT 0');
}
db.exec(`CREATE TABLE IF NOT EXISTS customer_order_details (
  id INTEGER PRIMARY KEY AUTOINCREMENT, order_id INTEGER NOT NULL UNIQUE REFERENCES orders(id) ON DELETE CASCADE,
  customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE, full_name TEXT NOT NULL,
  email TEXT NOT NULL, phone TEXT, shipping_line1 TEXT NOT NULL, shipping_line2 TEXT,
  shipping_city TEXT NOT NULL, shipping_state TEXT NOT NULL, shipping_pincode TEXT NOT NULL,
  shipping_country TEXT NOT NULL DEFAULT 'India', billing_details TEXT,
  submitted_fields TEXT NOT NULL DEFAULT '{}', created_at TEXT NOT NULL DEFAULT (datetime('now'))
)`);

const adminColumns = db.prepare("PRAGMA table_info(admins)").all().map((column) => column.name);
if (adminColumns.length && !adminColumns.includes('must_change_password')) {
  db.exec('ALTER TABLE admins ADD COLUMN must_change_password INTEGER NOT NULL DEFAULT 1');
}
const adminCount = db.prepare('SELECT COUNT(*) as c FROM admins').get().c;
if (adminCount === 0) {
  const bcrypt = require('bcryptjs');
  const tempHash = bcrypt.hashSync('Paara@123', 10);
  db.prepare(`
    INSERT INTO admins (name, email, password_hash, must_change_password)
    VALUES (?, ?, ?, 1)
  `).run('Admin', 'paara@gmail.com', tempHash);
  console.log('[ADMIN SAFETY NET] No admin account found after DB init; created temporary admin requiring password change.');
}

db.exec(`CREATE TABLE IF NOT EXISTS password_reset_otps (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL,
  code TEXT NOT NULL,
  user_type TEXT NOT NULL CHECK (user_type IN ('customer','admin')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at TEXT NOT NULL,
  used INTEGER NOT NULL DEFAULT 0,
  attempts INTEGER NOT NULL DEFAULT 0
)`);
const passwordResetOtpColumns = db.prepare("PRAGMA table_info(password_reset_otps)").all().map((column) => column.name);
if (passwordResetOtpColumns.length && !passwordResetOtpColumns.includes('attempts')) {
  db.exec('ALTER TABLE password_reset_otps ADD COLUMN attempts INTEGER NOT NULL DEFAULT 0');
}
const phoneOtpColumns = db.prepare("PRAGMA table_info(phone_otps)").all().map((column) => column.name);
if (phoneOtpColumns.length && !phoneOtpColumns.includes('attempts')) {
  db.exec('ALTER TABLE phone_otps ADD COLUMN attempts INTEGER NOT NULL DEFAULT 0');
}

// loading before handling any request, and persist writes back to Blob
// storage before successful write responses are sent.
if (db.isServerless) {
  app.use((req, res, next) => {
    const originalJson = res.json.bind(res);
    const originalSend = res.send.bind(res);
    const originalEnd = res.end.bind(res);
    let persistPromise = null;
    const respondPersistFailure = (err) => {
      console.error('[DB_PERSIST] Response blocked because persistence failed.', {
        method: req.method,
        path: req.path,
        error: err.message,
        errorName: err.name,
        errorCode: err.code,
        headersSent: res.headersSent,
      });
      if (!res.headersSent) {
        res.statusCode = 503;
        res.setHeader('Content-Type', 'application/json');
        originalEnd(JSON.stringify({ ok: false, code: 'PERSISTENCE_UNAVAILABLE', message: 'Database is temporarily unavailable. Please try again.' }));
      }
    };

    const persistBeforeResponse = () => {
      const isReadOnlyAdminLogin = req.method === 'POST' && req.path === '/api/admin-auth/login';
      if (req.method === 'GET' || isReadOnlyAdminLogin || res.statusCode >= 400) return Promise.resolve();
      if (!persistPromise) {
        console.log('[DB_PERSIST] Request requires persistence.', { method: req.method, path: req.path });
        persistPromise = db.persist();
      }
      return persistPromise;
    };

    res.json = (body) => {
      persistBeforeResponse()
        .then(() => originalJson(body))
        .catch(respondPersistFailure);
      return res;
    };
    res.send = (body) => {
      persistBeforeResponse()
        .then(() => originalSend(body))
        .catch(respondPersistFailure);
      return res;
    };
    res.end = (...args) => {
      persistBeforeResponse()
        .then(() => originalEnd(...args))
        .catch(respondPersistFailure);
      return res;
    };

    next();
  });
}

// The webhook route needs the RAW request body to verify Razorpay's signature,
// so it's mounted BEFORE express.json() with its own raw parser.
app.use('/api/payment/webhook', express.raw({ type: 'application/json' }));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

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

// Central error handler
app.use((err, req, res, next) => {
  console.error('[REQUEST_ERROR]', { message: maskSensitiveText(err.message), name: err.name, method: req.method, path: req.path });
  res.status(500).json({ ok: false, code: 'INTERNAL_ERROR', message: 'Something went wrong. Please try again.' });
});

if (db.isServerless) {
  // Vercel calls this exported handler per-request; no app.listen here.
  module.exports = app;
} else {
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
    console.error('Uncaught Exception:', { message: maskSensitiveText(err.message), name: err.name });
    gracefulShutdown();
  });
}
