const Deal = require('../models/Deal');
const { createNotification } = require('./notificationService');
const { sendDealExpiredEmail } = require('./emailService');

const todayISODate = () => {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

const isoDatePlusDays = (days) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

const convertToISO = (dateStr) => {
  if (!dateStr || typeof dateStr !== 'string') return null;
  const trimmed = dateStr.trim();
  if (!trimmed) return null;

  if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) return trimmed.slice(0, 10);

  const parts = trimmed.split('/');
  if (parts.length !== 3) return null;
  const [mm, dd, yyyy] = parts;
  if (!mm || !dd || !yyyy) return null;
  return `${yyyy}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`;
};

const notifyExpiredDeal = async (deal) => {
  const adminEmail = process.env.ADMIN_EMAIL;
  const submitterEmail = deal.submitterEmail || null;

  if (adminEmail) {
    await createNotification('deal_expired', deal.id, {
      admin_email: adminEmail,
      action_performer_id: submitterEmail,
    });
    try {
      await sendDealExpiredEmail({
        toEmail: adminEmail,
        recipientRole: 'admin',
        deal,
      });
    } catch (err) {
      console.error(
        `[expirationJob] Failed to email admin for deal ${deal.id}:`,
        err.message
      );
    }
  } else {
    console.warn(
      '[expirationJob] ADMIN_EMAIL env not set — skipping admin notification/email'
    );
  }

  // ── Submitter: notification + email ─────────────────────────────────
  if (submitterEmail) {
    await createNotification('deal_expired', deal.id, {
      admin_email: submitterEmail,
      action_performer_id: submitterEmail,
    });
    try {
      await sendDealExpiredEmail({
        toEmail: submitterEmail,
        recipientRole: 'submitter',
        deal,
      });
    } catch (err) {
      console.error(
        `[expirationJob] Failed to email submitter for deal ${deal.id}:`,
        err.message
      );
    }
  } else {
    console.warn(
      `[expirationJob] Deal ${deal.id} has no submitterEmail — skipping submitter notification/email`
    );
  }
};

const notifyExpiringDeal = async (deal) => {
  const adminEmail = process.env.ADMIN_EMAIL;
  const submitterEmail = deal.submitterEmail || null;

  if (adminEmail) {
    await createNotification('deal_expiring_soon', deal.id, {
      admin_email: adminEmail,
      action_performer_id: submitterEmail,
    });
  } else {
    console.warn('[expirationJob] ADMIN_EMAIL env not set — skipping admin expiry warning notification');
  }

  if (submitterEmail) {
    await createNotification('deal_expiring_soon', deal.id, {
      admin_email: submitterEmail,
      action_performer_id: submitterEmail,
    });
  } else {
    console.warn(`[expirationJob] Deal ${deal.id} has no submitterEmail — skipping submitter expiry warning notification`);
  }
};

const warnExpiringDeals = async () => {
  const target = isoDatePlusDays(3);
  const deals = await Deal.getAll();

  const expiringDeals = deals.filter((d) => {
    if (d.status === 'sold') return false;
    if (d.expired_status === true) return false;
    if (d.expiry_warning_sent === true) return false;
    const iso = convertToISO(d.expiry_date);
    return iso === target;
  });

  for (const deal of expiringDeals) {
    await Deal.update(deal.id, { expiry_warning_sent: true });
    await notifyExpiringDeal(deal);
    console.log(`[expirationJob] Expiry warning notification sent for deal ${deal.id} (expires ${target})`);
  }

  return expiringDeals;
};

const expireDueDeals = async () => {

  console.log('[expirationJob] Checking for deals to expire...');
  const today = todayISODate();
  const deals = await Deal.getAll();

  const expiredDeals = deals.filter((d) => {
    if (d.status == 'sold') return false;
    const iso = convertToISO(d.expiry_date);
    if (!iso) return false;
    return iso <= today;
  });

  console.log(`[expirationJob] Found ${expiredDeals.length} deals to expire (expiry_date <= ${today})`);

  const updatedDeals = [];
  for (const deal of expiredDeals) {
    if (deal.expired_status === true) continue;
    const updated = await Deal.update(deal.id, { expired_status: true });
    updatedDeals.push(updated);
    await notifyExpiredDeal({ ...deal, ...updated });
  }
  return updatedDeals;
};

module.exports = { expireDueDeals, warnExpiringDeals };
