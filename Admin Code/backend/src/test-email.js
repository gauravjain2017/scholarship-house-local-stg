/**
 * Standalone Email Test Script
 * Tests the Zoho SMTP email sending functionality without requiring full backend to start
 *
 * Usage: node src/test-email.js [recipient-email]
 * Example: node src/test-email.js test@example.com
 */

require('dotenv').config();
const nodemailer = require('nodemailer');

// Get recipient from command line args or use default
const recipientEmail = process.argv[2] || process.env.SMTP_USER;

console.log('\n=== Email Service Test ===\n');
console.log('Configuration:');
console.log(`  SMTP Host: ${process.env.SMTP_HOST || 'smtp.zoho.com'}`);
console.log(`  SMTP Port: ${process.env.SMTP_PORT || 465}`);
console.log(`  SMTP Secure: ${process.env.SMTP_SECURE !== 'false'}`);
console.log(`  SMTP User: ${process.env.SMTP_USER ? '✓ Set' : '✗ NOT SET'}`);
console.log(`  SMTP Pass: ${process.env.SMTP_PASS ? '✓ Set' : '✗ NOT SET'}`);
console.log(`  From Name: ${process.env.SMTP_FROM_NAME || 'STR Application'}`);
console.log(
  `  From Email: ${process.env.SMTP_FROM_EMAIL || process.env.SMTP_USER}`
);
console.log(`\n  Recipient: ${recipientEmail}\n`);

if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
  console.error('❌ Error: SMTP_USER and SMTP_PASS must be set in .env file');
  process.exit(1);
}

// Create transporter
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.zoho.com',
  port: parseInt(process.env.SMTP_PORT, 10) || 465,
  secure: process.env.SMTP_SECURE !== 'false',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

// Generate a fake reset token for testing
const fakeToken = require('crypto').randomBytes(32).toString('hex');
const resetUrl = `http://localhost:5173/auth/reset-password/${fakeToken}`;

// Test email HTML (same as production)
const testHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #1E7AC0 0%, #0AAFE5 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
    <h1 style="color: white; margin: 0; font-size: 24px;">🧪 TEST: Password Reset Request</h1>
  </div>
  
  <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; border: 1px solid #eee; border-top: none;">
    <p style="margin-top: 0;">Hello,</p>
    
    <p><strong>This is a TEST email</strong> to verify the Zoho SMTP configuration is working correctly.</p>
    
    <p>If this were a real password reset, you would click the button below:</p>
    
    <div style="text-align: center; margin: 30px 0;">
      <a href="${resetUrl}" 
         style="background: #1E7AC0; color: white; padding: 14px 30px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">
        Reset Password
      </a>
    </div>
    
    <p style="color: #666; font-size: 14px;">
      <strong>Test Token:</strong> ${fakeToken.substring(0, 20)}...
    </p>
    
    <div style="background: #e8f5e9; border-left: 4px solid #4caf50; padding: 15px; margin: 20px 0;">
      <p style="margin: 0; color: #2e7d32;">
        <strong>✅ Email sending is working!</strong> Your Zoho SMTP configuration is correct.
      </p>
    </div>
  </div>
  
  <div style="text-align: center; padding: 20px; color: #888; font-size: 12px;">
    <p>STR Application Team - Test Email</p>
    <p>Sent at: ${new Date().toISOString()}</p>
  </div>
</body>
</html>
`.trim();

async function runTests() {
  try {
    // Step 1: Verify SMTP connection
    console.log('Step 1: Verifying SMTP connection...');
    await transporter.verify();
    console.log('✅ SMTP connection verified!\n');

    // Step 2: Send test email
    console.log('Step 2: Sending test email...');
    const info = await transporter.sendMail({
      from: `"${process.env.SMTP_FROM_NAME || 'STR Application'}" <${process.env.SMTP_FROM_EMAIL || process.env.SMTP_USER}>`,
      to: recipientEmail,
      subject: '[TEST] STR Application Password Reset Email',
      text: `This is a test email to verify the SMTP configuration.\n\nTest reset link: ${resetUrl}\n\nIf you received this, the email service is working correctly!`,
      html: testHtml,
    });

    console.log('✅ Test email sent successfully!');
    console.log(`   Message ID: ${info.messageId}`);
    console.log(`   Recipient: ${recipientEmail}\n`);

    console.log('=== Test Complete ===\n');
    console.log(
      '✅ All tests passed! The email service is configured correctly.'
    );
    console.log(`\nCheck the inbox of ${recipientEmail} for the test email.\n`);
  } catch (error) {
    console.error('❌ Test failed:', error.message);

    if (error.code === 'EAUTH') {
      console.error('\nAuthentication failed. Please check:');
      console.error('  1. SMTP_USER is correct');
      console.error('  2. SMTP_PASS is the correct app password');
      console.error(
        '  3. If using Zoho, ensure you have created an app-specific password'
      );
    } else if (error.code === 'ESOCKET') {
      console.error('\nConnection failed. Please check:');
      console.error('  1. SMTP_HOST is correct (smtp.zoho.com for Zoho)');
      console.error('  2. SMTP_PORT is correct (465 for SSL, 587 for TLS)');
      console.error('  3. Your network allows outgoing SMTP connections');
    }

    process.exit(1);
  }
}

runTests();
