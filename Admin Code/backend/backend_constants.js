/**
 * Sairam. Shri Gurubyo Namaha.
 *
 * Backend Constants Module.
 * This module defines and exports constant values used throughout the backend of the Deal Pipeline application.
 * These constants include configuration settings, default values, and other fixed parameters.
 */
console.log('🚨 backend_constants loaded');

const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { dynamoDB, TABLES } = require('./src/config/aws');
const {
  PutCommand,
  GetCommand,
  UpdateCommand,
  DeleteCommand,
  ScanCommand,
  QueryCommand,
} = require('@aws-sdk/lib-dynamodb');

// Check if we should use DynamoDB
const USE_DYNAMODB = process.env.USE_DYNAMODB === 'true';
// When neither Dynamo nor Mongo is configured, fall back to in-memory
const USE_MEMORY_ONLY = !USE_DYNAMODB && !process.env.MONGODB_URI;

console.log('[backend_constants] Initialization:');
console.log('  USE_DYNAMODB:', USE_DYNAMODB);
console.log(
  '  MONGODB_URI:',
  process.env.MONGODB_URI ? '***set***' : 'not set'
);
console.log('  USE_MEMORY_ONLY:', USE_MEMORY_ONLY);

// In-memory fallback when Dynamo/Mongo are unavailable
const inMemoryDeals = [];

//Schemas (for MongoDB compatibility)
const userSchema = new mongoose.Schema({
  email: { type: String, unique: true, required: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['user', 'admin'], default: 'user' },
  createdAt: { type: Date, default: Date.now },
});
const userModel = mongoose.model('User', userSchema);

const USERS_BASE = TABLES.SUBMITTERS;

console.log('AUTH: USE_DYNAMODB=', USE_DYNAMODB, 'USERS_BASE=', USERS_BASE);

const dealSchema = new mongoose.Schema({
  id: { type: String, unique: true, required: true },
  title: { type: String, required: true },
  description: { type: String, required: true },
  category: { type: String, required: true },
  price: { type: Number, required: true },

  discountPercentage: { type: Number },
  premiumFirstAccess: { type: Boolean, default: false },
  images: { type: [String], default: [] },
  videos: { type: [String], default: [] },
  textSections: { type: String },
  status: {
    type: String,
    default: 'pending',
    enum: ['pending', 'approved', 'rejected', 'published', 'sold', 'expired'],
  },
  submittedAt: { type: Date, default: Date.now },
  publishedAt: { type: Date },
  rejectionReason: { type: String },
});
const dealModel = mongoose.model('Deal', dealSchema);

//Authentication constants
const JWT_SECRET = process.env.JWT_SECRET || 'your_jwt_secret_key';
const SALT_ROUNDS = 10;

const hash = (password) => bcrypt.hashSync(password, SALT_ROUNDS);

const checkUserExistence = async (email) => {
  const user = await getUserByEmail(email);
  return !!user;
};

const getUserByEmail = async (email) => {
  if (USE_DYNAMODB) {
    const result = await dynamoDB.send(
      new GetCommand({
        TableName: USERS_BASE,
        Key: { Email: email.toLowerCase() },
      })
    );
    return result.Item || null;
  }
  return await userModel.findOne({ email: email.toLowerCase() });
};

const addUserToDynamoDB = async (userData) => {
  await dynamoDB.send(
    new PutCommand({
      TableName: USERS_BASE,
      Item: userData,
      ConditionExpression: 'attribute_not_exists(Email)',
    })
  );
  return userData;
};

const checkPassword = async (email, password) => {
  const user = await getUserByEmail(email);
  const stored = user?.Auth?.passwordHash;

  if (!stored) return false;

  return bcrypt.compare(password, stored);
};

//Deal storage constants
const checkDealExistence = async (dealId) => {
  if (USE_MEMORY_ONLY) {
    return inMemoryDeals.some((d) => d.id === dealId);
  }
  if (USE_DYNAMODB) {
    try {
      const result = await dynamoDB.send(
        new GetCommand({
          TableName: TABLES.PROPERTIES,
          Key: { id: dealId },
        })
      );
      return !!result.Item;
    } catch (err) {
      console.warn(
        'DynamoDB checkDealExistence failed, using memory fallback:',
        err?.name || err
      );
      return inMemoryDeals.some((d) => d.id === dealId);
    }
  }
  const deal = await dealModel.findOne({ id: dealId });
  return !!deal;
};

