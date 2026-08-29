function isPincode(value) {
  return typeof value === 'string' && /^\d{6}$/.test(value);
}

function isPositiveInt(value) {
  return Number.isInteger(Number(value)) && Number(value) > 0;
}

module.exports = { isPincode, isPositiveInt };
