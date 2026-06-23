/**
 * Password Reset Routes
 * Public endpoints for password reset flow
 */
const express = require('express');
const router = express.Router();
const {
  requestPasswordReset,
  requestPasswordResetByEmail,
  validateResetToken,
  resetPassword,
} = require('../controllers/passwordResetController');

/**
 * POST /api/password/request-reset
 * Request a password reset email — used by the client & submitter websites,
 * caller supplies { email, userType }.
 */
router.post('/request-reset', requestPasswordReset);

/**
 * POST /api/password/request-reset-by-email
 * Mobile-app variant — caller supplies only { email }; userType is inferred
 * from the stored record. Returns 404 for unknown emails so the UI can
 * surface a clear error message.
 */
router.post('/request-reset-by-email', requestPasswordResetByEmail);

/**
 * GET /api/password/validate-token/:token
 * Validate a reset token (check if it's valid and not expired)
 */
router.get('/validate-token/:token', validateResetToken);

/**
 * POST /api/password/reset
 * Reset password with a valid token
 * Body: { token: string, newPassword: string }
 */
router.post('/reset', resetPassword);

module.exports = router;
