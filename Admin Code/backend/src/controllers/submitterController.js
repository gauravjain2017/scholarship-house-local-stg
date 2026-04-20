const { generateToken } = require('../middleware/auth');
const bcrypt = require('bcryptjs');
const autHelp = require('../../backend_constants').authentication;
const { dynamoDB, TABLES } = require('../config/aws');
const { GetCommand } = require('@aws-sdk/lib-dynamodb');
const Submitter = require('../models/Submitter');


exports.submitterExists = async (req, res) => {
  try {
    const { email } = req.query;

    if (!email) {
      return res.json({ exists: false });
    }

    const submitter = await Submitter.findByEmail(email);
    return res.json({ exists: !!submitter });
  } catch (err) {
    console.error('submitterExists error:', err);
    return res.status(500).json({ exists: false });
  }
};

// Register a new submitter
/*
exports.register = async (req, res) => {
  try {
    const { Name, Email, Phone, UserType, Password, Role } = req.body;
    if (!Name || !Email || !Phone || !Password || !Role) {
      return res
        .status(400)
        .json({ error: 'Name, Email, Phone, Password, and Role are required' });
    }
    // Build Access object
    const hashedPassword = await bcrypt.hash(Password, 10);
    const Access = {
      Password: hashedPassword,
      role: Role,
      priority: false,
    };

    const submitter = await Submitter.create({
      Name,
      Email,
      Phone,
      UserType,
      Access,
    });
    res.status(201).json({
      email: submitter.Email,
      name: submitter.Name,
      userType: submitter.UserType,
      phone: submitter.Phone,
      access: submitter.Access,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

*/

