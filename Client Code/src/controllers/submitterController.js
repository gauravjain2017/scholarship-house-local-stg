const { generateToken } = require('../middleware/auth');
const bcrypt = require('bcryptjs');
const autHelp = require('../../backend_constants').authentication;
const { dynamoDB, TABLES } = require('../config/aws');
const { GetCommand,ScanCommand } = require('@aws-sdk/lib-dynamodb');
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

exports.applogin = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const lowerEmail = email.toLowerCase();
    const submitter = await autHelp.getUserByEmail(lowerEmail);

    if (!submitter) {
      console.log('App login failed: submitter not found');
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Block deactivated accounts from signing in — mirrors the same guard
    // in the web `login` handler so the app and web behave consistently.
    // Checked BEFORE password validation so we don't leak whether the
    // password is correct for a deactivated account.
    if (submitter.isActive === false) {
      return res.status(403).json({
        error:
          'Your account has been deactivated. Please contact an administrator.',
        code: 'ACCOUNT_DEACTIVATED',
      });
    }

    const userType = String(submitter.UserType).toLowerCase();

    const { Items: roles } = await dynamoDB.send(
      new ScanCommand({
        TableName: TABLES.MANAGE_ROLES,
        FilterExpression: 'portal_type = :pt',
        ExpressionAttributeValues: { ':pt': 'admin' }
      })
    );

    const roleSlugs = roles.map(role => role.role_slug);

    if (roleSlugs.includes(userType)) {
      console.log(`App login failed: user ${lowerEmail} has role "${submitter.UserType}", not allowed for app login`);
      return res.status(403).json({ error: 'This account is not authorized for app login' });
    }

    const valid = await autHelp.checkPassword(lowerEmail, password);
    if (!valid) {
      console.log('App login failed: invalid password');
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const sessionToken = await Submitter.updateSessionToken(lowerEmail, 'app');

    const token = generateToken({
      email: submitter.Email,
      role: submitter.UserType || submitter.Access?.role || 'submitter',
      priority: submitter.Access?.priority === true,
      partnership: submitter.Access?.partnership === true,
      turnkey: submitter.Access?.turnkey === true,
      sessionToken,
      platform: 'app',
    });

    res.json({
      token,
      sessionToken,
      email: submitter.Email,
      name: submitter.Name,
      userType: submitter.UserType,
      phone: submitter.Phone,
      address: submitter.Address || null,
      access: submitter.Access || null,
      assignedPermissions: submitter.assignedPermissions || {},
    });
  } catch (err) {
    console.error('App login error:', err);
    res.status(500).json({ error: err.message });
  }
}




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
    const userRole = String(
      submitter.UserType || submitter.Access?.role || ''
    ).toLowerCase();

    const { Items: roles } = await dynamoDB.send(
      new ScanCommand({
        TableName: TABLES.MANAGE_ROLES,
      })
    );

    const requestedType = String(type || '').toLowerCase();

    const typeToAllowedRoles = roles.reduce((acc, { portal_type, role_slug }) => {
      acc[portal_type] = acc[portal_type] || [];
      acc[portal_type].push(role_slug);
      return acc;
    }, {});

    // Include the portal type slug itself to support legacy users (e.g. UserType: 'submitter')
    Object.keys(typeToAllowedRoles).forEach(portal_type => {
      if (!typeToAllowedRoles[portal_type].includes(portal_type)) {
        typeToAllowedRoles[portal_type].push(portal_type);
      }
    });

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

      const portalBaseUrls = {
        admin: process.env.FRONTEND_URL,
        client: process.env.CLIENT_URL,
        submitter: process.env.SUBMITTER_URL,
      };

      let correctPortalUrl = null;
      let correctPortalName = null;
      for (const [pt, allowedRoleList] of Object.entries(typeToAllowedRoles)) {
        if (pt !== requestedType && allowedRoleList.includes(userRole)) {
          const base = portalBaseUrls[pt];
          correctPortalUrl = base ? `${base}/auth/login` : null;
          correctPortalName = pt.charAt(0).toUpperCase() + pt.slice(1);
          break;
        }
      }

      return res.status(403).json({
        error: errorByType[requestedType],
        code: 'INVALID_ROLE',
        correctPortalUrl,
        correctPortalName,
      });
    }

    // Generate session token for single-session enforcement (web only)
    const sessionToken = await Submitter.updateSessionToken(lowerEmail, 'web');

    const token = generateToken({
      email: submitter.Email,
      role: submitter.UserType || submitter.Access?.role || 'submitter',
      priority: submitter.Access?.priority === true,
      partnership: submitter.Access?.partnership === true,
      turnkey: submitter.Access?.turnkey === true,
      sessionToken,
      platform: 'web',
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
      assignedPermissions: submitter.assignedPermissions || {},
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

    // Invalidate only the platform-specific session token
    const platform = req.user?.platform || 'web';
    await Submitter.invalidateSessionToken(email, platform);

    res.json({ success: true, message: 'Logged out successfully' });
  } catch (err) {
    console.error('Logout error:', err);
    res.status(500).json({ error: err.message });
  }
};
