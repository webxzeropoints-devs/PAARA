const jwt = require('jsonwebtoken');

function requireAdminSession(req, res, next) {
  const legacyKey = req.headers['x-admin-key'];
  if (legacyKey && legacyKey === process.env.ADMIN_API_KEY) {
    req.admin = { id: 0, email: 'legacy-key-admin' };
    return next();
  }

  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Admin login required.' });

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    if (payload.role !== 'admin') return res.status(403).json({ error: 'Not an admin session.' });
    req.admin = { id: payload.id, email: payload.email };
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired admin session.' });
  }
}

module.exports = { requireAdminSession };