// Authenticate submitter by email and password
exports.login = async (req, res) => {
  try {
    const { email, password, type } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const lowerEmail = email.toLowerCase();

    // First check if there's a pending registration
    try {
      const { Item: pendingReg } = await dynamoDB.send(
        new GetCommand({
          TableName: TABLES.PENDING_REGISTRATIONS,
          Key: { email: lowerEmail },
        })
      );

      if (pendingReg && pendingReg.status === 'pending') {
        return res.status(403).json({
          error:
            'Your registration is pending approval. Please wait for an administrator to approve your account.',
          code: 'PENDING_REGISTRATION',
        });
      }

      if (pendingReg && pendingReg.status === 'rejected') {
        return res.status(403).json({
          error:
            'Your registration was not approved. Please contact support for more information.',
          code: 'REGISTRATION_REJECTED',
        });
      }
    } catch (err) {
      console.warn('Error checking pending registration:', err.message);
      // Continue with login attempt even if pending check fails
    }

    const submitter = await autHelp.getUserByEmail(lowerEmail);

    // Check if user doesn't exist first
    if (!submitter) {
      console.log('Login failed: submitter not found');
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Check if account is deactivated
    if (submitter.isActive === false) {
      return res.status(403).json({
        error:
          'Your account has been deactivated. Please contact an administrator.',
        code: 'ACCOUNT_DEACTIVATED',
      });
    }

    const { generateToken } = require('../middleware/auth');

    // Validate password against stored hash
    const valid = await autHelp.checkPassword(lowerEmail, password);
    if (!valid) {
      console.log('Login failed: invalid password');
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // --- Role check ---
    // The frontend sends a `type` indicating which login portal was used
    // (submitter / client / admin). The actual role on the user record must
    // match what was requested:
    //   - type "submitter" -> user role must be "submitter"
    //   - type "client"    -> user role must be "client"
    //   - type "admin"     -> user role must be "team_member" or "admin"
    // IMPORTANT: do this BEFORE generating tokens or invalidating sessions,
    // so a mismatched login attempt doesn't wipe out that user's existing
    // session on another device.
    // Resolve the user's role: check UserType first, then Access.role as fallback.
    // Some older records store the role only inside Access.role.
    const userRole = String(
      submitter.UserType || submitter.Access?.role || ''
    ).toLowerCase();

    // IMPORTANT: do NOT silently default `type` here. If the frontend
    // forgets to send it, we must fail loudly instead of treating the
    // request as a submitter login (which would allow an admin-portal
    // request to succeed as a submitter login and vice versa).
    const requestedType = String(type || '').toLowerCase();

    const typeToAllowedRoles = {
      submitter: ['submitter'],
      client: ['client'],
      admin: ['team_member', 'admin'],
    };

    const allowedRoles = typeToAllowedRoles[requestedType];

 console.log('[login] requestedType:', requestedType, '| userRole:', userRole, '| raw type:', type);

    if (!requestedType || !allowedRoles) {
      return res.status(400).json({
        error: 'Invalid or missing login type.',
        code: 'INVALID_LOGIN_TYPE',
      });
    }

    if (!allowedRoles.includes(userRole)) {
      console.log(
        `Login failed: user ${lowerEmail} has role "${submitter.UserType}", not allowed for login type "${requestedType}"`
      );

      const errorByType = {
        submitter:
          'No submitter account found with this email address. Please use a submitter email to sign in.',
        client:
          'No client account found with this email address. Please use a client email to sign in.',
        admin:
          'No admin account found with this email address. Please use an admin email to sign in.',
      };

      return res.status(403).json({
        error: errorByType[requestedType],
        code: 'INVALID_ROLE',
      });
    }

    // Generate session token for single-session enforcement
    // This invalidates any previous sessions for this user
    const sessionToken = await Submitter.updateSessionToken(lowerEmail);

    // // Generate JWT token for submitter (include sessionToken in payload for validation)
    // console.log(
    //   'Generate token for:',
    //   submitter.Email,
    //   'with role:',
    //   submitter.UserType
    // );
    const token = generateToken({
      email: submitter.Email,
      role: submitter.UserType || submitter.Access?.role || 'submitter',
      priority: submitter.Access?.priority === true,
      partnership: submitter.Access?.partnership === true,
      turnkey: submitter.Access?.turnkey === true,
      sessionToken, // Include for single-session validation
    });
    // Return userType and address info (if present)
    res.json({
      token,
      sessionToken, // Return for client storage
      email: submitter.Email,
      name: submitter.Name,
      userType: submitter.UserType,
      phone: submitter.Phone,
      address: submitter.Address || null,
      access: submitter.Access || null,
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: err.message });
  }
};

exports.bulkRegister = async (req, res) => {
  console.log('Event body of register (controller):', req.body);

  try {
    const submitters = req.body.submitters;
    if (!Array.isArray(submitters)) {
      return res.status(400).json({ error: 'Missing submitters array' });
    }

    const results = [];

    for (const s of submitters) {
      try {
        const Name = String(s.Name || '').trim();
        const Email = String(s.Email || '')
          .trim()
          .toLowerCase();
        const Phone = String(s.Phone || '').trim();
        const UserType = s.UserType || 'submitter';
        const priority = Boolean(s.Access?.priority);
        const partnership = Boolean(s.Access?.partnership);
        const turnkey = Boolean(s.Access?.turnkey);

        if (!Name || !Email || !Phone) {
          throw new Error('Name, Email, and Phone are required');
        }

        await Submitter.create({
          Name,
          Email,
          Phone,
          UserType,

          Auth: {
            passwordHash: await bcrypt.hash('TEMP_RESET_REQUIRED', 10),
          },

          Access: {
            priority,
            partnership,
            turnkey,
          },
        });

        results.push({ email: Email, status: 'success' });
      } catch (err) {
        console.log('Error registering submitter:', s.Email, err);
        results.push({
          email: s.Email,
          status: 'error',
          message: err.message,
        });
      }
    }

    res.json({ results });
  } catch (err) {
    console.log('Bulk register error:', err);
    res.status(500).json({ error: err.message });
  }
};

/**
 * Logout a submitter - invalidates the session token
 */
exports.logout = async (req, res) => {
  try {
    const email = req.user?.email;

    if (!email) {
      return res.status(400).json({ error: 'No user email in token' });
    }

    // Invalidate the session token in the database
    await Submitter.invalidateSessionToken(email);

    res.json({ success: true, message: 'Logged out successfully' });
  } catch (err) {
    console.error('Logout error:', err);
    res.status(500).json({ error: err.message });
  }
};
