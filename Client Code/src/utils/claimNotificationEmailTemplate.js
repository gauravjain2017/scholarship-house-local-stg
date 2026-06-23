/**
 * claimNotificationEmailTemplate.js
 * Generates the HTML (and plain-text) body for the "Property Claimed"
 * internal notification sent to Scholarship House team members when a
 * user clicks "I want this Scholarship House" and confirms the MOU/wire
 * pop-up.
 */

/**
 * @param {Object} params
 * @param {Object} params.deal             - The claimed property (post-update)
 * @param {Object} params.claimedBy        - Info about the user who claimed it (sourced from the SUBMITTERS table)
 * @param {string} params.claimedBy.email
 * @param {string} [params.claimedBy.name]
 * @param {string} [params.claimedBy.phone]
 * @param {string} [params.claimedBy.userType]
 * @param {string} [params.claimedBy.company]
 * @param {string} [params.claimedBy.address]
 * @param {string} [params.claimedBy.city]
 * @param {string} [params.claimedBy.state]
 * @param {string} [params.claimedBy.zip]
 * @param {string} [params.claimedBy.country]
 * @param {string} [params.claimedBy.createdAt]
 * @param {string} params.dealLink         - Full URL to the deal detail page
 * @param {string} params.claimedAt        - ISO timestamp of the claim
 * @returns {{ subject: string, html: string, text: string }}
 */
