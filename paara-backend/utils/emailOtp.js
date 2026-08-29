const db = require('../db/database');
const { trySendEmail } = require('./email');

function normalizeEmail(value) {
  return typeof value === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())
    ? value.trim().toLowerCase() : null;
}

async function issueEmailOtp(email, context) {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) throw new Error('A valid email address is required.');
  const code = String(Math.floor(100000 + Math.random() * 900000));
  const expiresAt = new Date(Date.now() + 10 * 60000).toISOString();
  db.prepare('INSERT INTO email_otps (email, code, expires_at, verified) VALUES (?, ?, ?, 0)')
    .run(normalizedEmail, code, expiresAt);
  const result = await trySendEmail({
    to: normalizedEmail,
    subject: 'Your Paara verification code',
    text: `Your Paara verification code is ${code}. It expires in 10 minutes.`,
  }, context || `OTP to ${normalizedEmail}`);
  if (!result.success) throw new Error('Failed to send verification email. Please try again.');
  return normalizedEmail;
}

function consumeEmailOtp(email, code) {
  const normalizedEmail = normalizeEmail(email);
  const normalizedCode = String(code || '').trim();
  if (!normalizedEmail || !/^\d{6}$/.test(normalizedCode)) return null;
  const record = db.prepare(`
    SELECT * FROM email_otps
    WHERE email = ? AND code = ? AND verified = 0 AND expires_at > datetime('now')
    ORDER BY id DESC LIMIT 1
  `).get(normalizedEmail, normalizedCode);
  if (!record) return null;
  db.prepare('UPDATE email_otps SET verified = 1 WHERE id = ?').run(record.id);
  return record;
}

module.exports = { normalizeEmail, issueEmailOtp, consumeEmailOtp };
