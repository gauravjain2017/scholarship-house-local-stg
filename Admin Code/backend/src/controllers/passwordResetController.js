/**
 * Password Reset Controller
 * Handles password reset requests for both users and admins
 */
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const {
  PutCommand,
  GetCommand,
  UpdateCommand,
  QueryCommand,
  ScanCommand,
} = require('@aws-sdk/lib-dynamodb');
const { dynamoDB, TABLES } = require('../config/aws');
const Submitter = require('../models/Submitter');
const {
  sendPasswordResetEmail,
  sendPasswordChangedEmail,
  sendTemporaryPasswordEmail,
} = require('../services/emailService');

/**
 * Lazily load a model only if its file exists, fallback to Submitter.
 * This avoids MODULE_NOT_FOUND crashes when Client/Admin models
 * haven't been created yet.
 */
const loadModel = (modelPath, fallback) => {
  try {
    return require(modelPath);
  } catch (e) {
    return fallback;
  }
};

/**
 * Find a user by email based on their userType.
 * userType: 'submitter' | 'client' | 'admin' | 'team_member'
 * Returns { user, model } or { user: null }
 */
const findUserByEmailAndType = async (email, userType) => {
  switch (userType) {
    case 'client': {
      const Client = loadModel('../models/Client', Submitter);
      return { user: await Client.findByEmail(email), model: Client };
    }
    case 'admin':
    case 'team_member': {
      const Admin = loadModel('../models/Admin', Submitter);
      return { user: await Admin.findByEmail(email), model: Admin };
    }
    case 'submitter':
    default:
      return { user: await Submitter.findByEmail(email), model: Submitter };
  }
};

// Configuration
const TOKEN_EXPIRY_HOURS =
  parseInt(process.env.PASSWORD_RESET_TOKEN_EXPIRY_HOURS, 10) || 1;
const RATE_LIMIT_MAX = parseInt(process.env.PASSWORD_RESET_RATE_LIMIT, 10) || 3;
const RATE_LIMIT_WINDOW_HOURS = 1;
const SALT_ROUNDS = 10;

/**
 * Resolve the frontend base URL based on user type.
 * - admin / team_member  -> FRONTEND_URL
 * - client               -> CLIENT_URL
 * - submitter            -> SUBMITTER_URL
 */
const getFrontendUrlByUserType = (userType) => {
  switch (userType) {
    case 'client':
      return process.env.CLIENT_URL;
    case 'submitter':
      return process.env.SUBMITTER_URL;
    case 'admin':
    case 'team_member':
    default:
      return process.env.FRONTEND_URL;
  }
};

/**
 * Generate a secure random token
 */
const generateToken = () => {
  return crypto.randomBytes(32).toString('hex');
};

/**
 * Generate a temporary password (readable)
 */
const generateTempPassword = () => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  let password = '';
  for (let i = 0; i < 12; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
};

/**
 * Get rate limit count for an email in the past hour
 */
const getRateLimitCount = async (email) => {
  const oneHourAgo = Date.now() - RATE_LIMIT_WINDOW_HOURS * 60 * 60 * 1000;

  try {
    const result = await dynamoDB.send(
      new ScanCommand({
        TableName: TABLES.PASSWORD_RESET_TOKENS,
        FilterExpression: '#email = :email AND #createdAtNum > :timeLimit',
        ExpressionAttributeNames: {
          '#email': 'email',
          '#createdAtNum': 'createdAtNum',
        },
        ExpressionAttributeValues: {
          ':email': email.toLowerCase(),
          ':timeLimit': oneHourAgo,
        },
      })
    );
    return result.Items?.length || 0;
  } catch (error) {
    console.error('Rate limit check error:', error);
    return 0; // Fail open for rate limiting
  }
};

/**
 * Store a reset token in DynamoDB
 */
