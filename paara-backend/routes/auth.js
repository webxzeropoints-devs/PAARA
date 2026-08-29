const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../db/database');
const { issueEmailOtp, normalizeEmail } = require('../utils/emailOtp');
const { issuePasswordResetOtp, consumePasswordResetOtp, markPasswordResetOtpUsed } = require('../utils/passwordReset');

const router = express.Router();

router.post('/register', async (req, res) => {
  const { name, email, password, phone } = req.body;
  const normalizedEmail = normalizeEmail(email);
  if (!name || !normalizedEmail || !password) {
    return res.status(400).json({ error: 'name, email and password are required.' });
  }

  const existing = db.prepare('SELECT id FROM customers WHERE email = ? OR lower(email) = ?').get(normalizedEmail, normalizedEmail);
  if (existing) return res.status(409).json({ error: 'An account with this email already exists.' });

  const password_hash = bcrypt.hashSync(password, 10);
  console.log('[CUSTOMER_REGISTER_HASH]', { email: normalizedEmail, hashPrefix: password_hash.slice(0, 18), saltRounds: 10 });
  const info = db
    .prepare('INSERT INTO customers (name, email, phone, password_hash) VALUES (?, ?, ?, ?)')
    .run(name, normalizedEmail, phone || null, password_hash);

  // Persist the new customer record in serverless environments (Vercel) so it survives cold starts.
  if (db.persist) {
    try {
      await db.persist();
    } catch (persistErr) {
      console.error('Database persist after registration failed:', persistErr.message);
      // Continue; the registration succeeded even if persisting failed.
    }
  }

  try {
    await issueEmailOtp(normalizedEmail, `Signup OTP to ${normalizedEmail}`);
  } catch (error) {
    return res.status(503).json({ error: error.message });
  }
  res.status(201).json({ success: true, requires_otp: true, email: normalizedEmail, customer: { id: info.lastInsertRowid, name, email: normalizedEmail } });
});

router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'email and password are required.' });

  const normalizedEmail = normalizeEmail(email);
  const customer = db.prepare('SELECT * FROM customers WHERE email = ?').get(normalizedEmail)
    || db.prepare('SELECT * FROM customers WHERE lower(email) = ?').get(normalizedEmail);
  const passwordMatches = !!customer && bcrypt.compareSync(password, customer.password_hash);
  console.log('[CUSTOMER_LOGIN_HASH_CHECK]', {
    email: normalizedEmail,
    customerFound: !!customer,
    storedHashPresent: !!customer?.password_hash,
    passwordMatches,
    hashPrefix: customer?.password_hash?.slice(0, 18),
  });
  if (!customer || !passwordMatches) {
    return res.status(401).json({ error: 'Invalid email or password.' });
  }

  try {
    await issueEmailOtp(customer.email, `Login OTP to ${customer.email}`);
  } catch (error) {
    return res.status(503).json({ error: error.message });
  }
  res.json({ success: true, requires_otp: true, email: customer.email, customer: { id: customer.id, name: customer.name, email: customer.email } });
});

router.post('/forgot-password/request', async (req, res) => {
  const email = normalizeEmail(req.body.email);
  if (!email) return res.status(400).json({ error: 'A valid email address is required.' });
  const customer = db.prepare('SELECT id FROM customers WHERE email = ?').get(email);
  if (!customer) return res.status(404).json({ error: 'No customer account was found for that email.' });

  try {
    await issuePasswordResetOtp(email, 'customer');
    return res.json({ success: true, message: 'Password reset code sent to your email.' });
  } catch (error) {
    return res.status(503).json({ error: error.message });
  }
});

router.post('/forgot-password/reset', (req, res) => {
  const email = normalizeEmail(req.body.email);
  const code = String(req.body.code || '').trim();
  const newPassword = req.body.password;

  if (!email || !/^\d{6}$/.test(code)) {
    return res.status(400).json({ error: 'A valid email and 6-digit reset code are required.' });
  }
  if (!newPassword || String(newPassword).length < 8) {
    return res.status(400).json({ error: 'New password must be at least 8 characters long.' });
  }

  const validation = consumePasswordResetOtp(email, code, 'customer');
  if (!validation.valid) {
    return res.status(400).json({ error: validation.reason });
  }

  const customer = db.prepare('SELECT id FROM customers WHERE email = ?').get(email);
  if (!customer) {
    return res.status(404).json({ error: 'Customer account not found.' });
  }

  db.prepare('UPDATE customers SET password_hash = ? WHERE id = ?').run(bcrypt.hashSync(newPassword, 10), customer.id);
  markPasswordResetOtpUsed(validation.record.id);

  return res.json({ success: true, message: 'Password reset successful.' });
});

module.exports = router;
