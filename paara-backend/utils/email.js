const nodemailer = require('nodemailer');

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
    throw new Error('Email SMTP is not configured. Set EMAIL_USER, EMAIL_PASSWORD, and EMAIL_HOST.');
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
    console.log(`[Email sent] ${context}`, { messageId: result.messageId });
    return { success: true, result };
  } catch (error) {
    console.error(`[Email failed] ${context}`, error);
    return { success: false, error };
  }
}

module.exports = { sendEmail, trySendEmail };
