require('dotenv').config();
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const { dbPath, isServerless, storeIdFromUrl } = require('./blobRestore');
const blobStoreId = String(process.env.BLOB_STORE_ID || '').trim();

// By the time this file is required, api/index.js has already awaited
// restoreBlobThenInit() on Vercel — dbPath is guaranteed to contain either
// the Blob-restored data or the embedded seed snapshot. If somehow both
// failed, build a fresh schema so the app doesn't crash.
if (!fs.existsSync(dbPath)) {
  const schemaPath = path.join(__dirname, 'schema.sql');
  const tmpDb = new Database(dbPath);
  tmpDb.exec(fs.readFileSync(schemaPath, 'utf8'));
  tmpDb.close();
}

const db = new Database(dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// WRITE half — restore (READ half) lives in db/blobRestore.js, called from api/index.js.
async function persist() {
  if (!isServerless) return;
  const pathname = 'paara-db/paara.db';
  const diagnostics = {
    pathname,
    configuredStoreId: blobStoreId || '(not set)',
    hasReadWriteToken: Boolean(process.env.BLOB_READ_WRITE_TOKEN),
    hasOidcToken: Boolean(process.env.VERCEL_OIDC_TOKEN),
  };
  try {
    db.pragma('wal_checkpoint(TRUNCATE)');
    const { put } = require('@vercel/blob');
    const buf = fs.readFileSync(dbPath);
    console.log('[DB_PERSIST] Upload starting.', { ...diagnostics, size: buf.length });
    const uploadedBlob = await put(pathname, buf, {
      access: 'private',
      addRandomSuffix: false,
      allowOverwrite: true,
      ...(blobStoreId ? { storeId: blobStoreId } : {}),
    });
    console.log('[DB_PERSIST] Database uploaded to private Blob.', {
      ...diagnostics,
      effectiveStoreId: storeIdFromUrl(uploadedBlob.url),
      returnedPathname: uploadedBlob.pathname,
      size: buf.length,
      etag: uploadedBlob.etag,
      uploadedAt: uploadedBlob.uploadedAt?.toISOString?.() || uploadedBlob.uploadedAt,
    });
  } catch (err) {
    console.error('[DB_PERSIST] Private Blob upload failed.', {
      ...diagnostics,
      error: err.message,
      errorName: err.name,
      errorCode: err.code,
    });
    throw err;
  }
}

module.exports = db;
module.exports.persist = persist;
module.exports.isServerless = isServerless;