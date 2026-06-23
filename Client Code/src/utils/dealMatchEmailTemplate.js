/**
 * dealMatchEmailTemplate.js
 * Generates the HTML (and plain-text fallback) body for a "deal matches your
 * saved filter" notification email.
 */

/**
 * @param {Object} params
 * @param {string} params.recipientName   - User's display name (or email fallback)
 * @param {Object} params.deal            - The published deal object
 * @param {string} params.dealLink        - Full URL to view the deal
 * @returns {{ subject: string, html: string, text: string }}
 */
function buildDealMatchEmail({ recipientName, deal, dealLink }) {
  const name = recipientName || 'Investor';

  // ── Friendly field helpers ────────────────────────────────────────────────
  const fmt = (v) => (v != null && v !== '' ? v : '—');
  const fmtMoney = (v) =>
    v != null && v !== ''
      ? `$${Number(v).toLocaleString('en-US')}`
      : '—';

  const title       = fmt(deal.title);
  const city        = fmt(deal.city);
  const stateRegion = fmt(deal.stateRegion);
  const location    = city !== '—' ? `${city}, ${stateRegion}` : stateRegion;
  const category    = fmt(deal.category);
  const bedrooms    = fmt(deal.bedrooms);
  const bathrooms   = fmt(deal.bathrooms);
  const price       = fmtMoney(deal.price);
  const downPayment = fmtMoney(deal.downPayment);
  const monthlyPmt  = fmtMoney(deal.totalMonthlyPayment);
  const sqft        = deal.squareFootage ? `${Number(deal.squareFootage).toLocaleString()} sq ft` : '—';
  const yearBuilt   = fmt(deal.yearBuilt);

  // ── Subject ───────────────────────────────────────────────────────────────
  const subject = `🏠 New deal matches your saved filter: ${title}`;

  // ── HTML body ─────────────────────────────────────────────────────────────
  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>${subject}</title>
  <style>
    body { margin:0; padding:0; background:#f4f6f8; font-family:Arial,Helvetica,sans-serif; color:#333; }
    .wrapper { max-width:100%; margin:32px auto; background:#fff; border-radius:8px; overflow:hidden; box-shadow:0 2px 8px rgba(0,0,0,.1); }
    .header  { background:#1a3c5e; padding:28px 32px; text-align:center; }
    .header h1 { margin:0; color:#fff; font-size:22px; }
    .body    { padding:28px 32px; }
    .body p  { font-size:15px; line-height:1.6; margin:0 0 16px; }
    .card    { background:#f9fafb; border:1px solid #e2e8f0; border-radius:6px; padding:20px 24px; margin:20px 0; }
    .card h2 { margin:0 0 14px; font-size:18px; color:#1a3c5e; }
    table.details { width:100%; border-collapse:collapse; font-size:14px; }
    table.details td { padding:6px 0; vertical-align:top; }
    table.details td:first-child { color:#666; width:46%; }
    table.details td:last-child  { font-weight:600; color:#222; }
    .cta-wrap { text-align:center; margin:24px 0 8px; }
    .cta      { display:inline-block; background:#e86c2c; color:#fff !important; text-decoration:none;
                padding:13px 32px; border-radius:6px; font-size:15px; font-weight:700; letter-spacing:.3px; }
    .footer   { background:#f4f6f8; padding:18px 32px; text-align:center; font-size:12px; color:#888; }
    .footer a { color:#888; }
  </style>
</head>
<body>
<div class="wrapper">

  <div class="header">
    <h1>Deal Alert 🏠</h1>
  </div>

  <div class="body">
    <p>Hi <strong>${name}</strong>,</p>
    <p>
      Great news! A newly published property matches your saved search filter.
      Here's a quick summary:
    </p>

    <div class="card">
      <h2>${title}</h2>
      <table class="details">
        <tr><td>📍 Location</td>      <td>${location}</td></tr>
        <tr><td>🏡 Property Type</td> <td>${category}</td></tr>
        <tr><td>🛏 Bedrooms</td>      <td>${bedrooms}</td></tr>
        <tr><td>🚿 Bathrooms</td>     <td>${bathrooms}</td></tr>
        <tr><td>📐 Square Footage</td><td>${sqft}</td></tr>
        <tr><td>🏗 Year Built</td>    <td>${yearBuilt}</td></tr>
        <tr><td>💵 Price</td>  <td>${price}</td></tr>
        <tr><td>💵 Down Payment</td>  <td>${downPayment}</td></tr>
        
      </table>
    </div>

    <div class="cta-wrap">
      <a href="${dealLink}" class="cta">View This Deal →</a>
    </div>

    <p style="font-size:13px;color:#888;margin-top:24px;">
      You're receiving this email because you have a saved deal filter on our platform.
      If you no longer want these alerts, you can update or delete your saved filter
      from your account dashboard.
    </p>
  </div>

  <div class="footer">
    &copy; ${new Date().getFullYear()} Deal Platform. All rights reserved.
  </div>

</div>
</body>
</html>
  `.trim();

  // ── Plain-text fallback ───────────────────────────────────────────────────
  const text = [
    `Hi ${name},`,
    '',
    `A newly published property matches your saved filter: ${title}`,
    '',
    `Location      : ${location}`,
    `Property Type : ${category}`,
    `Bedrooms      : ${bedrooms}`,
    `Bathrooms     : ${bathrooms}`,
    `Square Footage: ${sqft}`,
    `Year Built    : ${yearBuilt}`,
    `Down Payment  : ${downPayment}`,
    `Monthly Pmt   : ${monthlyPmt}`,
    '',
    `View this deal: ${dealLink}`,
    '',
    'You are receiving this because you have a saved deal filter.',
    'Update or delete your filter from your account dashboard to stop these alerts.',
  ].join('\n');

  return { subject, html, text };
}

module.exports = { buildDealMatchEmail };
