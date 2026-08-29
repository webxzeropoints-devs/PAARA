const express = require('express');
const jwt = require('jsonwebtoken');
const db = require('../db/database');

const router = express.Router();

const {
  WHATSAPP_PHONE_NUMBER_ID,
  WHATSAPP_BUSINESS_ACCOUNT_ID,
  WHATSAPP_ACCESS_TOKEN,
} = process.env;

function normalizePhone(v) {
  if (typeof v !== 'string') return null;
  const value = v.trim();
  if (/^[6-9]\d{9}$/.test(value)) return value;
  if (/^\+91[6-9]\d{9}$/.test(value)) return value.slice(3);
  if (/^91[6-9]\d{9}$/.test(value)) return value.slice(2);
  return null;
}

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
    console.error('[WhatsApp API error]', payload);
    const message = payload?.error?.message || 'WhatsApp message delivery failed.';
    throw new Error(message);
  }

  return payload;
}

router.post('/request-otp', async (req, res) => {
  const { phone } = req.body;
  const normalizedPhone = normalizePhone(phone);
  if (!normalizedPhone) {
    return res.status(400).json({ error: 'A valid 10-digit phone number is required.' });
  }

  const otp = String(Math.floor(100000 + Math.random() * 900000));
  const expiresAt = new Date(Date.now() + 5 * 60000).toISOString();

  db.prepare('INSERT INTO phone_otps (phone, otp_code, expires_at) VALUES (?, ?, ?)')
    .run(normalizedPhone, otp, expiresAt);

  try {
    const deliveryResponse = await sendSms(normalizedPhone, otp);
    console.log('[WhatsApp API success]', deliveryResponse);
    res.json({ success: true, message: 'OTP sent.', provider_response: deliveryResponse });
  } catch (error) {
    console.error('OTP send failed:', error);
    return res.status(503).json({
      error: error.message || 'Unable to send OTP right now. Check your WhatsApp configuration.'
    });
  }
});

router.post('/verify-otp', (req, res) => {
  const { phone, otp } = req.body;
  const normalizedPhone = normalizePhone(phone);
  if (!normalizedPhone || !otp) {
    return res.status(400).json({ error: 'phone and otp are required.' });
  }

  const record = db.prepare(`
    SELECT * FROM phone_otps
    WHERE phone = ? AND otp_code = ? AND verified = 0 AND expires_at > datetime('now')
    ORDER BY id DESC LIMIT 1
  `).get(normalizedPhone, otp);

  if (!record) {
    return res.status(400).json({ error: 'Invalid or expired OTP.' });
  }

  db.prepare('UPDATE phone_otps SET verified = 1 WHERE id = ?').run(record.id);

  let customer = db.prepare('SELECT * FROM customers WHERE phone = ?').get(phone);
  if (!customer) {
    const info = db.prepare(`
      INSERT INTO customers (name, email, phone, password_hash)
      VALUES (?, ?, ?, ?)
    `).run(`User ${normalizedPhone.slice(-4)}`, `${normalizedPhone}@phone.paara.local`, normalizedPhone, 'PHONE_AUTH_NO_PASSWORD');
    customer = { id: info.lastInsertRowid, name: `User ${normalizedPhone.slice(-4)}`, phone: normalizedPhone };
  }

  let token;
  try {
    token = jwt.sign({ id: customer.id, phone: customer.phone }, process.env.JWT_SECRET, { expiresIn: '30d' });
  } catch (err) {
    console.error('[JWT_SIGN_ERROR]', err.message);
    return res.status(500).json({ error: 'Server configuration error. Contact support.' });
  }
  res.json({ token, customer: { id: customer.id, name: customer.name, phone: customer.phone } });
});

module.exports = router;