const addNewDeal = async (dealData) => {
  if (USE_MEMORY_ONLY) {
    inMemoryDeals.push(dealData);
    return dealData;
  }
  if (USE_DYNAMODB) {
    try {
      await dynamoDB.send(
        new PutCommand({
          TableName: TABLES.PROPERTIES,
          Item: dealData,
        })
      );
      return dealData;
    } catch (err) {
      console.warn(
        'DynamoDB addNewDeal failed, storing in memory:',
        err?.name || err
      );
      inMemoryDeals.push(dealData);
      return dealData;
    }
  }
  return await new dealModel(dealData).save();
};

const updateDeal = async (dealId, updatedData) => {
  if (USE_MEMORY_ONLY) {
    const idx = inMemoryDeals.findIndex((d) => d.id === dealId);
    if (idx >= 0)
      inMemoryDeals[idx] = { ...inMemoryDeals[idx], ...updatedData };
    return { id: dealId, ...updatedData };
  }
  if (USE_DYNAMODB) {
    Object.keys(updatedData).forEach((key) => {
      const v = updatedData[key];
      if (v === undefined || v === '' || Number.isNaN(v)) {
        delete updatedData[key];
      }
    });
    if (Object.keys(updatedData).length === 0) {
      console.warn('⚠️ updateDeal called with no valid fields');
      return { id: dealId, modifiedCount: 0 };
    }
    try {
      // Build update expression
      const updateExpressions = [];
      const expressionAttributeNames = {};
      const expressionAttributeValues = {};

      Object.keys(updatedData).forEach((key, index) => {
        const attrName = `#attr${index}`;
        const attrValue = `:val${index}`;
        updateExpressions.push(`${attrName} = ${attrValue}`);
        expressionAttributeNames[attrName] = key;
        expressionAttributeValues[attrValue] = updatedData[key];
      });

      await dynamoDB.send(
        new UpdateCommand({
          TableName: TABLES.PROPERTIES,
          Key: { id: dealId },
          UpdateExpression: `SET ${updateExpressions.join(', ')}`,
          ExpressionAttributeNames: expressionAttributeNames,
          ExpressionAttributeValues: expressionAttributeValues,
        })
      );
      return { id: dealId, ...updatedData };
    } catch (err) {
      console.warn(
        'DynamoDB updateDeal failed, updating memory copy:',
        err?.name || err
      );
      const idx = inMemoryDeals.findIndex((d) => d.id === dealId);
      if (idx >= 0)
        inMemoryDeals[idx] = { ...inMemoryDeals[idx], ...updatedData };
      return { id: dealId, ...updatedData };
    }
  }
  // MongoDB fallback
  if (!process.env.MONGODB_URI) {
    console.warn('No database configured for updateDeal');
    return { modifiedCount: 0 };
  }
  return await dealModel.updateOne({ id: dealId }, updatedData);
};

const deleteDeal = async (dealId) => {
  if (USE_MEMORY_ONLY) {
    const idx = inMemoryDeals.findIndex((d) => d.id === dealId);
    if (idx >= 0) inMemoryDeals.splice(idx, 1);
    return { deletedCount: 1 };
  }
  if (USE_DYNAMODB) {
    try {
      await dynamoDB.send(
        new DeleteCommand({
          TableName: TABLES.PROPERTIES,
          Key: { id: dealId },
        })
      );
      return { deletedCount: 1 };
    } catch (err) {
      console.warn(
        'DynamoDB deleteDeal failed, removing from memory:',
        err?.name || err
      );
      const idx = inMemoryDeals.findIndex((d) => d.id === dealId);
      if (idx >= 0) inMemoryDeals.splice(idx, 1);
      return { deletedCount: 1 };
    }
  }
  // MongoDB fallback
  if (!process.env.MONGODB_URI) {
    console.warn('No database configured for deleteDeal');
    return { deletedCount: 0 };
  }
  return await dealModel.deleteOne({ id: dealId });
};

const getDealById = async (dealId) => {
  if (USE_MEMORY_ONLY) {
    return inMemoryDeals.find((d) => d.id === dealId) || null;
  }

  if (USE_DYNAMODB) {
    try {
      const result = await dynamoDB.send(
        new GetCommand({
          TableName: TABLES.PROPERTIES, // ✅ FIX
          Key: { id: dealId },
        })
      );
      return result.Item || null;
    } catch (err) {
      console.warn('DynamoDB getDealById failed:', err?.name || err);
      return null;
    }
  }

  if (!process.env.MONGODB_URI) {
    console.warn('No database configured for getDealById');
    return null;
  }

  return await dealModel.findOne({ id: dealId });
};

