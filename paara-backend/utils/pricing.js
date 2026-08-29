const GST_PERCENT = Number(process.env.GST_PERCENT || 18);

/**
 * Product prices are tax-inclusive. Keep the legacy return shape for stored
 * order fields, but do not add tax to the customer total.
 * Always compute this server-side — never trust a total sent from the client.
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
