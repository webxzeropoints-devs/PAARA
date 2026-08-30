// Vercel routes every /api/* request here (see vercel.json).
// On Vercel we must restore /tmp/paara.db from Blob BEFORE requiring server.js,
// since server.js requires ./db/database at load time, which opens the file.
let cachedApp = null;

module.exports = async (req, res) => {
  if (!cachedApp) {
    if (process.env.VERCEL) {
      const { restoreBlobThenInit } = require('../db/blobRestore');
      try {
        await restoreBlobThenInit();
      } catch (err) {
        console.error('[DB_RESTORE] Database restore failed; refusing to start with stale seed data:', err.message);
        res.statusCode = 503;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ ok: false, code: 'DATABASE_UNAVAILABLE', message: 'Database is temporarily unavailable.' }));
        return;
      }
      console.log('[DB_RESTORE] Restore complete; loading server.js.');
    }
    cachedApp = require('../server');
  }
  cachedApp(req, res);
};