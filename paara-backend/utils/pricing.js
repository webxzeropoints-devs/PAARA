const GST_PERCENT = 0;

/**
 * Product prices are already the final customer-facing price.
 * Do not add another 18% GST to the payable total.
 */
function calculateGST(subtotal) {
  const gstAmount = 0;
  return {
    gstPercent: GST_PERCENT,
    gstAmount,
    totalWithGST: round2(subtotal)
  };
}

function round2(n) {
  return Math.round(n * 100) / 100;
}

module.exports = { calculateGST, round2, GST_PERCENT };
