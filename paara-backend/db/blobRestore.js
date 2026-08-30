const fs = require('fs');
const path = require('path');

const isServerless = !!process.env.VERCEL;
const BLOB_PATHNAME = 'paara-db/paara.db';
const blobStoreId = String(process.env.BLOB_STORE_ID || '').trim();
const dbPath = isServerless ? '/tmp/paara.db' : (process.env.DB_PATH || path.join(__dirname, '..', 'paara.db'));

// Deliberately does NOT require better-sqlite3 or ./database. Requiring
// this file must never open/create the SQLite file itself, or it would
// defeat the fs.existsSync() checks below.
async function restoreBlobThenInit() {
  if (!isServerless) return;
  if (fs.existsSync(dbPath)) return; // already restored earlier in this warm instance

  try {
    const { get } = require('@vercel/blob');
    const blob = await get(BLOB_PATHNAME, {
      access: 'private',
      useCache: false,
      ...(blobStoreId ? { storeId: blobStoreId } : {}),
    });
    if (blob) {
      console.log('[DB Restore] Private Blob found, downloading database...');
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
      console.log('[DB Restore] Blob restored to /tmp/paara.db');
      return;
    }
  } catch (err) {
    console.log('[DB Restore] Blob restore skipped (does not exist or fetch failed):', err.message);
  }

  try {
    const seedBuffer = require('./seed-data.js');
    fs.writeFileSync(dbPath, seedBuffer);
    console.log('[DB Init] Seeded /tmp/paara.db from embedded seed data');
  } catch (err) {
    console.error('[DB Init] Could not load embedded seed DB:', err.message);
    // leave it missing; database.js's schema.sql fallback below will create it fresh
  }
}

module.exports = { restoreBlobThenInit, dbPath, isServerless };