const storeResetToken = async (token, email, initiatedBy, userType) => {
  const now = Date.now();
  const expiresAt = Math.floor(now / 1000) + TOKEN_EXPIRY_HOURS * 60 * 60; // TTL in seconds

  await dynamoDB.send(
    new PutCommand({
      TableName: TABLES.PASSWORD_RESET_TOKENS,
      Item: {
        token,
        email: email.toLowerCase(),
        expiresAt, // TTL attribute (Unix timestamp in seconds)
        createdAt: new Date().toISOString(),
        createdAtNum: now, // For rate limiting queries
        used: false,
        initiatedBy: initiatedBy || 'user',
        userType: userType || 'submitter',
      },
    })
  );
};

/**
 * Get and validate a reset token
 */
const getValidToken = async (token) => {
  try {
    const result = await dynamoDB.send(
      new GetCommand({
        TableName: TABLES.PASSWORD_RESET_TOKENS,
        Key: { token },
      })
    );

    const tokenData = result.Item;

    if (!tokenData) {
      return { valid: false, error: 'Token not found' };
    }

    if (tokenData.used) {
      return { valid: false, error: 'Token has already been used' };
    }

    const nowSeconds = Math.floor(Date.now() / 1000);
    if (tokenData.expiresAt < nowSeconds) {
      return { valid: false, error: 'Token has expired' };
    }

    return { valid: true, tokenData };
  } catch (error) {
    console.error('Token validation error:', error);
    return { valid: false, error: 'Token validation failed' };
  }
};

/**
 * Mark a token as used
 */
const markTokenUsed = async (token) => {
  await dynamoDB.send(
    new UpdateCommand({
      TableName: TABLES.PASSWORD_RESET_TOKENS,
      Key: { token },
      UpdateExpression: 'SET #used = :used, #usedAt = :usedAt',
      ExpressionAttributeNames: {
        '#used': 'used',
        '#usedAt': 'usedAt',
      },
      ExpressionAttributeValues: {
        ':used': true,
        ':usedAt': new Date().toISOString(),
      },
    })
  );
};

/**
 * Invalidate all existing tokens for an email
 */
const invalidateExistingTokens = async (email) => {
  try {
    const result = await dynamoDB.send(
      new ScanCommand({
        TableName: TABLES.PASSWORD_RESET_TOKENS,
        FilterExpression: '#email = :email AND #used = :unused',
        ExpressionAttributeNames: {
          '#email': 'email',
          '#used': 'used',
        },
        ExpressionAttributeValues: {
          ':email': email.toLowerCase(),
          ':unused': false,
        },
      })
    );

    // Mark all found tokens as used
    for (const item of result.Items || []) {
      await markTokenUsed(item.token);
    }
  } catch (error) {
    console.error('Error invalidating existing tokens:', error);
  }
};

/**
 * Mask email for display (e.g., "j***@example.com")
 */
const maskEmail = (email) => {
  const [localPart, domain] = email.split('@');
  if (localPart.length <= 2) {
    return `${localPart[0]}***@${domain}`;
  }
  return `${localPart[0]}${'*'.repeat(Math.min(localPart.length - 1, 5))}@${domain}`;
};

/* ==================== CONTROLLERS ==================== */

/**
 * Request password reset (user-initiated)
 * POST /api/password/request-reset
 */
