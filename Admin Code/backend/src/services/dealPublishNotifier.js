/**
 * dealPublishNotifier.js
 * When a deal is published, find every user whose saved buy-box filter
 * matches the deal and send them an email notification.
 *
 * Usage (in adminController.js → publishDeal):
 *   const { notifyMatchingUsers } = require('../services/dealPublishNotifier');
 *   await notifyMatchingUsers(updatedDeal);
 */

const BuyBox = require('../models/BuyBox');
const Submitter = require('../models/Submitter');
const { dealMatchesFilter } = require('../utils/dealFilterMatcher');
const { buildDealMatchEmail } = require('../utils/dealMatchEmailTemplate');
const { sendEmail } = require('./emailService'); // ← your existing email sender
const { createNotification } = require('./notificationService');

// Base URL for deal links (set via env var, e.g. https://yourapp.com)
const APP_BASE_URL = process.env.CLIENT_URL;

// ── Blocked email addresses — notifications will never be sent to these ──────
// Add more emails to this list as needed.
const BLOCKED_EMAILS = new Set([
  'lancetmorgan@gmail.com',
]);

/**
 * Fetch ALL active buy-boxes from the buy_boxes table.
 * BuyBox.getAll() should return an array of rows; add it to your BuyBox model
 * if it doesn't exist yet (see note below).
 *
 * @returns {Promise<Array>}
 */
async function getAllActiveBuyBoxes() {
  // If your BuyBox model exposes a getAll / scan method use it directly.
  // Otherwise fall back to a raw DynamoDB / DB scan.
  if (typeof BuyBox.getAll === 'function') {
    return BuyBox.getAll({ is_active: true });
  }

  // ── Fallback: raw scan (works for both DynamoDB and SQL via your ORM) ────
  // Replace the block below with whatever DB client your project uses.
  const { dynamoDB, TABLES } = require('../config/aws');
  const { ScanCommand } = require('@aws-sdk/lib-dynamodb');

  const result = await dynamoDB.send(
    new ScanCommand({
      TableName: 'buy_boxes',
      FilterExpression: 'is_active = :t',
      ExpressionAttributeValues: { ':t': true },
    })
  );

  return result.Items || [];
}

/**
 * Core function — call this right after a deal is successfully published.
 *
 * @param {Object} deal - The fully-updated deal object (post-publish)
 * @param {Object} req  - Express request object (used to read req.user.email)
 */
 
 

 
async function notifyMatchingUsers(deal, req) {
  try {
   // 1. Fetch all active saved filters
    const buyBoxes = await getAllActiveBuyBoxes();

    if (!buyBoxes || buyBoxes.length === 0) {
      console.log('📭 No active buy-boxes found; skipping match notifications.');
      return;
    }

    const dealLink = `${APP_BASE_URL}/property/${deal.id}`;

    // 2. De-duplicate: track which user_ids we already emailed this deal
    //    (guards against a user having multiple buy-boxes that all match)
    const notifiedUsers = new Set();

    // 3. Iterate buy-boxes and match
    const emailPromises = [];

    for (const buyBox of buyBoxes) {
      const userId = buyBox.user_id; // email address used as user identifier

      // Skip globally blocked addresses
      if (BLOCKED_EMAILS.has(userId.toLowerCase())) {
        console.log(`🚫 Skipping blocked email: ${userId}`);
        continue;
      }

      // Skip if we already queued an email for this user for this deal
      if (notifiedUsers.has(userId)) continue;

      // Parse filters_json (may already be an object or a JSON string)
      let filters;
      try {
        filters =
          typeof buyBox.filters_json === 'string'
            ? JSON.parse(buyBox.filters_json)
            : buyBox.filters_json;
      } catch (parseErr) {
        console.warn(`⚠️  Could not parse filters_json for buy-box ${buyBox.id}:`, parseErr.message);
        continue;
      }

     
   if (!dealMatchesFilter(deal, filters)) continue;

      // 4. Match found — look up the user's name
      notifiedUsers.add(userId);

      emailPromises.push(
        (async () => {
          try {
            let recipientName = userId; // fallback to email

            const submitter = await Submitter.findByEmail(userId);
            if (submitter?.Name) recipientName = submitter.Name;

            const { subject, html, text } = buildDealMatchEmail({
              recipientName,
              deal,
              dealLink,
            });

            await sendEmail({
              to: userId,
              subject,
              html,
              text,
            });
    
	  // Save a notification record for this matched user
		 await createNotification('new_property', deal.id, {
              action_performer_id: deal.submitterEmail,
              notify: false,
              admin_email: userId,
            });
			
			 console.log(`✅ Deal-match email sent to ${userId} for deal ${deal.id}`);
			 
		//console.log(`🔔 Notification record saved for ${userId} for deal ${deal.id} by deal ${deal.submitterEmail}`);
			 
			 
			 
          } catch (emailErr) {
            // Never let a single failed email abort the whole loop
            console.error(
              `❌ Failed to send deal-match email to ${userId}:`,
              emailErr.message
            );
          }
        })()
      );
    }

    // 5. Fire all emails concurrently
    await Promise.allSettled(emailPromises);

    console.log(
      `📨 Deal-match notifications complete: ${notifiedUsers.size} user(s) notified for deal ${deal.id}`
    );
  } catch (err) {
    // Log but never crash the publish flow
    console.error('❌ dealPublishNotifier.notifyMatchingUsers failed:', err);
  }
}

module.exports = { notifyMatchingUsers };
