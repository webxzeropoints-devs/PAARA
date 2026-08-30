const GST_PERCENT = Number(process.env.GST_PERCENT || 18);

/**
 * Product prices are the pre-tax subtotal used for checkout calculations.
 * Always compute this server-side — never trust a total sent from the client.
 */
function calculateGST(subtotal) {
  const gstAmount = round2(subtotal * (GST_PERCENT / 100));
  return {
    gstPercent: GST_PERCENT,
    gstAmount,
    totalWithGST: round2(subtotal + gstAmount)
  };
}

function round2(n) {
  return Math.round(n * 100) / 100;
}

module.exports = { calculateGST, round2, GST_PERCENT };
