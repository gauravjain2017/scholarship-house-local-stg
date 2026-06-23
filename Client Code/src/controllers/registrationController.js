const { PutCommand } = require('@aws-sdk/lib-dynamodb');
const { dynamoDB, TABLES } = require('../config/aws');
const bcrypt = require('bcryptjs');
const { createNotification } = require('../services/notificationService');
const { sendNewClientRegistrationEmail } = require('../services/emailService');

exports.submitRegistrationRequest = async (req, res) => {
  try {

    const {
      email,
      firstName,
      lastName,
      phone,
      password,
      userType,
      specialist,
      acquisitionSpecialist,
    } = req.body;
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

    if (userType.toLowerCase() === 'client' && !specialist) {
      return res.status(400).json({
        error: 'Specialist is required for client registration',
      });
    }

    const normalizedType = userType.toLowerCase();
    const hashedPassword = await bcrypt.hash(password, 10);
    await dynamoDB.send(
      new PutCommand({
        TableName: TABLES.PENDING_REGISTRATIONS,
        Item: {
          email: email.toLowerCase(),
          firstName,
          lastName,
          phone,
          hashedPassword,
          requestedUserType: normalizedType,
		  acquisitionSpecialist: acquisitionSpecialist || '',
          specialist: specialist || '',
          status: 'pending',
          createdAt: new Date().toISOString(),
        },
        ConditionExpression: 'attribute_not_exists(email)',
      })
    );


    if (normalizedType === 'client') {
      await createNotification('new_registration', email.toLowerCase(), { action_performer_id: email.toLowerCase(), notify_specialist: specialist });
      // Notify the assigned specialist by email with the client's details
      if (specialist) {
        try {
          await sendNewClientRegistrationEmail({
            specialistEmail: specialist,
            clientEmail: email.toLowerCase(),
            clientFirstName: firstName,
            clientLastName: lastName,
            clientPhone: phone,
          });
        } catch (emailErr) {
          console.error('Failed to send registration email to specialist:', emailErr);
        }
      }
    } else {
      await createNotification('new_registration', email.toLowerCase(), { action_performer_id: email.toLowerCase() });
    }
    // Send notification to admin about new registration
    // await createNotification('new_registration', email.toLowerCase(),{action_performer_id:email.toLowerCase() });

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
