const {
  PutCommand,
  GetCommand,
  UpdateCommand,
  DeleteCommand,
  ScanCommand,
  QueryCommand,
} = require('@aws-sdk/lib-dynamodb');
const { dynamoDB, TABLES } = require('../config/aws');
const crypto = require('crypto');

// Resolve table name: prefer env-configured value, fall back to literal string.
const BUY_BOXES_TABLE = TABLES?.BUY_BOXES || 'buy_boxes';

const generateId = () => crypto.randomUUID();

const BuyBox = {

  create: async ({ user_id, name = '', filters_json, is_active = true }) => {
    const now = new Date().toISOString();
    const item = {
      id: generateId(),
      user_id: user_id.toLowerCase(),
      name,
      filters_json:
        typeof filters_json === 'string'
          ? filters_json
          : JSON.stringify(filters_json),
      is_active,
      createdAt: now,
      updatedAt: now,
    };

    await dynamoDB.send(
      new PutCommand({
        TableName: BUY_BOXES_TABLE,
        Item: item,
      })
    );

    // Return with filters_json parsed back to object for consistency
    return {
      ...item,
      filters_json:
        typeof item.filters_json === 'string'
          ? JSON.parse(item.filters_json)
          : item.filters_json,
    };
  },

  /**
   * Fetch a single buy-box by its primary key.
   *
   * @param {string} id
   * @returns {Promise<Object|null>}
   */
  findById: async (id) => {
    const result = await dynamoDB.send(
      new GetCommand({
        TableName: BUY_BOXES_TABLE,
        Key: { id },
      })
    );

    if (!result.Item) return null;

    return BuyBox._parse(result.Item);
  },

  /**
   * Fetch all buy-boxes belonging to a specific user.
   * Uses the UserIdIndex GSI when available; falls back to a filtered scan.
   *
   * @param {string} userId - User email address
   * @returns {Promise<Array>}
   */
  findByUserId: async (userId) => {
    const email = userId.toLowerCase();

    try {
      // Prefer GSI query (O(1) vs full-table scan)
      const result = await dynamoDB.send(
        new QueryCommand({
          TableName: BUY_BOXES_TABLE,
          IndexName: 'UserIdIndex',
          KeyConditionExpression: 'user_id = :uid',
          ExpressionAttributeValues: { ':uid': email },
        })
      );

      return (result.Items || []).map(BuyBox._parse);
    } catch (err) {
      // GSI may not exist in all environments — fall back to a scan
      if (err.name === 'ValidationException' || err.name === 'ResourceNotFoundException') {
        console.warn(
          '⚠️  BuyBox.findByUserId: UserIdIndex not found, falling back to scan.'
        );
        const scanResult = await dynamoDB.send(
          new ScanCommand({
            TableName: BUY_BOXES_TABLE,
            FilterExpression: 'user_id = :uid',
            ExpressionAttributeValues: { ':uid': email },
          })
        );
        return (scanResult.Items || []).map(BuyBox._parse);
      }
      throw err;
    }
  },

  /**
   * Return ALL active buy-boxes across all users.
   * Used by dealPublishNotifier to find every user whose filter may match a
   * newly published deal.
   *
   * @param {Object} [opts]
   * @param {boolean} [opts.is_active] - When true, only return active records
   * @returns {Promise<Array>}
   */
  getAll: async ({ is_active } = {}) => {
    const params = { TableName: BUY_BOXES_TABLE };

    if (is_active === true) {
      params.FilterExpression = 'is_active = :active';
      params.ExpressionAttributeValues = { ':active': true };
    }

    const result = await dynamoDB.send(new ScanCommand(params));
    return (result.Items || []).map(BuyBox._parse);
  },

  /**
   * Update mutable fields of an existing buy-box.
   *
   * @param {string} id
   * @param {Object} updates - Partial update: name, filters_json, is_active
   * @returns {Promise<Object|null>} Updated item, or null if not found
   */
  update: async (id, updates) => {
    const allowed = ['name', 'filters_json', 'is_active'];
    const expressions = [];
    const names = {};
    const values = {};

    for (const [key, value] of Object.entries(updates)) {
      if (!allowed.includes(key)) continue;

      const attr = `#${key}`;
      const val = `:${key}`;
      names[attr] = key;

      if (key === 'filters_json') {
        values[val] =
          typeof value === 'string' ? value : JSON.stringify(value);
      } else {
        values[val] = value;
      }

      expressions.push(`${attr} = ${val}`);
    }

    if (!expressions.length) return BuyBox.findById(id);

    names['#updatedAt'] = 'updatedAt';
    values[':updatedAt'] = new Date().toISOString();
    expressions.push('#updatedAt = :updatedAt');

    await dynamoDB.send(
      new UpdateCommand({
        TableName: BUY_BOXES_TABLE,
        Key: { id },
        UpdateExpression: `SET ${expressions.join(', ')}`,
        ExpressionAttributeNames: names,
        ExpressionAttributeValues: values,
      })
    );

    return BuyBox.findById(id);
  },

  /**
   * Delete a buy-box by id.
   *
   * @param {string} id
   * @returns {Promise<void>}
   */
  delete: async (id) => {
    await dynamoDB.send(
      new DeleteCommand({
        TableName: BUY_BOXES_TABLE,
        Key: { id },
      })
    );
  },

  // ── Internal helper ────────────────────────────────────────────────────────

  /**
   * Normalise a raw DynamoDB item: parse filters_json string → object.
   * @private
   */
  _parse: (item) => {
    if (!item) return null;
    let filters_json = item.filters_json;
    if (typeof filters_json === 'string') {
      try {
        filters_json = JSON.parse(filters_json);
      } catch {
        // Leave as string if it cannot be parsed; caller handles it
      }
    }
    return { ...item, filters_json };
  },
};

module.exports = BuyBox;
