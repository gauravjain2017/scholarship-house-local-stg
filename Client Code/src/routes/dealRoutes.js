/**
 * Deal Routes
 * Routes for deal-related operations
 */
const express = require('express');
const router = express.Router();
const dealController = require('../controllers/dealController');
const { validate, createDealSchema } = require('../middleware/validation');
const { authenticateToken, validateSession } = require('../middleware/auth');
const requirePortalAccess = require('../middleware/requirePortalAccess');

// Submit / manage submissions (submitters allowed)
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
  requirePortalAccess(['admin']),
  dealController.markAsSold
);

router.post(
  '/:id/revert-sold',
  authenticateToken,
  requirePortalAccess(['admin']),
  dealController.revertSold
);

router.get(
  '/published',
  authenticateToken,
  validateSession,
  requirePortalAccess(['admin', 'client']),
  dealController.getPublishedDeals
);

router.get(
  '/get-filter',
  authenticateToken,
  requirePortalAccess(['admin', 'client']),
  dealController.getfilter
);

router.post(
  '/store-filter',
  authenticateToken,
  requirePortalAccess(['admin', 'client']),
  dealController.storefilter
);

router.delete(
  '/delete-filter',
  authenticateToken,
  requirePortalAccess(['admin', 'client']),
  dealController.deletefilter
);

router.get(
  '/manage-filters',
  authenticateToken,
  requirePortalAccess(['admin', 'client']),
  dealController.getManageFilter
);

router.post(
  '/manage-filters',
  authenticateToken,
  requirePortalAccess(['admin', 'client']),
  dealController.storeManageFilter
);

router.post(
  '/store-tax-rate',
  authenticateToken,
  requirePortalAccess(['admin', 'client']),
  dealController.storeManageTaxRate
);

router.get(
  '/tax-rate-settings',
  authenticateToken,
  requirePortalAccess(['admin', 'client']),
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
  requirePortalAccess(['admin', 'client', 'submitter']),
  dealController.getDealById
);

module.exports = router;
