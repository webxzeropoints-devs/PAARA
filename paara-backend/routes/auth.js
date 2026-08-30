const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../db/database');
const { issueEmailOtp, normalizeEmail } = require('../utils/emailOtp');
const { issuePasswordResetOtp, consumePasswordResetOtp, markPasswordResetOtpUsed } = require('../utils/passwordReset');
const { normalizePhone, validatePassword, PASSWORD_ERROR, PHONE_ERROR } = require('../utils/validate');

const router = express.Router();

router.post('/register', async (req, res) => {
  const { name, email, password, phone } = req.body;
  const normalizedEmail = normalizeEmail(email);
  const normalizedPhone = normalizePhone(phone);
  if (!name || !normalizedEmail || !password) {
    return res.status(400).json({ ok: false, code: 'INVALID_REQUEST', message: 'name, email and password are required.' });
  }
  if (!validatePassword(password)) return res.status(400).json({ ok: false, code: 'WEAK_PASSWORD', message: PASSWORD_ERROR });
  if (!normalizedPhone) return res.status(400).json({ ok: false, code: 'INVALID_PHONE', message: PHONE_ERROR });

  const existing = db.prepare('SELECT id FROM customers WHERE email = ? OR lower(email) = ?').get(normalizedEmail, normalizedEmail);
  if (existing) return res.status(409).json({ ok: false, code: 'ACCOUNT_EXISTS', message: 'An account with this email already exists.' });

  const password_hash = bcrypt.hashSync(password, 10);
  console.log('[AUTH_REGISTER]', { emailDomain: normalizedEmail.split('@')[1] });
  const info = db
    .prepare('INSERT INTO customers (name, email, phone, password_hash) VALUES (?, ?, ?, ?)')
    .run(name, normalizedEmail, normalizedPhone, password_hash);

  try {
    await issueEmailOtp(normalizedEmail, 'Signup OTP');
  } catch (error) {
    db.prepare('DELETE FROM email_otps WHERE email = ? AND verified = 0').run(normalizedEmail);
    db.prepare('DELETE FROM customers WHERE id = ?').run(info.lastInsertRowid);
    return res.status(503).json({ ok: false, code: 'OTP_DELIVERY_UNAVAILABLE', message: 'Verification email could not be sent. Please try again.' });
  }
  res.status(201).json({ ok: true, success: true, requires_otp: true, requiresOtp: true, email: normalizedEmail, customer: { id: info.lastInsertRowid, name, email: normalizedEmail } });
});

router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ ok: false, code: 'INVALID_REQUEST', message: 'email and password are required.' });

  const normalizedEmail = normalizeEmail(email);
  const customer = db.prepare('SELECT * FROM customers WHERE email = ?').get(normalizedEmail)
    || db.prepare('SELECT * FROM customers WHERE lower(email) = ?').get(normalizedEmail);
  const passwordMatches = !!customer && bcrypt.compareSync(password, customer.password_hash);
  console.log('[AUTH_LOGIN]', {
    emailDomain: normalizedEmail?.split('@')[1],
    customerFound: !!customer,
    passwordMatches,
    hashExists: !!customer?.password_hash,
    hashLength: customer?.password_hash?.length,
    hashPrefix: customer?.password_hash?.substring(0, 7),
    bcryptRounds: customer?.password_hash
      ? bcrypt.getRounds(customer.password_hash)
      : null
  });
  if (!customer || !passwordMatches) {
    return res.status(401).json({ ok: false, code: 'INVALID_CREDENTIALS', message: 'Invalid email or password.' });
  }

  try {
    await issueEmailOtp(customer.email, 'Login OTP');
  } catch (error) {
    return res.status(503).json({ ok: false, code: 'OTP_DELIVERY_UNAVAILABLE', message: 'Verification email could not be sent. Please try again.' });
  }
  res.json({ ok: true, success: true, requires_otp: true, requiresOtp: true, email: customer.email, customer: { id: customer.id, name: customer.name, email: customer.email } });
});

router.post('/forgot-password/request', async (req, res) => {
  const email = normalizeEmail(req.body.email);
  if (!email) return res.status(400).json({ error: 'A valid email address is required.' });
  const customer = db.prepare('SELECT id FROM customers WHERE email = ?').get(email)
    || db.prepare('SELECT id FROM customers WHERE lower(email) = ?').get(email);
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
  if (!validatePassword(newPassword)) {
    return res.status(400).json({ error: PASSWORD_ERROR });
  }

  const validation = consumePasswordResetOtp(email, code, 'customer');
  if (!validation.valid) {
    return res.status(400).json({ error: validation.reason });
  }

  const customer = db.prepare('SELECT id FROM customers WHERE email = ?').get(email)
    || db.prepare('SELECT id FROM customers WHERE lower(email) = ?').get(email);
  if (!customer) {
    return res.status(404).json({ error: 'Customer account not found.' });
  }

  db.prepare('UPDATE customers SET password_hash = ? WHERE id = ?').run(bcrypt.hashSync(newPassword, 10), customer.id);
  markPasswordResetOtpUsed(validation.record.id);

  return res.json({ success: true, message: 'Password reset successful.' });
});

module.exports = router;
