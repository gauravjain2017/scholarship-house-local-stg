/**
 * Deal Routes
 * Routes for deal-related operations
 */
const express = require('express');
const router = express.Router();
const dealController = require('../controllers/dealController');
const { validate, createDealSchema } = require('../middleware/validation');
const { authenticateToken, validateSession } = require('../middleware/auth');
const requireRole = require('../middleware/requireRole');
const requireAdmin = require('../middleware/requireAdmin');

// Submit / manage submissions (submitters allowed)
// validateSession ensures only the most recent login session is valid
router.post(
  '/',
  authenticateToken,
  validateSession,
  validate(createDealSchema),
  dealController.createDeal
);

router.get(
  '/my-submissions',
  authenticateToken,
  validateSession,
  dealController.getMySubmissions
);

router.patch(
  '/:id',
  authenticateToken,
  validateSession,
  dealController.updateMyDeal
);

router.post(
  '/:id/unsubmit',
  authenticateToken,
  validateSession,
  dealController.unsubmitDeal
);

router.post(
  '/:id/mark-sold',
  authenticateToken,
  requireRole(['admin', 'team_member']),
  dealController.markAsSold
);

router.post(
  '/:id/revert-sold',
  authenticateToken,
  requireRole(['admin', 'team_member']),
  dealController.revertSold
);

router.get(
  '/published',
  authenticateToken,
  validateSession,
  requireRole(['client', 'admin', 'team_member']),
  dealController.getPublishedDeals
);

router.get(
  '/get-filter',
  authenticateToken,
  requireRole(['admin', 'team_member', 'client']),
  dealController.getfilter
);

router.post(
  '/store-filter',
  authenticateToken,
  requireRole(['admin', 'team_member', 'client']),
  dealController.storefilter
);

router.delete(
  '/delete-filter',
  authenticateToken,
  requireRole(['admin', 'team_member', 'client']),
  dealController.deletefilter
);

router.get(
  '/manage-filters',
  authenticateToken,
  requireRole(['admin', 'team_member', 'client']),
  dealController.getManageFilter
);

router.post(
  '/manage-filters',
  authenticateToken,
  requireRole(['admin', 'team_member', 'client']),
  dealController.storeManageFilter
);

router.post(
  '/store-tax-rate',
  authenticateToken,
  requireRole(['admin', 'team_member', 'client']),
  dealController.storeManageTaxRate
);

router.get(
  '/tax-rate-settings',
  authenticateToken,
  requireRole(['admin', 'team_member', 'client']),
  dealController.getManageTaxRate
);

// Public property view — no auth required (for shared links)
router.get(
  '/:id/public',
  dealController.getPublicDealById
);

router.get(
  '/:id',
  authenticateToken,
  validateSession,
  requireRole(['client', 'admin', 'team_member', 'submitter']),
  dealController.getDealById
);

module.exports = router;
