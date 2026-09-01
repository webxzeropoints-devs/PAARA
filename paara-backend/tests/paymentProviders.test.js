const assert = require('node:assert/strict');

const { getPaymentProvider, PAYMENT_METHODS } = require('../utils/paymentProviders');

assert.ok(PAYMENT_METHODS.includes('manual_upi'), 'manual_upi should be a supported payment method');
const provider = getPaymentProvider('manual_upi');
assert.ok(provider && typeof provider.createPaymentRequest === 'function', 'manual UPI provider should define createPaymentRequest');
assert.equal(provider.name, 'manual_upi', 'provider name should match the method');

console.log('payment provider test passed');
