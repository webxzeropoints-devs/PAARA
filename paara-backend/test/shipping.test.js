const test = require('node:test');
const assert = require('node:assert/strict');
const { calculateShipping } = require('../utils/shipping');

test('uses the configured flat rate for seeded cities', () => {
  const quote = calculateShipping({ city: 'Chennai', state: 'Tamil Nadu', paymentMethod: 'razorpay', totalWeightKg: 0.5 });
  assert.equal(quote.method, 'flat_city_rate');
  assert.equal(quote.amount, 0);
  assert.equal(quote.city, 'Chennai');
});

test('falls back to regional per-kg pricing for cities not in the flat-rate table', () => {
  const quote = calculateShipping({ city: 'Trivandrum', state: 'Kerala', paymentMethod: 'online', totalWeightKg: 0.5 });
  assert.equal(quote.method, 'region_per_kg');
  assert.equal(quote.region, 'Andhra Pradesh / Kerala / Karnataka');
  assert.equal(quote.amount, 55);
});
