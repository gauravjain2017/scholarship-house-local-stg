/**
 * propertyClaimController.js
 *
 * Express controller for `POST /deals/:id/claim`. Thin wrapper that
 * delegates to propertyClaimService and maps service errors to HTTP
 * status codes. On success, writes a record to the claim_property table.
 */

const { v4: uuidv4 } = require('uuid');
const { claimProperty } = require('../services/propertyClaimService');
const { dynamoDB, TABLES } = require('../config/aws');
const { PutCommand, QueryCommand, ScanCommand, GetCommand, UpdateCommand, DeleteCommand } = require('@aws-sdk/lib-dynamodb');
const Submitter = require('../models/Submitter');

const CODE_TO_STATUS = {
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  NOT_FOUND: 404,
  CONFLICT: 409,
};

async function claimRecordExists(clientId, propertyId) {
  const result = await dynamoDB.send(
    new QueryCommand({
      TableName: TABLES.CLAIM_PROPERTY,
      IndexName: 'clientId-index',
      KeyConditionExpression: 'clientId = :clientId',
      FilterExpression: 'propertyId = :propertyId',
      ExpressionAttributeValues: {
        ':clientId': clientId,
        ':propertyId': propertyId,
      },
      Limit: 1,
    })
  );
  return result.Count > 0;
}

async function saveClaimRecord({ user, dealId, claimDate }) {
  // JWT payload varies by login flow; email is always present across all flows
  const clientId = user.userId || user.id || user.email || '';

  if (!clientId) {
    console.warn('propertyClaimController: cannot save claim record — no client identifier found on user');
    return;
  }

  const alreadyClaimed = await claimRecordExists(clientId, dealId);
  if (alreadyClaimed) {
    console.log(`Claim record already exists for clientId=${clientId} propertyId=${dealId}, skipping insert.`);
    return;
  }

  const now = new Date().toISOString();
  const fullName = [user.firstName, user.lastName].filter(Boolean).join(' ') || user.name || '';

  // Pull the client's assigned specialist (team_member email) from the
  // SUBMITTERS table so we can scope the admin claim list per team member.
  let specialistEmail = '';
  if (user.email) {
    try {
      const submitter = await Submitter.findByEmail(user.email);
      specialistEmail = (submitter?.specialist || '').toLowerCase();
    } catch (err) {
      console.warn('propertyClaimController: failed to look up specialist for', user.email, err);
    }
  }

  await dynamoDB.send(
    new PutCommand({
      TableName: TABLES.CLAIM_PROPERTY,
      Item: {
        id: uuidv4(),
        clientId,
        clientName: fullName,
        clientEmail: user.email || '',
        propertyId: dealId,
        status: 'pending',
        specialistEmail,
        claimDate,
        createdAt: now,
        updatedAt: now,
      },
    })
  );
}

async function claimPropertyHandler(req, res) {
  try {
    const dealId = req.params.id || req.params.dealId;
    const user = req.user;

    const updated = await claimProperty({ dealId, user });

    const claimDate = new Date().toISOString();

    try {
      await saveClaimRecord({ user, dealId, claimDate });
    } catch (recordErr) {
      console.error('propertyClaimController: failed to save claim record:', recordErr);
    }

    return res.status(200).json({
      success: true,
      message:
        'Property marked as pending. The team has been notified and will reach out about the MOU and $5k wire.',
      deal: updated,
    });
  } catch (err) {
    const status = CODE_TO_STATUS[err.code] || 500;
    if (status >= 500) {
      console.error('propertyClaimController error:', err);
    }
    return res.status(status).json({
      success: false,
      error: err.message || 'Failed to claim property',
    });
  }
}

