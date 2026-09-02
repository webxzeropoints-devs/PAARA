const QRCode = require('qrcode');

const PAYMENT_METHODS = ['razorpay', 'manual_upi', 'cod'];
const MANUAL_UPI_PENDING_STATUS = 'Auto-confirmed - Unverified';
const MANUAL_UPI_VERIFIED_STATUS = 'verified';
const MANUAL_UPI_REJECTED_STATUS = 'rejected';
const MANUAL_UPI_CONFIRMED_STATUS = 'Order Confirmed';

const buildManualUpiRequest = async ({ order, customer, baseUrl = process.env.APP_URL || 'https://www.paarajewellery.in' }) => {
  const payeeName = String(process.env.UPI_PAYEE_NAME || '').trim();
  const upiId = String(process.env.UPI_ID || '').trim();
  if (!payeeName || !upiId) throw new Error('UPI payment is not configured.');
  const orderLabel = `Paara Order ${order.order_number || order.id}`;
  const amount = Number(order.total_amount || 0);
  const params = new URLSearchParams({
    pa: upiId,
    pn: payeeName,
    am: String(amount),
    cu: 'INR',
    tr: String(order.id),
    tn: orderLabel,
  });
  const deepLink = `upi://pay?${params.toString()}`;
  const qrCodeUrl = await QRCode.toDataURL(deepLink, { errorCorrectionLevel: 'M', margin: 1, width: 320 });

  return {
    method: 'manual_upi',
    name: 'manual_upi',
    label: 'Pay Now (Online)',
    description: 'Scan the QR or click the UPI link, then enter your UTR to submit the payment reference.',
    payee_name: payeeName,
    upi_id: upiId,
    order_id: order.id,
    order_number: order.order_number || order.id,
    amount,
    currency: 'INR',
    deep_link: deepLink,
    qr_code_url: qrCodeUrl,
    instructions: `Pay ${payeeName} on ${upiId} for ${orderLabel}. After payment, share the transaction UTR below.`,
    confirmation_url: `${baseUrl.replace(/\/$/, '')}/order-confirmation?order_id=${encodeURIComponent(order.id)}&payment=success`,
    order_status: MANUAL_UPI_CONFIRMED_STATUS,
    payment_status: MANUAL_UPI_PENDING_STATUS,
  };
};

const paymentProviders = {
  razorpay: {
    name: 'razorpay',
    label: 'Pay online',
    description: 'UPI, card, net banking or wallet via Razorpay',
    create: (order, customer) => ({
      method: 'razorpay',
      order_id: order.id,
      order_number: order.order_number || order.id,
      amount: Number(order.total_amount || 0),
      currency: 'INR',
      customer_id: customer?.id || order.customer_id,
    }),
    verify: () => ({ success: false, message: 'Razorpay verification is handled by the existing gateway flow.' }),
  },
  manual_upi: {
    name: 'manual_upi',
    label: 'Pay Now (Online)',
    description: 'Pay manually with UPI and submit a UTR for admin verification',
    create: async (order, customer, options = {}) => buildManualUpiRequest({ order, customer, baseUrl: options.baseUrl }),
    verify: (order, payload = {}) => {
      const reference = String(payload.payment_reference || payload.UTR || '').trim();
      if (!reference) {
        return { valid: false, message: 'UTR is required for manual UPI verification.' };
      }
      return {
        valid: true,
        payment_method: 'manual_upi',
        payment_reference: reference,
        payment_status: MANUAL_UPI_PENDING_STATUS,
        status: MANUAL_UPI_CONFIRMED_STATUS,
        message: 'Order Confirmed! We\'ll notify you once it ships.',
      };
    },
  },
  cod: {
    name: 'cod',
    label: 'Cash on Delivery',
    description: 'Pay in cash when your order arrives',
    create: (order, customer) => ({
      method: 'cod',
      order_id: order.id,
      order_number: order.order_number || order.id,
      amount: Number(order.total_amount || 0),
      currency: 'INR',
      customer_id: customer?.id || order.customer_id,
    }),
    verify: () => ({ success: false, message: 'COD is confirmed when the order is delivered.' }),
  },
};

const normalizePaymentMethod = (value) => {
  const normalized = String(value || '').trim().toLowerCase();
  if (PAYMENT_METHODS.includes(normalized)) return normalized;
  return 'razorpay';
};

const getPaymentProvider = (value) => {
  const normalized = normalizePaymentMethod(value);
  return paymentProviders[normalized] || paymentProviders.razorpay;
};

module.exports = {
  PAYMENT_METHODS,
  MANUAL_UPI_PENDING_STATUS,
  MANUAL_UPI_VERIFIED_STATUS,
  MANUAL_UPI_REJECTED_STATUS,
  MANUAL_UPI_CONFIRMED_STATUS,
  normalizePaymentMethod,
  paymentProviders,
  getPaymentProvider,
};
