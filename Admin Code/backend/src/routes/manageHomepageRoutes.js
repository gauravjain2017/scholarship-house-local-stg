const express = require('express');
const router = express.Router();
const { authenticateToken, validateSession } = require('../middleware/auth');
const requireRole = require('../middleware/requireRole');
const manageHomepageController = require('../controllers/manageHomepageController');

// Public: get homepage layout by type (no auth required)
router.get('/public/:type',manageHomepageController.getHomepage);

router.use(authenticateToken, validateSession);

// Save or update homepage layout
router.post(
  '/',
  requireRole(['admin', 'team_member']),
  manageHomepageController.saveHomepage
);

// Get homepage layout by type
router.get(
  '/:type',
  requireRole(['admin', 'team_member', 'client', 'submitter']),
  manageHomepageController.getHomepage
);

module.exports = router;
