function formatOrderNumber(createdAt, id) {
  const rawDate = String(createdAt || '').replace(' ', 'T');
  const date = new Date(rawDate.endsWith('Z') ? rawDate : `${rawDate}Z`);
  const datePart = Number.isNaN(date.getTime())
    ? new Date().toISOString().slice(0, 10).replace(/-/g, '')
    : date.toISOString().slice(0, 10).replace(/-/g, '');
  return `ORD-${datePart}-${String(id).padStart(4, '0')}`;
}

module.exports = { formatOrderNumber };