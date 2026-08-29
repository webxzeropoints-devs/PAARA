const jwt = require('jsonwebtoken');

function requireAdmin(req, res, next) {
  const key = req.headers['x-admin-key'];
  if (key && process.env.ADMIN_API_KEY && key === process.env.ADMIN_API_KEY) {
    return next();
  }

  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (token) {
    try {
      const payload = jwt.verify(token, process.env.JWT_SECRET);
      if (payload.role === 'admin') { req.admin = { id: payload.id, email: payload.email }; return next(); }
    } catch (err) { /* fall through to rejection below */ }
  }

  return res.status(401).json({ error: 'Invalid or missing admin credentials.' });
}

module.exports = { requireAdmin };
