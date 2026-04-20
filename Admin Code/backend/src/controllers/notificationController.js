const Notification = require('../models/Notification');

exports.getNotifications = async (req, res) => {
  try {
    const { admin_email } = req.query;

    const notifications = admin_email
      ? await Notification.getByAdminEmail(admin_email)
      : await Notification.getAll();

    res.json({ notifications });
  } catch (err) {
    console.error('getNotifications error:', err);
    res.status(500).json({ error: 'Failed to fetch notifications' });
  }
};

/**
 * GET /api/notifications/my
 * Returns notifications where admin_email matches the logged-in user's email.
 * Uses authenticateToken only — no admin role required.
 */
exports.getMyNotifications = async (req, res) => {
  try {
    const email = req.user?.email;
    if (!email) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const notifications = await Notification.getByAdminEmail(email);
    res.json({ notifications });
  } catch (err) {
    console.error('getMyNotifications error:', err);
    res.status(500).json({ error: 'Failed to fetch notifications' });
  }
};

exports.getNotificationById = async (req, res) => {
  try {
    const { id } = req.params;
    const notification = await Notification.getById(id);
    if (!notification) {
      return res.status(404).json({ error: 'Notification not found' });
    }
	 res.json({ notification });
  } catch (err) {
    console.error('getNotificationById error:', err);
    res.status(500).json({ error: 'Failed to fetch notification' });
  }
};

exports.markAsRead = async (req, res) => {
  try {
    const { id } = req.params;
    const updated = await Notification.updateNotify(id, true);
    if (!updated) {
      return res.status(404).json({ error: 'Notification not found' });
    }
    res.json({ notification: updated });
  } catch (err) {
    console.error('markAsRead error:', err);
    res.status(500).json({ error: 'Failed to update notification' });
  }
};

exports.deleteNotification = async (req, res) => {
  try {
    const { id } = req.params;
    await Notification.delete(id);
    res.json({ success: true });
  } catch (err) {
    console.error('deleteNotification error:', err);
    res.status(500).json({ error: 'Failed to delete notification' });
  }
};
