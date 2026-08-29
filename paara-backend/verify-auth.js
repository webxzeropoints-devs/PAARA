const db = require('./db/database');

const BASE = 'http://localhost:4000/api';

async function request(path, body = {}, method = 'POST') {
  const res = await fetch(BASE + path, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: method === 'GET' ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { data = { raw: text }; }
  if (!res.ok) {
    throw new Error(JSON.stringify({ status: res.status, path, body, response: data }));
  }
  return data;
}

(async () => {
  try {
    const customerEmail = 'customer.reset.2026@example.com';
    const customerPassword = 'CustomerNewPass123!';
    const registerRes = await request('/auth/register', {
      name: 'Customer Reset',
      email: customerEmail,
      password: customerPassword,
      phone: '9999999999',
    });
    console.log('CUSTOMER_REGISTER', registerRes.success, registerRes.requires_otp);

    const signupCode = db.prepare('SELECT code FROM email_otps WHERE email = ? ORDER BY id DESC LIMIT 1').get(customerEmail).code;
    const signupVerify = await request('/auth/email/verify-otp', { email: customerEmail, code: signupCode });
    console.log('CUSTOMER_SIGNUP_OTP', !!signupVerify.token);

    const forgotReq = await request('/auth/forgot-password/request', { email: customerEmail });
    console.log('CUSTOMER_FORGOT_REQ', forgotReq.message);

    const resetCode = db.prepare("SELECT code FROM password_reset_otps WHERE email = ? AND user_type = 'customer' ORDER BY id DESC LIMIT 1").get(customerEmail).code;
    const resetRes = await request('/auth/forgot-password/reset', {
      email: customerEmail,
      code: resetCode,
      password: 'CustomerResetPass456!',
    });
    console.log('CUSTOMER_RESET', resetRes.message);

    const loginRes = await request('/auth/login', { email: customerEmail, password: 'CustomerResetPass456!' });
    console.log('CUSTOMER_LOGIN_AFTER_RESET', loginRes.requires_otp, !!loginRes.email);

    const loginCode = db.prepare('SELECT code FROM email_otps WHERE email = ? ORDER BY id DESC LIMIT 1').get(customerEmail).code;
    const loginVerify = await request('/auth/email/verify-otp', { email: customerEmail, code: loginCode });
    console.log('CUSTOMER_LOGIN_OTP', !!loginVerify.token);

    const adminEmail = 'paara@gmail.com';
    const tempLogin = await request('/admin-auth/login', { email: adminEmail, password: 'Paara@123' });
    console.log('TEMP_ADMIN_FIRST_LOGIN', tempLogin.requires_password_change, tempLogin.admin_id);

    const adminRow = db.prepare('SELECT id FROM admins WHERE email = ?').get(adminEmail);
    const setPass = await request('/admin-auth/set-password', { admin_id: adminRow.id, new_password: 'PaaraNewPass789!' });
    console.log('TEMP_ADMIN_SET_NEW_PASSWORD', setPass.message);

    const adminForgotReq = await request('/admin-auth/forgot-password/request', { email: adminEmail });
    console.log('ADMIN_FORGOT_REQ', adminForgotReq.message);

    const adminResetCode = db.prepare("SELECT code FROM password_reset_otps WHERE email = ? AND user_type = 'admin' ORDER BY id DESC LIMIT 1").get(adminEmail).code;
    const adminResetRes = await request('/admin-auth/forgot-password/reset', {
      email: adminEmail,
      code: adminResetCode,
      password: 'PaaraResetPass321!',
    });
    console.log('ADMIN_RESET', adminResetRes.message);

    const adminLoginRes = await request('/admin-auth/login', { email: adminEmail, password: 'PaaraResetPass321!' });
    console.log('ADMIN_LOGIN_AFTER_RESET', !!adminLoginRes.admin_id, adminLoginRes.message);

    const adminOtpCode = db.prepare('SELECT code FROM email_otps WHERE email = ? ORDER BY id DESC LIMIT 1').get(adminEmail).code;
    const adminVerifyRes = await request('/admin-auth/verify-otp', { admin_id: adminLoginRes.admin_id, otp: adminOtpCode });
    console.log('ADMIN_LOGIN_OTP', !!adminVerifyRes.token);
  } catch (error) {
    console.error('VERIFICATION_FAILED');
    console.error(error.message);
    process.exit(1);
  }
})();
