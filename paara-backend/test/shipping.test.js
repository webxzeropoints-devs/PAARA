const test = require('node:test');
const assert = require('node:assert/strict');
const { calculateShipping } = require('../utils/shipping');

test('uses the exact Chennai business rule for online payment', () => {
  const quote = calculateShipping({ city: 'Chennai', state: 'Tamil Nadu', paymentMethod: 'manual_upi', totalWeightKg: 0.5 });
  assert.equal(quote.method, 'flat_city_rate');
  assert.equal(quote.amount, 70);
  assert.notEqual(quote.amount, 0);
  assert.equal(quote.city, 'Chennai');
});

test('uses the exact Chennai business rule for COD payment', () => {
  const quote = calculateShipping({ city: 'Chennai', state: 'Tamil Nadu', paymentMethod: 'cod', totalWeightKg: 0.5 });
  assert.equal(quote.amount, 90);
  assert.notEqual(quote.amount, 0);
});

test('uses the exact other Tamil Nadu business rule for non-Chennai cities', () => {
  const online = calculateShipping({ city: 'Coimbatore', state: 'Tamil Nadu', paymentMethod: 'online', totalWeightKg: 1 });
  const cod = calculateShipping({ city: 'Coimbatore', state: 'Tamil Nadu', paymentMethod: 'cod', totalWeightKg: 1 });
  assert.equal(online.amount, 80);
  assert.equal(cod.amount, 100);
});

test('uses the exact Karnataka business rule for Bengaluru', () => {
  const online = calculateShipping({ city: 'Bengaluru', state: 'Karnataka', paymentMethod: 'manual_upi', totalWeightKg: 1 });
  const cod = calculateShipping({ city: 'Bengaluru', state: 'Karnataka', paymentMethod: 'cod', totalWeightKg: 1 });
  assert.equal(online.amount, 110);
  assert.equal(cod.amount, 130);
});

test('uses the exact Mumbai business rule for online and COD', () => {
  const online = calculateShipping({ city: 'Mumbai', state: 'Maharashtra', paymentMethod: 'manual_upi', totalWeightKg: 1 });
  const cod = calculateShipping({ city: 'Mumbai', state: 'Maharashtra', paymentMethod: 'cod', totalWeightKg: 1 });
  assert.equal(online.amount, 130);
  assert.equal(cod.amount, 150);
});
