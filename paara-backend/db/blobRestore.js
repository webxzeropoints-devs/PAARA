const fs = require('fs');
const path = require('path');

const isServerless = !!process.env.VERCEL;
const BLOB_PATHNAME = 'paara-db/paara.db';
const dbPath = isServerless ? '/tmp/paara.db' : (process.env.DB_PATH || path.join(__dirname, '..', 'paara.db'));

// Deliberately does NOT require better-sqlite3 or ./database. Requiring
// this file must never open/create the SQLite file itself, or it would
// defeat the fs.existsSync() checks below.
async function restoreBlobThenInit() {
  if (!isServerless) return;
  if (fs.existsSync(dbPath)) return; // already restored earlier in this warm instance

  try {
    const { head } = require('@vercel/blob');
    const metadata = await head(BLOB_PATHNAME);
    if (metadata && metadata.url) {
      console.log('[DB Restore] Blob found, fetching from Vercel Blob...');
      const response = await fetch(metadata.url);
      if (!response.ok) throw new Error(`Fetch failed: ${response.statusText}`);
      const buffer = await response.arrayBuffer();
      fs.writeFileSync(dbPath, Buffer.from(buffer));
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