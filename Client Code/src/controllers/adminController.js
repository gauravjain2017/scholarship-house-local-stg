/**
 * Admin Controllers
 * Handle business logic for admin operations
 *
 * NOTE ON THE SUBMITTERS TABLE SCHEMA
 * -----------------------------------
 * The `submitters` DynamoDB table uses `Email` (capital E) as its
 * partition key — confirmed by the working `getSubmitterByEmail` in
 * dealController.js which does `Key: { Email: email.toLowerCase() }`.
 *
 * Passing `Key: { email }` (lower-case) to Get/Update/Delete commands
 * fails with "The provided key element does not match the schema".
 * All direct DynamoDB operations in this file therefore key off `Email`.
 */


const backendConstants = require('../../backend_constants');
const dealStorage = backendConstants.dealStorage;

const {
  ScanCommand,
  GetCommand,
  PutCommand,
  UpdateCommand,
  DeleteCommand,
} = require('@aws-sdk/lib-dynamodb');
const bcrypt = require('bcryptjs');
const Submitter = require('../models/Submitter');
const { dynamoDB, TABLES } = require('../config/aws');
const {
  generateAutoTags,
  mergeWithExistingTags,
} = require('../utils/autoTagger');
const { notifyMatchingUsers } = require('../services/dealPublishNotifier');

// Submitters table — partition key is `Email` (capital E).
const SUBMITTERS_TABLE = TABLES.SUBMITTERS;
const MANAGE_ROLES_TABLE = TABLES.MANAGE_ROLES;
const PENDING_REGISTRATIONS_TABLE = TABLES.PENDING_REGISTRATIONS;
const SUBMITTERS_PK = 'Email';

/** Build the DynamoDB key object for a submitter row. */
const submitterKey = (email) => ({
  [SUBMITTERS_PK]: String(email || '').trim().toLowerCase(),
});

const pendingRegisterKey = (email) => ({
  email: String(email || '').trim().toLowerCase(),
});

const getAllUsers = async (req, res) => {
  try {
    console.log('getAllUsers hit, query:', req.query);
    const users = await Submitter.listAll(req.query);
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch users' });
  }
};

/**
 * Create a new user (Add User flow).
 *
 * Writes directly to DynamoDB using the `Email` partition key.
 * Stores both `Email` (for the PK) and `email` (for the rest of the
 * app which reads `user.email`), plus all the flat and nested fields
 * the UserManagement form produces.
 */

