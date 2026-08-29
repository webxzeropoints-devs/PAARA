require('dotenv').config();
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const isServerless = !!process.env.VERCEL;
const BLOB_PATHNAME = 'paara-db/paara.db';

// Local dev: use the repo's paara.db file directly, unchanged behaviour.
// On Vercel: the filesystem is read-only except /tmp, and /tmp is wiped
// between cold starts, so we copy the DB into /tmp and sync it to Vercel
// Blob storage (a persistent store) after writes.
const localSeedPath = process.env.DB_PATH || path.join(__dirname, '..', 'paara.db');
const dbPath = isServerless ? '/tmp/paara.db' : localSeedPath;

let ready = Promise.resolve();

if (isServerless) {
  ready = (async () => {
    if (fs.existsSync(dbPath)) return; // warm invocation, already restored
    try {
      const { head } = require('@vercel/blob');
      const info = await head(BLOB_PATHNAME).catch(() => null);
      if (info?.url) {
        const res = await fetch(info.url);
        const buf = Buffer.from(await res.arrayBuffer());
        fs.writeFileSync(dbPath, buf);
        return;
      }
    } catch (err) {
      console.error('Blob DB restore failed, falling back to seed copy:', err.message);
    }
    // No blob copy yet (first ever deploy) — seed /tmp from the bundled file.
    fs.copyFileSync(localSeedPath, dbPath);
  })();
}

const db = new Database(dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Call after any write on Vercel to persist /tmp/paara.db back to Blob.
// Cheap enough for this app's traffic; last-write-wins like the rest of
// the file-backed setup.
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
module.exports.ready = ready;
module.exports.persist = persist;
module.exports.isServerless = isServerless;
