const db = require('../db/database');
const { trySendEmail } = require('./email');
const crypto = require('crypto');

function normalizeEmail(value) {
  return typeof value === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())
    ? value.trim().toLowerCase() : null;
}

function hashOtp(code) {
  return crypto.createHash('sha256').update(code).digest('hex');
}

async function issueEmailOtp(email, context) {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) throw new Error('A valid email address is required.');
  const code = String(crypto.randomInt(100000, 1000000));
  const expiresAt = new Date(Date.now() + 10 * 60000).toISOString();
  db.prepare('UPDATE email_otps SET verified = 1 WHERE email = ? AND verified = 0').run(normalizedEmail);
  db.prepare('INSERT INTO email_otps (email, code, expires_at, verified) VALUES (?, ?, ?, 0)')
    .run(normalizedEmail, hashOtp(code), expiresAt);
  await db.persistAfterWrite();
  const result = await trySendEmail({
    to: normalizedEmail,
    subject: 'Your Paara verification code',
    text: `Your Paara verification code is ${code}. It expires in 10 minutes.`,
  }, context || `OTP to ${normalizedEmail}`);
  if (!result.success) throw result.error || new Error('Verification email could not be sent.');
  console.log('[AUTH_OTP_SENT]', { channel: 'email' });
  return normalizedEmail;
}

function consumeEmailOtp(email, code) {
  const normalizedEmail = normalizeEmail(email);
  const normalizedCode = String(code || '').trim();
  if (!normalizedEmail || !/^\d{6}$/.test(normalizedCode)) return null;
  const record = db.prepare(`
    SELECT * FROM email_otps
    WHERE email = ? AND verified = 0
    ORDER BY id DESC LIMIT 1
  `).get(normalizedEmail);
  if (!record) return null;
  if (new Date(record.expires_at).getTime() <= Date.now() || record.attempts >= 5) {
    db.prepare('UPDATE email_otps SET verified = 1 WHERE id = ?').run(record.id);
    return null;
  }
  const expected = Buffer.from(record.code);
  const supplied = Buffer.from(hashOtp(normalizedCode));
  const matches = expected.length === supplied.length && crypto.timingSafeEqual(expected, supplied);
  if (!matches) {
    const nextAttempts = record.attempts + 1;
    db.prepare('UPDATE email_otps SET attempts = ?, verified = ? WHERE id = ?').run(nextAttempts, nextAttempts >= 5 ? 1 : 0, record.id);
    return null;
  }
  db.prepare('UPDATE email_otps SET verified = 1 WHERE id = ?').run(record.id);
  return record;
}

module.exports = { normalizeEmail, issueEmailOtp, consumeEmailOtp };