function buildClaimNotificationEmail({
  deal,
  claimedBy,
  dealLink,
  claimedAt,
}) {
  const fmt = (v) => (v != null && v !== '' ? v : '—');
  const fmtMoney = (v) =>
    v != null && v !== '' && !Number.isNaN(Number(v))
      ? `$${Number(v).toLocaleString('en-US')}`
      : '—';
  const fmtDateTime = (v) => {
    if (!v) return '—';
    const d = new Date(v);
    if (Number.isNaN(d.getTime())) return String(v);
    return d.toLocaleString('en-US', {
      weekday: 'short',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      timeZoneName: 'short',
    });
  };

  // ── 48-hour wire deadline ─────────────────────────────────────────────────
  const wireDeadline = claimedAt
    ? new Date(new Date(claimedAt).getTime() + 48 * 60 * 60 * 1000).toISOString()
    : null;

  const title = fmt(deal.title);
  const streetAddress = fmt(deal.streetAddress);
  const city = fmt(deal.city);
  const stateRegion = fmt(deal.stateRegion);
  const postalCode = fmt(deal.postalCode);
  const fullAddress = `${streetAddress}, ${city}, ${stateRegion} ${postalCode}`;
  const price = fmtMoney(deal.price);

  // Display ID: combine the leading street number with the postal code
  // (e.g. "5128-37202") instead of showing the raw UUID. Falls back to
  // whichever piece is available, or '—' if neither is.
  const shortDealId = (() => {
    const streetNum = deal.streetAddress?.trim().split(' ')[0].replace(/\D/g, '') || '';
    const postal = deal.postalCode?.trim() || '';
    if (!streetNum && !postal) return '—';
    if (!streetNum) return postal;
    if (!postal) return streetNum;
    return `${streetNum}-${postal}`;
  })();
  const dealId = shortDealId;

  const claimerName = fmt(claimedBy?.name);
  const claimerEmail = fmt(claimedBy?.email);
  const claimerPhone = fmt(claimedBy?.phone);
  const claimerType = fmt(claimedBy?.userType);
  const claimerCompany = fmt(claimedBy?.company);
 const addrObj =
    claimedBy?.address && typeof claimedBy.address === 'object'
      ? claimedBy.address
      : null;

  const street = addrObj ? addrObj.street : claimedBy?.address;
  const addrCity = addrObj?.city ?? claimedBy?.city;
  const addrState = addrObj?.state ?? claimedBy?.state;
  const addrZip = addrObj?.zip ?? claimedBy?.zip;
  const addrCountry = addrObj?.country ?? claimedBy?.country;

  const claimerAddressLine = [
    street,
    addrCity,
    [addrState, addrZip].filter(Boolean).join(' ').trim() || null,
    addrCountry,
  ]
    .filter((part) => part != null && part !== '')
    .join(', ');
  const claimerAddress = claimerAddressLine || '—';

  const claimerSince = fmt(claimedBy?.createdAt && fmtDateTime(claimedBy.createdAt));

  // Rows are ordered for the "Claimed By" card. Each row is rendered only if
  // the underlying value is meaningful (i.e. not '—'). This keeps the email
  // clean when some fields are missing in the SUBMITTERS table.
  const claimerRows = [
    { label: 'Name', value: claimerName },
    { label: 'Email', value: claimerEmail },
    { label: 'Phone', value: claimerPhone },
    { label: 'Company', value: claimerCompany },
    { label: 'Address', value: claimerAddress },
    { label: 'Submitter Since', value: claimerSince },
    { label: 'Claimed At', value: fmtDateTime(claimedAt) },
  ].filter((row) => row.value && row.value !== '—');

  const claimerRowsHtml = claimerRows
    .map(
      (row) =>
        `<tr><td>${row.label}</td><td>${row.value}</td></tr>`
    )
    .join('\n        ');

  const claimerRowsText = claimerRows
    .map((row) => `  ${row.label.padEnd(17)}: ${row.value}`)
    .join('\n');

  const subject = `🏠 Property Claimed: ${title} — $5k wire required within 48 hrs`;

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>${subject}</title>
  <style>
    body { margin:0; padding:0; background:#f4f6f8; font-family:Arial,Helvetica,sans-serif; color:#333; }
    .wrapper { max-width:640px; margin:32px auto; background:#fff; border-radius:8px; overflow:hidden; box-shadow:0 2px 8px rgba(0,0,0,.1); }
    .header  { background: linear-gradient(135deg, #0369a1 0%, #0284c7 100%); padding:28px 32px; text-align:center; }
    .header h1 { margin:0; color:#fff; font-size:22px; }
    .body    { padding:28px 32px; }
    .body p  { font-size:15px; line-height:1.6; margin:0 0 16px; }
    .alert   { background:#fff3e0; border-left:4px solid #ff9800; padding:14px 18px; margin:18px 0; color:#e65100; font-size:14px; }
    .alert strong { color:#bf360c; }
    .card    { background:#f9fafb; border:1px solid #e2e8f0; border-radius:6px; padding:20px 24px; margin:20px 0; }
    .card h2 { margin:0 0 14px; font-size:17px; color:#1a3c5e; }
    table.details { width:100%; border-collapse:collapse; font-size:14px; }
    table.details td { padding:6px 0; vertical-align:top; }
    table.details td:first-child { color:#666; width:42%; }
    table.details td:last-child  { font-weight:600; color:#222; }
    .cta-wrap { text-align:center; margin:24px 0 8px; }
    .cta      { display:inline-block; background:#0284c7; color:#fff !important; text-decoration:none;
                padding:13px 32px; border-radius:6px; font-size:15px; font-weight:700; letter-spacing:.3px; }
    .footer  { background:#f4f6f8; padding:18px 32px; text-align:center; font-size:12px; color:#888; }
  </style>
</head>
<body>
<div class="wrapper">
  <div class="header">
    <h1>🏠 Property Claimed</h1>
  </div>

  <div class="body">
    <p>Hello Team,</p>
    <div class="alert">
      <strong>${claimerName} has claimed this property.</strong> It has been marked <strong>Pending</strong>
      and is on hold awaiting a signed MOU and a $5,000 wire within
      <strong>48 hours</strong> (by ${fmtDateTime(wireDeadline)}).
    </div>

    <div class="card">
      <h2>${title}</h2>
      <table class="details">
        <tr><td>Address</td>      <td>${fullAddress}</td></tr>
        <tr><td>Asking Price</td> <td>${price}</td></tr>
        <tr><td>Property ID:</td>      <td>${dealId}</td></tr>
      </table>
    </div>

    <div class="card">
      <h2>Claimed By</h2>
      <table class="details">
        ${claimerRowsHtml}
      </table>
    </div>

    <div class="cta-wrap">
      <a href="${dealLink}" class="cta">View Property →</a>
    </div>

    <p style="color:#666;font-size:13px;margin-top:24px;">
      Please follow up with the claimer to send over the MOU and confirm the $5,000 wire.
      If the wire is not received within 48 hours, the property should be re-published.
    </p>
  </div>

  <div class="footer">
    &copy; ${new Date().getFullYear()} Scholarship House &middot; Internal Notification
  </div>
</div>
</body>
</html>
  `.trim();

  const text = [
    'A property has been claimed on Scholarship House.',
    '',
    'STATUS: Pending — awaiting signed MOU and $5,000 wire within 48 hours',
    `Wire deadline: ${fmtDateTime(wireDeadline)}`,
    '',
    'PROPERTY',
    `  Title        : ${title}`,
    `  Address      : ${fullAddress}`,
    `  Asking Price : ${price}`,
    `  Deal ID      : ${dealId}`,
    '',
    'CLAIMED BY',
    claimerRowsText,
    '',
    `View property: ${dealLink}`,
    '',
    'Please follow up to send the MOU and confirm the wire.',
  ].join('\n');

  return { subject, html, text };
}

module.exports = { buildClaimNotificationEmail };
