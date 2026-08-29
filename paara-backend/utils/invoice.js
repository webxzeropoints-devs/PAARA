const PDFDocument = require('pdfkit');

function money(value) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2 }).format(value || 0);
}

function createInvoicePdf(order, items, address) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    const doc = new PDFDocument({ margin: 50, size: 'A4' });
    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const invoiceDate = new Date(order.created_at).toLocaleDateString('en-IN', {
      day: '2-digit', month: 'short', year: 'numeric'
    });
    const left = doc.page.margins.left;
    const width = doc.page.width - doc.page.margins.left - doc.page.margins.right;
    const rule = (color = '#eadfce') => {
      doc.moveTo(left, doc.y).lineTo(left + width, doc.y).strokeColor(color).lineWidth(0.7).stroke();
      doc.moveDown(0.6);
    };
    doc.fillColor('#3d2b24').font('Helvetica-Bold').fontSize(25).text('PAARA');
    doc.fillColor('#8b6b43').font('Helvetica').fontSize(11).text('JEWELLERY INVOICE');
    doc.moveDown(0.5);
    rule('#d7b06b');
    doc.fillColor('#3d2b24').fontSize(10).text(`Order #${order.id}`);
    doc.text(`Date: ${invoiceDate}`);
    doc.text(`Status: ${(order.payment_status === 'paid' ? 'PAID' : order.status).toUpperCase()}`);
    if (order.razorpay_payment_id) doc.text(`Payment ID: ${order.razorpay_payment_id}`);
    doc.moveDown(1.2);
    if (address) {
      doc.fillColor('#8b6b43').font('Helvetica-Bold').fontSize(10).text('SHIPPING ADDRESS');
      doc.fillColor('#3d2b24').font('Helvetica').fontSize(10);
      doc.text(`${address.line1}${address.line2 ? `, ${address.line2}` : ''}`);
      doc.text(`${address.city}, ${address.state} - ${address.pincode}`);
    }
    doc.moveDown(1.2);
    doc.moveDown(1);
    doc.fillColor('#8b6b43').font('Helvetica-Bold').fontSize(11).text('ORDER ITEMS');
    doc.moveDown(0.4);
    const tableTop = doc.y;
    doc.rect(left, tableTop - 3, width, 22).fill('#f3eadb');
    doc.fillColor('#3d2b24').fontSize(9).text('ITEM', left + 8, tableTop + 4);
    doc.text('QTY', left + 335, tableTop + 4, { width: 40, align: 'right' });
    doc.text('AMOUNT', left + 390, tableTop + 4, { width: 95, align: 'right' });
    doc.y = tableTop + 27;
    items.forEach((item) => {
      const rowTop = doc.y;
      doc.font('Helvetica').fontSize(10).fillColor('#3d2b24').text(item.product_name, left + 8, rowTop, { width: 300 });
      doc.fontSize(9).fillColor('#8b6b43').text(`Unit price ${money(item.unit_price)}`, left + 8, rowTop + 13, { width: 300 });
      doc.fillColor('#3d2b24').text(String(item.quantity), left + 335, rowTop + 4, { width: 40, align: 'right' });
      doc.text(money(item.line_total), left + 390, rowTop + 4, { width: 95, align: 'right' });
      doc.y = rowTop + 34;
      rule();
    });
    doc.moveDown(0.3);
    doc.font('Helvetica').fontSize(10).fillColor('#3d2b24');
    doc.text(`Subtotal: ${money(order.subtotal)}`, left + 300, doc.y, { width: 185, align: 'right' });
    doc.text('Taxes: Included in product prices', left + 300, doc.y, { width: 185, align: 'right' });
    doc.text(`Shipping: ${money(order.shipping_amount)}`, left + 300, doc.y, { width: 185, align: 'right' });
    doc.moveDown(0.4);
    const totalTop = doc.y;
    doc.rect(left + 280, totalTop, 205, 29).fill('#3d2b24');
    doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(12).text(`TOTAL: ${money(order.total_amount)}`, left + 290, totalTop + 8, { width: 185, align: 'right' });
    doc.y = totalTop + 42;
    doc.fillColor('#8b6b43').font('Helvetica').fontSize(9).text('Thank you for choosing Paara.');
    doc.end();
  });
}

module.exports = { createInvoicePdf };
