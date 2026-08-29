const express = require('express');
const jwt = require('jsonwebtoken');
const db = require('../db/database');
const { issueEmailOtp, consumeEmailOtp, normalizeEmail } = require('../utils/emailOtp');

const router = express.Router();

router.post('/request-otp', async (req, res) => {
  const email = normalizeEmail(req.body.email);
  if (!email) return res.status(400).json({ error: 'A valid email address is required.' });
  try { await issueEmailOtp(email, `OTP to ${email}`); }
  catch (error) { return res.status(503).json({ error: error.message }); }
  res.json({ success: true, message: 'OTP sent.' });
});

router.post('/verify-otp', (req, res) => {
  const email = normalizeEmail(req.body.email);
  const code = String(req.body.code || '').trim();
  if (!email || !/^\d{6}$/.test(code)) return res.status(400).json({ error: 'email and a 6-digit code are required.' });
  const record = consumeEmailOtp(email, code);
  if (!record) return res.status(400).json({ error: 'Invalid or expired OTP.' });

  let customer = db.prepare('SELECT * FROM customers WHERE email = ?').get(email)
    || db.prepare('SELECT * FROM customers WHERE lower(email) = ?').get(email);

  if (!customer) {
    const lowerMatch = db.prepare('SELECT * FROM customers WHERE lower(email) = ?').get(email);
    if (lowerMatch) {
      customer = lowerMatch;
    } else {
      const info = db.prepare(`
        INSERT INTO customers (name, email, password_hash)
        VALUES (?, ?, ?)
      `).run(email.split('@')[0], email, 'EMAIL_AUTH_NO_PASSWORD');
      customer = db.prepare('SELECT * FROM customers WHERE id = ?').get(info.lastInsertRowid);
    }
  }

  if (customer.email !== email) {
    db.prepare('UPDATE customers SET email = ? WHERE id = ?').run(email, customer.id);
    customer.email = email;
  }

  const token = jwt.sign({ id: customer.id, email: customer.email }, process.env.JWT_SECRET, { expiresIn: '30d' });
  res.json({ token, customer: { id: customer.id, name: customer.name, email: customer.email } });
});

module.exports = router;
