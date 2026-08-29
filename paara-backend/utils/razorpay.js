const Razorpay = require('razorpay');

let razorpay;
try {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keyId || !keySecret) throw new Error('Razorpay keys are not configured.');
  razorpay = new Razorpay({
    key_id: keyId,
    key_secret: keySecret,
  });
} catch (err) {
  console.warn('[paara] Razorpay initialization notice:', err.message);
  razorpay = {
    orders: {
      create: async () => {
        throw new Error('Razorpay keys not configured. Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in paara-backend/.env');
      }
    }
  };
}

module.exports = razorpay;
