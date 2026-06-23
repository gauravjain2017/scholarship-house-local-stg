const {
  PutCommand,
  GetCommand,
  ScanCommand,
  UpdateCommand,
  DeleteCommand,
  QueryCommand,
} = require('@aws-sdk/lib-dynamodb');
const { dynamoDB, TABLES } = require('../config/aws');
const crypto = require('crypto');

const NOTIFICATIONS_TABLE = TABLES?.NOTIFICATIONS || 'notifications';

const generateId = () => crypto.randomUUID();

class Notification {
  /**
   * Create a new notification
   */
  static async create({ notification_type, admin_email, notify, type_id, action_performer_id }) {
    const notification = {
      id: generateId(),
      notification_type,
      admin_email,
      notify: notify ?? false,
      type_id: type_id || null,
      action_performer_id: action_performer_id || null,
      created_at: new Date().toISOString(),
    };

    const params = {
      TableName: NOTIFICATIONS_TABLE,
      Item: notification,
    };

    await dynamoDB.send(new PutCommand(params));
    return notification;
  }

  /**
   * Get notification by ID
   */
  static async getById(id) {
    const params = {
      TableName: NOTIFICATIONS_TABLE,
      Key: { id },
    };

    const result = await dynamoDB.send(new GetCommand(params));
    return result.Item || null;
  }

  /**
   * Get all notifications
   */
  static async getAll() {
    const params = {
      TableName: NOTIFICATIONS_TABLE,
    };

    const result = await dynamoDB.send(new ScanCommand(params));
    // Sort by created_at descending (newest first)
    return (result.Items || []).sort(
      (a, b) => new Date(b.created_at) - new Date(a.created_at)
    );
  }

  /**
   * Get notifications by admin email
   */
  static async getByAdminEmail(admin_email) {
    const params = {
      TableName: NOTIFICATIONS_TABLE,
      FilterExpression: 'admin_email = :email',
      ExpressionAttributeValues: {
        ':email': admin_email,
      },
    };

    const result = await dynamoDB.send(new ScanCommand(params));
    return (result.Items || []).sort(
      (a, b) => new Date(b.created_at) - new Date(a.created_at)
    );
  }

  /**
   * Get notifications by type
   */
  static async getByType(notification_type) {
    const params = {
      TableName: NOTIFICATIONS_TABLE,
      FilterExpression: 'notification_type = :type',
      ExpressionAttributeValues: {
        ':type': notification_type,
      },
    };

    const result = await dynamoDB.send(new ScanCommand(params));
    return (result.Items || []).sort(
      (a, b) => new Date(b.created_at) - new Date(a.created_at)
    );
  }

  /**
   * Update notify status
   */
  static async updateNotify(id, notify) {
    const params = {
      TableName: NOTIFICATIONS_TABLE,
      Key: { id },
      UpdateExpression: 'SET notify = :notify',
      ExpressionAttributeValues: {
        ':notify': notify,
      },
      ReturnValues: 'ALL_NEW',
    };

    const result = await dynamoDB.send(new UpdateCommand(params));
    return result.Attributes;
  }

  /**
   * Delete a notification
   */
  static async delete(id) {
    const params = {
      TableName: NOTIFICATIONS_TABLE,
      Key: { id },
    };

    await dynamoDB.send(new DeleteCommand(params));
    return { deleted: true };
  }
}

module.exports = Notification;
