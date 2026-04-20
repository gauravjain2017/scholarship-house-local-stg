const { PutCommand } = require('@aws-sdk/lib-dynamodb');
const { dynamoDB, TABLES } = require('../config/aws');
const bcrypt = require('bcryptjs');
const { createNotification } = require('../services/notificationService');

exports.submitRegistrationRequest = async (req, res) => {
  try {
    const { email, firstName, lastName, phone, password, userType } = req.body;
    const requestedUserType = userType;
    if (
      !email ||
      !firstName ||
      !lastName ||
      !phone ||
      !password ||
      !requestedUserType
    ) {
      return res.status(400).json({
        error: 'Missing required registration fields',
      });
    }

    const allowedTypes = [
      'admin',
      'submitter',
      'team_member',
      'real_estate_professional',
      'wholesaler',
      'realtor',
      'bird_dogger',
      'client',
    ];

    const normalizedType = userType.toLowerCase();

    if (!allowedTypes.includes(normalizedType)) {
      return res.status(400).json({ error: 'Invalid user type' });
    }
    const hashedPassword = await bcrypt.hash(password, 10);
    await dynamoDB.send(
      new PutCommand({
        TableName: TABLES.PENDING_REGISTRATIONS,
        Item: {
          email: email.toLowerCase(),
          firstName,
          lastName,
          phone,
          hashedPassword, // TEMP — hash later
          requestedUserType: normalizedType,
          status: 'pending',
          createdAt: new Date().toISOString(),
        },
        ConditionExpression: 'attribute_not_exists(email)',
      })
    );

    // Send notification to admin about new registration
    await createNotification('new_registration', email.toLowerCase(),{action_performer_id:email.toLowerCase() });

    res.status(201).json({ success: true });
  } catch (err) {
    if (err.name === 'ConditionalCheckFailedException') {
      return res.status(409).json({
        error: 'A registration request already exists for this email',
      });
    }

    console.error('submitRegistrationRequest error:', err);
    res.status(500).json({ error: 'Failed to submit registration request' });
  }
};
