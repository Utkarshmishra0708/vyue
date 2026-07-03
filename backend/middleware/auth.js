const jwt = require('jsonwebtoken');
const { User } = require('../models');

// authenticate — reads Bearer token, verifies, loads user, stamps last_seen
async function authenticate(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) return res.status(401).json({ message: 'Missing token' });

    let payload;
    try {
      payload = jwt.verify(token, process.env.JWT_SECRET);
    } catch {
      return res.status(401).json({ message: 'Invalid or expired token' });
    }

    const user = await User.findByPk(payload.id, { attributes: { exclude: ['password_hash'] } });
    if (!user)          return res.status(401).json({ message: 'User not found' });
    if (!user.active)   return res.status(403).json({ message: 'User is inactive' });

    // Non-blocking last_seen stamp
    user.update({ last_seen: new Date() }).catch(() => {});

    req.user = user;
    return next();
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
}

// authorize(...roles) — allows only the listed roles
function authorize(...roles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ message: 'Unauthenticated' });
    if (!roles.length || roles.includes(req.user.role)) return next();
    return res.status(403).json({ message: 'Forbidden' });
  };
}

// isAdminOrPmo — convenience
const adminOnly = authorize('admin', 'pmo');

module.exports = { authenticate, authorize, adminOnly };
