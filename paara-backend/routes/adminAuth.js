const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../db/database');
const { requireAdminSession } = require('../middleware/adminAuth');
const { issuePasswordResetOtp, consumePasswordResetOtp, markPasswordResetOtpUsed } = require('../utils/passwordReset');
const { normalizeEmail } = require('../utils/emailOtp');
const { validatePassword, PASSWORD_ERROR } = require('../utils/validate');

const router = express.Router();

// STEP 1 of login: verify email+password, then either require a password change
// or send OTP based on the admin's force-change flag.
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'email and password are required.' });

  const normalizedEmail = normalizeEmail(email);
  const admin = db.prepare('SELECT * FROM admins WHERE email = ?').get(normalizedEmail)
    || db.prepare('SELECT * FROM admins WHERE lower(email) = ?').get(normalizedEmail);
  const passwordMatches = !!admin && bcrypt.compareSync(password, admin.password_hash);
  console.log('[AUTH_LOGIN]', { actor: 'admin', emailDomain: normalizedEmail?.split('@')[1], adminFound: !!admin, passwordMatches });
  if (!admin || !passwordMatches) {
    return res.status(401).json({ error: 'Invalid email or password.' });
  }

  let token;
  try {
    token = jwt.sign({ id: admin.id, email: admin.email, role: 'admin' }, process.env.JWT_SECRET, { expiresIn: '12h' });
  } catch (err) {
    console.error('[JWT_SIGN_ERROR]', err.message);
    return res.status(500).json({ error: 'Server configuration error. Contact support.' });
  }
  return res.json({
    success: true,
    token,
    admin: { id: admin.id, name: admin.name, email: admin.email, profile_image_url: admin.profile_image_url },
    admin_id: admin.id,
    email: admin.email,
    needs_setup: Boolean(admin.must_change_password),
    message: Boolean(admin.must_change_password)
      ? 'Temporary admin access granted. Update your email and password from profile settings.'
      : 'Admin login successful.'
  });
});

router.post('/set-password', (req, res) => {
  const { admin_id, new_password, new_email } = req.body;
  const normalizedEmail = normalizeEmail(new_email);

  if (!admin_id || !new_password || !normalizedEmail) {
    return res.status(400).json({ error: 'admin_id, new_password and new_email are required.' });
  }

  const admin = db.prepare('SELECT * FROM admins WHERE id = ?').get(admin_id);
  if (!admin) return res.status(404).json({ error: 'Admin not found.' });
  if (!validatePassword(new_password)) {
    return res.status(400).json({ error: PASSWORD_ERROR });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
    return res.status(400).json({ error: 'A valid email address is required.' });
  }

  const password_hash = bcrypt.hashSync(new_password, 10);
  console.log('[AUTH_PROFILE_UPDATE]', { actor: 'admin', action: 'set-password' });

  try {
    db.prepare('UPDATE admins SET password_hash = ?, email = ?, must_change_password = 0 WHERE id = ?')
      .run(password_hash, normalizedEmail, admin.id);
    res.json({ success: true, message: 'Password and email updated successfully.' });
  } catch (error) {
    return res.status(409).json({ error: 'That email is already in use.' });
  }
});

router.post('/forgot-password/request', async (req, res) => {
  const email = normalizeEmail(req.body.email);
  if (!email) return res.status(400).json({ error: 'A valid email address is required.' });

  const admin = db.prepare('SELECT id FROM admins WHERE email = ?').get(email)
    || db.prepare('SELECT id FROM admins WHERE lower(email) = ?').get(email);
  if (!admin) return res.status(404).json({ error: 'No admin account was found for that email.' });

  try {
    await issuePasswordResetOtp(email, 'admin');
    return res.json({ success: true, message: 'Password reset code sent to your admin email.' });
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

  const validation = consumePasswordResetOtp(email, code, 'admin');
  if (!validation.valid) {
    return res.status(400).json({ error: validation.reason });
  }

  const admin = db.prepare('SELECT id FROM admins WHERE email = ?').get(email)
    || db.prepare('SELECT id FROM admins WHERE lower(email) = ?').get(email);
  if (!admin) {
    return res.status(404).json({ error: 'Admin account not found.' });
  }

  db.prepare('UPDATE admins SET password_hash = ?, must_change_password = 0 WHERE id = ?')
    .run(bcrypt.hashSync(newPassword, 10), admin.id);
  markPasswordResetOtpUsed(validation.record.id);

  return res.json({ success: true, message: 'Password reset successful.' });
});

// Profile
router.get('/me', requireAdminSession, (req, res) => {
  const admin = db.prepare('SELECT id, name, email, profile_image_url, must_change_password FROM admins WHERE id = ?').get(req.admin.id);
  res.json(admin);
});

router.put('/change-password', requireAdminSession, (req, res) => {
  const { currentPassword, newPassword } = req.body;
  const admin = db.prepare('SELECT * FROM admins WHERE id = ?').get(req.admin.id);
  if (!bcrypt.compareSync(currentPassword, admin.password_hash)) {
    return res.status(401).json({ error: 'Current password is incorrect.' });
  }
  if (!validatePassword(newPassword)) {
    return res.status(400).json({ error: PASSWORD_ERROR });
  }
  db.prepare('UPDATE admins SET password_hash = ? WHERE id = ?').run(bcrypt.hashSync(newPassword, 10), admin.id);
  res.json({ success: true });
});

router.put('/change-email', requireAdminSession, (req, res) => {
  const { newEmail, currentPassword } = req.body;
  const admin = db.prepare('SELECT * FROM admins WHERE id = ?').get(req.admin.id);
  if (!bcrypt.compareSync(currentPassword, admin.password_hash)) {
    return res.status(401).json({ error: 'Current password is incorrect.' });
  }
  try {
    const normalizedEmail = normalizeEmail(newEmail);
    if (!normalizedEmail) return res.status(400).json({ error: 'A valid email address is required.' });
    db.prepare('UPDATE admins SET email = ? WHERE id = ?').run(normalizedEmail, admin.id);
    res.json({ success: true });
  } catch (err) {
    res.status(409).json({ error: 'That email is already in use.' });
  }
});

// Profile picture: accepts a URL for now (not a file upload — keeps this
// reliable without adding multer/file-storage complexity). Codex: if a real
// file upload is wanted later, that's a separate follow-up, not part of this.
router.put('/profile-picture', requireAdminSession, (req, res) => {
  const { image_url } = req.body;
  if (!image_url) return res.status(400).json({ error: 'image_url is required.' });
  db.prepare('UPDATE admins SET profile_image_url = ? WHERE id = ?').run(image_url, req.admin.id);
  res.json({ success: true });
});

module.exports = router;
