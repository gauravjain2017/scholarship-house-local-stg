/**
 * Email Service
 * Handles sending emails via Zoho SMTP for password reset and notifications
 */
const nodemailer = require('nodemailer');

// SMTP Configuration from environment variables
const SMTP_CONFIG = {
  host: process.env.SMTP_HOST || 'smtp.zoho.com',
  port: parseInt(process.env.SMTP_PORT, 10) || 465,
  secure: process.env.SMTP_SECURE !== 'false', // true for 465, false for other ports
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
};

const FROM_NAME = process.env.SMTP_FROM_NAME || 'STR Application';
const FROM_EMAIL = process.env.SMTP_FROM_EMAIL || process.env.SMTP_USER;

// Create reusable transporter
let transporter = null;

/**
 * Initialize the email transporter
 */
const initTransporter = () => {
  if (!SMTP_CONFIG.auth.user || !SMTP_CONFIG.auth.pass) {
    console.warn('⚠️ SMTP credentials not configured. Email sending disabled.');
    return null;
  }

  transporter = nodemailer.createTransport(SMTP_CONFIG);
  return transporter;
};

/**
 * Send an email
 * @param {Object} options - Email options
 * @param {string} options.to - Recipient email
 * @param {string} options.subject - Email subject
 * @param {string} options.text - Plain text body
 * @param {string} options.html - HTML body
 */
