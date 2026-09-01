const PAYMENT_METHODS = ['razorpay', 'manual_upi', 'cod'];

const buildManualUpiRequest = ({ order, customer, baseUrl = process.env.APP_URL || 'https://www.paarajewellery.in' }) => {
  const payeeName = process.env.UPI_PAYEE_NAME || 'Paara Jewellery';
  const upiId = process.env.UPI_ID || 'paara.jewellery@upi';
  const orderLabel = `Paara Order ${order.order_number || order.id}`;
  const params = new URLSearchParams({
    pa: upiId,
    pn: payeeName,
    am: String(Number(order.total_amount || 0)),
    cu: 'INR',
    tn: orderLabel,
  });
  const deepLink = `upi://pay?${params.toString()}`;
  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(deepLink)}`;

  return {
    method: 'manual_upi',
    name: 'manual_upi',
    label: 'UPI transfer',
    description: 'Scan the QR code or use the UPI link below, then submit your UTR for quick verification.',
    payee_name: payeeName,
    upi_id: upiId,
    order_id: order.id,
    order_number: order.order_number || order.id,
    amount: Number(order.total_amount || 0),
    currency: 'INR',
    deep_link: deepLink,
    qr_code_url: qrCodeUrl,
    instructions: `Pay ${payeeName} on ${upiId} for ${orderLabel}. After payment, share the transaction UTR below.`,
    confirmation_url: `${baseUrl.replace(/\/$/, '')}/order-confirmation?order_id=${encodeURIComponent(order.id)}&payment=success`
  };
};

const paymentProviders = {
  razorpay: {
    name: 'razorpay',
    label: 'Pay online',
    description: 'UPI, card, net banking or wallet via Razorpay',
    createPaymentRequest: (order, customer) => ({
      method: 'razorpay',
      order_id: order.id,
      order_number: order.order_number || order.id,
      amount: Number(order.total_amount || 0),
      currency: 'INR',
      customer_id: customer?.id || order.customer_id,
    }),
  },
  manual_upi: {
    name: 'manual_upi',
    label: 'UPI transfer',
    description: 'Pay manually with UPI and submit a UTR for admin verification',
    createPaymentRequest: (order, customer, options = {}) => buildManualUpiRequest({ order, customer, baseUrl: options.baseUrl }),
  },
  cod: {
    name: 'cod',
    label: 'Cash on Delivery',
    description: 'Pay in cash when your order arrives',
    createPaymentRequest: (order, customer) => ({
      method: 'cod',
      order_id: order.id,
      order_number: order.order_number || order.id,
      amount: Number(order.total_amount || 0),
      currency: 'INR',
      customer_id: customer?.id || order.customer_id,
    }),
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
  normalizePaymentMethod,
  paymentProviders,
  getPaymentProvider,
};