const getAllDeals = async () => {
  console.log('🔍 SCANNING TABLE:', TABLES.PROPERTIES);
  console.log('🧠 DATA SOURCE:', {
    USE_DYNAMODB,
    USE_MEMORY_ONLY,
  });

  const result = await dynamoDB.send(
    new ScanCommand({
      TableName: TABLES.PROPERTIES,
    })
  );

  return result.Items || [];
};

const getDealsByStatusScan = async (statuses = []) => {
  // Support both a single string and an array of statuses
  const statusList = Array.isArray(statuses) ? statuses : [statuses];

  const filterExpression = statusList
    .map((_, i) => `#status = :status${i}`)
    .join(' OR ');

  const expressionAttributeValues = statusList.reduce((acc, status, i) => {
    acc[`:status${i}`] = status;
    return acc;
  }, {});

  const result = await dynamoDB.send(
    new ScanCommand({
      TableName: TABLES.PROPERTIES,
      FilterExpression: filterExpression,
      ExpressionAttributeNames: { '#status': 'status' },
      ExpressionAttributeValues: expressionAttributeValues,
    })
  );

  return result.Items || [];
};

const getDealsByStatus = async (status) => {
  if (USE_MEMORY_ONLY) {
    console.log(
      'Using in-memory storage for getDealsByStatus, current deals:',
      inMemoryDeals.length
    );
    return inMemoryDeals.filter((d) => d.status === status);
  }
  if (USE_DYNAMODB) {
    try {
      const result = await dynamoDB.send(
        new ScanCommand({
          TableName: TABLES.PROPERTIES,
          FilterExpression: '#status = :status',
          ExpressionAttributeNames: { '#status': 'status' },
          ExpressionAttributeValues: { ':status': status },
        })
      );
      return result.Items || [];
    } catch (err) {
      console.warn(
        'DynamoDB getDealsByStatus failed, using memory cache:',
        err?.name || err
      );
      return inMemoryDeals.filter((d) => d.status === status);
    }
  }
  // MongoDB fallback
  if (!process.env.MONGODB_URI) {
    console.warn('No database configured, returning empty array');
    return [];
  }
  return await dealModel.find({ status });
};

const approveDeal = async (dealId) => {
  if (USE_MEMORY_ONLY) {
    const idx = inMemoryDeals.findIndex((d) => d.id === dealId);
    if (idx >= 0) inMemoryDeals[idx].status = 'approved';
    return { modifiedCount: 1 };
  }

  if (USE_DYNAMODB) {
    try {
      await dynamoDB.send(
        new UpdateCommand({
          TableName: TABLES.PROPERTIES,
          Key: { id: dealId },
          UpdateExpression: 'SET #status = :status',
          ExpressionAttributeNames: {
            '#status': 'status',
          },
          ExpressionAttributeValues: {
            ':status': 'approved',
          },
        })
      );
      return { modifiedCount: 1 };
    } catch (err) {
      console.error('❌ DynamoDB approveDeal failed:', err);
      throw err;
    }
  }

  if (!process.env.MONGODB_URI) {
    console.warn('No database configured for approveDeal');
    return { modifiedCount: 0 };
  }

  return await dealModel.updateOne({ id: dealId }, { status: 'approved' });
};

const rejectDeal = async (dealId, reason) => {
  if (USE_MEMORY_ONLY) {
    const idx = inMemoryDeals.findIndex((d) => d.id === dealId);
    if (idx >= 0) {
      inMemoryDeals[idx].status = 'rejected';
      inMemoryDeals[idx].rejectionReason = reason;
    }
    return { modifiedCount: 1 };
  }
  if (USE_DYNAMODB) {
    try {
      await dynamoDB.send(
        new UpdateCommand({
          TableName: TABLES.PROPERTIES,
          Key: { id: dealId },
          UpdateExpression: 'SET #status = :status, #rejectionReason = :reason',
          ExpressionAttributeNames: {
            '#status': 'status',
            '#rejectionReason': 'rejectionReason',
          },
          ExpressionAttributeValues: {
            ':status': 'rejected',
            ':reason': reason,
          },
        })
      );
      return { modifiedCount: 1 };
    } catch (err) {
      console.warn(
        'DynamoDB rejectDeal failed, updating memory copy:',
        err?.name || err
      );
      const idx = inMemoryDeals.findIndex((d) => d.id === dealId);
      if (idx >= 0) {
        inMemoryDeals[idx].status = 'rejected';
        inMemoryDeals[idx].rejectionReason = reason;
      }
      return { modifiedCount: 1 };
    }
  }
  // MongoDB fallback
  if (!process.env.MONGODB_URI) {
    console.warn('No database configured for rejectDeal');
    return { modifiedCount: 0 };
  }
  return await dealModel.updateOne(
    { id: dealId },
    { status: 'rejected', rejectionReason: reason }
  );
};

