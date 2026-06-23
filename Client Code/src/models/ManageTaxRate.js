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
 * ManageTaxRate model
 * Columns: id, appreciation_rate, client_share_forced_appreciation, design_setup,
 * federal_tax_rate, hold_years_timeline, initial_startup_costs, llc_joint_venture,
 * preferred_dist_rate, created_at, updated_at
 */
const ManageTaxRate = {

  /**
   * Create a new tax rate record
   */
  create: async (data) => {
    const now = new Date().toISOString();
    const item = {
      id: uuidv4(),
      appreciation_rate: data.appreciation_rate ?? null,
      client_share_forced_appreciation: data.client_share_forced_appreciation ?? null,
      design_setup: data.design_setup ?? null,
      federal_tax_rate: data.federal_tax_rate ?? null,
      hold_years_timeline: data.hold_years_timeline ?? null,
      initial_startup_costs: data.initial_startup_costs ?? null,
      llc_joint_venture: data.llc_joint_venture ?? null,
      preferred_dist_rate: data.preferred_dist_rate ?? null,
      created_at: now,
      updated_at: now,
    };

    await dynamoDB.send(
      new PutCommand({
        TableName: TABLES.MANAGE_TAX_RATES,
        Item: item,
      })
    );

    return item;
  },

  /**
   * Get a tax rate record by ID
   */
  getById: async (id) => {
    const result = await dynamoDB.send(
      new GetCommand({
        TableName: TABLES.MANAGE_TAX_RATES,
        Key: { id },
      })
    );
    return result.Item || null;
  },

  /**
   * Get all tax rate records
   */
  getAll: async () => {
    const result = await dynamoDB.send(
      new ScanCommand({
        TableName: TABLES.MANAGE_TAX_RATES,
      })
    );
    return result.Items || [];
  },

  /**
   * Update a tax rate record by ID
   */
  update: async (id, data) => {
    const now = new Date().toISOString();
    const updateParts = [];
    const expressionValues = {};
    const expressionNames = {};

    const fields = [
      'appreciation_rate',
      'client_share_forced_appreciation',
      'design_setup',
      'federal_tax_rate',
      'hold_years_timeline',
      'initial_startup_costs',
      'llc_joint_venture',
      'preferred_dist_rate',
    ];

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
        TableName: TABLES.MANAGE_TAX_RATES,
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
   * Delete a tax rate record by ID
   */
  delete: async (id) => {
    await dynamoDB.send(
      new DeleteCommand({
        TableName: TABLES.MANAGE_TAX_RATES,
        Key: { id },
      })
    );
    return { deleted: true };
  },
};

module.exports = ManageTaxRate;