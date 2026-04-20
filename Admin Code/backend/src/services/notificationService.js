const Notification = require('../models/Notification');

const adminEmail = process.env.ADMIN_EMAIL;

/**
 * Create a notification and log errors without throwing
 * @param {string} notificationType - e.g. 'new_registration', 'deal_submitted'
 * @param {string} typeId - identifier related to the notification (email, deal id, etc.)
 * @param {object} [options] - optional overrides
 * @param {string} [options.admin_email] - override default admin email
 * @param {boolean} [options.notify] - override default notify flag
 * @param {string} [options.action_performer_id] - ID of the user who performed the action
 */
const createNotification = async (notificationType, typeId, options = {}) => {
  try {
    const notification = await Notification.create({
      notification_type: notificationType,
      admin_email: options.admin_email || adminEmail,
      notify: options.notify ?? false,
      type_id: typeId,
      action_performer_id: options.action_performer_id || null,
    });
    return notification;
  } catch (err) {
    console.error(`Failed to create ${notificationType} notification:`, err);
    return null;
  }
};

module.exports = { createNotification };
