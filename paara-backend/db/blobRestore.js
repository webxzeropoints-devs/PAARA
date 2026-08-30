const fs = require('fs');
const path = require('path');

const isServerless = !!process.env.VERCEL;
const BLOB_PATHNAME = 'paara-db/paara.db';
const blobStoreId = String(process.env.BLOB_STORE_ID || '').trim();
const dbPath = isServerless ? '/tmp/paara.db' : (process.env.DB_PATH || path.join(__dirname, '..', 'paara.db'));

const blobDiagnostics = () => ({
  pathname: BLOB_PATHNAME,
  configuredStoreId: blobStoreId || '(not set)',
  hasReadWriteToken: Boolean(process.env.BLOB_READ_WRITE_TOKEN),
  hasOidcToken: Boolean(process.env.VERCEL_OIDC_TOKEN),
});

const storeIdFromUrl = (url) => {
  try {
    return new URL(url).hostname.split('.')[0] || '(not returned)';
  } catch {
    return '(not returned)';
  }
};

// Deliberately does NOT require better-sqlite3 or ./database. Requiring
// this file must never open/create the SQLite file itself, or it would
// defeat the fs.existsSync() checks below.
async function restoreBlobThenInit() {
  if (!isServerless) return;
  if (fs.existsSync(dbPath)) {
    console.log('[DB_RESTORE] Local Vercel database already exists; skipping restore.', blobDiagnostics());
    return;
  }

  const { get } = require('@vercel/blob');
  console.log('[DB_RESTORE] Looking for private database Blob.', blobDiagnostics());
  const blob = await get(BLOB_PATHNAME, {
    access: 'private',
    useCache: false,
    ...(blobStoreId ? { storeId: blobStoreId } : {}),
  });
  if (blob) {
    console.log('[DB_RESTORE] Private Blob found.', {
      ...blobDiagnostics(),
      effectiveStoreId: storeIdFromUrl(blob.blob.url),
      size: blob.blob.size,
      uploadedAt: blob.blob.uploadedAt?.toISOString?.() || blob.blob.uploadedAt,
      etag: blob.blob.etag,
    });
    const reader = blob.stream.getReader();
    const chunks = [];
    let totalLength = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = Buffer.from(value);
      chunks.push(chunk);
      totalLength += chunk.length;
    }
    fs.writeFileSync(dbPath, Buffer.concat(chunks, totalLength));
    console.log('[DB_RESTORE] Blob restored to /tmp/paara.db.', {
      ...blobDiagnostics(),
      effectiveStoreId: storeIdFromUrl(blob.blob.url),
      size: totalLength,
      uploadedAt: blob.blob.uploadedAt?.toISOString?.() || blob.blob.uploadedAt,
      etag: blob.blob.etag,
    });
    return;
  }

  // A null result means the private store is reachable but this is the first boot.
  console.log('[DB_RESTORE] Private Blob does not contain the database yet.', blobDiagnostics());
  try {
    const seedBuffer = require('./seed-data.js');
    fs.writeFileSync(dbPath, seedBuffer);
    console.log('[DB_RESTORE] No database Blob found; seeded /tmp/paara.db.');
  } catch (err) {
    console.error('[DB_RESTORE] Could not load embedded seed DB:', err.message);
    // leave it missing; database.js's schema.sql fallback below will create it fresh
  }
}

module.exports = { restoreBlobThenInit, dbPath, isServerless, storeIdFromUrl };