exports.requestPasswordReset = async (req, res) => {
  try {
    const { email, userType } = req.body;
   
    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

   console.log('');
   console.log(email);
   console.log(userType);


    const lowerEmail = email.toLowerCase();

    // Always return success message to prevent email enumeration
    const successResponse = {
      success: true,
      message:
        'If an account exists with this email, you will receive a password reset link shortly.',
      email: maskEmail(lowerEmail),
    };

    const errorResponse = {
      success: false,
      message: `Password reset requested for non-existent email: ${lowerEmail}`,
    };

    // Check if user exists in the correct table based on userType
    const { user } = await findUserByEmailAndType(lowerEmail, userType);

    if (!user) {
      console.log(
        `Password reset requested for non-existent email: ${lowerEmail} (type: ${userType})`
      );
      return res.json(errorResponse);
    }

    // Verify the found user's type matches what was requested
    const foundType = user?.UserType || user?.role || '';
    const allowedTypes = {
      submitter: ['submitter'],
      client: ['client'],
      admin: ['admin', 'team_member'],
      team_member: ['admin', 'team_member'],
    };
    const allowed = allowedTypes[userType] || [userType];
    if (!allowed.includes(foundType.toLowerCase())) {
      console.log(
        `Type mismatch for ${lowerEmail}: requested ${userType}, found ${foundType}`
      );
      return res.json(errorResponse);
    }

    let userRole = foundType.replace(/_/g, ' ').replace(/\b\w/g, char => char.toUpperCase());

    // Check rate limit
    const requestCount = await getRateLimitCount(lowerEmail);
    if (requestCount >= RATE_LIMIT_MAX) {
      console.log(`Rate limit exceeded for password reset: ${lowerEmail}`);
      return res.status(429).json({
        error: 'Too many password reset requests. Please try again later.',
      });
    }

    // Invalidate any existing tokens before generating a new one
    await invalidateExistingTokens(lowerEmail);

    // Generate token and store
    const token = generateToken();
    await storeResetToken(token, lowerEmail, 'user', userType);

    // Build reset URL — URL base depends on userType, path depends on submitter vs others
    const frontendUrl = getFrontendUrlByUserType(userType);
    const resetPath = userType === 'submitter'
      ? `/auth/reset-password/${token}`
      : `/auth/reset-password/${token}`;
    const resetUrl = `${frontendUrl}${resetPath}`;


    // Send email
    try {
      await sendPasswordResetEmail(lowerEmail, resetUrl, 'user',user?.Name,userRole);
      console.log(`Password reset email sent to: ${lowerEmail}`);
    } catch (emailError) {
      console.error('Failed to send password reset email:', emailError);
      // Don't reveal email sending failure to user
    }

    res.json(successResponse);
  } catch (error) {
    console.error('Request password reset error:', error);
    res.status(500).json({ error: 'Failed to process password reset request' });
  }
};

/**
 * Validate reset token
 * GET /api/password/validate-token/:token
 */
exports.validateResetToken = async (req, res) => {
  try {
    const { token } = req.params;

    if (!token) {
      return res.status(400).json({ valid: false, error: 'Token is required' });
    }

    const { valid, error, tokenData } = await getValidToken(token);

    if (!valid) {
      return res.status(400).json({ valid: false, error });
    }

    res.json({
      valid: true,
      email: maskEmail(tokenData.email),
    });
  } catch (error) {
    console.error('Validate token error:', error);
    res.status(500).json({ valid: false, error: 'Token validation failed' });
  }
};

/**
 * Reset password with token
 * POST /api/password/reset
 */
exports.resetPassword = async (req, res) => {
  try {
    const { token, newPassword } = req.body;

    if (!token || !newPassword) {
      return res
        .status(400)
        .json({ error: 'Token and new password are required' });
    }

    // Validate password requirements
    if (newPassword.length < 8) {
      return res
        .status(400)
        .json({ error: 'Password must be at least 8 characters long' });
    }

    // Validate token
    const { valid, error, tokenData } = await getValidToken(token);
    if (!valid) {
      return res
        .status(400)
        .json({ error: error || 'Invalid or expired token' });
    }

    // Mark token as used FIRST (prevents race conditions)
    await markTokenUsed(token);

    // Invalidate any other pending tokens for this user
    await invalidateExistingTokens(tokenData.email);

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, SALT_ROUNDS);

    // Update password in database — look up correct model from stored token
    try {
      const { model: UserModel } = await findUserByEmailAndType(
        tokenData.email,
        tokenData.userType || 'submitter'
      );
      await UserModel.updatePassword(tokenData.email, hashedPassword);
    } catch (updateError) {
      console.error('Password update failed:', updateError);
      return res.status(500).json({ error: 'Failed to update password' });
    }

    // Send confirmation email
    try {
      await sendPasswordChangedEmail(tokenData.email);
    } catch (emailError) {
      console.error('Failed to send password changed email:', emailError);
      // Don't fail the reset if email fails
    }

    console.log(`Password reset completed for: ${tokenData.email}`);

    res.json({
      success: true,
      message:
        'Password has been reset successfully. You can now log in with your new password.',
    });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ error: 'Failed to reset password' });
  }
};

