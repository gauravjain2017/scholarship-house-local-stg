// Utility to calculate priority countdown
function getPriorityCountdown(submittedAt) {
  if (!submittedAt) return null;
  const now = new Date();
  const submitted = new Date(submittedAt);
  const msElapsed = now - submitted;
  const msInDay = 1000 * 60 * 60 * 24;
  const msInHour = 1000 * 60 * 60;
  const msInMinute = 1000 * 60;
  const daysLeft = 7 - Math.floor(msElapsed / msInDay);
  if (daysLeft > 1) {
    return { type: 'days', value: daysLeft };
  }
  const hoursLeft = Math.floor((7 * msInDay - msElapsed) / msInHour);
  if (daysLeft === 1 && hoursLeft > 1) {
    return { type: 'hours', value: hoursLeft };
  }
  const minutesLeft = Math.floor((7 * msInDay - msElapsed) / msInMinute);
  if (hoursLeft <= 1 && minutesLeft > 0) {
    return { type: 'minutes', value: minutesLeft };
  }
  return { type: 'expired', value: 0 };
}
const {
  PutCommand,
  GetCommand,
  ScanCommand,
  UpdateCommand,
  DeleteCommand,
} = require('@aws-sdk/lib-dynamodb');
const { dynamoDB, TABLES } = require('../config/aws');
const DEALS_TABLE =
  TABLES?.DEALS || process.env.PROPERTIES_TABLE || 'properties';
const crypto = require('crypto');

// Generate UUID without external dependency
const generateId = () => crypto.randomUUID();

class Deal {
  static async create(dealData) {
    const deal = {
      id: generateId(),
      ...dealData,
      status: 'pending',
      submittedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const params = {
      TableName: DEALS_TABLE,
      Item: deal,
    };

    await dynamoDB.send(new PutCommand(params));
    return deal;
  }

  static async getById(dealId) {
    const params = {
      TableName: DEALS_TABLE,
      Key: { id: dealId },
    };

    const result = await dynamoDB.send(new GetCommand(params));
    const deal = result.Item;
    if (deal && deal.priorityFirstAccess) {
      deal.priorityCountdown = getPriorityCountdown(deal.submittedAt);
    }
    return deal;
  }

  static async getByStatus(status, filters = {}) {
    let params = {
      TableName: DEALS_TABLE,
      FilterExpression: '#status = :status',
      ExpressionAttributeNames: {
        '#status': 'status',
      },
      ExpressionAttributeValues: {
        ':status': status,
      },
    };

    // Add category filter if provided
    if (filters.category && filters.category !== 'All') {
      params.FilterExpression += ' AND category = :category';
      params.ExpressionAttributeValues[':category'] = filters.category;
    }

    // Add search filter if provided
    if (filters.search) {
      params.FilterExpression += ' AND contains(title, :search)';
      params.ExpressionAttributeValues[':search'] = filters.search;
    }

    const result = await dynamoDB.send(new ScanCommand(params));
    const deals = result.Items || [];
    for (const deal of deals) {
      if (deal.priorityFirstAccess) {
        deal.priorityCountdown = getPriorityCountdown(deal.submittedAt);
      }
    }
    return deals;
  }

  static async getBySeller(sellerId) {
    const params = {
      TableName: DEALS_TABLE,
      FilterExpression: 'seller = :seller',
      ExpressionAttributeValues: {
        ':seller': sellerId,
      },
    };

    const result = await dynamoDB.send(new ScanCommand(params));
    const deals = result.Items || [];
    for (const deal of deals) {
      if (deal.priorityFirstAccess) {
        deal.priorityCountdown = getPriorityCountdown(deal.submittedAt);
      }
    }
    return deals;
  }

  static async getAll(filters = {}) {
    let params = {
      TableName: DEALS_TABLE,
    };

    // Build filter expression
    const filterExpressions = [];
    const expressionAttributeValues = {};
    const expressionAttributeNames = {};

    if (filters.status && filters.status !== 'All') {
      filterExpressions.push('#status = :status');
      expressionAttributeNames['#status'] = 'status';
      expressionAttributeValues[':status'] = filters.status;
    }

    if (filters.category && filters.category !== 'All') {
      filterExpressions.push('category = :category');
      expressionAttributeValues[':category'] = filters.category;
    }

    if (filters.search) {
      filterExpressions.push('contains(title, :search)');
      expressionAttributeValues[':search'] = filters.search;
    }

    if (filterExpressions.length > 0) {
      params.FilterExpression = filterExpressions.join(' AND ');
      params.ExpressionAttributeValues = expressionAttributeValues;
      if (Object.keys(expressionAttributeNames).length > 0) {
        params.ExpressionAttributeNames = expressionAttributeNames;
      }
    }

    const result = await dynamoDB.send(new ScanCommand(params));

    const deals = result.Items || [];
    for (const deal of deals) {
      if (deal.priorityFirstAccess) {
        deal.priorityCountdown = getPriorityCountdown(deal.submittedAt);
      }
    }
    return deals;
  }

  static async update(dealId, updates) {
    // Build update expression, skip id
    const updateExpressions = [];
    const expressionAttributeNames = {};
    const expressionAttributeValues = {};

    updates.updatedAt = new Date().toISOString();

    // Exclude id from updates
    const keys = Object.keys(updates).filter((key) => key !== 'id');
    keys.forEach((key, index) => {
      updateExpressions.push(`#attr${index} = :val${index}`);
      expressionAttributeNames[`#attr${index}`] = key;
      expressionAttributeValues[`:val${index}`] = updates[key];
    });

    if (updateExpressions.length === 0) {
      // Nothing to update
      return await this.getById(dealId);
    }

    const params = {
      TableName: DEALS_TABLE,
      Key: { id: dealId },
      UpdateExpression: `SET ${updateExpressions.join(', ')}`,
      ExpressionAttributeNames: expressionAttributeNames,
      ExpressionAttributeValues: expressionAttributeValues,
      ReturnValues: 'ALL_NEW',
    };

    const result = await dynamoDB.send(new UpdateCommand(params));
    return result.Attributes;
  }

  static async updateStatus(dealId, status, additionalData = {}) {
    const updates = {
      status,
      ...additionalData,
    };

    if (status === 'published') {
      updates.publishedAt = new Date().toISOString();
    }

    return this.update(dealId, updates);
  }

  static async delete(dealId) {
    const params = {
      TableName: DEALS_TABLE,
      Key: { id: dealId },
    };

    await dynamoDB.send(new DeleteCommand(params));
    return { success: true };
  }
}

module.exports = Deal;
