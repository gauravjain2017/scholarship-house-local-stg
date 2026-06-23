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
const requireAdminPortal = require('../middleware/requireAdminPortal');

const {
  getPendingRegistrations,
  approveRegistration,
  rejectRegistration,
  getRejectRegistrations,
  updateRegistration,
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
const { getAllClaimProperties, updateClaimStatus, deleteClaimProperty } = require('../controllers/propertyClaimController');


router.get('/users', adminController.getAllUsers);

// Protect all admin routes: must be authenticated, session valid, and have an admin-portal role
router.use(authenticateToken);
router.use(validateSession);
router.use(requireAdminPortal); // Dynamically checks manage_roles table for portal_type='admin'

router.get('/user/:email', adminController.getAdminUser);



// Create a user (Add User modal). Admins and team members can create
// non-admin users; only admins may create admin users (enforced in the
// controller).
router.post('/users', adminController.createUser);

router.patch('/users/:email', adminController.updateUser);

// Permanently delete a user (admin-only).
router.delete(
  '/users/:email',
  requireRole(['admin']),
  adminController.deleteUser
);

router.post(
  '/create-role',
  requireRole(['admin']),
  adminController.createRole
);

router.get(
  '/roles',
  adminController.fetchAllRoles
);

router.delete(
  '/role/:id',
  requireRole(['admin']),
  adminController.deleteRole
);

router.get('/deals/pending', adminController.getPendingDeals);
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
router.get('/reject-registrations', getRejectRegistrations);
router.post('/approve-registration', approveRegistration);
router.post('/reject-registration', rejectRegistration);
router.patch('/registrations/:email', updateRegistration);

// Password reset endpoints (admin-initiated)
router.post('/trigger-password-reset', adminTriggerPasswordReset);
router.post('/set-temporary-password', adminSetTemporaryPassword);

// Claim properties
router.get('/claim-properties', getAllClaimProperties);
router.patch('/claim-properties/:id', updateClaimStatus);
router.delete('/claim-properties/:id', deleteClaimProperty);

// Notification endpoints
router.get('/notifications', getNotifications);
router.get('/notifications/:id', getNotificationById);
router.patch('/notifications/:id/read', markAsRead);
router.delete('/notifications/:id', requireRole(['admin']), deleteNotification);

module.exports = router;
