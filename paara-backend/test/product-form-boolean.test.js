const test = require('node:test');
const assert = require('node:assert/strict');
const adminRouter = require('../routes/admin');

test('normalizeFormBoolean handles falsey strings from multipart uploads', () => {
  assert.equal(adminRouter.normalizeFormBoolean('false'), false);
  assert.equal(adminRouter.normalizeFormBoolean('0'), false);
  assert.equal(adminRouter.normalizeFormBoolean('true'), true);
  assert.equal(adminRouter.normalizeFormBoolean('1'), true);
  assert.equal(adminRouter.normalizeFormBoolean(false), false);
  assert.equal(adminRouter.normalizeFormBoolean(true), true);
});
