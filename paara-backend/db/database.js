require('dotenv').config();
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const { dbPath, isServerless, storeIdFromUrl, getLastPulledAt } = require('./blobRestore');
const blobReadWriteToken = String(process.env.BLOB_READ_WRITE_TOKEN || '').trim();
const blobStoreId = String(process.env.BLOB_STORE_ID || '').trim();
const blobAuthOptions = blobReadWriteToken
  ? { token: blobReadWriteToken }
  : (blobStoreId ? { storeId: blobStoreId } : {});
const tokenStoreId = blobReadWriteToken
  ? (() => {
    const parts = blobReadWriteToken.split('_');
    return parts.length > 3 && parts[3] ? `store_${parts[3]}` : '(not parseable)';
  })()
  : '(no read-write token)';

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

// TEMPORARY PATCH — remove when migrated to Postgres
let _db = new Database(dbPath);
_db.pragma('journal_mode = WAL');
_db.pragma('foreign_keys = ON');

// TEMPORARY PATCH — remove when migrated to Postgres
function reopen() {
  try {
    if (_db.open) _db.close();
  } catch (error) {
    console.warn('[DB_REOPEN] Could not close:', error.message);
  }
  _db = new Database(dbPath);
  _db.pragma('journal_mode = WAL');
  _db.pragma('foreign_keys = ON');
  console.log('[DB_REOPEN] Connection reopened from fresh /tmp/paara.db');
}

// TEMPORARY PATCH — remove when migrated to Postgres
// Promise mutex serializes mutating requests on a single serverless instance.
let writeQueue = Promise.resolve();
let lastPushAt = null;
let writesSinceLastPush = 0;

async function acquireWriteLock() {
  // TEMPORARY PATCH — remove when migrated to Postgres
  let release;
  const turn = new Promise((resolve) => {
    release = resolve;
  });
  const previous = writeQueue;
  writeQueue = writeQueue.then(() => turn);
  await previous;
  return release;
}

function markWrite() {
  // TEMPORARY PATCH — remove when migrated to Postgres
  writesSinceLastPush += 1;
}

// TEMPORARY PATCH — remove when migrated to Postgres
// READ half — restore lives in db/blobRestore.js and runs once before server.js loads.
async function persist() {
  if (!isServerless) return;
  if (lastPushAt && writesSinceLastPush === 0) return true;
  const pathname = 'paara-db/paara.db';
  const diagnostics = {
    pathname,
    configuredStoreId: blobStoreId || '(not set)',
    tokenStoreId,
    storeIdMismatch: Boolean(blobStoreId && blobReadWriteToken && tokenStoreId !== blobStoreId),
    hasReadWriteToken: Boolean(process.env.BLOB_READ_WRITE_TOKEN),
    hasOidcToken: Boolean(process.env.VERCEL_OIDC_TOKEN),
  };
  try {
    _db.pragma('wal_checkpoint(TRUNCATE)');
    const { put } = require('@vercel/blob');
    const buf = fs.readFileSync(dbPath);
    console.log('[DB_PERSIST] Upload starting.', { ...diagnostics, size: buf.length });
    const uploadedBlob = await put(pathname, buf, {
      access: 'private',
      addRandomSuffix: false,
      allowOverwrite: true,
      ...blobAuthOptions,
    });
    console.log('[DB_PERSIST] Database uploaded to private Blob.', {
      ...diagnostics,
      effectiveStoreId: storeIdFromUrl(uploadedBlob.url),
      returnedPathname: uploadedBlob.pathname,
      size: buf.length,
      etag: uploadedBlob.etag,
      uploadedAt: uploadedBlob.uploadedAt?.toISOString?.() || uploadedBlob.uploadedAt,
    });
    lastPushAt = new Date().toISOString();
    writesSinceLastPush = 0;
    return true;
  } catch (err) {
    console.error('[DB_PERSIST] Private Blob upload failed.', {
      ...diagnostics,
      error: err.message,
      errorName: err.name,
      errorCode: err.code,
    });
    return false;
  }
}

// TEMPORARY PATCH — remove when migrated to Postgres
async function persistAfterWrite() {
  try {
    const persisted = await persist();
    if (persisted === false) {
      console.error('[PERSIST_FAILED]', 'Database write was not uploaded to Blob.');
    }
  } catch (persistErr) {
    console.error('[PERSIST_FAILED]', persistErr.message);
  }
}

function getSyncStatus() {
  // TEMPORARY PATCH — remove when migrated to Postgres
  return {
    lastPulledFromBlob: getLastPulledAt(),
    lastPushedToBlob: lastPushAt,
    dbFileSize: fs.existsSync(dbPath) ? fs.statSync(dbPath).size : 0,
    writesSinceLastPush,
  };
}

// TEMPORARY PATCH — remove when migrated to Postgres
const db = new Proxy({}, {
  get(_target, prop) {
    if (prop === 'reopen') return reopen;
    if (prop === 'persist') return persist;
    if (prop === 'persistAfterWrite') return persistAfterWrite;
    if (prop === 'isServerless') return isServerless;
    if (prop === 'acquireWriteLock') return acquireWriteLock;
    if (prop === 'markWrite') return markWrite;
    if (prop === 'getSyncStatus') return getSyncStatus;
    const value = _db[prop];
    return typeof value === 'function' ? value.bind(_db) : value;
  },
  set(_target, prop, value) {
    _db[prop] = value;
    return true;
  },
});

module.exports = db;