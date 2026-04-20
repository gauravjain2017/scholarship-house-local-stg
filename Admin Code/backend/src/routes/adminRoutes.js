/**
 * Admin Routes
 * Routes for admin operations (protected)
 */
const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const { getAdminUser } = adminController;
const { authenticateToken, validateSession } = require('../middleware/auth');
const requireRole = require('../middleware/requireRole');
const {
  getPendingRegistrations,
  approveRegistration,
  rejectRegistration,
} = require('../controllers/adminRegistrationController');
const {
  adminTriggerPasswordReset,
  adminSetTemporaryPassword,
} = require('../controllers/passwordResetController');
const {
  getNotifications,
  getNotificationById,
  markAsRead,
  deleteNotification,
} = require('../controllers/notificationController');
const { expireDueDeals } = require('../services/expirationJob');

// Protect all admin routes with authentication, session validation, and admin role
router.use(authenticateToken);
router.use(validateSession);
router.use(requireRole(['admin', 'team_member'])); // Allow team members to access admin routes

router.get('/user/:email', adminController.getAdminUser);

router.get(
  '/users',
  requireRole(['admin', 'team_member']),
  adminController.getAllUsers
);
router.patch(
  '/users/:email',
  requireRole(['admin', 'team_member']),
  adminController.updateUser
);

router.get('/deals/pending', adminController.getAllDeals);
router.get('/deals', adminController.getAllDeals);
router.patch('/deals/:id', adminController.updateDeal);
router.post('/deals/:id/approve', adminController.approveDeal);
router.post('/deals/:id/reject', adminController.rejectDeal);
router.post('/deals/:id/publish', adminController.publishDeal);
router.post('/deals/:id/unpublish', adminController.unpublishDeal);
router.delete('/deals/:id', requireRole(['admin']), adminController.deleteDeal);
router.post('/deals/expire-now', requireRole(['admin']), async (_req, res) => {
  try {
    const result = await expireDueDeals();
    res.json({ success: true, ...result });
  } catch (err) {
    console.error('expire-now failed:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});
router.get('/pending-registrations', getPendingRegistrations);
router.post('/approve-registration', approveRegistration);
router.post('/reject-registration', rejectRegistration);

// Password reset endpoints (admin-initiated)
router.post(
  '/trigger-password-reset',
  requireRole(['admin', 'team_member']),
  adminTriggerPasswordReset
);
router.post(
  '/set-temporary-password',
  requireRole(['admin', 'team_member']),
  adminSetTemporaryPassword
);

// Notification endpoints
router.get('/notifications', getNotifications);
router.get('/notifications/:id', getNotificationById);
router.patch('/notifications/:id/read', markAsRead);
router.delete('/notifications/:id', requireRole(['admin']), deleteNotification);

module.exports = router;
