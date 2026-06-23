const { ScanCommand } = require('@aws-sdk/lib-dynamodb');
const { dynamoDB, TABLES } = require('../config/aws');

// Shared cache: { portal_type -> [role_slug, ...] }
let _cachedRoles = null;
let _cacheExpiry = 0;
const CACHE_TTL_MS = 5 * 60 * 1000;

async function getAllPortalRoles() {
  if (_cachedRoles && Date.now() < _cacheExpiry) return _cachedRoles;

  const { Items = [] } = await dynamoDB.send(
    new ScanCommand({ TableName: TABLES.MANAGE_ROLES })
  );

  _cachedRoles = Items.reduce((acc, r) => {
    if (r.portal_type && r.role_slug) {
      if (!acc[r.portal_type]) acc[r.portal_type] = [];
      acc[r.portal_type].push(r.role_slug);
    }
    return acc;
  }, {});

  _cacheExpiry = Date.now() + CACHE_TTL_MS;
  return _cachedRoles;
}

/**
 * Middleware factory — allows access if req.user.role belongs to any of the given portal types.
 *
 * Usage:
 *   requirePortalAccess(['admin'])               // admin-portal roles only
 *   requirePortalAccess(['admin', 'client'])      // admin or client portal roles
 *   requirePortalAccess(['admin', 'client', 'submitter'])
 */
function requirePortalAccess(portalTypes) {
  if (!Array.isArray(portalTypes)) portalTypes = [portalTypes];

  return async (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    try {
      const allRoles = await getAllPortalRoles();
      const allowedSlugs = portalTypes.flatMap((pt) => allRoles[pt] || []);

      if (allowedSlugs.includes(req.user.role)) {
        return next();
      }

      return res.status(403).json({
        error: `Forbidden: Access requires a role in portal: ${portalTypes.join(', ')}`,
        actual: req.user.role,
      });
    } catch (err) {
      console.error('requirePortalAccess error:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  };
}

module.exports = requirePortalAccess;
