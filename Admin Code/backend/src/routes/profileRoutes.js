/**
 * Profile routes — all require authentication.
 *
 * Mount in app.js with:
 *   const profileRoutes = require('./routes/profileRoutes');
 *   app.use('/api/profile', profileRoutes);
 */
const express = require('express');
const router = express.Router();
const { authenticateToken, validateSession } = require('../middleware/auth');
const profileController = require('../Controllers/profileController');

// Every route below requires a valid JWT + active session
router.use(authenticateToken);
router.use(validateSession);

router.get('/me', profileController.getProfile);
router.get('/check-email', profileController.checkEmailAvailable);
router.put('/update', profileController.updateProfile);
router.post('/change-password', profileController.changePassword);

module.exports = router;
