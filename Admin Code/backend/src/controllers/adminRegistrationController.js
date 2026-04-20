const {
  ScanCommand,
  GetCommand,
  UpdateCommand,
} = require('@aws-sdk/lib-dynamodb');
const { dynamoDB, TABLES } = require('../config/aws');
const Submitter = require('../models/Submitter');
const { sendRegistrationApprovedEmail } = require('../services/emailService');

/* ---------------- GET PENDING ---------------- */

exports.getPendingRegistrations = async (req, res) => {
  try {
    const result = await dynamoDB.send(
      new ScanCommand({
        TableName: TABLES.PENDING_REGISTRATIONS,
        FilterExpression: '#status = :pending',
        ExpressionAttributeNames: {
          '#status': 'status',
        },
        ExpressionAttributeValues: {
          ':pending': 'pending',
        },
      })
    );

    res.json(result.Items || []);
  } catch (err) {
    console.error('getPendingRegistrations error:', err);
    res.status(500).json({ error: 'Failed to fetch pending registrations' });
  }
};

/* ---------------- APPROVE ---------------- */

exports.approveRegistration = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email required' });

    const lowerEmail = email.toLowerCase();

    const { Item: pending } = await dynamoDB.send(
      new GetCommand({
        TableName: TABLES.PENDING_REGISTRATIONS,
        Key: { email: lowerEmail },
      })
    );

    console.log('APPROVE pending item:', {
      email: lowerEmail,
      status: pending?.status,
      hasHashedPassword: !!pending?.hashedPassword,
      hashedPasswordPrefix: pending?.hashedPassword?.slice(0, 10),
      keys: pending ? Object.keys(pending) : null,
    });

    if (!pending || pending.status !== 'pending') {
      return res.status(404).json({ error: 'Pending registration not found' });
    }

    const { firstName, lastName, phone, requestedUserType, hashedPassword } =
      pending;

    if (!hashedPassword) {
      return res.status(500).json({
        error: 'Pending registration missing hashed password',
      });
    }

    console.log('APPROVE about to create submitter:', {
      Email: lowerEmail,
      UserType: requestedUserType,
      Phone: phone || '',
      AuthKey: 'passwordHash',
      passwordHashPrefix: hashedPassword.slice(0, 10),
    });

    await Submitter.create({
      Email: lowerEmail,
      Name: `${firstName} ${lastName}`,
      Phone: phone || '',
      UserType: requestedUserType,

      Auth: {
        passwordHash: hashedPassword, // ✅ correct key
      },

      Access: {
        priority: false,
        partnership: false,
        turnkey: false,
      },
    });

    const verify = await dynamoDB.send(
      new GetCommand({
        TableName: TABLES.SUBMITTERS,
        Key: { Email: lowerEmail },
      })
    );

    console.log('APPROVE verify submitter item:', {
      hasAuth: !!verify.Item?.Auth,
      auth: verify.Item?.Auth,
    });

    await dynamoDB.send(
      new UpdateCommand({
        TableName: TABLES.PENDING_REGISTRATIONS,
        Key: { email: lowerEmail },
        UpdateExpression: 'SET #status = :approved',
        ExpressionAttributeNames: { '#status': 'status' },
        ExpressionAttributeValues: { ':approved': 'approved' },
      })
    );

    // Send approval notification email
    try {
      await sendRegistrationApprovedEmail(lowerEmail, firstName);
      console.log('✅ Registration approval email sent to:', lowerEmail);
    } catch (emailErr) {
      // Don't fail the approval if email fails
      console.error('⚠️ Failed to send approval email:', emailErr.message);
    }

    res.json({ success: true });
  } catch (err) {
    console.error('approveRegistration error:', err);
    res.status(500).json({ error: 'Approval failed' });
  }
};

/* ---------------- REJECT ---------------- */

exports.rejectRegistration = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email required' });
    }

    await dynamoDB.send(
      new UpdateCommand({
        TableName: TABLES.PENDING_REGISTRATIONS,
        Key: { email: email.toLowerCase() },
        UpdateExpression: 'SET #status = :rejected',
        ExpressionAttributeNames: {
          '#status': 'status',
        },
        ExpressionAttributeValues: {
          ':rejected': 'rejected',
        },
      })
    );

    res.json({ success: true });
  } catch (err) {
    console.error('rejectRegistration error:', err);
    res.status(500).json({ error: 'Rejection failed' });
  }
};
