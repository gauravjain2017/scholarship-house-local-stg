/**
 * propertyClaimService.js
 *
 * Handles the "I want this Scholarship House" flow:
 *   1. Atomically flips the property in the `properties` DynamoDB table
 *      from `published` → `pending` (only if currently `published`).
 *   2. Records who claimed it, when, and why it's pending.
 *   3. Emails the Scholarship House team so they can follow up with the
 *      MOU + $5k wire within 48 hours.
 *
 * Usage (in a route/controller):
 *   const { claimProperty } = require('../services/propertyClaimService');
 *   const updated = await claimProperty({ dealId, user: req.user });
 */

const { UpdateCommand, GetCommand } = require('@aws-sdk/lib-dynamodb');
const { dynamoDB, TABLES } = require('../config/aws');
const { sendEmail } = require('./emailService');
const { buildClaimNotificationEmail } = require('../utils/claimNotificationEmailTemplate');

// ── Recipients who get notified on every claim ──────────────────────────────
// Keep this list in one place so it's easy to add/remove people later.

const CLAIM_NOTIFICATION_EMAILS = [
  'Lance@ScholarshipHouse.com',
  'Kailey@ScholarshipHouse.com',
  'Kyler@ScholarshipHouse.com',
];



// Base URL for deal links (same env var used by dealPublishNotifier)
const APP_BASE_URL = process.env.CLIENT_URL || '';

/**
 * Fetch a single property row by id.
 */
async function getProperty(dealId) {
  const result = await dynamoDB.send(
    new GetCommand({
      TableName: TABLES.PROPERTIES,
      Key: { id: dealId },
    })
  );
  return result.Item || null;
}

/**
 * Fetch the full submitter row from the SUBMITTERS table by email.
 * The table is keyed by `Email` (PascalCase, lowercase value), so a Get
 * is enough — no Scan or Query needed.
 *
 * Returns the raw Item (with PascalCase keys) so the email template can
 * surface every field that exists for that user, or null if not found.
 */
async function getSubmitterByEmail(email) {
  if (!email) return null;
  const result = await dynamoDB.send(
    new GetCommand({
      TableName: TABLES.SUBMITTERS,
      Key: { Email: String(email).toLowerCase() },
    })
  );
  return result.Item || null;
}

/**
 * Convert a raw submitter record (PascalCase, mixed shape) into the flat,
 * camelCase shape consumed by the notification email template. Only fields
 * that actually have a value are included so the template can decide whether
 * to render that row.
 */
function buildClaimedByPayload({ submitter, fallbackUser }) {
  // Merge: prefer DB submitter values, fall back to req.user
  const src = submitter || {};
  const fb = fallbackUser || {};

  const pick = (...candidates) => {
    for (const c of candidates) {
      if (c !== undefined && c !== null && c !== '') return c;
    }
    return null;
  };

  const fullName = pick(
    src.Name,
    src.FullName,
    fb.name,
    fb.fullName,
    [fb.firstName, fb.lastName].filter(Boolean).join(' ').trim() || null
  );

  return {
    name: fullName,
    email: pick(src.Email, fb.email),
    phone: pick(src.Phone, fb.phone),
    userType: pick(src.UserType, fb.role, fb.userType),
    company: pick(src.Company, src.CompanyName, fb.company),
    address: pick(src.Address, src.StreetAddress, fb.address),
    city: pick(src.City, fb.city),
    state: pick(src.State, src.StateRegion, fb.state),
    zip: pick(src.Zip, src.PostalCode, fb.zip),
    country: pick(src.Country, fb.country),
    createdAt: pick(src.CreatedAt, src.createdAt),
  };
}

/**
 * Conditionally update the property to `pending`. The ConditionExpression
 * guarantees we don't accidentally overwrite a `sold` or already-`pending`
 * property if two users click "I want this" at nearly the same time.
 */
async function markPropertyPending({ dealId, claimedBy, claimedAt }) {
  const updateResult = await dynamoDB.send(
    new UpdateCommand({
      TableName: TABLES.PROPERTIES,
      Key: { id: dealId },
      // Only flip the status if the property is currently `published`.
      ConditionExpression: '#status = :published',
      UpdateExpression: `
        SET #status       = :pending,
            claimedBy     = :claimedBy,
            claimedAt     = :claimedAt,
            pendingReason = :pendingReason
      `,
      ExpressionAttributeNames: {
        '#status': 'status',
      },
      ExpressionAttributeValues: {
        ':published': 'published',
        ':pending': 'pending',
        ':claimedBy': claimedBy,
        ':claimedAt': claimedAt,
        ':pendingReason': 'awaiting_mou_and_wire',
      },
      ReturnValues: 'ALL_NEW',
    })
  );

  return updateResult.Attributes;
}

