const {
  PutCommand,
  GetCommand,
  ScanCommand,
  UpdateCommand,
} = require('@aws-sdk/lib-dynamodb');
const { v4: uuidv4 } = require('uuid');
const { dynamoDB, TABLES } = require('../config/aws');

/**
 * ManageHomepage model
 * Columns: id, type, payload, global_css, created_at, updated_at
 */
const ManageHomepage = {
  /**
   * Create a new homepage record
   */
  create: async (data) => {
    const now = new Date().toISOString();
    const item = {
      id: uuidv4(),
      type: data.type,
      payload: data.payload,
      global_css: data.global_css ?? '',
      created_at: now,
      updated_at: now,
    };

    await dynamoDB.send(
      new PutCommand({
        TableName: TABLES.MANAGE_HOMEPAGES,
        Item: item,
      })
    );

    return item;
  },

  /**
   * Get a homepage record by ID
   */
  getById: async (id) => {
    const result = await dynamoDB.send(
      new GetCommand({
        TableName: TABLES.MANAGE_HOMEPAGES,
        Key: { id },
      })
    );
    return result.Item || null;
  },

  /**
   * Get a homepage record by type (e.g. 'client')
   */
  getByType: async (type) => {
    const result = await dynamoDB.send(
      new ScanCommand({
        TableName: TABLES.MANAGE_HOMEPAGES,
        FilterExpression: '#t = :type',
        ExpressionAttributeNames: { '#t': 'type' },
        ExpressionAttributeValues: { ':type': type },
      })
    );
    return (result.Items && result.Items.length > 0) ? result.Items[0] : null;
  },

  /**
   * Update a homepage record by ID
   */
  update: async (id, data) => {
    const now = new Date().toISOString();
    const updateParts = [];
    const expressionValues = {};
    const expressionNames = {};

    const fields = ['type', 'payload', 'global_css'];

    fields.forEach((field) => {
      if (data[field] !== undefined) {
        updateParts.push(`#${field} = :${field}`);
        expressionValues[`:${field}`] = data[field];
        expressionNames[`#${field}`] = field;
      }
    });

    updateParts.push('#updated_at = :updated_at');
    expressionValues[':updated_at'] = now;
    expressionNames['#updated_at'] = 'updated_at';

    const result = await dynamoDB.send(
      new UpdateCommand({
        TableName: TABLES.MANAGE_HOMEPAGES,
        Key: { id },
        UpdateExpression: `SET ${updateParts.join(', ')}`,
        ExpressionAttributeValues: expressionValues,
        ExpressionAttributeNames: expressionNames,
        ReturnValues: 'ALL_NEW',
      })
    );

    return result.Attributes;
  },
};

module.exports = ManageHomepage;
