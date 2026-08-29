require('dotenv').config();
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const { dbPath, isServerless } = require('./blobRestore');

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
  try {
    db.pragma('wal_checkpoint(TRUNCATE)');
    const { put } = require('@vercel/blob');
    const buf = fs.readFileSync(dbPath);
    await put('paara-db/paara.db', buf, { access: 'public', addRandomSuffix: false, allowOverwrite: true });
  } catch (err) {
    console.error('Blob DB persist failed:', err.message);
  }
}

module.exports = db;
module.exports.persist = persist;
module.exports.isServerless = isServerless;