const createUser = async (req, res) => {
  try {
    const payload = req.body || {};
    const timestamp = new Date().toISOString();

    if (
      !payload.email ||
      typeof payload.email !== 'string' ||
      !payload.firstName ||
      !payload.lastName
    ) {
      return res.status(400).json({
        error: 'firstName, lastName and a valid email are required',
      });
    }
    if (!payload.password) {
      return res
        .status(400)
        .json({ error: 'password is required when creating a user' });
    }

    const email = payload.email.trim().toLowerCase();

    // Only admins can create other admins.
    if (
      (payload.role === 'admin' || payload.UserType === 'admin') &&
      req.user.role !== 'admin'
    ) {
      console.warn(
        `[AUDIT] ${timestamp} | ROLE_ASSIGNMENT_DENIED | ` +
        `Requester: ${req.user.email} (${req.user.role}) | ` +
        `Target: ${email} | Attempted Role: admin`
      );
      return res.status(403).json({
        error: 'Only administrators can create admin users',
      });
    }

    // Reject duplicates — check directly on the PK, not via the model.
    const existingRes = await dynamoDB.send(
      new GetCommand({
        TableName: SUBMITTERS_TABLE,
        Key: submitterKey(email),
      })
    );
    if (existingRes.Item) {
      return res
        .status(409)
        .json({ error: 'A user with this email already exists' });
    }

    const hashedPassword = await bcrypt.hash(String(payload.password), 10);
    const firstName = String(payload.firstName).trim();
    const lastName = String(payload.lastName).trim();
    const fullName = `${firstName} ${lastName}`.trim();
    const role = payload.role || payload.UserType || 'client';

    // Step 1: write to pending_registrations with status 'approved' for audit trail.
    const pendingItem = {
      email,
      firstName,
      lastName,
      phone: payload.phone || '',
      hashedPassword,
      requestedUserType: role,
      status: 'approved',
      createdAt: timestamp,
      approvedAt: timestamp,
      approvedBy: req.user.email,
    };

    await dynamoDB.send(
      new PutCommand({
        TableName: TABLES.PENDING_REGISTRATIONS,
        Item: pendingItem,
      })
    );

    // Step 2: write to submitters table.
    const item = {
      Email: email,
      email,

      Name: fullName,
      Phone: payload.phone || '',
      UserType: payload.UserType || payload.role || 'client',

      firstName,
      lastName,
      phone: payload.phone || '',
      role,
      Address: payload.Address || {
        street: '',
        city: '',
        state: '',
        zip: '',
      },
      Access: payload.Access || {
        priority: true,
        partnership: true,
        turnkey: true,
      },
      assignedPermissions: payload.assignedPermissions || {},
      isActive: payload.isActive !== false,
      isPending: false,
      isRejected: false,
      Auth: { passwordHash: hashedPassword },
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    try {
      await dynamoDB.send(
        new PutCommand({
          TableName: SUBMITTERS_TABLE,
          Item: item,
          ConditionExpression: 'attribute_not_exists(#pk)',
          ExpressionAttributeNames: { '#pk': SUBMITTERS_PK },
        })
      );
    } catch (submitterErr) {
      // Roll back the pending_registrations record so we don't leave orphans.
      await dynamoDB.send(
        new DeleteCommand({
          TableName: TABLES.PENDING_REGISTRATIONS,
          Key: { email },
        })
      ).catch((cleanupErr) =>
        console.error('createUser cleanup error:', cleanupErr)
      );
      throw submitterErr;
    }

    console.log(
      `[AUDIT] ${timestamp} | USER_CREATED | ` +
      `By: ${req.user.email} | Target: ${email} | Role: ${item.role}`
    );

    const { Auth: _auth, ...safe } = item;
    res.status(201).json(safe);
  } catch (err) {
    console.error('createUser error:', err);
    if (err.name === 'ConditionalCheckFailedException') {
      return res
        .status(409)
        .json({ error: 'A user with this email already exists' });
    }
    res.status(400).json({ error: err.message || 'Failed to create user' });
  }
};


const createRole = async (req, res) => {
  try {
    const { role_name, permissions, role_description, portal_type } = req.body || {};

    if (
      !role_name ||
      !permissions ||
      Object.keys(permissions).length === 0 ||
      !portal_type
    ) {
      return res.status(400).json({
        success: false,
        message: "Please filled all required fields!!"
      });
    }

    const roleSlug = role_name.trim().toLowerCase().replace(/\s+/g, "_");

    await dynamoDB.send(
      new PutCommand({
        TableName: MANAGE_ROLES_TABLE,
        Item: {
          id: roleSlug,
          role_name,
          role_slug: roleSlug,
          role_description,
          role_permission: permissions,
          portal_type
        }
      })
    );

    return res.status(200).json({
      success: true,
      message: "Role saved successfully"
    });

  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// const fetchAllRoles = async (req, res) => {


const fetchAllRoles = async (req, res) => {
  try {
    // Fetch all roles
    const rolesResult = await dynamoDB.send(
      new ScanCommand({
        TableName: MANAGE_ROLES_TABLE
      })
    );

    const roles = rolesResult.Items || [];

    // Fetch all submitters (for count)
    const usersResult = await dynamoDB.send(
      new ScanCommand({
        TableName: PENDING_REGISTRATIONS_TABLE // replace with your actual submitter table name
      })
    );

    const users = usersResult.Items || [];

    // Add user count in each role
    const rolesWithCount = roles.map((role) => {
      const count = users.filter(
        (user) => user.userType === role.role_slug
      ).length;

      return {
        ...role,
        user_count: count
      };
    });

    return res.status(200).json({
      success: true,
      data: rolesWithCount
    });

  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// Public endpoint — no auth required. Returns only roles whose portal_type matches the query param (default: 'admin').
const fetchPublicRoles = async (req, res) => {
  try {
    const portalType = req.query.portal_type;

    console.log('fetchPublicRoles hit, portalType : ',portalType);

    let result = {};

    if (!portalType || portalType === 'undefined') {
      result = await dynamoDB.send(
        new ScanCommand({
          TableName: MANAGE_ROLES_TABLE
        })
      );
    } else {
      result = await dynamoDB.send(
        new ScanCommand({
          TableName: MANAGE_ROLES_TABLE,
          FilterExpression: 'portal_type = :pt',
          ExpressionAttributeValues: { ':pt': portalType },
        })
      );
    }
    return res.status(200).json({
      success: true,
      data: result.Items || [],
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};



const deleteRole = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({ success: false, message: 'Role ID is required' });
    }

    // Check if any user has this role assigned
    const usersWithRole = await dynamoDB.send(
      new ScanCommand({
        TableName: SUBMITTERS_TABLE,
        FilterExpression: 'UserType = :roleId',
        ExpressionAttributeValues: { ':roleId': id },
        Select: 'COUNT',
      })
    );

    if (usersWithRole.Count > 0) {
      return res.status(409).json({
        success: false,
        message: `This role is assigned to ${usersWithRole.Count} user(s) and cannot be deleted.`,
      });
    }

    await dynamoDB.send(
      new DeleteCommand({
        TableName: MANAGE_ROLES_TABLE,
        Key: { id },
      })
    );

    return res.status(200).json({ success: true, message: 'Role deleted successfully' });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
};


/**
 * Update a user.
 *
 * Builds a DynamoDB UpdateExpression covering every field in req.body,
 * keyed by the `Email` partition key. Deep-merges `Address` and
 * `Access` so partial updates don't clobber untouched keys. Keeps
 * `Name` / `Phone` / `UserType` in sync with the flat firstName /
 * lastName / phone / role fields so both shapes stay consistent.
 */
const updateUser = async (req, res) => {
  // console.log('updateUser hit, params:', req.params, 'body:', req.body);
  // return;

  try {
    const email = String(req.params.email || '').trim().toLowerCase();
    const updates = { ...(req.body || {}) };
    const timestamp = new Date().toISOString();

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    // ---- Role-assignment audit / guard ----
    if (
      updates.role === 'admin' ||
      updates.userType === 'admin' ||
      updates.UserType === 'admin'
    ) {
      if (req.user.role !== 'admin') {
        console.warn(
          `[AUDIT] ${timestamp} | ROLE_ASSIGNMENT_DENIED | ` +
          `Requester: ${req.user.email} (${req.user.role}) | ` +
          `Target: ${email} | Attempted Role: admin`
        );
        return res.status(403).json({
          error: 'Only administrators can assign the admin role',
        });
      }
      console.log(
        `[AUDIT] ${timestamp} | ROLE_ASSIGNMENT_GRANTED | ` +
        `Admin: ${req.user.email} | Target: ${email}`
      );
    }

    // Fetch existing record directly so we know for sure whether the
    // user exists and can deep-merge nested objects.
    const existingRes = await dynamoDB.send(
      new GetCommand({
        TableName: SUBMITTERS_TABLE,
        Key: submitterKey(email),
      })
    );
    const existing = existingRes.Item;
    if (!existing) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Build role_slug → portal_type lookup from MANAGE_ROLES table.
    const { Items: roles = [] } = await dynamoDB.send(
      new ScanCommand({ TableName: TABLES.MANAGE_ROLES })
    );
    const roleToPortalType = roles.reduce((acc, { portal_type, role_slug }) => {
      if (role_slug) acc[role_slug] = portal_type;
      return acc;
    }, {});

    // Never let the primary key, its lowercase twin, or the password
    // be rewritten through this endpoint.
    delete updates.Email;
    delete updates.email;
    delete updates.password;

    // Normalise `address` (lower) → `Address` (the stored shape).
    if (updates.address && !updates.Address) {
      updates.Address = updates.address;
    }
    delete updates.address;

    // Deep-merge nested objects.
    if (updates.Address) {
      updates.Address = {
        ...(existing.Address || existing.address || {}),
        ...updates.Address,
      };
    }
    if (updates.Access) {
      updates.Access = {
        ...(existing.Access || {}),
        ...updates.Access,
      };
    }

    // Keep the capitalised display fields in sync with the flat fields
    // so dealController.js::getSubmitterByEmail keeps returning the
    // right values (it reads `Name`, `Phone`, `UserType`).
    const nextFirst =
      updates.firstName !== undefined ? updates.firstName : existing.firstName;
    const nextLast =
      updates.lastName !== undefined ? updates.lastName : existing.lastName;
    if (updates.firstName !== undefined || updates.lastName !== undefined) {
      updates.Name = `${nextFirst || ''} ${nextLast || ''}`.trim();
    }
    if (updates.phone !== undefined) {
      updates.Phone = updates.phone;
    }
    if (updates.role !== undefined) {
      const derivedType = updates.role;
      updates.UserType = derivedType;
      updates.userType = derivedType;
    }

    updates.updatedAt = timestamp;

    // Build a dynamic UpdateExpression covering every provided key.
    const names = {};
    const values = {};
    const sets = [];

    Object.entries(updates).forEach(([key, value], idx) => {
      if (value === undefined) return;
      const nameKey = `#k${idx}`;
      const valueKey = `:v${idx}`;
      names[nameKey] = key;
      values[valueKey] = value;
      sets.push(`${nameKey} = ${valueKey}`);
    });

    if (sets.length === 0) {
      const { password, ...safe } = existing;
      return res.json(safe);
    }

    const result = await dynamoDB.send(
      new UpdateCommand({
        TableName: SUBMITTERS_TABLE,
        Key: submitterKey(email),
        UpdateExpression: 'SET ' + sets.join(', '),
        ExpressionAttributeNames: names,
        ExpressionAttributeValues: values,
        ReturnValues: 'ALL_NEW',
      })
    );

    // Force-logout from all platforms when role changes so the user
    // re-authenticates with the new role applied.
    const previousRole = existing.role || existing.UserType;
    const newRole = updates.role;
    if (newRole !== undefined && newRole !== previousRole) {
      await Submitter.invalidateAllSessions(email);
      console.log(
        `[AUDIT] ${timestamp} | SESSIONS_INVALIDATED | ` +
        `Admin: ${req.user.email} | Target: ${email} | ` +
        `Role: ${previousRole} → ${newRole}`
      );
    }

    const updated = result.Attributes || { ...existing, ...updates };
    if (updated.password) delete updated.password;
    res.json(updated);
  } catch (err) {
    console.error('updateUser error:', err);
    res.status(400).json({ error: err.message || 'Failed to update user' });
  }
};

/**
 * Permanently delete a user (admin-only).
 * Keys off `Email` — the real partition key.
 */

const deleteUser = async (req, res) => {
  const email = String(req.params.email || '').trim().toLowerCase();




  if (!email) {
    return res.status(400).json({ error: 'Email is required' });
  }

  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Only administrators can delete users' });
  }

  if (String(req.user.email).toLowerCase() === email) {
    return res.status(400).json({ error: 'You cannot delete your own account' });
  }

  try {
    console.log('deleteUser email:', email);

    // Delete from submitters — skip silently if not present (user may be pending-only)
    let deletedFromSubmitters = false;
    try {
      await dynamoDB.send(
        new DeleteCommand({
          TableName: SUBMITTERS_TABLE,
          Key: submitterKey(email),
          ConditionExpression: 'attribute_exists(#pk)',
          ExpressionAttributeNames: { '#pk': SUBMITTERS_PK },
        })
      );
      deletedFromSubmitters = true;
    } catch (err) {
      if (err.name !== 'ConditionalCheckFailedException') {
        throw err;
      }
    }

    // Delete from pending_registrations — skip silently if not present
    let deletedFromPending = false;
    try {
      const pendingResult = await dynamoDB.send(
        new DeleteCommand({
          TableName: PENDING_REGISTRATIONS_TABLE,
          Key: pendingRegisterKey(email),
          ConditionExpression: 'attribute_exists(email)',
          ReturnValues: 'ALL_OLD',
        })
      );
      deletedFromPending = !!(pendingResult.Attributes);
    } catch (err) {
      if (err.name !== 'ConditionalCheckFailedException') {
        throw err;
      }
    }

    if (!deletedFromSubmitters && !deletedFromPending) {
      return res.status(404).json({ error: 'User not found' });
    }

    const timestamp = new Date().toISOString();
    console.log(
      `[AUDIT] ${timestamp} | USER_DELETED | ` +
      `By: ${req.user.email} | Target: ${email} | ` +
      `submitters=${deletedFromSubmitters} pending=${deletedFromPending}`
    );

    return res.json({ success: true, message: 'User deleted successfully' });

  } catch (err) {
    console.error('deleteUser error:', err);
    return res.status(500).json({ error: 'Failed to delete user' });
  }
};

const deactivateUser = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    const updated = await Submitter.updateByEmail(email, {
      isActive: false,
    });

    return res.json({
      success: true,
      user: updated,
    });
  } catch (err) {
    console.error('Deactivate user error:', err);
    res.status(500).json({ error: err.message });
  }
};

/**
 * Get all pending deals
 */
const getPendingDeals = async (req, res) => {
  try {
    const deals = await dealStorage.getDealsByStatus('pending');
    res.json(deals);
  } catch (error) {
    console.error('Error fetching pending deals:', error);
    res.status(500).json({ error: 'Failed to fetch pending deals' });
  }
};

/**
 * Get all deals (for admin dashboard)
 */
const getAllDeals = async (req, res) => {
  try {

    console.log('Query : ', req.query)
    const { status, category, search } = req.query;

    let deals = await dealStorage.getAllDeals();

    if (status && status !== 'All' && status !== 'expired') {
      deals = deals.filter((d) => d.status === status);
    }

    if (status == 'expired') {
      deals = deals.filter((d) => d.expired_status == true);
    }

    if (category && category !== 'All') {
      deals = deals.filter(
        (d) => d.category?.toLowerCase() === category.toLowerCase()
      );
    }

    if (search) {
      const q = search.toLowerCase();
      deals = deals.filter((d) => {
        const fullAddress = [d.streetAddress, d.city, d.stateRegion, d.postalCode]
          .filter(Boolean)
          .join(', ')
          .toLowerCase();
        const streetNum = (d.streetAddress || '').trim().split(' ')[0].replace(/\D/g, '');
        const postal = (d.postalCode || '').trim();
        const propertyId = streetNum && postal ? `${streetNum}-${postal}` : streetNum || postal || '';
        return (
          propertyId.toLowerCase().includes(q) ||
          d.title?.toLowerCase().includes(q) ||
          d.description?.toLowerCase().includes(q) ||
          fullAddress.includes(q) ||
          d.submitterName?.toLowerCase().includes(q) ||
          d.submitterEmail?.toLowerCase().includes(q) ||
          String(d.price || '').includes(q) ||
          String(d.downPayment || '').includes(q) ||
          String(d.subjInterestRate || '').includes(q) ||
          String(d.totalMonthlyPayment || '').includes(q) ||
          d.financingType?.toLowerCase().includes(q) ||
          d.status?.toLowerCase().includes(q)
        );
      });
    }

    res.json(deals);
  } catch (error) {
    console.error('Error fetching all deals:', error);
    res.status(500).json({ error: 'Failed to fetch deals' });
  }
};

/**
 * Update a deal
 */
const updateDeal = async (req, res) => {
  try {
    const dealId = req.params.id;
    const updateData = req.body;

    // Check if deal exists
    const existingDeal = await dealStorage.getDealById(dealId);
    if (!existingDeal) {
      return res.status(404).json({ error: 'Deal not found' });
    }

    // Remove fields that shouldn't be updated directly
    delete updateData.id;
    delete updateData.submittedAt;
	
	    // Keep rejectionDate/rejectionDelete in sync with status changes
    if (updateData.status !== undefined) {
      const newStatus = String(updateData.status).toLowerCase();
      if (newStatus === 'rejected') {
        const now = new Date();
        updateData.rejectionDate = now.toISOString();
        updateData.rejectionDelete = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString();
        // updateData.rejectionDelete = now.toISOString();

      } else {
        updateData.rejectionDate = null;
        updateData.rejectionDelete = null;
      }
    }


    // Merge existing deal with updates for auto-tag generation
    const mergedDeal = { ...existingDeal, ...updateData };

    // Regenerate auto-tags based on updated data
    const autoTags = generateAutoTags(mergedDeal);
    updateData.autoTags = autoTags;

    // Merge auto-tags with any manual/special tags
    updateData.specialTags = mergeWithExistingTags(
      mergedDeal,
      updateData.specialTags || existingDeal.specialTags
    );

    await dealStorage.updateDeal(dealId, updateData);
    const updatedDeal = await dealStorage.getDealById(dealId);

    res.json(updatedDeal);
  } catch (error) {
    console.error('Error updating deal:', error);
    res.status(500).json({ error: 'Failed to update deal' });
  }
};

/**
 * Approve a deal
 */
const approveDeal = async (req, res) => {
  try {
    const dealId = req.params.id;

    // Check if deal exists
    const exists = await dealStorage.checkDealExistence(dealId);
    if (!exists) {
      return res.status(404).json({ error: 'Deal not found' });
    }

    await dealStorage.approveDeal(dealId);
    const updatedDeal = await dealStorage.getDealById(dealId);

    res.json(updatedDeal);
  } catch (error) {
    console.error('Error approving deal:', error);
    res.status(500).json({ error: 'Failed to approve deal' });
  }
};

/**
 * Reject a deal
 */
const rejectDeal = async (req, res) => {
  try {
    const dealId = req.params.id;
    const { reason } = req.body;

    if (!reason) {
      return res.status(400).json({ error: 'Rejection reason is required' });
    }

    // Check if deal exists
    const exists = await dealStorage.checkDealExistence(dealId);
    if (!exists) {
      return res.status(404).json({ error: 'Deal not found' });
    }

    await dealStorage.rejectDeal(dealId, reason);
    const updatedDeal = await dealStorage.getDealById(dealId);

    res.json(updatedDeal);
  } catch (error) {
    console.error('Error rejecting deal:', error);
    res.status(500).json({ error: 'Failed to reject deal' });
  }
};

/**
 * Publish a deal to customer view
 */
const publishDeal = async (req, res) => {
  try {
    // Only admins can publish
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        error: 'Only administrators can publish properties',
        message: 'Please submit this property for admin review instead',
      });
    }

    const dealId = req.params.id;

    // Check if deal exists
    const deal = await dealStorage.getDealById(dealId);
    if (!deal) {
      return res.status(404).json({ error: 'Deal not found' });
    }

    // Cannot publish sold properties
    if (deal.status === 'sold') {
      return res.status(400).json({
        error: 'Cannot publish a sold property',
      });
    }

    // Check if deal is approved
    if (deal.status !== 'approved') {
      return res
        .status(400)
        .json({ error: 'Only approved deals can be published' });
    }

    await dealStorage.publishDeal(dealId);
    const updatedDeal = await dealStorage.getDealById(dealId);

    // Notify users whose saved filters match this deal.
    // Fire-and-forget: errors are caught inside notifyMatchingUsers so they
    // never prevent the HTTP 200 response from reaching the admin.
    console.log('send notification....');


    notifyMatchingUsers(updatedDeal).catch((err) =>
      console.error('❌ Background notifyMatchingUsers error:', err)
    );

    res.json(updatedDeal);
  } catch (error) {
    console.error('Error publishing deal:', error);
    res.status(500).json({ error: 'Failed to publish deal' });
  }
};

