const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../db/database');
const { requireAdminSession } = require('../middleware/adminAuth');
const { issueEmailOtp, consumeEmailOtp } = require('../utils/emailOtp');

const router = express.Router();

// STEP 1 of login: verify email+password, then send OTP
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'email and password are required.' });

  const admin = db.prepare('SELECT * FROM admins WHERE email = ?').get(email.toLowerCase());
  if (!admin || !bcrypt.compareSync(password, admin.password_hash)) {
    return res.status(401).json({ error: 'Invalid email or password.' });
  }

  try {
    await issueEmailOtp(admin.email, `Admin login OTP to ${admin.email}`);
  } catch (error) {
    return res.status(503).json({ error: error.message });
  }
  res.json({ success: true, message: 'OTP sent to admin email.', admin_id: admin.id });
});

// STEP 2 of login: verify OTP, issue admin session JWT
router.post('/verify-otp', (req, res) => {
  const { admin_id, otp } = req.body;
  if (!admin_id || !otp) return res.status(400).json({ error: 'admin_id and otp are required.' });

  const admin = db.prepare('SELECT * FROM admins WHERE id = ?').get(admin_id);
  const record = admin && consumeEmailOtp(admin.email, otp);
  if (!record) return res.status(400).json({ error: 'Invalid or expired OTP.' });
  const token = jwt.sign({ id: admin.id, email: admin.email, role: 'admin' }, process.env.JWT_SECRET, { expiresIn: '12h' });
  res.json({ token, admin: { id: admin.id, name: admin.name, email: admin.email, profile_image_url: admin.profile_image_url } });
});

// Profile
router.get('/me', requireAdminSession, (req, res) => {
  const admin = db.prepare('SELECT id, name, email, profile_image_url FROM admins WHERE id = ?').get(req.admin.id);
  res.json(admin);
});

router.put('/change-password', requireAdminSession, (req, res) => {
  const { currentPassword, newPassword } = req.body;
  const admin = db.prepare('SELECT * FROM admins WHERE id = ?').get(req.admin.id);
  if (!bcrypt.compareSync(currentPassword, admin.password_hash)) {
    return res.status(401).json({ error: 'Current password is incorrect.' });
  }
  if (!newPassword || newPassword.length < 8) {
    return res.status(400).json({ error: 'New password must be at least 8 characters.' });
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
    db.prepare('UPDATE admins SET email = ? WHERE id = ?').run(newEmail.toLowerCase(), admin.id);
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
