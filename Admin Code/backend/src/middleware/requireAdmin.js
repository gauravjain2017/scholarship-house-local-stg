/**
 * Require Admin Middleware
 * Ensures only users with admin role can access protected routes
 */

const requireAdmin = (req, res, next) => {
  const timestamp = new Date().toISOString();
  const endpoint = `${req.method} ${req.originalUrl || req.url}`;
  const ip = req.ip || req.connection.remoteAddress;

  // Check if user is authenticated
  if (!req.user) {
    console.warn(`[AUDIT] ${timestamp} | UNAUTHORIZED | Endpoint: ${endpoint} | IP: ${ip} | Reason: No authentication`);
    return res.status(401).json({ 
      error: 'Not authenticated',
      message: 'You must be logged in to perform this action'
    });
  }

  // Check if user has admin role
  if (req.user.role !== 'admin') {
    console.warn(
      `[AUDIT] ${timestamp} | FORBIDDEN | User: ${req.user.email} | Role: ${req.user.role} | ` +
      `Endpoint: ${endpoint} | IP: ${ip} | Reason: Admin role required`
    );
    return res.status(403).json({ 
      error: 'Admin access required',
      message: 'Only administrators can perform this action'
    });
  }

  // User is admin, proceed
  console.log(`[AUDIT] ${timestamp} | GRANTED | Admin: ${req.user.email} | Endpoint: ${endpoint} | IP: ${ip}`);
  next();
};

module.exports = requireAdmin;