/**
 * Unpublish a deal
 */
const unpublishDeal = async (req, res) => {
  try {
    // Only admins can unpublish
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        error: 'Only administrators can unpublish properties',
      });
    }

    const dealId = req.params.id;

    // Check if deal exists
    const deal = await dealStorage.getDealById(dealId);
    if (!deal) {
      return res.status(404).json({ error: 'Deal not found' });
    }

    // Only published deals can be unpublished
    if (deal.status !== 'published') {
      return res.status(400).json({ error: 'Deal is not published' });
    }

    await dealStorage.unpublishDeal(dealId);

    const updatedDeal = await dealStorage.getDealById(dealId);
    res.json(updatedDeal);
  } catch (error) {
    console.error('Error unpublishing deal:', error);
    res.status(500).json({ error: 'Failed to unpublish deal' });
  }
};

/**
 * Delete a deal (admin only, rejected deals only)
 */
const deleteDeal = async (req, res) => {
  try {
    // Only admins can delete
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        error: 'Only administrators can delete properties',
      });
    }

    const dealId = req.params.id;

    // Check if deal exists
    const deal = await dealStorage.getDealById(dealId);
    if (!deal) {
      return res.status(404).json({ error: 'Deal not found' });
    }

    // Only rejected deals can be deleted
    if (deal.status !== 'rejected') {
      return res.status(400).json({
        error: 'Only rejected properties can be permanently deleted',
      });
    }

    await dealStorage.deleteDeal(dealId);

    res.json({
      success: true,
      message: 'Rejected deal deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting deal:', error);
    res.status(500).json({ error: 'Failed to delete deal' });
  }
};

const getAdminUser = async (req, res) => {
  try {
    const { email } = req.params;
    const decodedEmail = Buffer.from(email, 'base64').toString('utf-8');
    const user = await Submitter.findByEmail(decodedEmail);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json(user);
  } catch (err) {
    console.error('getAdminUser error:', err);
    res.status(500).json({ error: 'Failed to fetch user' });
  }
};

const fetchTeamMembers = async (req, res) => {
  try {
    const users = await Submitter.listAll({ userType: 'team_member' });
    console.log('users : ', users)
    res.json(users);
  } catch (err) {
    console.error('fetchTeamMembers error:', err);
    res.status(500).json({ error: 'Failed to fetch team members' });
  }
}


module.exports = {
  getAdminUser,
  getAllUsers,
  createUser,
  updateUser,
  deleteUser,
  deactivateUser,
  getPendingDeals,
  getAllDeals,
  updateDeal,
  approveDeal,
  rejectDeal,
  publishDeal,
  unpublishDeal,
  deleteDeal,
  createRole,
  fetchAllRoles,
  fetchPublicRoles,
  deleteRole,
  fetchTeamMembers,
};
