/**
 * Profile Controller
 * Handles profile updates and password changes.
 *
 * In this project all user types (submitter / client / admin / team_member)
 * live in the same SUBMITTERS DynamoDB table, discriminated by the
 * `UserType` field. So we always use the Submitter model.
 *
 * Identity ALWAYS comes from req.user (set by authenticateToken middleware).
 * We never trust an email passed in the body for identity — that would let
 * any logged-in user edit any other user's profile.
 */
const bcrypt = require('bcryptjs');
const {
  PutCommand,
  DeleteCommand,
  TransactWriteCommand,
} = require('@aws-sdk/lib-dynamodb');
const { dynamoDB, TABLES } = require('../config/aws');
const Submitter = require('../models/Submitter');

const SALT_ROUNDS = 10;
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/* ==================== HELPERS ==================== */

/**
 * Strip auth/session fields before sending a user object to the client.
 */
const sanitizeUser = (user) => {
  if (!user) return null;
  const { Auth, sessionToken, ...safe } = user;
  return safe;
};

/**
 * Change a user's email. Because Email is the partition key on DynamoDB,
 * this is implemented as a transactional delete-old + put-new so we don't
 * end up with two records or a partially-updated record.
 *
 * Returns the new user record.
 */
const changeUserEmail = async (oldEmail, newEmail, otherUpdates = {}) => {
  const oldKey = oldEmail.toLowerCase();
  const newKey = newEmail.toLowerCase();

  const existing = await Submitter.findByEmail(oldKey);
  if (!existing) throw new Error('User not found');

  const newItem = {
    ...existing,
    ...otherUpdates,
    Email: newKey,
    updatedAt: new Date().toISOString(),
  };

  await dynamoDB.send(
    new TransactWriteCommand({
      TransactItems: [
        {
          // Insert new record. Fail if email already taken (race-safe).
          Put: {
            TableName: TABLES.SUBMITTERS,
            Item: newItem,
            ConditionExpression: 'attribute_not_exists(Email)',
          },
        },
        {
          // Delete the old record.
          Delete: {
            TableName: TABLES.SUBMITTERS,
            Key: { Email: oldKey },
          },
        },
      ],
    })
  );

  return newItem;
};

/* ==================== CONTROLLERS ==================== */

/**
 * GET /api/profile/me
 * Returns the current user's full profile.
 */
exports.getProfile = async (req, res) => {
  try {
    const email = req.user?.email;
    if (!email) return res.status(401).json({ error: 'Not authenticated' });

    const user = await Submitter.findByEmail(email);
    if (!user) return res.status(404).json({ error: 'User not found' });

    res.json(sanitizeUser(user));
  } catch (err) {
    console.error('getProfile error:', err);
    res.status(500).json({ error: 'Failed to load profile' });
  }
};

/**
 * GET /api/profile/check-email?email=foo@bar.com
 * Returns { available: boolean }.
 *
 * The user's own current email is always reported as available so they can
 * resave their own profile without a false conflict.
 */
exports.checkEmailAvailable = async (req, res) => {
  try {
    const { email } = req.query;
    const currentEmail = req.user?.email?.toLowerCase();

    if (!email || !emailRegex.test(email)) {
      return res.json({ available: false, reason: 'invalid' });
    }

    const lower = email.toLowerCase();
    if (lower === currentEmail) {
      return res.json({ available: true });
    }

    const existing = await Submitter.findByEmail(lower);
    return res.json({ available: !existing });
  } catch (err) {
    console.error('checkEmailAvailable error:', err);
    return res.status(500).json({ available: false, error: 'Lookup failed' });
  }
};

/**
 * PUT /api/profile/update
 * Body: { firstName, lastName, name, phone, email, address }
 *
 * Updates the current user's profile. Identity comes from req.user — body
 * email is the *new* email the user wants, not used for identity lookup.
 */
