const {
  PutCommand,
  GetCommand,
  ScanCommand,
  UpdateCommand,
  DeleteCommand,
} = require('@aws-sdk/lib-dynamodb');
const { v4: uuidv4 } = require('uuid');
const { dynamoDB, TABLES } = require('../config/aws');

/**
 * ManageFilter model
 * Columns: id, label, slug, min_value, max_value, section, enabled, format, step
 */
const ManageFilter = {
  /**
   * Create a new filter
   */
  create: async (data) => {
    const now = new Date().toISOString();
    const item = {
      id: uuidv4(),
      label: data.label,
      slug: data.slug,
      min_value: data.min_value ?? null,
      max_value: data.max_value ?? null,
      section: data.section,
      enabled: data.enabled ?? true,
      format: data.format ?? null,
      step: data.step ?? null,
      created_at: now,
      updated_at: now,
    };

    await dynamoDB.send(
      new PutCommand({
        TableName: TABLES.MANAGE_FILTERS,
        Item: item,
      })
    );

    return item;
  },

  /**
   * Get a filter by ID
   */
  getById: async (id) => {
    const result = await dynamoDB.send(
      new GetCommand({
        TableName: TABLES.MANAGE_FILTERS,
        Key: { id },
      })
    );
    return result.Item || null;
  },

  /**
   * Get all filters
   */
  getAll: async () => {
    const result = await dynamoDB.send(
      new ScanCommand({
        TableName: TABLES.MANAGE_FILTERS,
      })
    );
    return result.Items || [];
  },

  /**
   * Update a filter by ID
   */
  update: async (id, data) => {
    const now = new Date().toISOString();
    const updateParts = [];
    const expressionValues = {};
    const expressionNames = {};

    const fields = ['label', 'slug', 'min_value', 'max_value', 'section', 'enabled', 'format', 'step'];

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
        TableName: TABLES.MANAGE_FILTERS,
        Key: { id },
        UpdateExpression: `SET ${updateParts.join(', ')}`,
        ExpressionAttributeValues: expressionValues,
        ExpressionAttributeNames: expressionNames,
        ReturnValues: 'ALL_NEW',
      })
    );

    return result.Attributes;
  },

  /**
   * Delete a filter by ID
   */
  delete: async (id) => {
    await dynamoDB.send(
      new DeleteCommand({
        TableName: TABLES.MANAGE_FILTERS,
        Key: { id },
      })
    );
    return { deleted: true };
  },
};

module.exports = ManageFilter;