async function getAllClaimProperties(req, res) {
  try {
    const { clientId, propertyId, clientEmail } = req.query;
    const filterExpressions = [];
    const expressionAttributeNames = {};
    const expressionAttributeValues = {};

    if (clientId) {
      filterExpressions.push('clientId = :clientId');
      expressionAttributeValues[':clientId'] = clientId;
    }
    if (propertyId) {
      filterExpressions.push('propertyId = :propertyId');
      expressionAttributeValues[':propertyId'] = propertyId;
    }
    if (clientEmail) {
      filterExpressions.push('clientEmail = :clientEmail');
      expressionAttributeValues[':clientEmail'] = clientEmail;
    }

    const params = { TableName: TABLES.CLAIM_PROPERTY };
    if (filterExpressions.length > 0) {
      params.FilterExpression = filterExpressions.join(' AND ');
      params.ExpressionAttributeValues = expressionAttributeValues;
    }

    const result = await dynamoDB.send(new ScanCommand(params));
    const claims = result.Items || [];

    const enriched = await Promise.all(
      claims.map(async (claim) => {
        if (!claim.propertyId) return { ...claim, property: null };
        const propertyResult = await dynamoDB.send(
          new GetCommand({ TableName: TABLES.PROPERTIES, Key: { id: claim.propertyId } })
        );
        return { ...claim, property: propertyResult.Item || null };
      })
    );

    return res.status(200).json({ success: true, items: enriched });
  } catch (err) {
    console.error('getAllClaimProperties error:', err);
    return res.status(500).json({ success: false, error: 'Failed to fetch claim properties' });
  }
}

async function updateClaimStatus(req, res) {
  try {
    const { id } = req.params;
    const { status, notes, reason } = req.body;

    if (!['approved', 'rejected', 'pending'].includes(status)) {
      return res.status(400).json({ success: false, error: 'status must be "approved", "rejected", or "pending"' });
    }

    const now = new Date().toISOString();

    const updateExpressionParts = ['#status = :status', 'updatedAt = :updatedAt'];
    const expressionAttributeNames = { '#status': 'status' };
    const expressionAttributeValues = { ':status': status, ':updatedAt': now };

    if (notes !== undefined) {
      updateExpressionParts.push('notes = :notes');
      expressionAttributeValues[':notes'] = notes;
    }
    if (reason !== undefined) {
      updateExpressionParts.push('reason = :reason');
      expressionAttributeValues[':reason'] = reason;
    }

    await dynamoDB.send(
      new UpdateCommand({
        TableName: TABLES.CLAIM_PROPERTY,
        Key: { id },
        UpdateExpression: `SET ${updateExpressionParts.join(', ')}`,
        ExpressionAttributeNames: expressionAttributeNames,
        ExpressionAttributeValues: expressionAttributeValues,
        ReturnValues: 'ALL_NEW',
      })
    );

    return res.status(200).json({ success: true, message: `Claim ${status} successfully` });
  } catch (err) {
    console.error('updateClaimStatus error:', err);
    return res.status(500).json({ success: false, error: 'Failed to update claim status' });
  }
}

/**
 * DELETE /admin/claim-properties/:id
 *
 * Deletes the claim row from the claim_property table AND clears the
 * `claimedAt` / `claimedBy` attributes on the linked property so it no
 * longer shows as claimed. The property's `status` is left unchanged.
 */
async function deleteClaimProperty(req, res) {
  try {
    const { id } = req.params;
    if (!id) {
      return res.status(400).json({ success: false, error: 'Claim id is required' });
    }

    // Look up the claim first so we know which property to un-claim.
    const existing = await dynamoDB.send(
      new GetCommand({ TableName: TABLES.CLAIM_PROPERTY, Key: { id } })
    );
    const claim = existing.Item;
    if (!claim) {
      return res.status(404).json({ success: false, error: 'Claim not found' });
    }

    // Delete the claim record.
    await dynamoDB.send(
      new DeleteCommand({ TableName: TABLES.CLAIM_PROPERTY, Key: { id } })
    );

    // Clear claimedAt / claimedBy on the property (best-effort — a missing
    // property shouldn't fail the delete the admin just performed).
    if (claim.propertyId) {
      try {
        await dynamoDB.send(
          new UpdateCommand({
            TableName: TABLES.PROPERTIES,
            Key: { id: claim.propertyId },
            UpdateExpression: 'REMOVE claimedAt, claimedBy',
            ConditionExpression: 'attribute_exists(id)',
          })
        );
      } catch (propErr) {
        if (propErr.name !== 'ConditionalCheckFailedException') {
          console.error('deleteClaimProperty: failed to clear claim fields on property', claim.propertyId, propErr);
        }
      }
    }

    return res.status(200).json({ success: true, message: 'Claim deleted successfully' });
  } catch (err) {
    console.error('deleteClaimProperty error:', err);
    return res.status(500).json({ success: false, error: 'Failed to delete claim' });
  }
}

module.exports = { claimPropertyHandler, getAllClaimProperties, updateClaimStatus, deleteClaimProperty };
