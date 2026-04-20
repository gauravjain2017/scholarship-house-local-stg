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

const expireDueDeals = async () => {
  const today = todayISODate();
  const deals = await Deal.getAll();

  const expiredDeals = deals.filter((d) => {
    if (d.status == 'sold') return false;
    const iso = convertToISO(d.expiry_date);
    if (!iso) return false;
    return iso <= today;
  });

  const updatedDeals = [];
  for (const deal of expiredDeals) {
    if (deal.expired_status === true) continue;
    const updated = await Deal.update(deal.id, { expired_status: true });
    updatedDeals.push(updated);
    await notifyExpiredDeal({ ...deal, ...updated });
  }
  return updatedDeals;
};

module.exports = { expireDueDeals };
