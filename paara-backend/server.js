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
const path = require('path');
const db = require('./db/database');
const { maskSensitiveText } = require('./utils/validate');
const { formatOrderNumber } = require('./utils/orderNumber');

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

const normalizeOrigin = (origin) => {
  if (!origin) return null;

  try {
    const parsed = new URL(origin);
    return parsed.origin;
  } catch (error) {
    return null;
  }
};

const buildAllowedOrigins = () => {
  const configuredOrigins = (process.env.FRONTEND_URL || '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);

  const defaultOrigins = [
    'https://paara.vercel.app',
    'https://paarajewellery.in',
    'https://www.paarajewellery.in',
    'http://localhost:3000',
    'http://localhost:4000',
    'http://localhost:5173',
    'http://127.0.0.1:3000',
    'http://127.0.0.1:5173'
  ];

  return [...new Set([...configuredOrigins, ...defaultOrigins])];
};

const isAllowedOrigin = (origin) => {
  if (!origin) return true;

  const normalizedOrigin = normalizeOrigin(origin);
  if (!normalizedOrigin) return false;

  const allowedOrigins = buildAllowedOrigins();
  if (allowedOrigins.includes(normalizedOrigin)) return true;

  const hostname = new URL(normalizedOrigin).hostname.toLowerCase();
  const isLocalhost = ['localhost', '127.0.0.1', '::1'].includes(hostname) || hostname.endsWith('.localhost');
  const isVercelPreview = hostname.endsWith('.vercel.app') || hostname === 'vercel.app';

  return isLocalhost || isVercelPreview;
};

const corsOptions = {
  origin(origin, callback) {
    if (isAllowedOrigin(origin)) {
      return callback(null, origin || true);
    }
    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-admin-key', 'X-Requested-With'],
  exposedHeaders: ['Content-Length', 'Content-Type'],
  optionsSuccessStatus: 204
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));

// Serve the shared public assets used by the storefront and local upload files.
app.use('/images', express.static(path.join(__dirname, '..', 'public', 'images')));
app.get('/images/blob/*', async (req, res) => {
  try {
    const pathname = decodeURIComponent(req.params[0] || '');
    if (!pathname || pathname.includes('..')) return res.status(404).end();
    const { get } = require('@vercel/blob');
    const token = String(process.env.BLOB_READ_WRITE_TOKEN || '').trim();
    const storeId = String(process.env.BLOB_STORE_ID || '').trim();
    const blob = await get(pathname, { access: 'private', ...(token ? { token } : { storeId }) });
    if (!blob) return res.status(404).end();
    res.set('Content-Type', blob.blob.contentType || 'application/octet-stream');
    const reader = blob.stream.getReader();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      res.write(Buffer.from(value));
    }
    res.end();
  } catch (error) {
    console.error('Private image delivery failed:', error);
    res.status(404).end();
  }
});
app.use('/uploads', express.static(path.join(__dirname, 'public', 'uploads')));
app.use('/assets', express.static(path.join(__dirname, '..', 'public', 'assets')));
app.use(express.static(path.join(__dirname, '..', 'public')));

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
if (productColumns.length && !productColumns.includes('weight_kg')) {
  db.exec('ALTER TABLE products ADD COLUMN weight_kg REAL NOT NULL DEFAULT 0.1');
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
  db.exec('ALTER TABLE paara_irl ADD COLUMN updated_at TEXT');
  db.exec("UPDATE paara_irl SET updated_at = datetime('now') WHERE updated_at IS NULL OR updated_at = ''");
}
if (paaraIrlColumns.length) {
  const paaraIrlCount = db.prepare('SELECT COUNT(*) AS count FROM paara_irl WHERE sort_order BETWEEN 0 AND 2').get().count;
  const addPaaraIrlSlot = db.prepare(`
    INSERT INTO paara_irl (image_url, owner_image_url, caption, sort_order, is_active, created_at, updated_at)
    VALUES ('', NULL, NULL, ?, 1, datetime('now'), datetime('now'))
  `);
  for (let slot = paaraIrlCount; slot < 3; slot += 1) addPaaraIrlSlot.run(slot);
}
const couponColumns = db.prepare("PRAGMA table_info(coupons)").all().map((column) => column.name);
if (couponColumns.length && !couponColumns.includes('redeemed_at')) {
  db.exec('ALTER TABLE coupons ADD COLUMN redeemed_at TEXT');
}
const instagramReviewColumns = db.prepare("PRAGMA table_info(instagram_reviews)").all().map((column) => column.name);
if (instagramReviewColumns.length && !instagramReviewColumns.includes('sort_order')) {
  db.exec('ALTER TABLE instagram_reviews ADD COLUMN sort_order INTEGER NOT NULL DEFAULT 0');
  db.exec(`
    UPDATE instagram_reviews
    SET sort_order = (
      SELECT COUNT(*) - 1
      FROM instagram_reviews earlier
      WHERE earlier.product_id IS NULL
        AND earlier.id <= instagram_reviews.id
    )
    WHERE product_id IS NULL
  `);
}
if (instagramReviewColumns.length && !instagramReviewColumns.includes('updated_at')) {
  db.exec('ALTER TABLE instagram_reviews ADD COLUMN updated_at TEXT');
  db.exec("UPDATE instagram_reviews SET updated_at = datetime('now') WHERE updated_at IS NULL OR updated_at = ''");
}
const customerColumns = db.prepare("PRAGMA table_info(customers)").all().map((column) => column.name);
if (customerColumns.length && !customerColumns.includes('gift_card_balance')) {
  db.exec('ALTER TABLE customers ADD COLUMN gift_card_balance REAL NOT NULL DEFAULT 1500');
}
const hasOrdersTable = db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'orders'").get();
if (!hasOrdersTable) {
  db.exec(`
    CREATE TABLE orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_number TEXT UNIQUE,
      customer_id INTEGER NOT NULL,
      address_id INTEGER NOT NULL,
      subtotal REAL NOT NULL,
      gst_amount REAL NOT NULL,
      shipping_amount REAL NOT NULL,
      total_amount REAL NOT NULL,
      status TEXT NOT NULL DEFAULT 'Order Confirmed',
      payment_status TEXT NOT NULL DEFAULT 'unpaid',
      payment_method TEXT NOT NULL DEFAULT 'razorpay',
      razorpay_order_id TEXT,
      razorpay_payment_id TEXT,
      payment_reference TEXT,
      payment_verified_at TEXT,
      payment_rejected_at TEXT,
      gift_card_eligible_amount REAL,
      gift_card_granted_at TEXT,
      gift_card_granted_by INTEGER,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);
}
const orderColumns = db.prepare("PRAGMA table_info(orders)").all().map((column) => column.name);
if (orderColumns.length && !orderColumns.includes('order_number')) {
  db.exec('ALTER TABLE orders ADD COLUMN order_number TEXT');
}
if (orderColumns.length && !orderColumns.includes('gift_card_eligible_amount')) {
  db.exec('ALTER TABLE orders ADD COLUMN gift_card_eligible_amount REAL');
}
if (orderColumns.length && !orderColumns.includes('gift_card_granted_at')) {
  db.exec('ALTER TABLE orders ADD COLUMN gift_card_granted_at TEXT');
}
if (orderColumns.length && !orderColumns.includes('gift_card_granted_by')) {
  db.exec('ALTER TABLE orders ADD COLUMN gift_card_granted_by INTEGER REFERENCES admins(id)');
}
if (orderColumns.length && !orderColumns.includes('status')) {
  db.exec('ALTER TABLE orders ADD COLUMN status TEXT NOT NULL DEFAULT "Order Confirmed"');
}
if (orderColumns.length && !orderColumns.includes('payment_method')) {
  db.exec('ALTER TABLE orders ADD COLUMN payment_method TEXT NOT NULL DEFAULT "razorpay"');
}
if (orderColumns.length && !orderColumns.includes('payment_reference')) {
  db.exec('ALTER TABLE orders ADD COLUMN payment_reference TEXT');
}
if (orderColumns.length && !orderColumns.includes('payment_verified_at')) {
  db.exec('ALTER TABLE orders ADD COLUMN payment_verified_at TEXT');
}
if (orderColumns.length && !orderColumns.includes('payment_rejected_at')) {
  db.exec('ALTER TABLE orders ADD COLUMN payment_rejected_at TEXT');
}
db.prepare("SELECT id, created_at FROM orders WHERE order_number IS NULL OR order_number = ''").all()
  .forEach((order) => db.prepare('UPDATE orders SET order_number = ? WHERE id = ?').run(formatOrderNumber(order.created_at, order.id), order.id));
db.exec(`
  UPDATE orders
  SET status = CASE
    WHEN status IS NULL OR status = '' THEN 'Order Confirmed'
    WHEN status = 'pending' THEN 'Order Confirmed'
    WHEN status = 'paid' THEN 'Order Confirmed'
    WHEN status = 'failed' THEN 'Order Confirmed'
    WHEN status = 'cancelled' THEN 'Order Confirmed'
    WHEN status = 'shipped' THEN 'Shipped'
    WHEN status = 'delivered' THEN 'Delivered'
    ELSE status
  END
  WHERE status IS NOT NULL
`);
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

const ensureHomepageDefaults = () => {
  db.prepare(`
    INSERT OR IGNORE INTO paara_irl (id, image_url, owner_image_url, caption, sort_order, is_active, created_at, updated_at)
    VALUES (1, '', NULL, NULL, 0, 1, datetime('now'), datetime('now'))
  `).run();

  [1, 2, 3].forEach((slotId) => {
    db.prepare(`
      INSERT OR IGNORE INTO instagram_reviews (
        id, product_id, instagram_post_url, image_url, caption, likes, cached_at
      ) VALUES (?, NULL, '', '', '', 0, datetime('now'))
    `).run(slotId);
  });
};

ensureHomepageDefaults();

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
const ensureDefaultAdmin = () => {
  const bcrypt = require('bcryptjs');
  const defaultEmail = 'paara@gmail.com';
  const defaultName = 'Paara Admin';
  const defaultHash = bcrypt.hashSync('Paara@123', 10);
  const existingDefault = db.prepare('SELECT id, email, password_hash, must_change_password FROM admins WHERE lower(email) = ?').get(defaultEmail.toLowerCase());

  if (existingDefault) {
    const needsReset = existingDefault.email.toLowerCase() !== defaultEmail.toLowerCase()
      || existingDefault.password_hash !== defaultHash
      || Number(existingDefault.must_change_password) !== 1;

    if (needsReset) {
      db.prepare('UPDATE admins SET email = ?, password_hash = ?, must_change_password = 1 WHERE id = ?')
        .run(defaultEmail, defaultHash, existingDefault.id);
      console.log('[ADMIN SAFETY NET] Normalized the default admin record to the dashboard login account.');
    }
    return;
  }

  const firstAdmin = db.prepare('SELECT id FROM admins ORDER BY id LIMIT 1').get();
  if (firstAdmin) {
    db.prepare('UPDATE admins SET name = ?, email = ?, password_hash = ?, must_change_password = 1 WHERE id = ?')
      .run(defaultName, defaultEmail, defaultHash, firstAdmin.id);
    console.log('[ADMIN SAFETY NET] Replaced the stale admin record with the dashboard login account.');
    return;
  }

  db.prepare(`
    INSERT INTO admins (name, email, password_hash, must_change_password)
    VALUES (?, ?, ?, 1)
  `).run(defaultName, defaultEmail, defaultHash);
  console.log('[ADMIN SAFETY NET] No admin account found after DB init; created default dashboard admin requiring password change.');
};
ensureDefaultAdmin();

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
