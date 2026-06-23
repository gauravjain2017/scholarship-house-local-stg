const {
  PutCommand,
  GetCommand,
  ScanCommand,
  UpdateCommand,
} = require('@aws-sdk/lib-dynamodb');
const { dynamoDB, TABLES } = require('../config/aws');
const crypto = require('crypto');

const Submitter = {
  /**
   * Create a new submitter
   */
  create: async ({ Name, Email, Phone, acquisitionSpecialist, specialist, UserType, Access, Auth }) => {
    const email = Email.toLowerCase();

    // Check if submitter already exists
    const existing = await Submitter.findByEmail(email);
    if (existing) {
      throw new Error('Submitter with this email already exists');
    }

    const now = new Date().toISOString();

    const submitter = {
      Email: email,
      Name,
      Phone,
      acquisitionSpecialist,
      specialist: specialist || '',
      UserType,
      Access: {
        priority: Boolean(Access?.priority),
        partnership: Boolean(Access?.partnership),
        turnkey: Boolean(Access?.turnkey),
      },
      Auth,
      isActive: true,
      webSessionToken: null,  // Web portal single-session enforcement
      appSessionToken: null,  // Mobile app single-session enforcement
      lastLoginAt: null,
      createdAt: now,
      updatedAt: now,
    };

    if (!Auth?.passwordHash) {
      console.warn('⚠️ Creating submitter without passwordHash:', email);
    }

    await dynamoDB.send(
      new PutCommand({
        TableName: TABLES.SUBMITTERS,
        Item: submitter,
      })
    );
    console.log('DDB PUT ITEM:', submitter);

    return submitter;
  },

  /**
   * Find submitter by email (PK lookup)
   */
  findByEmail: async (email) => {
    const result = await dynamoDB.send(
      new GetCommand({
        TableName: TABLES.SUBMITTERS,
        Key: {
          Email: email.toLowerCase(),
        },
      })
    );

    return result.Item || null;
  },

  /**
   * Admin update submitter
   */
  updateByEmail: async (email, updates) => {
    const allowed = ['Name', 'FirstName', 'LastName', 'Phone', 'firstName', 'lastName', 'phone', 'UserType', 'Access', 'isActive', 'acquisitionSpecialist', 'specialist', 'Address','ProfileImage'];

    const updateExpressions = [];
    const names = {};
    const values = {};

    let idx = 0;
    for (const [key, value] of Object.entries(updates)) {
      if (!allowed.includes(key)) continue;

      const attr = `#a${idx}`;
      const val = `:v${idx}`;
      updateExpressions.push(`${attr} = ${val}`);
      names[attr] = key;
      values[val] = value;
      idx++;
    }

    if (!updateExpressions.length) return null;

    updateExpressions.push('#updatedAt = :updatedAt');
    names['#updatedAt'] = 'updatedAt';
    values[':updatedAt'] = new Date().toISOString();

    await dynamoDB.send(
      new UpdateCommand({
        TableName: TABLES.SUBMITTERS,
        Key: { Email: email.toLowerCase() },
        UpdateExpression: `SET ${updateExpressions.join(', ')}`,
        ExpressionAttributeNames: names,
        ExpressionAttributeValues: values,
      })
    );

    return await Submitter.findByEmail(email);
  },

  /**
   * Update password for a submitter (password reset)
   * IMPORTANT: This ONLY updates the password hash, preserving all other user data
   * @param {string} email - User's email
   * @param {string} hashedPassword - Already bcrypt-hashed password
   */
  updatePassword: async (email, hashedPassword) => {
    const lowerEmail = email.toLowerCase();

    // Verify user exists first
    const existing = await Submitter.findByEmail(lowerEmail);
    if (!existing) {
      throw new Error('User not found');
    }

    await dynamoDB.send(
      new UpdateCommand({
        TableName: TABLES.SUBMITTERS,
        Key: { Email: lowerEmail },
        UpdateExpression:
          'SET #auth.#pwdHash = :pwdHash, #updatedAt = :updatedAt',
        ExpressionAttributeNames: {
          '#auth': 'Auth',
          '#pwdHash': 'passwordHash',
          '#updatedAt': 'updatedAt',
        },
        ExpressionAttributeValues: {
          ':pwdHash': hashedPassword,
          ':updatedAt': new Date().toISOString(),
        },
        ConditionExpression: 'attribute_exists(Email)', // Safety: only update existing users
      })
    );
    return true;
  },

  /**
   * Update session token for single-session enforcement per platform.
   * Web and app sessions are tracked independently so a web login
   * does not invalidate an active app session and vice versa.
   * @param {string} email
   * @param {'web'|'app'} platform
   * @returns {string} The new session token
   */
  updateSessionToken: async (email, platform = 'web') => {
    const lowerEmail = email.toLowerCase();
    const sessionToken = crypto.randomBytes(32).toString('hex');
    const now = new Date().toISOString();
    const field = platform === 'app' ? 'appSessionToken' : 'webSessionToken';

    await dynamoDB.send(
      new UpdateCommand({
        TableName: TABLES.SUBMITTERS,
        Key: { Email: lowerEmail },
        UpdateExpression:
          'SET #tok = :tok, #lastLoginAt = :lastLoginAt, #updatedAt = :updatedAt',
        ExpressionAttributeNames: {
          '#tok': field,
          '#lastLoginAt': 'lastLoginAt',
          '#updatedAt': 'updatedAt',
        },
        ExpressionAttributeValues: {
          ':tok': sessionToken,
          ':lastLoginAt': now,
          ':updatedAt': now,
        },
      })
    );

    return sessionToken;
  },

  /**
   * Validate session token for a user against the correct platform slot.
   * @param {string} email
   * @param {string} sessionToken
   * @param {'web'|'app'} platform
   * @returns {boolean}
   */
  validateSessionToken: async (email, sessionToken, platform = 'web') => {
    if (!sessionToken) return false;

    const user = await Submitter.findByEmail(email);
    if (!user) return false;

    const field = platform === 'app' ? 'appSessionToken' : 'webSessionToken';
    return user[field] === sessionToken;
  },

  /**
   * Invalidate session token for a specific platform (logout).
   * @param {string} email
   * @param {'web'|'app'} platform
   */
  invalidateSessionToken: async (email, platform = 'web') => {
    const lowerEmail = email.toLowerCase();
    const field = platform === 'app' ? 'appSessionToken' : 'webSessionToken';

    await dynamoDB.send(
      new UpdateCommand({
        TableName: TABLES.SUBMITTERS,
        Key: { Email: lowerEmail },
        UpdateExpression: 'SET #tok = :null, #updatedAt = :updatedAt',
        ExpressionAttributeNames: {
          '#tok': field,
          '#updatedAt': 'updatedAt',
        },
        ExpressionAttributeValues: {
          ':null': null,
          ':updatedAt': new Date().toISOString(),
        },
      })
    );
  },

  /**
   * Invalidate ALL sessions (web + app) in one operation.
   * Used when an admin changes a user's role so the user is forced
   * to re-login on every platform with their new role applied.
   * @param {string} email
   */
  invalidateAllSessions: async (email) => {
    const lowerEmail = email.toLowerCase();

    await dynamoDB.send(
      new UpdateCommand({
        TableName: TABLES.SUBMITTERS,
        Key: { Email: lowerEmail },
        UpdateExpression:
          'SET #web = :null, #app = :null, #updatedAt = :updatedAt',
        ExpressionAttributeNames: {
          '#web': 'webSessionToken',
          '#app': 'appSessionToken',
          '#updatedAt': 'updatedAt',
        },
        ExpressionAttributeValues: {
          ':null': null,
          ':updatedAt': new Date().toISOString(),
        },
      })
    );
  },

  /**
   * Admin list submitters
   */
  listAll: async (filters = {}) => {
    const params = { TableName: TABLES.SUBMITTERS};
    const expressions = [];
    const names = {};
    const values = {};

    if (filters.userType) {
      expressions.push('#ut = :ut');
      names['#ut'] = 'UserType';
      values[':ut'] = filters.userType;
    }

    if (filters.priority !== undefined) {
      expressions.push('#acc.#p = :p');
      names['#acc'] = 'Access';
      names['#p'] = 'priority';
      values[':p'] = filters.priority;
    }

    if (expressions.length) {
      params.FilterExpression = expressions.join(' AND ');
      params.ExpressionAttributeNames = names;
      params.ExpressionAttributeValues = values;
    }


    const result = await dynamoDB.send(new ScanCommand(params));

    return (result.Items || []).map((u) => ({
      email: u.Email,
      firstName: u.Name?.split(' ')[0] || '',
      lastName: u.Name?.split(' ').slice(1).join(' ') || '',
      phone: u.Phone || '',
      role: u.role || u.UserType,
      specialist: u.specialist || '',
      acquisitionSpecialist: u.acquisitionSpecialist || '',
      priorityFirstAccess: !!u.Access?.priority,
      partnershipAccess: !!u.Access?.partnership,
      turnkeyAccess: !!u.Access?.turnkey,
      isActive: u.isActive !== false,
      createdAt: u.createdAt,
    }));
  },
};

module.exports = Submitter;
