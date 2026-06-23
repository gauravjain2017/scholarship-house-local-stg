const {
  ScanCommand,
  GetCommand,
  UpdateCommand,
} = require('@aws-sdk/lib-dynamodb');
const { dynamoDB, TABLES } = require('../config/aws');
const Submitter = require('../models/Submitter');
const { sendRegistrationApprovedEmail, sendClientApprovedToSpecialistEmail } = require('../services/emailService');

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

exports.getRejectRegistrations = async (req, res) => {
  try {
    const result = await dynamoDB.send(
      new ScanCommand({
        TableName: TABLES.PENDING_REGISTRATIONS,
        FilterExpression: "#status = :status",
        ExpressionAttributeNames: {
          "#status": "status",
        },
        ExpressionAttributeValues: {
          ":status": "rejected",
        },
      })
    );

    res.json(result.Items || []);
  } catch (err) {
    console.error("getRejectRegistrations error:", err);
    res.status(500).json({ error: "Failed to fetch rejected registrations" });
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

    // 🔍 DEBUG LOGS
    // console.log('=== APPROVE REGISTRATION DEBUG ===');
    // console.log('1. Input email:', lowerEmail);
    // console.log('2. Pending item found:', !!pending);
    // console.log('3. Pending item raw:', JSON.stringify(pending, null, 2));
    // console.log('4. Status value:', pending?.status);
    // console.log('5. Status type:', typeof pending?.status);
    // console.log('6. Condition checks:');
    // console.log('   - !pending              :', !pending);
    // console.log('   - status !== "pending"  :', pending?.status !== 'pending');
    // console.log('   - status !== "rejected" :', pending?.status !== 'rejected');
    // console.log('   - COMBINED (&&)         :', !pending || (pending?.status !== 'pending' && pending?.status !== 'rejected'));
    // console.log('==================================');

    if (!pending || (pending.status !== 'pending' && pending.status !== 'rejected')) {
      // console.log('❌ GUARD FAILED — returning 404');
      return res.status(404).json({ error: 'Pending registration not found' });
    }

    // console.log('✅ GUARD PASSED — proceeding with approval');

    const { firstName, lastName, phone,acquisitionSpecialist, requestedUserType, hashedPassword, specialist } = pending;



    if (!hashedPassword) {
      // console.log('❌ MISSING hashedPassword — returning 500');
      return res.status(500).json({
        error: 'Pending registration missing hashed password',
      });
    }
  
    await Submitter.create({
      Email: lowerEmail,
      Name: `${firstName} ${lastName}`,
      Phone: phone || '',
      acquisitionSpecialist: acquisitionSpecialist || '',
      specialist: specialist || '',
      UserType: requestedUserType,
      Auth: {
        passwordHash: hashedPassword,
      },
      Access: {
        priority: true,
        partnership: true,
        turnkey: true,
      },
    });

 
    console.log('✅ Submitter created successfully');

    const verify = await dynamoDB.send(
      new GetCommand({
        TableName: TABLES.SUBMITTERS,
        Key: { Email: lowerEmail },
      })
    );

    // console.log('8. Verify submitter:', {
    //   found: !!verify.Item,
    //   hasAuth: !!verify.Item?.Auth,
    //   auth: verify.Item?.Auth,
    // });

    await dynamoDB.send(
      new UpdateCommand({
        TableName: TABLES.PENDING_REGISTRATIONS,
        Key: { email: lowerEmail },
        UpdateExpression: 'SET #status = :approved',
        ExpressionAttributeNames: { '#status': 'status' },
        ExpressionAttributeValues: { ':approved': 'approved' },
      })
    );

    // console.log('✅ Pending registration status updated to approved');

    try {
      await sendRegistrationApprovedEmail(lowerEmail, firstName);
    } catch (emailErr) {
      console.error('Failed to send approval email to client:', emailErr.message);
    }

    if (requestedUserType === 'client' && specialist) {
      try {
        await sendClientApprovedToSpecialistEmail({
          specialistEmail: specialist,
          clientEmail: lowerEmail,
          clientFirstName: firstName,
          clientLastName: lastName,
          clientPhone: phone,
        });
      } catch (emailErr) {
        console.error('Failed to send approval email to specialist:', emailErr.message);
      }
    }

    res.json({ success: true });
  } catch (err) {
    console.error('❌ approveRegistration error:', err);
    res.status(500).json({ error: 'Approval failed' });
  }
};



/* ---------------- UPDATE REGISTRATION ---------------- */

exports.updateRegistration = async (req, res) => {
  try {
    const email = decodeURIComponent(req.params.email).toLowerCase();
    const { firstName, lastName, phone, role } = req.body;

    if (!email) return res.status(400).json({ error: 'Email required' });

    await dynamoDB.send(
      new UpdateCommand({
        TableName: TABLES.PENDING_REGISTRATIONS,
        Key: { email },
        UpdateExpression:
          'SET firstName = :fn, lastName = :ln, phone = :ph, requestedUserType = :role',
        ExpressionAttributeValues: {
          ':fn': firstName || '',
          ':ln': lastName || '',
          ':ph': phone || '',
          ':role': role || '',
        },
      })
    );

    res.json({ success: true });
  } catch (err) {
    console.error('updateRegistration error:', err);
    res.status(500).json({ error: 'Failed to update registration' });
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
