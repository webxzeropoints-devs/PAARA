function isPincode(value) {
  return typeof value === 'string' && /^\d{6}$/.test(value);
}

function isPositiveInt(value) {
  return Number.isInteger(Number(value)) && Number(value) > 0;
}

const PASSWORD_ERROR = 'Password must be at least 12 characters and include an uppercase letter, lowercase letter, number, and special character.';

function validatePassword(value) {
  const password = typeof value === 'string' ? value : '';
  return password.length >= 12
    && /[A-Z]/.test(password)
    && /[a-z]/.test(password)
    && /\d/.test(password)
    && /[^A-Za-z0-9]/.test(password);
}

function normalizePhone(value) {
  if (typeof value !== 'string') return null;
  let digits = value.replace(/\D/g, '');
  if (digits.startsWith('91') && digits.length === 12) digits = digits.slice(2);
  return /^\d{10}$/.test(digits) && /^[6-9]/.test(digits) ? digits : null;
}

const PHONE_ERROR = 'Please enter a valid 10-digit mobile number.';

function maskEmail(value) {
  const email = String(value || '');
  const [local, domain] = email.split('@');
  if (!local || !domain) return '[invalid-email]';
  return `${local.slice(0, 2)}***@${domain}`;
}

function maskPhone(value) {
  const digits = String(value || '').replace(/\D/g, '');
  if (digits.length < 4) return '[invalid-phone]';
  return `${digits.slice(0, 2)}${'*'.repeat(Math.max(0, digits.length - 4))}${digits.slice(-2)}`;
}

function maskSensitiveText(value) {
  return String(value || '')
    .replace(/[^\s@]+@[^\s@]+\.[^\s@]+/g, (email) => maskEmail(email))
    .replace(/(?<!\d)\d{10,}(?!\d)/g, (phone) => maskPhone(phone));
}

module.exports = { isPincode, isPositiveInt, validatePassword, PASSWORD_ERROR, normalizePhone, PHONE_ERROR, maskEmail, maskPhone, maskSensitiveText };
