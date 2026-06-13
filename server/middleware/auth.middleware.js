const { verifyToken } = require('../services/token.service');
const { verifyInviteJWT } = require('../utils/inviteToken');

/**
 * Middleware to verify agent JWT (from Authorization: Bearer <token>)
 */
function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authorization token required' });
  }
  try {
    const token = authHeader.split(' ')[1];
    req.user = verifyToken(token);
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

/**
 * Middleware factory to restrict to certain roles
 * @param {...string} roles - e.g. 'admin', 'agent'
 */
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: `Access denied. Required role: ${roles.join(' or ')}` });
    }
    next();
  };
}

/**
 * Middleware to verify invite JWT for customer socket auth
 * Used in Socket.io handshake validation
 */
function verifyInviteToken(token) {
  try {
    return verifyInviteJWT(token);
  } catch {
    return null;
  }
}

module.exports = { requireAuth, requireRole, verifyInviteToken };
