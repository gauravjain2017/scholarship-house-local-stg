/**
 * Dispute Routes
 *
 * API routes for handling ownership disputes
 */

const express = require('express');
const router = express.Router();
const {
  checkDuplicateAddress,
  createDispute,
  getMyDisputes,
  uploadProof,
  getAllDisputes,
  getDisputeById,
  resolveDispute,
  autoResolveExpired,
  sendReminders,
} = require('../controllers/disputeController');
const { authenticateToken, requireRole } = require('../middleware/auth');

// Public/authenticated routes
router.post('/check-duplicate', authenticateToken, checkDuplicateAddress);
router.post('/', authenticateToken, createDispute);
router.get('/my-disputes', authenticateToken, getMyDisputes);
router.post('/:disputeId/upload-proof', authenticateToken, uploadProof);

// Admin-only routes
router.get(
  '/',
  authenticateToken,
  requireRole(['admin', 'validator', 'team_member']),
  getAllDisputes
);
router.get(
  '/:disputeId',
  authenticateToken,
  requireRole(['admin', 'validator', 'team_member']),
  getDisputeById
);
router.post(
  '/:disputeId/resolve',
  authenticateToken,
  requireRole(['admin']),
  resolveDispute
);

// Cron/scheduled job routes (should be protected or called internally)
router.post(
  '/cron/auto-resolve',
  authenticateToken,
  requireRole(['admin']),
  autoResolveExpired
);
router.post(
  '/cron/send-reminders',
  authenticateToken,
  requireRole(['admin']),
  sendReminders
);

module.exports = router;
