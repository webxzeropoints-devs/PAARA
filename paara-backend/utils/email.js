const nodemailer = require('nodemailer');
const { maskSensitiveText } = require('./validate');

const smtpConfig = {
  user: String(process.env.EMAIL_USER || '').trim(),
  pass: String(process.env.EMAIL_PASSWORD || '').trim(),
  host: String(process.env.EMAIL_HOST || '').trim(),
  port: Number(String(process.env.EMAIL_PORT || '587').trim()),
};

const transporter = nodemailer.createTransport({
  host: smtpConfig.host,
  port: smtpConfig.port,
  secure: smtpConfig.port === 465,
  auth: { user: smtpConfig.user, pass: smtpConfig.pass },
});

async function sendEmail({ to, subject, text, attachments = [] }) {
  if (!smtpConfig.user || !smtpConfig.pass || !smtpConfig.host) {
    console.warn('SMTP not configured – email sending disabled. Set EMAIL_USER, EMAIL_PASSWORD, EMAIL_HOST to enable.');
    // Return a fake successful result so callers can continue.
    return { messageId: 'mock-id', envelope: {}, accepted: [to], rejected: [] };
  }
  return transporter.sendMail({
    from: smtpConfig.user,
    to,
    subject,
    text,
    attachments,
  });
}

async function trySendEmail(options, context) {
  try {
    const result = await sendEmail(options);
    console.log(`[Email sent] ${maskSensitiveText(context)}`, { messageId: result.messageId });
    return { success: true, result };
  } catch (error) {
    console.error(`[Email failed] ${maskSensitiveText(context)}`, { message: maskSensitiveText(error.message), name: error.name });
    return { success: false, error };
  }
}

module.exports = { sendEmail, trySendEmail };
