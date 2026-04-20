const Submitter = require('../models/Submitter');
const { dynamoDB, TABLES } = require('../config/aws');
const { GetCommand } = require('@aws-sdk/lib-dynamodb');
const { createResponse } = require('../utils/response');

exports.getByEmail = async (event) => {
  const email = decodeURIComponent(event.pathParameters.email).toLowerCase();

  const result = await dynamoDB.send(
    new GetCommand({
      TableName: TABLES.SUBMITTERS,
      Key: { Email: email },
    })
  );

  if (!result.Item) {
    return createResponse(404, null);
  }

  return createResponse(200, {
    email: result.Item.Email,
    name: result.Item.Name,
    phone: result.Item.Phone || '',
    userType: result.Item.UserType,
  });
};

/**
 * Bulk register submitters from array
 * Expects body: { submitters: [ { Name, Email, Phone, UserType, Access } ] }
 */
// ADMIN ONLY — not used by frontend runtime
exports.bulkRegister = async (event) => {
  let body;
  try {
    body = typeof event.body === 'string' ? JSON.parse(event.body) : event.body;
  } catch {
    return createResponse(400, { error: 'Invalid JSON body' });
  }

  if (!Array.isArray(body.submitters)) {
    return createResponse(400, { error: 'Missing submitters array' });
  }

  const results = [];

  for (const s of body.submitters) {
    try {
      await dynamoDB.send(
        new PutCommand({
          TableName: TABLES.SUBMITTERS,
          Item: {
            Email: s.Email.toLowerCase(),
            Name: s.Name,
            Phone: s.Phone || '',
            UserType: s.UserType,
            Access: s.Access ?? 'standard',
          },
          ConditionExpression: 'attribute_not_exists(Email)',
        })
      );

      results.push({ email: s.Email, status: 'success' });
    } catch (err) {
      results.push({ email: s.Email, status: 'error', message: err.message });
    }
  }

  return createResponse(200, { results });
};
