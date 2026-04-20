/**
 * Password Reset Routes
 * Public endpoints for password reset flow
 */
const express = require('express');
const router = express.Router();
const {
  requestPasswordReset,
  validateResetToken,
  resetPassword,
} = require('../controllers/passwordResetController');

/**
 * POST /api/password/request-reset
 * Request a password reset email
 * Body: { email: string }
 */
router.post('/request-reset', requestPasswordReset);

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
