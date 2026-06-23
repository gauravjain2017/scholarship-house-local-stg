/**
 * Notification Routes (non-admin)
 * Accessible by any authenticated user — no role check.
 * Used by /property-notifications pages for client-role users.
 */
const express = require('express');
const router = express.Router();
const { authenticateToken, validateSession } = require('../middleware/auth');
const {
  getMyNotifications,
  getNotificationById,
  markAsRead,
  deleteNotification,
} = require('../controllers/notificationController');

router.use(authenticateToken);
router.use(validateSession);


router.get('/client', getMyNotifications);
router.get('/:id', getNotificationById);
router.patch('/:id/read', markAsRead);
router.delete('/:id', deleteNotification);

module.exports = router;
