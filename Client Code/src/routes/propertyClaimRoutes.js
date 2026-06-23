/**
 * propertyClaimRoutes.js
 *
 * Mounts the POST /deals/:id/claim endpoint.
 *
 * Mounted in src/index.js as:
 *   app.use('/api/deals', propertyClaimRoutes);
 *
 * → Final URL: POST /api/deals/:id/claim
 */

const express = require('express');
const router = express.Router();

const { authenticateToken, validateSession } = require('../middleware/auth');
const { claimPropertyHandler } = require('../controllers/propertyClaimController');

// Every route below requires a valid JWT + active session
router.use(authenticateToken);
router.use(validateSession);

router.post('/:id/claim', claimPropertyHandler);

module.exports = router;