/**
 * Fan out notification emails to the Scholarship House team.
 * One failed email never blocks the others (Promise.allSettled, same
 * pattern as dealPublishNotifier).
 */
async function notifyScholarshipHouseTeam({ deal, claimedBy, claimedAt }) {
	
 const dealLink = APP_BASE_URL
    ? `${APP_BASE_URL}/property/${deal.id}`
    : `/property/${deal.id}`;

  const { subject, html, text } = buildClaimNotificationEmail({
    deal,
    claimedBy,
    dealLink,
    claimedAt,
  });

  const results = await Promise.allSettled(
    CLAIM_NOTIFICATION_EMAILS.map((to) =>
      sendEmail({ to, subject, html, text })
        .then(() => {
          console.log(`✅ Claim notification sent to ${to} for deal ${deal.id}`);
          return { to, ok: true };
        })
        .catch((err) => {
          console.error(
            `❌ Failed to send claim notification to ${to}:`,
            err.message
          );
          throw err;
        })
    )
  );

  const sent = results.filter((r) => r.status === 'fulfilled').length;
  const failed = results.length - sent;
  console.log(
    `📨 Claim notifications: ${sent} sent, ${failed} failed for deal ${deal.id}`
  );
}

/**
 * Public entry point.
 *
 * @param {Object} params
 * @param {string} params.dealId  - The property id
 * @param {Object} params.user    - The authenticated user (req.user)
 * @returns {Promise<Object>} The updated property row
 * @throws  {Error} with .code set when the property isn't claimable
 */
async function claimProperty({ dealId, user }) {
  if (!dealId) {
    const err = new Error('dealId is required');
    err.code = 'BAD_REQUEST';
    throw err;
  }
  if (!user?.email) {
    const err = new Error('Authenticated user is required to claim a property');
    err.code = 'UNAUTHORIZED';
    throw err;
  }

  // 1. Load the existing property (used for pre-flight checks + email content)
  const existing = await getProperty(dealId);
  if (!existing) {
    const err = new Error('Property not found');
    err.code = 'NOT_FOUND';
    throw err;
  }

  // 2. Pre-flight status check. (The conditional UpdateCommand below is the
  //    real race-safe guard, but this gives us a cleaner error message when
  //    the status is already pending/sold/etc.)
  if (existing.status !== 'published') {
    const err = new Error(
      `This property is not available to claim (current status: ${existing.status}).`
    );
    err.code = 'CONFLICT';
    throw err;
  }

  const claimedAt = new Date().toISOString();

  // Look up the full submitter record by email so the team notification
  // can show every detail we have on file (name, phone, address, etc.).
  // Falls back gracefully to req.user fields when no submitter row exists.
  const submitter = await getSubmitterByEmail(user.email);
  const claimedBy = buildClaimedByPayload({ submitter, fallbackUser: user });

  // 3. Atomically mark as pending
  let updated;
  try {
    updated = await markPropertyPending({ dealId, claimedBy, claimedAt });
  } catch (err) {
    // ConditionalCheckFailedException → someone else claimed it first
    if (err.name === 'ConditionalCheckFailedException') {
      const conflict = new Error(
        'This property was just claimed by another user. Please refresh and try again.'
      );
      conflict.code = 'CONFLICT';
      throw conflict;
    }
    throw err;
  }

  // 4. Notify the team. We intentionally do NOT await-throw here — the claim
  //    itself succeeded; a failed email shouldn't cause the client to see an
  //    error and retry the claim. Errors are still logged.
  try {
    await notifyScholarshipHouseTeam({
      deal: updated,
      claimedBy: updated.claimedBy,
      claimedAt,
    });
  } catch (notifyErr) {
    console.error(
      '❌ propertyClaimService: notification step failed but claim succeeded:',
      notifyErr
    );
  }

  return updated;
}

module.exports = {
  claimProperty,
  CLAIM_NOTIFICATION_EMAILS,
};
