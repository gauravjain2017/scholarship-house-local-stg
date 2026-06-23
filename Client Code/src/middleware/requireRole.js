// backend/src/middleware/requireRole.js

/**
 * Usage:
 *   requireRole('admin')
 *   requireRole(['admin', 'team_member'])
 *
 * Assumes:
 *   req.user.role is already a canonical role string
 */
function requireRole(allowedRoles) {

  if (!Array.isArray(allowedRoles)) {
    allowedRoles = [allowedRoles];
  }

  const allowed = allowedRoles.map((r) => r.toLowerCase());
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const role = req.user.role;
    
    if (!allowed.includes(role)) {
      return res.status(403).json({
        error: 'Forbidden: Insufficient role',
        required: allowed,
        actual: role,
      });
    }

    next();
  };
}

module.exports = requireRole;