exports.updateProfile = async (req, res) => {
  try {
    const currentEmail = req.user?.email?.toLowerCase();
    if (!currentEmail) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const {
      firstName,
      lastName,
      name,
      phone,
      email: newEmail,
      address,
    } = req.body;

    /* ---- validation ---- */
    const errors = [];

    const finalName =
      firstName || lastName
        ? `${(firstName || '').trim()} ${(lastName || '').trim()}`.trim()
        : (name || '').trim();
    if (!finalName) errors.push('Name is required');

    if (!phone) {
      errors.push('Phone is required');
    } else {
      const digits = String(phone).replace(/\D/g, '');
      if (digits.length < 8 || digits.length > 12) {
        errors.push('Phone must be between 8 and 12 digits');
      }
    }

    if (!newEmail || !emailRegex.test(newEmail)) {
      errors.push('A valid email is required');
    }

    if (errors.length) {
      return res.status(400).json({ error: errors.join('. ') });
    }

    const lowerNewEmail = newEmail.toLowerCase();
    const emailChanging = lowerNewEmail !== currentEmail;

    /* ---- email uniqueness check ---- */
    if (emailChanging) {
      const existing = await Submitter.findByEmail(lowerNewEmail);
      if (existing) {
        return res.status(409).json({
          error: 'This email is already in use by another account.',
          code: 'EMAIL_TAKEN',
        });
      }
    }

    /* ---- locate the user ---- */
    const user = await Submitter.findByEmail(currentEmail);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    /* ---- apply updates ---- */
    let updated;
    try {
      const fieldUpdates = {
        Name: finalName,
        Phone: String(phone).trim(),
      };
      if (address !== undefined) fieldUpdates.Address = address;

      if (emailChanging) {
        // Email is the PK — must delete + put. Bundle field updates into
        // the new record so we only touch DDB once.
        updated = await changeUserEmail(currentEmail, lowerNewEmail, fieldUpdates);
      } else {
        // Same email — use the existing updateByEmail (it permits Name/Phone).
        // Address is added to its allowlist below; if your model is unchanged,
        // Address will be silently skipped — see notes at bottom.
        updated = await Submitter.updateByEmail(currentEmail, fieldUpdates);
      }
    } catch (e) {
      // TransactWrite throws ConditionalCheckFailed if the email got taken
      // between our check and our write — surface that as a 409.
      if (e?.name === 'TransactionCanceledException' || /Conditional/i.test(e?.message || '')) {
        return res.status(409).json({
          error: 'This email was just claimed by another account. Please pick a different one.',
          code: 'EMAIL_TAKEN',
        });
      }
      console.error('Profile update failed:', e);
      return res.status(500).json({ error: 'Failed to update profile' });
    }

    res.json({
      success: true,
      message: 'Profile updated successfully',
      user: {
        email: updated?.Email || lowerNewEmail,
        name: updated?.Name || finalName,
        phone: updated?.Phone || String(phone).trim(),
        userType: updated?.UserType || req.user?.role || 'submitter',
        address: updated?.Address || address || null,
        access: updated?.Access || null,
      },
      // If email changed, the JWT in the client now carries the OLD email
      // and won't match anything in the DB → forces re-login.
      emailChanged: emailChanging,
    });
  } catch (err) {
    console.error('updateProfile error:', err);
    res.status(500).json({ error: 'Failed to update profile' });
  }
};

/**
 * POST /api/profile/change-password
 * Body: { currentPassword, newPassword }
 *
 * Verifies the current password, hashes & stores the new one, and
 * invalidates the session token so other devices are forced to re-login.
 */
exports.changePassword = async (req, res) => {
  try {
    const email = req.user?.email?.toLowerCase();
    if (!email) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res
        .status(400)
        .json({ error: 'Current and new password are both required' });
    }
    if (newPassword.length < 8) {
      return res
        .status(400)
        .json({ error: 'New password must be at least 8 characters' });
    }
    if (currentPassword === newPassword) {
      return res
        .status(400)
        .json({ error: 'New password must be different from current password' });
    }

    /* ---- verify current password ---- */
    const user = await Submitter.findByEmail(email);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const storedHash = user?.Auth?.passwordHash;
    if (!storedHash) {
      console.error('No password hash on user record:', email);
      return res.status(500).json({ error: 'Password verification unavailable' });
    }

    const valid = await bcrypt.compare(currentPassword, storedHash);
    if (!valid) {
      // Return 400 (not 401) so the axios interceptor doesn't treat it as
      // a session expiry and redirect the user to login. The user is still
      // authenticated — they just typed the wrong *current* password.
      return res.status(400).json({
        error: 'Current password is incorrect',
        code: 'INVALID_CURRENT_PASSWORD',
      });
    }

    /* ---- hash & store new password ---- */
    const newHash = await bcrypt.hash(newPassword, SALT_ROUNDS);
    try {
      await Submitter.updatePassword(email, newHash);
    } catch (e) {
      console.error('updatePassword failed:', e);
      return res.status(500).json({ error: 'Failed to update password' });
    }

    /* ---- invalidate session on all devices ---- */
    try {
      await Submitter.invalidateSessionToken(email);
    } catch (e) {
      console.warn('Session invalidation skipped:', e.message);
    }

    res.json({
      success: true,
      message: 'Password changed successfully. For your security, please sign in again.',
      requireRelogin: true,
    });
  } catch (err) {
    console.error('changePassword error:', err);
    res.status(500).json({ error: 'Failed to change password' });
  }
};
