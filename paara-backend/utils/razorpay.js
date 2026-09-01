const Razorpay = require('razorpay');

const keyId = String(process.env.RAZORPAY_KEY_ID || '').trim();
const keySecret = String(process.env.RAZORPAY_KEY_SECRET || '').trim();

let razorpay = null;

if (keyId && keySecret) {
  try {
    razorpay = new Razorpay({
      key_id: keyId,
      key_secret: keySecret,
    });
  } catch (err) {
    console.error('[paara] Razorpay client construction failed:', {
      message: err?.message,
      name: err?.name,
    });
    razorpay = null;
  }
} else {
  console.warn('[paara] Razorpay initialization notice: Razorpay keys are not configured.');
}

const safeExport = razorpay || {};
safeExport.isConfigured = () => Boolean(razorpay && razorpay.orders && typeof razorpay.orders.create === 'function');

module.exports = safeExport;
