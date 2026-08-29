/**
 * Frontend checkout flow for Paara.
 * Include Razorpay's script on your checkout page before this file:
 *   <script src="https://checkout.razorpay.com/v1/checkout.js"></script>
 *
 * Assumes you already have a JWT (from /api/auth/login or /register)
 * saved as `authToken`, and a cart array of { product_id, quantity }.
 */

const API_BASE = 'http://localhost:4000/api';

async function api(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${localStorage.getItem('authToken')}`,
      ...(options.headers || {})
    }
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

/**
 * Full checkout flow, called when the customer clicks "Pay Now".
 * @param {Array<{product_id:number, quantity:number}>} cartItems
 * @param {number} addressId
 */
async function checkout(cartItems, addressId) {
  try {
    // 1. Create the order server-side — this is where subtotal, GST and
    //    shipping are calculated for real, from DB prices, not the cart UI.
    const order = await api('/orders', {
      method: 'POST',
      body: JSON.stringify({ items: cartItems, address_id: addressId })
    });

    // 2. Ask the backend to open a Razorpay order for that exact amount.
    const rzp = await api('/payment/create-razorpay-order', {
      method: 'POST',
      body: JSON.stringify({ order_id: order.order_id })
    });

    // 3. Launch Razorpay's checkout modal.
    const razorpayCheckout = new Razorpay({
      key: rzp.key_id,
      amount: rzp.amount,
      currency: rzp.currency,
      name: 'Paara.',
      description: `Order #${order.order_id}`,
      order_id: rzp.razorpay_order_id,
      theme: { color: '#B98F4E' }, // champagne gold, matches the brand
      handler: async function (response) {
        // 4. On success, verify the payment server-side before showing
        //    a confirmation — this is the step that actually matters.
        try {
          await api('/payment/verify', {
            method: 'POST',
            body: JSON.stringify({
              paara_order_id: order.order_id,
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature
            })
          });
          window.location.href = `/order-confirmation.html?order_id=${order.order_id}`;
        } catch (err) {
          alert('Payment could not be verified. If money was deducted, it will be refunded automatically.');
        }
      },
      modal: {
        ondismiss: function () {
          console.log('Checkout closed without completing payment.');
        }
      }
    });

    razorpayCheckout.open();
  } catch (err) {
    alert(err.message || 'Something went wrong during checkout.');
  }
}
