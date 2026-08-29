require('dotenv').config();
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const isServerless = !!process.env.VERCEL;
const BLOB_PATHNAME = 'paara-db/paara.db';

// Local dev: use the repo's paara.db file directly, unchanged behaviour.
// On Vercel: the filesystem is read-only except /tmp, and /tmp is wiped
// between cold starts. We seed /tmp synchronously from the bundled DB file
// on every cold start (guarantees the schema/tables exist before ANY
// require() runs — several route files run db.prepare() at module load
// time, so this must be synchronous, not awaited).
const localSeedPath = process.env.DB_PATH || path.join(__dirname, '..', 'paara.db');
const dbPath = isServerless ? '/tmp/paara.db' : localSeedPath;

if (isServerless && !fs.existsSync(dbPath)) {
  fs.copyFileSync(localSeedPath, dbPath);
}

const db = new Database(dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Call after any write on Vercel to back up /tmp/paara.db to Blob storage.
// NOTE: this is a best-effort backup, not live cross-cold-start persistence
// — better-sqlite3 can't safely swap its open file out from under itself,
// so a brand-new cold start always starts from the bundled seed file again,
// not from the latest Blob backup. For a store handling real orders/payments,
// treat this as a safety net (and a way to manually pull recent writes),
// not as your actual database. Migrating to a hosted DB (Turso/Postgres) is
// the real fix if this needs to reliably retain data across cold starts.
async function persist() {
  if (!isServerless) return;
  try {
    db.pragma('wal_checkpoint(TRUNCATE)');
    const { put } = require('@vercel/blob');
    const buf = fs.readFileSync(dbPath);
    await put(BLOB_PATHNAME, buf, { access: 'public', addRandomSuffix: false, allowOverwrite: true });
  } catch (err) {
    console.error('Blob DB persist failed:', err.message);
  }
}

module.exports = db;
module.exports.ready = Promise.resolve();
module.exports.persist = persist;
module.exports.isServerless = isServerless;
