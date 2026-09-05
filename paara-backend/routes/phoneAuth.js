const express = require('express');
const jwt = require('jsonwebtoken');
const db = require('../db/database');
const crypto = require('crypto');
const { normalizePhone, PHONE_ERROR, maskPhone, maskSensitiveText } = require('../utils/validate');

const router = express.Router();

const {
  WHATSAPP_PHONE_NUMBER_ID,
  WHATSAPP_BUSINESS_ACCOUNT_ID,
  WHATSAPP_ACCESS_TOKEN,
} = process.env;

const hashOtp = (otp) => crypto.createHash('sha256').update(otp).digest('hex');

async function sendSms(phone, otp) {
  if (!WHATSAPP_PHONE_NUMBER_ID || !WHATSAPP_BUSINESS_ACCOUNT_ID || !WHATSAPP_ACCESS_TOKEN) {
    throw new Error(
      'WhatsApp delivery is not configured. Set WHATSAPP_PHONE_NUMBER_ID, WHATSAPP_BUSINESS_ACCOUNT_ID, and WHATSAPP_ACCESS_TOKEN in paara-backend/.env.'
    );
  }

  // Meta WhatsApp Cloud API is still in test-number mode for this app; only
  // numbers added as verified test recipients in the Meta dashboard can receive messages.
  const to = phone.startsWith('+') ? phone : `+91${phone}`;
  const url = `https://graph.facebook.com/v19.0/${WHATSAPP_PHONE_NUMBER_ID}/messages`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${WHATSAPP_ACCESS_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to,
      type: 'text',
      text: {
        body: `Your Paara verification code is ${otp}. Valid for 5 minutes.`,
      },
    }),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    console.error('[WhatsApp API error]', { message: maskSensitiveText(payload?.error?.message || 'unknown error') });
    const message = payload?.error?.message || 'WhatsApp message delivery failed.';
    throw new Error(message);
  }

  return payload;
}

router.post('/request-otp', async (req, res) => {
  const { phone } = req.body;
  const normalizedPhone = normalizePhone(phone);
  if (!normalizedPhone) {
    return res.status(400).json({ error: PHONE_ERROR });
  }

  const otp = String(crypto.randomInt(100000, 1000000));
  const expiresAt = new Date(Date.now() + 5 * 60000).toISOString();

  db.prepare('UPDATE phone_otps SET verified = 1 WHERE phone = ? AND verified = 0').run(normalizedPhone);
  db.prepare('INSERT INTO phone_otps (phone, otp_code, expires_at, attempts) VALUES (?, ?, ?, 0)')
    .run(normalizedPhone, hashOtp(otp), expiresAt);

  await db.persistAfterWrite();
  try {
    const deliveryResponse = await sendSms(normalizedPhone, otp);
    console.log('[AUTH_OTP_SENT]', { channel: 'phone', phone: maskPhone(normalizedPhone) });
    res.json({ ok: true, success: true, message: 'OTP sent.' });
  } catch (error) {
    console.error('OTP send failed:', { message: maskSensitiveText(error.message), name: error.name });
    return res.status(503).json({ ok: false, code: 'OTP_DELIVERY_UNAVAILABLE', message: 'Unable to send OTP right now. Please try again.' });
  }
});

router.post('/verify-otp', async (req, res) => {
  const { phone, otp } = req.body;
  const normalizedPhone = normalizePhone(phone);
  if (!normalizedPhone || !/^\d{6}$/.test(String(otp || '').trim())) {
    return res.status(400).json({ ok: false, code: 'INVALID_REQUEST', message: 'phone and otp are required.' });
  }

  const record = db.prepare(`
    SELECT * FROM phone_otps
    WHERE phone = ? AND verified = 0
    ORDER BY id DESC LIMIT 1
  `).get(normalizedPhone);

  if (!record) return res.status(400).json({ ok: false, code: 'INVALID_OTP', message: 'Invalid or expired OTP.' });
  if (new Date(record.expires_at).getTime() <= Date.now() || record.attempts >= 5) {
    db.prepare('UPDATE phone_otps SET verified = 1 WHERE id = ?').run(record.id);
    await db.persistAfterWrite();
    return res.status(400).json({ ok: false, code: 'INVALID_OTP', message: 'Invalid or expired OTP.' });
  }
  const expected = Buffer.from(record.otp_code);
  const supplied = Buffer.from(hashOtp(String(otp).trim()));
  const matches = expected.length === supplied.length && crypto.timingSafeEqual(expected, supplied);
  if (!matches) {
    const nextAttempts = record.attempts + 1;
    db.prepare('UPDATE phone_otps SET attempts = ?, verified = ? WHERE id = ?').run(nextAttempts, nextAttempts >= 5 ? 1 : 0, record.id);
    await db.persistAfterWrite();
    return res.status(400).json({ ok: false, code: 'INVALID_OTP', message: 'Invalid or expired OTP.' });
  }

  db.prepare('UPDATE phone_otps SET verified = 1 WHERE id = ?').run(record.id);

  let customer = db.prepare('SELECT id, name, email, phone FROM customers WHERE phone = ?').get(normalizedPhone);
  if (!customer) {
    const info = db.prepare(`
      INSERT INTO customers (name, email, phone, password_hash)
      VALUES (?, ?, ?, ?)
    `).run(`User ${normalizedPhone.slice(-4)}`, `${normalizedPhone}@phone.paara.local`, normalizedPhone, 'PHONE_AUTH_NO_PASSWORD');
    customer = { id: info.lastInsertRowid, name: `User ${normalizedPhone.slice(-4)}`, phone: normalizedPhone };
  }
  await db.persistAfterWrite();

  let token;
  try {
    token = jwt.sign({ id: customer.id, phone: customer.phone }, process.env.JWT_SECRET, { expiresIn: '30d' });
  } catch (err) {
    console.error('[JWT_SIGN_ERROR]', err.message);
    return res.status(500).json({ ok: false, code: 'CONFIGURATION_ERROR', message: 'Server configuration error. Contact support.' });
  }
  await db.persistAfterWrite();
  res.json({ ok: true, token, customer: { id: customer.id, name: customer.name, phone: customer.phone } });
});

module.exports = router;