const sendEmail = async ({ to, subject, text, html }) => {
  if (!transporter) {
    initTransporter();
  }

  if (!transporter) {
    console.error('❌ Cannot send email: SMTP not configured');
    throw new Error('Email service not configured');
  }

  const mailOptions = {
    from: `"${FROM_NAME}" <${FROM_EMAIL}>`,
    to,
    subject,
    text,
    html,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log('📧 Email sent:', info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('❌ Email send failed:', error.message);
    throw error;
  }
};

/**
 * Send password reset request email
 * @param {string} email - User's email
 * @param {string} resetUrl - Full reset URL with token
 * @param {string} initiatedBy - 'user' or admin's email
 */
const sendPasswordResetEmail = async (
  email,
  resetUrl,
  initiatedBy = 'user',
  userName = null,
  role = null,
  appDeepLink = null
) => {
  const isAdminInitiated = initiatedBy !== 'user';

  const subject = 'Reset Your STR Application Password';

  const text = `
Hello ${userName},

${isAdminInitiated
      ? `An ${role} has requested a password reset for your STR Application account.`
      : `You requested a password reset for your STR Application account.`
    }

Click the link below to reset your password:
${resetUrl}
${appDeepLink ? `\nOn your phone with the app installed, open directly in the app:\n${appDeepLink}\n` : ''}
This link will expire in 1 hour.

If you didn't request this password reset, you can safely ignore this email. Your password will remain unchanged.

For security, this link can only be used once.

Best regards,
STR Application Team
`.trim();

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #1E7AC0 0%, #0AAFE5 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
    <h1 style="color: white; margin: 0; font-size: 24px;">Password Reset Request</h1>
  </div>
  
  <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; border: 1px solid #eee; border-top: none;">
    <p style="margin-top: 0;">Hello ${userName} ,</p>
    
    <p>${isAdminInitiated
      ? `An ${role} has requested a password reset for your STR Application account.`
      : `You requested a password reset for your STR Application account.`
    }</p>
    
    <p>Click the button below to reset your password:</p>
    
    <div style="text-align: center; margin: 30px 0;">
      <a href="${resetUrl}"
         style="background: #1E7AC0; color: white; padding: 14px 30px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">
        Reset Password
      </a>
    </div>
    ${appDeepLink ? `
    <div style="text-align: center; margin: 18px 0;">
      <p style="color: #666; font-size: 13px; margin: 0 0 10px;">
        On your phone with the mobile app installed:
      </p>
      <a href="${appDeepLink}"
         style="background: #fff; color: #1E7AC0; padding: 12px 26px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block; border: 2px solid #1E7AC0;">
        Open in App
      </a>
    </div>` : ''}

    <p style="color: #666; font-size: 14px;">
      <strong>This link will expire in 1 hour.</strong>
    </p>
    
    <p style="color: #666; font-size: 14px;">
      If you didn't request this password reset, you can safely ignore this email. Your password will remain unchanged.
    </p>
    
    <p style="color: #888; font-size: 12px; margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee;">
      If the button doesn't work, copy and paste this link into your browser:<br>
      <a href="${resetUrl}" style="color: #1E7AC0; word-break: break-all;">${resetUrl}</a>
    </p>
  </div>
  
  <div style="text-align: center; padding: 20px; color: #888; font-size: 12px;">
    <p>STR Application Team</p>
  </div>
</body>
</html>
`.trim();

  return sendEmail({ to: email, subject, text, html });
};

/**
 * Send password changed confirmation email
 * @param {string} email - User's email
 */
const sendPasswordChangedEmail = async (email) => {
  const subject = 'Your STR Application Password Was Changed';

  const text = `
Hello,

Your STR Application password was successfully changed.

If you made this change, no further action is required.

If you did NOT make this change, please contact support immediately as your account may have been compromised.

Best regards,
STR Application Team
`.trim();

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #1E7AC0 0%, #0AAFE5 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
    <h1 style="color: white; margin: 0; font-size: 24px;">Password Changed</h1>
  </div>
  
  <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; border: 1px solid #eee; border-top: none;">
    <p style="margin-top: 0;">Hello,</p>
    
    <p>Your STR Application password was successfully changed.</p>
    
    <div style="background: #e8f5e9; border-left: 4px solid #4caf50; padding: 15px; margin: 20px 0;">
      <p style="margin: 0; color: #2e7d32;">
        <strong>If you made this change</strong>, no further action is required.
      </p>
    </div>
    
    <div style="background: #fff3e0; border-left: 4px solid #ff9800; padding: 15px; margin: 20px 0;">
      <p style="margin: 0; color: #e65100;">
        <strong>If you did NOT make this change</strong>, please contact support immediately as your account may have been compromised.
      </p>
    </div>
  </div>
  
  <div style="text-align: center; padding: 20px; color: #888; font-size: 12px;">
    <p>STR Application Team</p>
  </div>
</body>
</html>
`.trim();

  return sendEmail({ to: email, subject, text, html });
};

/**
 * Send temporary password email (admin-set password)
 * @param {string} email - User's email
 * @param {string} tempPassword - Temporary password
 * @param {string} adminEmail - Admin who initiated the reset
 */
const sendTemporaryPasswordEmail = async (email, tempPassword, adminEmail = null, role = 'Administrator') => {
  const subject = 'Your STR Application Password Has Been Reset';

  const text = `
Hello,

An ${role} has reset your STR Application password.

Your temporary password is: ${tempPassword}

Please log in and change your password immediately for security.

Best regards,
STR Application Team
`.trim();

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #1E7AC0 0%, #0AAFE5 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
    <h1 style="color: white; margin: 0; font-size: 24px;">Password Reset by Administrator</h1>
  </div>
  
  <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; border: 1px solid #eee; border-top: none;">
    <p style="margin-top: 0;">Hello,</p>
    
    <p>An ${role} has reset your STR Application password.</p>
    
    <div style="background: #fff; border: 2px dashed #1E7AC0; padding: 20px; margin: 20px 0; text-align: center; border-radius: 8px;">
      <p style="margin: 0 0 10px 0; color: #666; font-size: 14px;">Your temporary password is:</p>
      <p style="margin: 0; font-size: 24px; font-family: monospace; color: #1E7AC0; letter-spacing: 2px;">
        <strong>${tempPassword}</strong>
      </p>
    </div>
    
    <div style="background: #fff3e0; border-left: 4px solid #ff9800; padding: 15px; margin: 20px 0;">
      <p style="margin: 0; color: #e65100;">
        <strong>Important:</strong> Please log in and change your password immediately for security.
      </p>
    </div>
  </div>
  
  <div style="text-align: center; padding: 20px; color: #888; font-size: 12px;">
    <p>STR Application Team</p>
  </div>
</body>
</html>
`.trim();

  return sendEmail({ to: email, subject, text, html });
};

/**
 * Verify SMTP connection
 */
const verifyConnection = async () => {
  if (!transporter) {
    initTransporter();
  }

  if (!transporter) {
    return { success: false, error: 'SMTP not configured' };
  }

  try {
    await transporter.verify();
    console.log('✅ SMTP connection verified');
    return { success: true };
  } catch (error) {
    console.error('❌ SMTP verification failed:', error.message);
    return { success: false, error: error.message };
  }
};

/**
 * Send dispute notification email to original property owner
 * @param {Object} options
 * @param {string} options.toEmail - Recipient email
 * @param {string} options.propertyAddress - Property address
 * @param {string} options.disputeId - Dispute ID for reference
 * @param {string} options.deadline - Deadline for response
 */
const sendDisputeNotificationEmail = async ({
  toEmail,
  propertyAddress,
  disputeId,
  deadline,
}) => {
  const frontendUrl =
    process.env.FRONTEND_URL || 'https://app.scholarshiphouse.com';
  const disputeUrl = `${frontendUrl}/disputes`;
  const deadlineDate = new Date(deadline).toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const subject = 'Action Required: Ownership Dispute for Your Property';

  const text = `
Hello,

Someone has submitted a property that matches an address you previously submitted and is claiming ownership.

Property Address: ${propertyAddress}

This person has claimed ownership of this property. To protect your submission, you must upload proof of ownership (such as a deed, title, or purchase agreement) within 30 days.

Deadline: ${deadlineDate}

To upload your proof of ownership, please visit:
${disputeUrl}

If you do not respond by the deadline, the dispute will be resolved in favor of the other party, and your property submission will be rejected.

If you have any questions, please contact our support team.

Best regards,
STR Application Team
`.trim();

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #dc3545 0%, #ff6b6b 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
    <h1 style="color: white; margin: 0; font-size: 24px;">Action Required: Ownership Dispute</h1>
  </div>
  
  <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; border: 1px solid #eee; border-top: none;">
    <p style="margin-top: 0;">Hello,</p>
    
    <p>Someone has submitted a property that matches an address you previously submitted and is <strong>claiming ownership</strong>.</p>
    
    <div style="background: #fff; border: 1px solid #ddd; padding: 20px; margin: 20px 0; border-radius: 8px;">
      <p style="margin: 0; color: #666; font-size: 14px;">Property Address:</p>
      <p style="margin: 5px 0 0 0; font-size: 18px; color: #072B53;">
        <strong>${propertyAddress}</strong>
      </p>
    </div>
    
    <div style="background: #fff3e0; border-left: 4px solid #ff9800; padding: 15px; margin: 20px 0;">
      <p style="margin: 0; color: #e65100;">
        <strong>To protect your submission</strong>, you must upload proof of ownership (such as a deed, title, or purchase agreement) within 30 days.
      </p>
    </div>
    
    <p><strong>Deadline:</strong> ${deadlineDate}</p>
    
    <div style="text-align: center; margin: 30px 0;">
      <a href="${disputeUrl}" 
         style="background: #1E7AC0; color: white; padding: 14px 30px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">
        Upload Proof of Ownership
      </a>
    </div>
    
    <div style="background: #ffebee; border-left: 4px solid #dc3545; padding: 15px; margin: 20px 0;">
      <p style="margin: 0; color: #c62828;">
        <strong>Warning:</strong> If you do not respond by the deadline, the dispute will be resolved in favor of the other party, and your property submission will be rejected.
      </p>
    </div>
  </div>
  
  <div style="text-align: center; padding: 20px; color: #888; font-size: 12px;">
    <p>STR Application Team</p>
    <p style="font-size: 10px;">Dispute Reference: ${disputeId}</p>
  </div>
</body>
</html>
`.trim();

  return sendEmail({ to: toEmail, subject, text, html });
};

/**
 * Send dispute resolution email
 * @param {Object} options
 * @param {string} options.toEmail - Recipient email
 * @param {string} options.propertyAddress - Property address
 * @param {string} options.resolution - Resolution type
 * @param {boolean} options.isWinner - Whether this recipient won the dispute
 */
const sendDisputeResolvedEmail = async ({
  toEmail,
  propertyAddress,
  resolution,
  isWinner,
}) => {
  const subject = isWinner
    ? 'Good News: Ownership Dispute Resolved in Your Favor'
    : 'Ownership Dispute Resolution Notification';

  const resultMessage = isWinner
    ? 'The ownership dispute has been <strong>resolved in your favor</strong>. Your property will now proceed through our standard review process.'
    : 'After careful review, the ownership dispute has been resolved in favor of the other party. Your property submission has been rejected.';

  const text = `
Hello,

The ownership dispute for the property at ${propertyAddress} has been resolved.

${isWinner
      ? 'Good news! The dispute has been resolved in your favor. Your property will now proceed through our standard review process.'
      : 'After careful review, the dispute has been resolved in favor of the other party. Your property submission has been rejected.'
    }

If you have any questions about this decision, please contact our support team.

Best regards,
STR Application Team
`.trim();

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, ${isWinner ? '#28a745' : '#6c757d'} 0%, ${isWinner ? '#20c997' : '#adb5bd'} 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
    <h1 style="color: white; margin: 0; font-size: 24px;">Ownership Dispute Resolved</h1>
  </div>
  
  <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; border: 1px solid #eee; border-top: none;">
    <p style="margin-top: 0;">Hello,</p>
    
    <p>The ownership dispute for the following property has been resolved:</p>
    
    <div style="background: #fff; border: 1px solid #ddd; padding: 20px; margin: 20px 0; border-radius: 8px;">
      <p style="margin: 0; font-size: 18px; color: #072B53;">
        <strong>${propertyAddress}</strong>
      </p>
    </div>
    
    <div style="background: ${isWinner ? '#e8f5e9' : '#fff3e0'}; border-left: 4px solid ${isWinner ? '#4caf50' : '#ff9800'}; padding: 15px; margin: 20px 0;">
      <p style="margin: 0; color: ${isWinner ? '#2e7d32' : '#e65100'};">
        ${resultMessage}
      </p>
    </div>
    
    <p style="color: #666;">If you have any questions about this decision, please contact our support team.</p>
  </div>
  
  <div style="text-align: center; padding: 20px; color: #888; font-size: 12px;">
    <p>STR Application Team</p>
  </div>
</body>
</html>
`.trim();

  return sendEmail({ to: toEmail, subject, text, html });
};

/**
 * Send dispute reminder email
 * @param {Object} options
 * @param {string} options.toEmail - Recipient email
 * @param {string} options.propertyAddress - Property address
 * @param {string} options.disputeId - Dispute ID
 * @param {string} options.deadline - Deadline date
 * @param {number} options.daysRemaining - Days remaining until deadline
 */
const sendDisputeReminderEmail = async ({
  toEmail,
  propertyAddress,
  disputeId,
  deadline,
  daysRemaining,
}) => {
  const frontendUrl =
    process.env.FRONTEND_URL || 'https://app.scholarshiphouse.com';
  const disputeUrl = `${frontendUrl}/disputes`;
  const deadlineDate = new Date(deadline).toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const subject = `Reminder: ${daysRemaining} Days Left to Respond to Ownership Dispute`;

  const text = `
Hello,

This is a reminder that you have ${daysRemaining} days remaining to upload proof of ownership for the disputed property.

Property Address: ${propertyAddress}
Deadline: ${deadlineDate}

To upload your proof of ownership, please visit:
${disputeUrl}

If you do not respond by the deadline, the dispute will be automatically resolved against you.

Best regards,
STR Application Team
`.trim();

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #ffc107 0%, #ff9800 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
    <h1 style="color: white; margin: 0; font-size: 24px;">Reminder: Action Required</h1>
  </div>
  
  <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; border: 1px solid #eee; border-top: none;">
    <p style="margin-top: 0;">Hello,</p>
    
    <div style="background: #fff3e0; border: 2px solid #ff9800; padding: 20px; margin: 20px 0; border-radius: 8px; text-align: center;">
      <p style="margin: 0; font-size: 36px; color: #e65100; font-weight: bold;">
        ${daysRemaining}
      </p>
      <p style="margin: 5px 0 0 0; color: #e65100;">
        days remaining
      </p>
    </div>
    
    <p>You have <strong>${daysRemaining} days</strong> remaining to upload proof of ownership for the disputed property:</p>
    
    <div style="background: #fff; border: 1px solid #ddd; padding: 20px; margin: 20px 0; border-radius: 8px;">
      <p style="margin: 0; font-size: 18px; color: #072B53;">
        <strong>${propertyAddress}</strong>
      </p>
    </div>
    
    <p><strong>Deadline:</strong> ${deadlineDate}</p>
    
    <div style="text-align: center; margin: 30px 0;">
      <a href="${disputeUrl}" 
         style="background: #1E7AC0; color: white; padding: 14px 30px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">
        Upload Proof Now
      </a>
    </div>
    
    <div style="background: #ffebee; border-left: 4px solid #dc3545; padding: 15px; margin: 20px 0;">
      <p style="margin: 0; color: #c62828;">
        <strong>Warning:</strong> If you do not respond by the deadline, the dispute will be automatically resolved against you.
      </p>
    </div>
  </div>
  
  <div style="text-align: center; padding: 20px; color: #888; font-size: 12px;">
    <p>STR Application Team</p>
    <p style="font-size: 10px;">Dispute Reference: ${disputeId}</p>
  </div>
</body>
</html>
`.trim();

  return sendEmail({ to: toEmail, subject, text, html });
};

/**
 * Send registration approved email to user
 * @param {string} email - User's email
 * @param {string} firstName - User's first name
 */
const sendRegistrationApprovedEmail = async (email, firstName) => {
  const frontendUrl =
    process.env.FRONTEND_URL || 'https://app.scholarshiphouse.com';
  const loginUrl = `${frontendUrl}/auth/login`;

  const subject =
    'Welcome! Your STR Application Registration Has Been Approved';

  const text = `
Hello ${firstName || 'there'},

Great news! Your registration for the STR Application has been approved.

You can now log in to your account and start exploring properties:
${loginUrl}

If you have any questions, please don't hesitate to reach out to our support team.

Welcome aboard!

Best regards,
STR Application Team
`.trim();

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #28a745 0%, #20c997 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
    <h1 style="color: white; margin: 0; font-size: 24px;">Registration Approved!</h1>
  </div>
  
  <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; border: 1px solid #eee; border-top: none;">
    <p style="margin-top: 0;">Hello ${firstName || 'there'},</p>
    
    <div style="background: #e8f5e9; border-left: 4px solid #4caf50; padding: 15px; margin: 20px 0;">
      <p style="margin: 0; color: #2e7d32;">
        <strong>Great news!</strong> Your registration for the STR Application has been approved.
      </p>
    </div>
    
    <p>You can now log in to your account and start exploring properties.</p>
    
    <div style="text-align: center; margin: 30px 0;">
      <a href="${loginUrl}" 
         style="background: #1E7AC0; color: white; padding: 14px 30px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">
        Log In Now
      </a>
    </div>
    
    <p style="color: #666;">If you have any questions, please don't hesitate to reach out to our support team.</p>
    
    <p style="margin-bottom: 0;">Welcome aboard!</p>
  </div>
  
  <div style="text-align: center; padding: 20px; color: #888; font-size: 12px;">
    <p>STR Application Team</p>
  </div>
</body>
</html>
`.trim();

  return sendEmail({ to: email, subject, text, html });
};

/**
 * Send "deal expired today" email to admin or submitter
 * @param {Object} options
 * @param {string} options.toEmail   - Recipient email
 * @param {'admin'|'submitter'} options.recipientRole
 * @param {Object} options.deal      - The expired deal object
 */
const sendDealExpiredEmail = async ({ toEmail, recipientRole, deal }) => {
  const fmt = (v) => (v != null && v !== '' ? v : '—');
  const fmtMoney = (v) =>
    v != null && v !== '' && !Number.isNaN(Number(v))
      ? `$${Number(v).toLocaleString('en-US')}`
      : '—';
  const fmtSqft = (v) =>
    v != null && v !== '' && !Number.isNaN(Number(v))
      ? `${Number(v).toLocaleString('en-US')} sq ft`
      : '—';
  const fmtDate = (v) => {
    if (!v) return '—';
    const d = new Date(v);
    if (Number.isNaN(d.getTime())) return String(v);
    return d.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const isAdmin = recipientRole === 'admin';

  const title = fmt(deal.title);
  const streetAddress = fmt(deal.streetAddress);
  const city = fmt(deal.city);
  const stateRegion = fmt(deal.stateRegion);
  const postalCode = fmt(deal.postalCode);
  const fullAddress = `${streetAddress}, ${city}, ${stateRegion} ${postalCode}`;
  const category = fmt(deal.category);
  const bedrooms = fmt(deal.bedrooms);
  const bathrooms = fmt(deal.bathrooms);
  const squareFootage = fmtSqft(deal.squareFootage);
  const yearBuilt = fmt(deal.yearBuilt);
  const price = fmtMoney(deal.price);
  const downPayment = fmtMoney(deal.downPayment);
  const monthlyPmt = fmtMoney(deal.totalMonthlyPayment);
  const submitterName = fmt(deal.submitterName);
  const submitterEmail = fmt(deal.submitterEmail);
  const submitterPhone = fmt(deal.submitterPhone);
  const submitterUserType = fmt(deal.submitterUserType);
  const submittedAt = fmtDate(deal.submittedAt);
  const expiryDate = fmt(deal.expiry_date);
  const dealId = fmt(deal.id);
  const todayLabel = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const subject = isAdmin
    ? `Property Expired Today: ${title}`
    : `Your Property Listing Has Expired: ${title}`;

  const greeting = isAdmin
    ? 'Hello Admin,'
    : `Hello ${deal.submitterName || 'there'},`;

  const introMessage = isAdmin
    ? `A property listing has been automatically marked as expired today (${todayLabel}).`
    : `Your property listing has expired today (${todayLabel}) and has been automatically marked as expired on our platform.`;

  const closingMessage = isAdmin
    ? 'The submitter has also been notified.'
    : "If you'd like to relist this property or have questions, please contact our team or resubmit through the platform.";

  const submitterCardHtml = isAdmin
    ? `
    <div class="card">
      <h2>Submitter</h2>
      <table class="details">
        <tr><td>Name</td>      <td>${submitterName}</td></tr>
        <tr><td>Email</td>     <td>${submitterEmail}</td></tr>
        <tr><td>Phone</td>     <td>${submitterPhone}</td></tr>
        <tr><td>User Type</td> <td>${submitterUserType}</td></tr>
      </table>
    </div>`
    : '';

  const dealIdRowHtml = isAdmin
    ? `<tr><td>Deal ID</td>      <td>${dealId}</td></tr>`
    : '';

  const text = [
    greeting,
    '',
    introMessage,
    '',
    'PROPERTY DETAILS',
    `  Title            : ${title}`,
    `  Address          : ${fullAddress}`,
    `  Property Type    : ${category}`,
    `  Bedrooms         : ${bedrooms}`,
    `  Bathrooms        : ${bathrooms}`,
    `  Square Footage   : ${squareFootage}`,
    `  Year Built       : ${yearBuilt}`,
    `  Asking Price     : ${price}`,
    `  Down Payment     : ${downPayment}`,
    `  Monthly Payment  : ${monthlyPmt}`,
    '',
    ...(isAdmin
      ? [
        'SUBMITTER',
        `  Name       : ${submitterName}`,
        `  Email      : ${submitterEmail}`,
        `  Phone      : ${submitterPhone}`,
        `  User Type  : ${submitterUserType}`,
        '',
      ]
      : []),
    'LISTING TIMELINE',
    `  Submitted On : ${submittedAt}`,
    `  Expiry Date  : ${expiryDate}`,
    ...(isAdmin ? [`  Deal ID      : ${dealId}`] : []),
    '',
    closingMessage,
    '',
    'Best regards,',
    'STR Application Team',
  ].join('\n');

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
    .header  { background: linear-gradient(135deg, #dc3545 0%, #ff6b6b 100%); padding:28px 32px; text-align:center; }
    .header h1 { margin:0; color:#fff; font-size:22px; }
    .body    { padding:28px 32px; }
    .body p  { font-size:15px; line-height:1.6; margin:0 0 16px; }
    .alert   { background:#fff3e0; border-left:4px solid #ff9800; padding:14px 18px; margin:18px 0; color:#e65100; font-size:14px; }
    .card    { background:#f9fafb; border:1px solid #e2e8f0; border-radius:6px; padding:20px 24px; margin:20px 0; }
    .card h2 { margin:0 0 14px; font-size:17px; color:#1a3c5e; }
    table.details { width:100%; border-collapse:collapse; font-size:14px; }
    table.details td { padding:6px 0; vertical-align:top; }
    table.details td:first-child { color:#666; width:42%; }
    table.details td:last-child  { font-weight:600; color:#222; }
    .footer  { background:#f4f6f8; padding:18px 32px; text-align:center; font-size:12px; color:#888; }
  </style>
</head>
<body>
<div class="wrapper">
  <div class="header">
    <h1>Property Expired</h1>
  </div>

  <div class="body">
    <p>${greeting}</p>
    <div class="alert">${introMessage}</div>

    <div class="card">
      <h2>${title}</h2>
      <table class="details">
        <tr><td>Address</td>         <td>${fullAddress}</td></tr>
        <tr><td>Property Type</td>   <td>${category}</td></tr>
        <tr><td>Bedrooms</td>        <td>${bedrooms}</td></tr>
        <tr><td>Bathrooms</td>       <td>${bathrooms}</td></tr>
        <tr><td>Square Footage</td>  <td>${squareFootage}</td></tr>
        <tr><td>Year Built</td>      <td>${yearBuilt}</td></tr>
        <tr><td>Asking Price</td>    <td>${price}</td></tr>
        <tr><td>Down Payment</td>    <td>${downPayment}</td></tr>
        <tr><td>Monthly Payment</td> <td>${monthlyPmt}</td></tr>
      </table>
    </div>

    ${submitterCardHtml}

    <div class="card">
      <h2>Listing Timeline</h2>
      <table class="details">
        <tr><td>Submitted On</td> <td>${submittedAt}</td></tr>
        <tr><td>Expiry Date</td>  <td>${expiryDate}</td></tr>
        ${dealIdRowHtml}
      </table>
    </div>

    <p style="color:#666;font-size:14px;">${closingMessage}</p>
  </div>

  <div class="footer">
    &copy; ${new Date().getFullYear()} STR Application Team
  </div>
</div>
</body>
</html>
  `.trim();

  return sendEmail({ to: toEmail, subject, text, html });
};

/**
 * Send registration approval notification to the assigned specialist
 * @param {Object} options
 * @param {string} options.specialistEmail - Specialist's email (recipient)
 * @param {string} options.clientEmail - Client's email
 * @param {string} options.clientFirstName - Client's first name
 * @param {string} options.clientLastName - Client's last name
 * @param {string} options.clientPhone - Client's phone number
 */
const sendClientApprovedToSpecialistEmail = async ({
  specialistEmail,
  clientEmail,
  clientFirstName,
  clientLastName,
  clientPhone,
}) => {
  const subject = 'Your Client Registration Has Been Approved';

  const fullName = `${clientFirstName} ${clientLastName}`.trim();

  const text = `
Hello,

A client assigned to you has been approved and can now access the platform.

Client Details:
  Name  : ${fullName}
  Email : ${clientEmail}
  Phone : ${clientPhone || '—'}

Best regards,
STR Application Team
`.trim();

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #28a745 0%, #20c997 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
    <h1 style="color: white; margin: 0; font-size: 24px;">Client Approved</h1>
  </div>

  <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; border: 1px solid #eee; border-top: none;">
    <p style="margin-top: 0;">Hello,</p>

    <div style="background: #e8f5e9; border-left: 4px solid #4caf50; padding: 15px; margin: 20px 0;">
      <p style="margin: 0; color: #2e7d32;">
        <strong>Good news!</strong> A client assigned to you has been approved and can now access the platform.
      </p>
    </div>

    <div style="background: #fff; border: 1px solid #ddd; padding: 20px; margin: 20px 0; border-radius: 8px;">
      <table style="width: 100%; border-collapse: collapse; font-size: 15px;">
        <tr>
          <td style="padding: 8px 0; color: #666; width: 35%;">Name</td>
          <td style="padding: 8px 0; font-weight: 600; color: #222;">${fullName}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #666;">Email</td>
          <td style="padding: 8px 0; font-weight: 600; color: #1E7AC0;">
            <a href="mailto:${clientEmail}" style="color: #1E7AC0; text-decoration: none;">${clientEmail}</a>
          </td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #666;">Phone</td>
          <td style="padding: 8px 0; font-weight: 600; color: #222;">${clientPhone || '—'}</td>
        </tr>
      </table>
    </div>
  </div>

  <div style="text-align: center; padding: 20px; color: #888; font-size: 12px;">
    <p>STR Application Team</p>
  </div>
</body>
</html>
`.trim();

  return sendEmail({ to: specialistEmail, subject, text, html });
};

/**
 * Send new client registration notification to the assigned specialist
 * @param {Object} options
 * @param {string} options.specialistEmail - Specialist's email (recipient)
 * @param {string} options.clientEmail - Client's email
 * @param {string} options.clientFirstName - Client's first name
 * @param {string} options.clientLastName - Client's last name
 * @param {string} options.clientPhone - Client's phone number
 */
const sendNewClientRegistrationEmail = async ({
  specialistEmail,
  clientEmail,
  clientFirstName,
  clientLastName,
  clientPhone,
}) => {
  const subject = 'New Client Registration — Action Required';

  const fullName = `${clientFirstName} ${clientLastName}`.trim();

  const text = `
Hello,

A new client has registered and selected you as their specialist.

Client Details:
  Name  : ${fullName}
  Email : ${clientEmail}
  Phone : ${clientPhone || '—'}

Please log in to review and approve or reject the registration request.

Best regards,
STR Application Team
`.trim();

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #1E7AC0 0%, #0AAFE5 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
    <h1 style="color: white; margin: 0; font-size: 24px;">New Client Registration</h1>
  </div>

  <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; border: 1px solid #eee; border-top: none;">
    <p style="margin-top: 0;">Hello,</p>

    <p>A new client has registered and selected you as their specialist. Here are their details:</p>

    <div style="background: #fff; border: 1px solid #ddd; padding: 20px; margin: 20px 0; border-radius: 8px;">
      <table style="width: 100%; border-collapse: collapse; font-size: 15px;">
        <tr>
          <td style="padding: 8px 0; color: #666; width: 35%;">Name</td>
          <td style="padding: 8px 0; font-weight: 600; color: #222;">${fullName}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #666;">Email</td>
          <td style="padding: 8px 0; font-weight: 600; color: #1E7AC0;">
            <a href="mailto:${clientEmail}" style="color: #1E7AC0; text-decoration: none;">${clientEmail}</a>
          </td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #666;">Phone</td>
          <td style="padding: 8px 0; font-weight: 600; color: #222;">${clientPhone || '—'}</td>
        </tr>
      </table>
    </div>

    <div style="background: #e8f4fd; border-left: 4px solid #1E7AC0; padding: 15px; margin: 20px 0;">
      <p style="margin: 0; color: #0c5a8a;">
        Please log in to review and approve or reject this registration request.
      </p>
    </div>
  </div>

  <div style="text-align: center; padding: 20px; color: #888; font-size: 12px;">
    <p>STR Application Team</p>
  </div>
</body>
</html>
`.trim();

  return sendEmail({ to: specialistEmail, subject, text, html });
};

module.exports = {
  sendEmail,
  sendPasswordResetEmail,
  sendPasswordChangedEmail,
  sendTemporaryPasswordEmail,
  verifyConnection,
  initTransporter,
  sendDisputeNotificationEmail,
  sendDisputeResolvedEmail,
  sendDisputeReminderEmail,
  sendRegistrationApprovedEmail,
  sendDealExpiredEmail,
  sendNewClientRegistrationEmail,
  sendClientApprovedToSpecialistEmail,
};
