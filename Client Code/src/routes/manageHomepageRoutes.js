const express = require('express');
const router = express.Router();
const { authenticateToken, validateSession } = require('../middleware/auth');
const requirePortalAccess = require('../middleware/requirePortalAccess');
const manageHomepageController = require('../controllers/manageHomepageController');

// Public: get homepage layout by type (no auth required)
router.get('/public/:type', manageHomepageController.getHomepage);

router.use(authenticateToken, validateSession);

// Save or update homepage layout (admin portal only)
router.post(
  '/',
  requirePortalAccess(['admin']),
  manageHomepageController.saveHomepage
);

// Get homepage layout by type (all portals)
router.get(
  '/:type',
  requirePortalAccess(['admin', 'client', 'submitter']),
  manageHomepageController.getHomepage
);

module.exports = router;
