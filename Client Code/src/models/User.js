const bcrypt = require('bcryptjs');
const { dynamoDB, TABLES } = require('../config/aws');
const {
  PutCommand,
  GetCommand,
  UpdateCommand,
  ScanCommand,
  QueryCommand,
} = require('@aws-sdk/lib-dynamodb');
const { v4: uuidv4 } = require('uuid');
const { ROLES } = require('../utils/roles');

const VALID_ROLES = Object.values(ROLES);

const User = {
  create: async ({ email, password, firstName, lastName,acquisitionSpecialist, role = 'client' }) => {
    if (!VALID_ROLES.includes(role.toLowerCase())) {
      throw new Error(
        `Invalid role. Must be one of: ${VALID_ROLES.join(', ')}`
      );
    }

    const existingUser = await User.findByEmail(email);
    if (existingUser) {
      throw new Error('User with this email already exists');
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const userId = uuidv4();
    const now = new Date().toISOString();

    const user = {
      userId,
      email: email.toLowerCase(),
      passwordHash,
      firstName: firstName || '',
      lastName: lastName || '',
      acquisitionSpecialist: acquisitionSpecialist || '',
      role: role.toLowerCase(),
      isActive: true,
      createdAt: now,
      updatedAt: now,
    };

    await dynamoDB.send(
      new PutCommand({
        TableName: TABLES.USERS,
        Item: user,
      })
    );

    const { passwordHash: _, ...safeUser } = user;
    return safeUser;
  },

  findById: async (userId) => {
    const result = await dynamoDB.send(
      new GetCommand({
        TableName: TABLES.USERS,
        Key: { userId },
      })
    );

    if (!result.Item) return null;

    const { passwordHash, ...safeUser } = result.Item;
    return safeUser;
  },

  findByEmail: async (email) => {
    const result = await dynamoDB.send(
      new QueryCommand({
        TableName: TABLES.USERS,
        IndexName: 'EmailIndex',
        KeyConditionExpression: 'email = :email',
        ExpressionAttributeValues: {
          ':email': email.toLowerCase(),
        },
      })
    );

    return result.Items?.[0] ?? null;
  },

  authenticate: async (email, password) => {
    const user = await User.findByEmail(email);

    if (!user || !user.isActive) {
      throw new Error('Invalid email or password');
    }

    const isValid = await bcrypt.compare(password, user.passwordHash);
    if (!isValid) {
      throw new Error('Invalid email or password');
    }

    const { passwordHash, ...safeUser } = user;
    return safeUser;
  },

  update: async (userId, updates) => {
    const allowed = ['firstName', 'lastName', 'role', 'isActive', 'password','acquisitionSpecialist'];
    const expressions = [];
    const names = {};
    const values = {};

    for (const [key, value] of Object.entries(updates)) {
      if (!allowed.includes(key)) continue;

      if (key === 'password') {
        values[':passwordHash'] = await bcrypt.hash(value, 10);
        names['#passwordHash'] = 'passwordHash';
        expressions.push('#passwordHash = :passwordHash');
      } else if (key === 'role') {
        if (!VALID_ROLES.includes(value.toLowerCase())) {
          throw new Error(`Invalid role`);
        }
        names['#role'] = 'role';
        values[':role'] = value.toLowerCase();
        expressions.push('#role = :role');
      } else {
        names[`#${key}`] = key;
        values[`:${key}`] = value;
        expressions.push(`#${key} = :${key}`);
      }
    }

    if (!expressions.length) return User.findById(userId);

    names['#updatedAt'] = 'updatedAt';
    values[':updatedAt'] = new Date().toISOString();
    expressions.push('#updatedAt = :updatedAt');

    await dynamoDB.send(
      new UpdateCommand({
        TableName: TABLES.USERS,
        Key: { userId },
        UpdateExpression: `SET ${expressions.join(', ')}`,
        ExpressionAttributeNames: names,
        ExpressionAttributeValues: values,
      })
    );

    return User.findById(userId);
  },

  getAll: async (filters = {}) => {
    const params = { TableName: TABLES.USERS };

    if (filters.role) {
      params.FilterExpression = '#role = :role';
      params.ExpressionAttributeNames = { '#role': 'role' };
      params.ExpressionAttributeValues = {
        ':role': filters.role.toLowerCase(),
      };
    }

    const result = await dynamoDB.send(new ScanCommand(params));
    return result.Items.map(({ passwordHash, ...u }) => u);
  },
};

module.exports = { User };
