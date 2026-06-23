/**
 * Authentication Middleware
 * Verifies JWT tokens and protects routes
 */
const jwt = require('jsonwebtoken');
const Submitter = require('../models/Submitter');

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  console.warn('⚠️ JWT_SECRET is not set');
}

/**
 * Middleware to verify JWT token
 */
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers.authorization;
  const token = authHeader?.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    console.error('❌ TOKEN INVALID:', err.message);
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
};

/**
 * Middleware to verify admin role
 */
const requireAdmin = (req, res, next) => {
  if (req.user?.role === 'admin') {
    return next();
  }
  return res.status(403).json({ error: 'Admin access required' });
};

/**
 * Middleware factory to verify specific roles
 * @param {string[]} allowedRoles - Array of allowed roles
 */
const requireRole = (allowedRoles) => (req, res, next) => {
  const userRole = req.user?.role;

  if (!userRole) {
    return res.status(403).json({ error: 'Authentication required' });
  }

  if (allowedRoles.includes(userRole)) {
    return next();
  }

  return res.status(403).json({
    error: `Access denied. Required roles: ${allowedRoles.join(', ')}`,
  });
};

/**
 * Generate JWT token
 */
const generateToken = (payload) => {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });
};

/**
 * Middleware to validate session token for single-session enforcement
 * This ensures only the most recent login session is valid
 * Should be used AFTER authenticateToken middleware
 *
 * The session token is sent via x-session-token header (not embedded in JWT)
 * because we need to validate the current token against the database on each request.
 * If the user logs in from another device, the DB token changes, invalidating previous sessions.
 */

const validateSession = async (req, res, next) => {
  try {
    const email = req.user?.email;

    // Get session token from header (primary) or fallback to JWT (backwards compatibility)
    const sessionToken =
      req.headers['x-session-token'] || req.user?.sessionToken;

    // If no email, can't validate
    if (!email) {
      return next();
    }

    // Per-request `isActive` check so an admin deactivating a user
    // immediately ejects their existing JWT session. Without this, the
    // user's JWT keeps working until natural expiry (7d) even after admin
    // flips them inactive. Mirrors the same response shape that
    // submitterController.applogin returns at login time so the iOS
    // app's existing ACCOUNT_DEACTIVATED handler picks it up and shows
    // the deactivation popup + force-logs out.
    const submitter = await Submitter.findByEmail(email);
    if (submitter && submitter.isActive === false) {
      return res.status(403).json({
        error:
          'Your account has been deactivated. Please contact an administrator.',
        code: 'ACCOUNT_DEACTIVATED',
      });
    }

    // If no sessionToken provided, skip validation (backwards compatibility for old tokens)
    if (!sessionToken) {
      return next();
    }

    const platform = req.user?.platform || 'web';
    const isValid = await Submitter.validateSessionToken(email, sessionToken, platform);

    if (!isValid) {
      return res.status(401).json({
        error:
          'Your session has expired. You may have logged in from another device.',
        code: 'SESSION_INVALIDATED',
      });
    }

    next();
  } catch (err) {
    console.error('Session validation error:', err);
    return res.status(500).json({ error: 'Session validation failed' });
  }
};

module.exports = {
  authenticateToken,
  requireAdmin,
  requireRole,
  generateToken,
  validateSession,
};
