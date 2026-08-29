const db = require('./db/database');
const bcrypt = require('bcryptjs');
const BASE = 'http://localhost:4000/api';

async function request(path, body = {}) {
  const res = await fetch(BASE + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { data = { raw: text }; }
  return { status: res.status, data };
}

(async () => {
  const adminEmail = 'paara@gmail.com';
  const adminOldPassword = 'Paara@123';
  const adminNewPassword = 'PaaraFreshReset123!';
  const customerEmail = `customer.${Date.now()}@example.com`;
  const customerPassword = 'CustomerFreshPass123!';

  // Reset admin to known-good temp-user state.
  db.prepare('UPDATE admins SET password_hash = ?, must_change_password = 1 WHERE email = ?')
    .run(bcrypt.hashSync(adminOldPassword, 10), adminEmail);
  db.prepare('DELETE FROM email_otps WHERE email = ?').run(adminEmail);
  db.prepare('DELETE FROM password_reset_otps WHERE email = ? AND user_type = ?').run(adminEmail, 'admin');

  // Customer fresh registration path.
  const blank = await request('/auth/register', { name: 'Blank Email Test', password: customerPassword, phone: '9999999999' });
  console.log('BLANK_EMAIL_SIGNUP', blank.status, JSON.stringify(blank.data));

  const customerCreate = await request('/auth/register', {
    name: 'Fresh Customer',
    email: customerEmail,
    password: customerPassword,
    phone: '9999999999',
  });
  console.log('CUSTOMER_REGISTER', customerCreate.status, JSON.stringify(customerCreate.data));

  const signupOtp = db.prepare('SELECT code FROM email_otps WHERE email = ? ORDER BY id DESC LIMIT 1').get(customerEmail);
  const signupVerify = await request('/auth/email/verify-otp', { email: customerEmail, code: signupOtp.code });
  console.log('CUSTOMER_SIGNUP_VERIFY', signupVerify.status, JSON.stringify(signupVerify.data));

  const loginResult = await request('/auth/login', { email: customerEmail, password: customerPassword });
  console.log('CUSTOMER_LOGIN_WITH_SAME_PASSWORD', loginResult.status, JSON.stringify(loginResult.data));

  const customerLoginCheck = !loginResult.data || loginResult.data.requires_otp || loginResult.data.success;
  console.log('CUSTOMER_LOGIN_PASSED', customerLoginCheck);

  const adminTempLogin = await request('/admin-auth/login', { email: adminEmail, password: adminOldPassword });
  console.log('ADMIN_TEMP_LOGIN', adminTempLogin.status, JSON.stringify(adminTempLogin.data));

  const adminId = db.prepare('SELECT id FROM admins WHERE email = ?').get(adminEmail).id;
  const adminSetPassword = await request('/admin-auth/set-password', { admin_id: adminId, new_password: adminNewPassword });
  console.log('ADMIN_SET_PASSWORD', adminSetPassword.status, JSON.stringify(adminSetPassword.data));

  const adminAfterSet = await request('/admin-auth/login', { email: adminEmail, password: adminNewPassword });
  console.log('ADMIN_LOGIN_AFTER_SET', adminAfterSet.status, JSON.stringify(adminAfterSet.data));

  const adminHash = db.prepare('SELECT password_hash FROM admins WHERE email = ?').get(adminEmail).password_hash;
  console.log('ADMIN_HASH_MATCHES', bcrypt.compareSync(adminNewPassword, adminHash));
  console.log('ADMIN_HASH_PREFIX', adminHash.slice(0, 30));

  const customerHash = db.prepare('SELECT password_hash FROM customers WHERE email = ?').get(customerEmail).password_hash;
  console.log('CUSTOMER_HASH_MATCHES', bcrypt.compareSync(customerPassword, customerHash));
})();
