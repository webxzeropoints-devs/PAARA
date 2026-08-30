export const PASSWORD_ERROR = "Password must be at least 12 characters and include an uppercase letter, lowercase letter, number, and special character.";
export const PHONE_ERROR = "Please enter a valid 10-digit mobile number.";

export function isStrongPassword(password) {
  return password.length >= 12
    && /[A-Z]/.test(password)
    && /[a-z]/.test(password)
    && /\d/.test(password)
    && /[^A-Za-z0-9]/.test(password);
}

export function normalizePhone(value) {
  let digits = value.replace(/\D/g, "");
  if (digits.startsWith("91") && digits.length === 12) digits = digits.slice(2);
  return /^\d{10}$/.test(digits) && /^[6-9]/.test(digits) ? digits : null;
}