/**
 * Admin: Trigger password reset email for a user
 * POST /api/admin/trigger-password-reset
 */
exports.adminTriggerPasswordReset = async (req, res) => {
  try {
    const { email } = req.body;
    const adminEmail = req.user?.email;
    const role = (req.user?.role == 'admin') ? 'Administrator' : 'Team Member';

    if (!email) {
      return res.status(400).json({ error: 'User email is required' });
    }

    const lowerEmail = email.toLowerCase();

    // Check if user exists — admin panel searches all types
    const { user } =
      await findUserByEmailAndType(lowerEmail, req.body.userType || 'submitter');

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    let userRole = (user?.UserType || user?.role || '');
    userRole = userRole.replace(/_/g, ' ').replace(/\b\w/g, char => char.toUpperCase());

    // Invalidate existing tokens
    await invalidateExistingTokens(lowerEmail);

    // Determine target type and generate token
    const targetType = req.body.userType || 'submitter';
    const token = generateToken();
    await storeResetToken(token, lowerEmail, adminEmail || 'admin', targetType);

    // Build reset URL — URL base depends on targetType
    const frontendUrl = getFrontendUrlByUserType(targetType);
    const resetPath = targetType === 'submitter'
      ? `/auth/reset-password/${token}`
      : `/auth/reset-password/${token}`;
    const resetUrl = `${frontendUrl}${resetPath}`;

    // Send email
    try {
      await sendPasswordResetEmail(lowerEmail, resetUrl, adminEmail || 'admin',user?.Name,role);
      console.log(
        `Admin-triggered password reset email sent to: ${lowerEmail} by: ${adminEmail}`
      );
    } catch (emailError) {
      console.error(
        'Failed to send admin-triggered password reset email:',
        emailError
      );
      return res
        .status(500)
        .json({ error: 'Failed to send password reset email' });
    }

    res.json({
      success: true,
      message: `Password reset email sent to ${maskEmail(lowerEmail)}`,
    });
  } catch (error) {
    console.error('Admin trigger password reset error:', error);
    res.status(500).json({ error: 'Failed to trigger password reset' });
  }
};

/**
 * Admin: Set temporary password for a user
 * POST /api/admin/set-temporary-password
 */
exports.adminSetTemporaryPassword = async (req, res) => {
  try {
    const { email } = req.body;
    const role = (req.user?.role == 'admin') ? 'Administrator' : 'Team Member';
    const adminEmail = req.user?.email;

    if (!email) {
      return res.status(400).json({ error: 'User email is required' });
    }

    const lowerEmail = email.toLowerCase();

    // Check if user exists
    const { user, model: UserModel } =
      await findUserByEmailAndType(lowerEmail, req.body.userType || 'submitter');
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Generate temporary password
    const tempPassword = generateTempPassword();
    const hashedPassword = await bcrypt.hash(tempPassword, SALT_ROUNDS);

    // Update password using the correct model
    try {
      await UserModel.updatePassword(lowerEmail, hashedPassword);
    } catch (updateError) {
      console.error('Temporary password update failed:', updateError);
      return res
        .status(500)
        .json({ error: 'Failed to set temporary password' });
    }

    // Invalidate any existing reset tokens
    await invalidateExistingTokens(lowerEmail);

    // Send temporary password email
    try {
      await sendTemporaryPasswordEmail(lowerEmail, tempPassword, adminEmail,role);
      console.log(
        `Temporary password set for: ${lowerEmail} by admin: ${adminEmail}`
      );
    } catch (emailError) {
      console.error('Failed to send temporary password email:', emailError);
      // Still return success since password was changed - admin can communicate manually
    }

    res.json({
      success: true,
      message: `Temporary password has been set and emailed to ${maskEmail(lowerEmail)}`,
      // Don't include the temp password in the response for security
    });
  } catch (error) {
    console.error('Admin set temporary password error:', error);
    res.status(500).json({ error: 'Failed to set temporary password' });
  }
};
