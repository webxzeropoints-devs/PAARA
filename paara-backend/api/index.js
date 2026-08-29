// Vercel routes every /api/* request here (see vercel.json).
// On Vercel we must restore /tmp/paara.db from Blob BEFORE requiring server.js,
// since server.js requires ./db/database at load time, which opens the file.
let cachedApp = null;

module.exports = async (req, res) => {
  if (!cachedApp) {
    if (process.env.VERCEL) {
      const { restoreBlobThenInit } = require('../db/blobRestore');
      await restoreBlobThenInit();
      console.log('[API Init] Blob restore complete, loading server.js...');
    }
    cachedApp = require('../server');
  }
  cachedApp(req, res);
};