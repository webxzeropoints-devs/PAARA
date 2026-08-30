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

module.exports = { isPincode, isPositiveInt, validatePassword, PASSWORD_ERROR, normalizePhone, PHONE_ERROR };