const publishDeal = async (dealId) => {
  if (USE_MEMORY_ONLY) {
    const idx = inMemoryDeals.findIndex((d) => d.id === dealId);
    if (idx >= 0) {
      inMemoryDeals[idx].status = 'published';
      inMemoryDeals[idx].publishedAt = new Date().toISOString();
    }
    return { modifiedCount: 1 };
  }
  if (USE_DYNAMODB) {
    try {
      await dynamoDB.send(
        new UpdateCommand({
          TableName: TABLES.PROPERTIES,
          Key: { id: dealId },
          UpdateExpression:
            'SET #status = :status, #publishedAt = :publishedAt',
          ExpressionAttributeNames: {
            '#status': 'status',
            '#publishedAt': 'publishedAt',
          },
          ExpressionAttributeValues: {
            ':status': 'published',
            ':publishedAt': new Date().toISOString(),
          },
        })
      );
      return { modifiedCount: 1 };
    } catch (err) {
      console.warn(
        'DynamoDB publishDeal failed, updating memory copy:',
        err?.name || err
      );
      const idx = inMemoryDeals.findIndex((d) => d.id === dealId);
      if (idx >= 0) {
        inMemoryDeals[idx].status = 'published';
        inMemoryDeals[idx].publishedAt = new Date().toISOString();
      }
      return { modifiedCount: 1 };
    }
  }
  // MongoDB fallback
  if (!process.env.MONGODB_URI) {
    console.warn('No database configured for publishDeal');
    return { modifiedCount: 0 };
  }
  return await dealModel.updateOne(
    { id: dealId },
    { status: 'published', publishedAt: new Date() }
  );
};

const unpublishDeal = async (dealId) => {
  await dynamoDB.send(
    new UpdateCommand({
      TableName: TABLES.PROPERTIES,
      Key: { id: dealId },
      UpdateExpression: 'SET #status = :pending REMOVE publishedAt',
      ExpressionAttributeNames: {
        '#status': 'status',
      },
      ExpressionAttributeValues: {
        ':pending': 'pending',
      },
    })
  );
};

const validateDealData = (dealData) => {
  const isValid = !!(
    dealData.id &&
    dealData.description &&
    dealData.category &&
    typeof dealData.price === 'number' &&
    typeof dealData.id === 'string' &&
    typeof dealData.description === 'string' &&
    typeof dealData.category === 'string' &&
    typeof dealData.price === 'number' &&
    (dealData.premiumFirstAccess === undefined ||
      typeof dealData.premiumFirstAccess === 'boolean') &&
    (dealData.images === undefined || Array.isArray(dealData.images)) &&
    (dealData.videos === undefined || Array.isArray(dealData.videos)) &&
    (dealData.textSections === undefined ||
      typeof dealData.textSections === 'string')
  );
  return isValid;
};

module.exports = {
  schemas: { userModel: userModel, dealModel: dealModel },
  authentication: {
    //JWT_SECRET: JWT_SECRET,
    hash: hash,
    checkUserExistence: checkUserExistence,
    checkPassword: checkPassword,
    USE_DYNAMODB: USE_DYNAMODB,
    getUserByEmail: getUserByEmail,
    addUserToDynamoDB: addUserToDynamoDB,
  },
  dealStorage: {
    checkDealExistence: checkDealExistence,
    addNewDeal: addNewDeal,
    updateDeal: updateDeal,
    deleteDeal: deleteDeal,
    getDealById: getDealById,
    getAllDeals: getAllDeals,
    getDealsByStatusScan: getDealsByStatusScan,
    getDealsByStatus: getDealsByStatus,
    approveDeal: approveDeal,
    rejectDeal: rejectDeal,
    publishDeal: publishDeal,
    unpublishDeal: unpublishDeal,
    validateDealData: validateDealData,
  },
};
