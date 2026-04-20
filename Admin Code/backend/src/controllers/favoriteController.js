/**
 * Favorite Controller
 *
 * Handles user-specific property favoriting.
 * One row per favorite.
 *
 * Table: USER_FAVORITES
 * PK: email
 * SK: propertyId
 */

const { dynamoDB, TABLES } = require('../config/aws');
const {
  PutCommand,
  DeleteCommand,
  QueryCommand,
} = require('@aws-sdk/lib-dynamodb');

console.log('🧪 FAVORITES TABLE:', TABLES.USER_FAVORITES);

/**
 * GET /favorites
 * Return all favorited propertyIds for the authenticated user
 */
const getFavorites = async (req, res) => {
  if (!req.user?.email) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  try {
    const email = req.user?.email;
    if (!email) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const result = await dynamoDB.send(
      new QueryCommand({
        TableName: TABLES.USER_FAVORITES,
        KeyConditionExpression: '#email = :email',
        ExpressionAttributeNames: {
          '#email': 'email',
        },
        ExpressionAttributeValues: {
          ':email': email,
        },
      })
    );

    const favorites = (result.Items || []).map((item) => item.propertyId);
    res.json({ favorites });
  } catch (err) {
    console.error('❌ getFavorites failed:', err);
    res.status(500).json({ error: 'Failed to fetch favorites' });
  }
};

/**
 * POST /favorites/:propertyId
 * Add a favorite (idempotent)
 */
const addFavorite = async (req, res) => {
  if (!req.user?.email) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  try {
    const email = req.user?.email;
    const { propertyId } = req.params;

    if (!email) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    if (!propertyId) {
      return res.status(400).json({ error: 'propertyId required' });
    }

    await dynamoDB.send(
      new PutCommand({
        TableName: TABLES.USER_FAVORITES,
        Item: {
          email,
          propertyId,
          createdAt: new Date().toISOString(),
        },
        ConditionExpression: 'attribute_not_exists(propertyId)',
      })
    );

    res.status(201).json({ success: true });
  } catch (err) {
    // Conditional check failed = already favorited → idempotent success
    if (err.name === 'ConditionalCheckFailedException') {
      return res.status(200).json({ success: true });
    }

    console.error('❌ addFavorite failed:', err);
    res.status(500).json({ error: 'Failed to add favorite' });
  }
};

/**
 * DELETE /favorites/:propertyId
 * Remove a favorite (idempotent)
 */
const removeFavorite = async (req, res) => {
  if (!req.user?.email) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  try {
    const email = req.user?.email;
    const { propertyId } = req.params;

    if (!email) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    if (!propertyId) {
      return res.status(400).json({ error: 'propertyId required' });
    }

    await dynamoDB.send(
      new DeleteCommand({
        TableName: TABLES.USER_FAVORITES,
        Key: {
          email,
          propertyId,
        },
      })
    );

    res.json({ success: true });
  } catch (err) {
    console.error('❌ removeFavorite failed:', err);
    res.status(500).json({ error: 'Failed to remove favorite' });
  }
};

module.exports = {
  getFavorites,
  addFavorite,
  removeFavorite,
};
