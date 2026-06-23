/**
 * Draft controller
 *
 * Handles CRUD for draft_properties DynamoDB table.
 *
 * Table schema (created by src/table/create-draft-properties-table.js):
 *   Primary key : id (String)
 *   GSI         : submitterEmail-index on submitterEmail (String)
 *
 * Ownership model:
 *   Each draft stores submitterEmail. All reads/writes/deletes verify that
 *   req.user.email matches the draft's submitterEmail to prevent cross-user
 *   access. Admins are allowed to bypass this check.
 */
const {
  PutCommand,
  GetCommand,
  UpdateCommand,
  DeleteCommand,
  QueryCommand,
} = require('@aws-sdk/lib-dynamodb');
const { randomUUID } = require('crypto');

const { dynamoDB, TABLES } = require('../config/aws');

const TABLE = TABLES.DRAFT_PROPERTIES;

/* ---------- helpers ---------- */

// Extract the authenticated user's email. Different middleware may attach
// the user object under slightly different keys, so we check common ones.
function getAuthEmail(req) {
  return (
    req.user?.email ||
    req.user?.userEmail ||
    req.session?.email ||
    null
  );
}

// Lightweight admin check — adjust the role value if your app uses a
// different string (e.g., 'superadmin'). Non-admins are scoped to their
// own drafts only.
function isAdmin(req) {
  const role = req.user?.role || req.user?.userType;
  return role === 'admin' || role === 'administrator';
}

/* ---------- POST /api/drafts ---------- */

exports.createDraft = async (req, res) => {
  try {
    const authEmail = getAuthEmail(req);
    if (!authEmail) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const body = req.body || {};
    const now = new Date().toISOString();

    // Force submitterEmail to the authenticated user's email for non-admins.
    // Admins may submit on behalf of another user (submitAsOther flow), so
    // we let them override it via the request body.
    const submitterEmail =
      isAdmin(req) && body.submitterEmail ? body.submitterEmail : authEmail;

    const draft = {
      ...body,
      id: randomUUID(),
      submitterEmail,
      created_at: now,
      updated_at: now,
    };

    await dynamoDB.send(
      new PutCommand({
        TableName: TABLE,
        Item: draft,
      })
    );

    return res.status(201).json({ data: draft });
  } catch (err) {
    console.error('createDraft failed:', err);
    return res
      .status(500)
      .json({ error: err.message || 'Failed to create draft' });
  }
};

/* ---------- GET /api/drafts/mine?email=... ---------- */

exports.getMyDrafts = async (req, res) => {
  try {
    const authEmail = getAuthEmail(req);
    if (!authEmail) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // A non-admin can only list their own drafts; ignore any ?email= override.
    const email =
      isAdmin(req) && req.query.email ? req.query.email : authEmail;

    const { Items = [] } = await dynamoDB.send(
      new QueryCommand({
        TableName: TABLE,
        IndexName: 'submitterEmail-index',
        KeyConditionExpression: 'submitterEmail = :email',
        ExpressionAttributeValues: { ':email': email },
      })
    );

    // Sort newest-first by updated_at (falling back to created_at)
    Items.sort((a, b) => {
      const ta = new Date(a.updated_at || a.created_at || 0).getTime();
      const tb = new Date(b.updated_at || b.created_at || 0).getTime();
      return tb - ta;
    });

    return res.json({ data: Items });
  } catch (err) {
    console.error('getMyDrafts failed:', err);
    return res
      .status(500)
      .json({ error: err.message || 'Failed to fetch drafts' });
  }
};

/* ---------- GET /api/drafts/:id ---------- */

exports.getDraftById = async (req, res) => {
  try {
    const authEmail = getAuthEmail(req);
    if (!authEmail) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { Item } = await dynamoDB.send(
      new GetCommand({
        TableName: TABLE,
        Key: { id: req.params.id },
      })
    );

    if (!Item) {
      return res.status(404).json({ error: 'Draft not found' });
    }

    if (!isAdmin(req) && Item.submitterEmail !== authEmail) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    return res.json({ data: Item });
  } catch (err) {
    console.error('getDraftById failed:', err);
    return res
      .status(500)
      .json({ error: err.message || 'Failed to fetch draft' });
  }
};

/* ---------- PUT /api/drafts/:id ---------- */

exports.updateDraft = async (req, res) => {
  try {
    const authEmail = getAuthEmail(req);
    if (!authEmail) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { id } = req.params;

    // Fetch first to verify existence + ownership
    const { Item: existing } = await dynamoDB.send(
      new GetCommand({ TableName: TABLE, Key: { id } })
    );

    if (!existing) {
      return res.status(404).json({ error: 'Draft not found' });
    }
    if (!isAdmin(req) && existing.submitterEmail !== authEmail) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const body = req.body || {};

    // Build a dynamic UPDATE expression from the incoming body. We skip the
    // primary key and system fields so callers can't break invariants.
    const RESERVED = new Set(['id', 'created_at', 'submitterEmail']);

    const names = {};
    const values = {};
    const sets = [];

    for (const [key, value] of Object.entries(body)) {
      if (RESERVED.has(key)) continue;
      if (value === undefined) continue;

      const nameToken = `#${key}`;
      const valueToken = `:${key}`;
      names[nameToken] = key;
      values[valueToken] = value;
      sets.push(`${nameToken} = ${valueToken}`);
    }

    // Always bump updated_at
    names['#updated_at'] = 'updated_at';
    values[':updated_at'] = new Date().toISOString();
    sets.push('#updated_at = :updated_at');

    const { Attributes } = await dynamoDB.send(
      new UpdateCommand({
        TableName: TABLE,
        Key: { id },
        UpdateExpression: `SET ${sets.join(', ')}`,
        ExpressionAttributeNames: names,
        ExpressionAttributeValues: values,
        ReturnValues: 'ALL_NEW',
      })
    );

    return res.json({ data: Attributes });
  } catch (err) {
    console.error('updateDraft failed:', err);
    return res
      .status(500)
      .json({ error: err.message || 'Failed to update draft' });
  }
};

/* ---------- DELETE /api/drafts/:id ---------- */

exports.deleteDraft = async (req, res) => {
  try {
    const authEmail = getAuthEmail(req);
    if (!authEmail) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { id } = req.params;

    // Verify ownership before deleting
    const { Item: existing } = await dynamoDB.send(
      new GetCommand({ TableName: TABLE, Key: { id } })
    );

    if (!existing) {
      // Treat delete of a non-existent draft as success (idempotent)
      return res.json({ data: { id, deleted: true } });
    }
    if (!isAdmin(req) && existing.submitterEmail !== authEmail) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    await dynamoDB.send(
      new DeleteCommand({
        TableName: TABLE,
        Key: { id },
      })
    );

    return res.json({ data: { id, deleted: true } });
  } catch (err) {
    console.error('deleteDraft failed:', err);
    return res
      .status(500)
      .json({ error: err.message || 'Failed to delete draft' });
  }
};
