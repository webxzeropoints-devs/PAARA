# Paara. — Backend (Node + Express + SQLite + Razorpay)

## Setup

```bash
npm install
cp .env.example .env
# then edit .env with your real Razorpay test keys (from dashboard.razorpay.com/app/keys)

npm run init-db     # creates paara.db and seeds cities/categories/sample products
npm start            # runs on http://localhost:4000
```

## What's included

| File | Purpose |
|---|---|
| `db/schema.sql` | Full table structure (products, categories, orders, cities, addresses, Instagram cache, etc.) |
| `db/init.js` | Creates tables + seeds your 10 cities and sample products |
| `utils/pricing.js` | GST calculation (18%, server-side only) |
| `utils/shipping.js` | Flat rate for your 10 named cities; km-based slab fallback (Haversine) for everywhere else |
| `routes/products.js` | List/filter products, single product + gallery + Instagram reviews |
| `routes/vault.js` | Today's drop, drop archive, countdown to next drop |
| `routes/addresses.js` | Authenticated saved-address list and creation endpoints used by checkout |
| `routes/orders.js` | Creates an order with **server-recalculated** prices — the frontend cart is never trusted |
| `routes/payment.js` | Razorpay order creation, signature verification, and webhook |
| `public/checkout.js` | Frontend script that drives the Razorpay Checkout.js modal |

## Editing your 10 city shipping rates

Open `db/init.js` and change the `cities` array — city name + flat rate in rupees. Anything outside those 10 falls back to the km-based calculation in `utils/shipping.js` (edit `SHIPPING_BASE_FEE`, `SHIPPING_RATE_PER_KM`, `SHIPPING_MAX_CAP` in `.env`).

**Note on distance-based shipping:** the km fallback needs a lat/lng for the customer's address. Pincode → lat/lng isn't wired up yet — the cleanest free option is the India Post Pincode API, or you can geocode once at checkout using any pincode-to-coordinates service and pass `lat`/`lng` when saving an address. Until that's wired up, addresses outside your 10 cities will get the `SHIPPING_MAX_CAP` default — safe, but worth finishing before launch.

## Razorpay setup checklist

1. Sign up at razorpay.com → Dashboard → Settings → API Keys → generate **test mode** keys first.
2. Put `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET` in `.env`.
3. For the webhook (Settings → Webhooks in the dashboard): point it at `https://yourdomain.com/api/payment/webhook`, subscribe to `payment.captured` and `payment.failed`, and put the webhook secret it gives you into `RAZORPAY_WEBHOOK_SECRET`.
4. Test with Razorpay's test card `4111 1111 1111 1111`, any future expiry, any CVV.
5. Only switch `rzp_test_` keys to `rzp_live_` once you've tested the full flow end to end.

## The payment flow, end to end

1. Frontend sends cart items + address → `POST /api/orders` → backend re-fetches every product's real price, computes GST + shipping, saves an order row, returns the total.
2. Frontend calls `POST /api/payment/create-razorpay-order` with that order's id → backend opens a Razorpay order for the exact stored amount.
3. Razorpay's Checkout.js modal opens (see `public/checkout.js`), customer pays.
4. On success, frontend sends the three values Razorpay returns to `POST /api/payment/verify` → backend recomputes the HMAC signature and only *then* marks the order paid and decrements stock.
5. The webhook (`POST /api/payment/webhook`) is a safety net that does the same thing server-to-server, in case step 4 never fires (tab closed, network drop, etc).

## Not yet included (next steps)

- Cart persistence table (this backend treats the cart as frontend-only state, validated at checkout)
- PDF invoice generation with GST breakup (the data's all there in `GET /api/orders/:id` — just needs a template)
- Admin routes for adding products/images and scheduling Vault release dates
- Wishlist, address book beyond a single insert, order status transitions to "shipped"/"delivered"
