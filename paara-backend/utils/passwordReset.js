const db = require('../db/database');
const { sendEmail } = require('./email');
const crypto = require('crypto');

function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

function generateResetCode() {
  return String(crypto.randomInt(100000, 1000000));
}

function hashResetCode(code) {
  return crypto.createHash('sha256').update(code).digest('hex');
}

async function issuePasswordResetOtp(email, userType = 'customer') {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) {
    throw new Error('A valid email address is required.');
  }

  const code = generateResetCode();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

  db.prepare('DELETE FROM password_reset_otps WHERE email = ? AND user_type = ?').run(normalizedEmail, userType);
  db.prepare(`
    INSERT INTO password_reset_otps (email, code, user_type, expires_at, used)
    VALUES (?, ?, ?, ?, 0)
  `).run(normalizedEmail, hashResetCode(code), userType, expiresAt);
  await db.persistAfterWrite();

  const subject = userType === 'admin'
    ? 'Paara admin password reset code'
    : 'Paara password reset code';
  const replyText = userType === 'admin'
    ? `Your Paara admin password reset code is ${code}. This code expires in 10 minutes.`
    : `Your Paara password reset code is ${code}. This code expires in 10 minutes.`;

  await sendEmail({
    to: normalizedEmail,
    subject,
    text: `${replyText}\n\nIf you did not request this, you can ignore this email.`
  });

  return { email: normalizedEmail, code, expires_at: expiresAt };
}

function consumePasswordResetOtp(email, code, userType = 'customer') {
  const normalizedEmail = normalizeEmail(email);
  const digitCode = String(code || '').trim();

  if (!normalizedEmail || !/^\d{6}$/.test(digitCode)) {
    return { valid: false, reason: 'A valid 6-digit code is required.' };
  }

  const record = db.prepare(`
    SELECT * FROM password_reset_otps
    WHERE email = ? AND user_type = ?
    ORDER BY created_at DESC
    LIMIT 1
  `).get(normalizedEmail, userType);

  if (!record) {
    return { valid: false, reason: 'Incorrect reset code.' };
  }

  if (record.used === 1) {
    return { valid: false, reason: 'This reset code has already been used.' };
  }

  if (record.attempts >= 5) {
    db.prepare('UPDATE password_reset_otps SET used = 1 WHERE id = ?').run(record.id);
    db.persistAfterWrite();
    return { valid: false, reason: 'Too many incorrect attempts. Please request a new code.' };
  }

  if (new Date(record.expires_at).getTime() <= Date.now()) {
    db.prepare('UPDATE password_reset_otps SET used = 1 WHERE id = ?').run(record.id);
    db.persistAfterWrite();
    return { valid: false, reason: 'This reset code has expired. Please request a new one.' };
  }

  const expected = Buffer.from(record.code);
  const supplied = Buffer.from(hashResetCode(digitCode));
  const matches = expected.length === supplied.length && crypto.timingSafeEqual(expected, supplied);
  if (!matches) {
    const nextAttempts = record.attempts + 1;
    db.prepare('UPDATE password_reset_otps SET attempts = ?, used = ? WHERE id = ?').run(nextAttempts, nextAttempts >= 5 ? 1 : 0, record.id);
    db.persistAfterWrite();
    return { valid: false, reason: 'Incorrect reset code.' };
  }

  return { valid: true, record };
}

function markPasswordResetOtpUsed(id) {
  db.prepare('UPDATE password_reset_otps SET used = 1 WHERE id = ?').run(id);
  db.persistAfterWrite();
}

module.exports = {
  normalizeEmail,
  issuePasswordResetOtp,
  consumePasswordResetOtp,
  markPasswordResetOtpUsed,
};
