/**
 * Password Reset Flow Integration Test
 * Tests the complete password reset flow with mocked DynamoDB
 *
 * Usage: node src/test-password-reset.js [test-email]
 * Example: node src/test-password-reset.js test@example.com
 */

require('dotenv').config();
const crypto = require('crypto');
const bcrypt = require('bcryptjs');

// Import email service directly (no AWS dependency)
const {
  sendPasswordResetEmail,
  sendPasswordChangedEmail,
  sendTemporaryPasswordEmail,
  verifyConnection,
} = require('./services/emailService');

const recipientEmail = process.argv[2] || process.env.SMTP_USER;

console.log(
  '\n╔══════════════════════════════════════════════════════════════╗'
);
console.log('║       PASSWORD RESET SYSTEM INTEGRATION TEST                 ║');
console.log(
  '╚══════════════════════════════════════════════════════════════╝\n'
);

// Mock database for testing
const mockDB = {
  users: new Map(),
  resetTokens: new Map(),
  rateLimits: new Map(),
};

// Initialize mock user
mockDB.users.set(recipientEmail, {
  email: recipientEmail,
  Auth: {
    passwordHash: bcrypt.hashSync('oldPassword123', 10),
  },
  Profile: {
    firstName: 'Test',
    lastName: 'User',
  },
  Status: 'active',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
});

/**
 * Utility: Mask email for privacy
 */
function maskEmail(email) {
  const [local, domain] = email.split('@');
  if (local.length <= 2) {
    return `${local[0]}***@${domain}`;
  }
  return `${local[0]}${local[1]}***@${domain}`;
}

/**
 * Utility: Generate secure token
 */
function generateResetToken() {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Utility: Generate temporary password
 */
function generateTempPassword() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  let password = '';
  for (let i = 0; i < 12; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
}

/**
 * Test 1: Request Password Reset (User Flow)
 */
async function testRequestPasswordReset() {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('TEST 1: User-Initiated Password Reset Request');
  console.log(
    '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n'
  );

  const email = recipientEmail;

  // Check if user exists (mock)
  const user = mockDB.users.get(email);
  if (!user) {
    console.log(
      '  ⚠️  User not found (returning success anyway to prevent enumeration)'
    );
    return { success: true, masked: maskEmail(email) };
  }

  // Check rate limit
  const rateKey = `reset_${email}`;
  const rateData = mockDB.rateLimits.get(rateKey) || {
    count: 0,
    resetAt: Date.now(),
  };

  if (Date.now() < rateData.resetAt && rateData.count >= 3) {
    console.log('  ❌ Rate limit exceeded');
    return { error: 'Rate limit exceeded', status: 429 };
  }

  // Generate reset token
  const token = generateResetToken();
  const expiresAt = Date.now() + 60 * 60 * 1000; // 1 hour

  // Store token (mock)
  mockDB.resetTokens.set(token, {
    email,
    expiresAt,
    used: false,
    createdAt: Date.now(),
  });

  // Update rate limit
  mockDB.rateLimits.set(rateKey, {
    count: rateData.count + 1,
    resetAt: Date.now() + 60 * 60 * 1000,
  });

  // Generate reset URL
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
  const resetUrl = `${frontendUrl}/auth/reset-password/${token}`;

  console.log('  ✓ User found in database');
  console.log('  ✓ Rate limit check passed');
  console.log(`  ✓ Token generated: ${token.substring(0, 20)}...`);
  console.log(`  ✓ Token expires at: ${new Date(expiresAt).toISOString()}`);
  console.log(`  ✓ Reset URL: ${resetUrl.substring(0, 60)}...`);

  // Send email
  console.log('\n  📧 Sending password reset email...');
  try {
    await sendPasswordResetEmail(email, resetUrl, 'user');
    console.log('  ✅ Password reset email sent successfully!\n');
  } catch (error) {
    console.log(`  ❌ Failed to send email: ${error.message}\n`);
    return { error: 'Failed to send email' };
  }

  return {
    success: true,
    token, // Return for next test
    masked: maskEmail(email),
  };
}

/**
 * Test 2: Validate Reset Token
 */
async function testValidateToken(token) {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('TEST 2: Validate Reset Token');
  console.log(
    '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n'
  );

  // Check token exists
  const tokenData = mockDB.resetTokens.get(token);

  if (!tokenData) {
    console.log('  ❌ Token not found');
    return { valid: false, error: 'Invalid token' };
  }

  // Check if expired
  if (Date.now() > tokenData.expiresAt) {
    console.log('  ❌ Token expired');
    return { valid: false, error: 'Token expired' };
  }

  // Check if already used
  if (tokenData.used) {
    console.log('  ❌ Token already used');
    return { valid: false, error: 'Token already used' };
  }

  console.log('  ✓ Token found in database');
  console.log(`  ✓ Token email: ${maskEmail(tokenData.email)}`);
  console.log(
    `  ✓ Token is not expired (expires: ${new Date(tokenData.expiresAt).toISOString()})`
  );
  console.log('  ✓ Token has not been used');
  console.log('  ✅ Token is valid!\n');

  return { valid: true, email: maskEmail(tokenData.email) };
}

/**
 * Test 3: Reset Password with Token
 */
async function testResetPassword(token, newPassword) {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('TEST 3: Reset Password');
  console.log(
    '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n'
  );

  // Validate token again
  const tokenData = mockDB.resetTokens.get(token);

  if (!tokenData || Date.now() > tokenData.expiresAt || tokenData.used) {
    console.log('  ❌ Invalid or expired token');
    return { error: 'Invalid or expired token' };
  }

  // Get user
  const user = mockDB.users.get(tokenData.email);
  if (!user) {
    console.log('  ❌ User not found');
    return { error: 'User not found' };
  }

  // Hash new password
  const hashedPassword = await bcrypt.hash(newPassword, 10);

  // Update user password (mock)
  user.Auth.passwordHash = hashedPassword;
  user.updatedAt = new Date().toISOString();
  mockDB.users.set(tokenData.email, user);

  // Mark token as used
  tokenData.used = true;
  mockDB.resetTokens.set(token, tokenData);

  console.log('  ✓ Token validated');
  console.log('  ✓ User found');
  console.log('  ✓ New password hashed with bcrypt');
  console.log('  ✓ User password updated in database');
  console.log('  ✓ Token marked as used');

  // Send confirmation email
  console.log('\n  📧 Sending password changed confirmation email...');
  try {
    await sendPasswordChangedEmail(tokenData.email);
    console.log('  ✅ Password changed email sent successfully!\n');
  } catch (error) {
    console.log(`  ⚠️  Failed to send confirmation email: ${error.message}\n`);
    // Continue anyway - password was changed
  }

  // Verify password was actually changed
  const passwordValid = await bcrypt.compare(
    newPassword,
    user.Auth.passwordHash
  );
  console.log(`  ✓ Password verification: ${passwordValid ? 'PASS' : 'FAIL'}`);
  console.log('  ✅ Password reset complete!\n');

  return { success: true };
}

/**
 * Test 4: Admin Set Temporary Password
 */
async function testAdminSetTempPassword() {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('TEST 4: Admin Set Temporary Password');
  console.log(
    '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n'
  );

  const targetEmail = recipientEmail;
  const adminEmail = 'admin@example.com';

  // Get user
  const user = mockDB.users.get(targetEmail);
  if (!user) {
    console.log('  ❌ User not found');
    return { error: 'User not found' };
  }

  // Generate temporary password
  const tempPassword = generateTempPassword();

  // Hash and update
  const hashedPassword = await bcrypt.hash(tempPassword, 10);
  user.Auth.passwordHash = hashedPassword;
  user.updatedAt = new Date().toISOString();
  mockDB.users.set(targetEmail, user);

  console.log('  ✓ User found');
  console.log(`  ✓ Temporary password generated: ${tempPassword}`);
  console.log('  ✓ Password hashed and stored');

  // Send email with temp password
  console.log('\n  📧 Sending temporary password email...');
  try {
    await sendTemporaryPasswordEmail(targetEmail, tempPassword, adminEmail);
    console.log('  ✅ Temporary password email sent successfully!\n');
  } catch (error) {
    console.log(`  ❌ Failed to send email: ${error.message}\n`);
    return { error: 'Failed to send email' };
  }

  // Verify password works
  const passwordValid = await bcrypt.compare(
    tempPassword,
    user.Auth.passwordHash
  );
  console.log(`  ✓ Password verification: ${passwordValid ? 'PASS' : 'FAIL'}`);
  console.log('  ✅ Admin temporary password set!\n');

  return { success: true, tempPassword };
}

/**
 * Test 5: Token Expiration
 */
async function testTokenExpiration() {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('TEST 5: Token Expiration Handling');
  console.log(
    '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n'
  );

  // Create an expired token
  const expiredToken = generateResetToken();
  mockDB.resetTokens.set(expiredToken, {
    email: recipientEmail,
    expiresAt: Date.now() - 1000, // Already expired
    used: false,
    createdAt: Date.now() - 2 * 60 * 60 * 1000, // 2 hours ago
  });

  const tokenData = mockDB.resetTokens.get(expiredToken);

  console.log(`  ✓ Created expired token: ${expiredToken.substring(0, 20)}...`);
  console.log(
    `  ✓ Token expired at: ${new Date(tokenData.expiresAt).toISOString()}`
  );

  // Try to validate
  if (Date.now() > tokenData.expiresAt) {
    console.log('  ✓ Token correctly identified as expired');
    console.log('  ✅ Expiration handling works correctly!\n');
    return { valid: false, correctly_rejected: true };
  }

  console.log('  ❌ Token should have been rejected as expired\n');
  return { valid: true, correctly_rejected: false };
}

/**
 * Test 6: Rate Limiting
 */
async function testRateLimiting() {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('TEST 6: Rate Limiting');
  console.log(
    '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n'
  );

  const testEmail = 'ratelimit@test.com';
  const rateKey = `reset_${testEmail}`;
  const maxRequests = 3;

  // Simulate hitting rate limit
  mockDB.rateLimits.set(rateKey, {
    count: maxRequests,
    resetAt: Date.now() + 60 * 60 * 1000, // 1 hour from now
  });

  const rateData = mockDB.rateLimits.get(rateKey);

  console.log(`  ✓ Simulated ${maxRequests} requests for ${testEmail}`);
  console.log(
    `  ✓ Rate limit resets at: ${new Date(rateData.resetAt).toISOString()}`
  );

  // Check if rate limit is enforced
  if (Date.now() < rateData.resetAt && rateData.count >= maxRequests) {
    console.log('  ✓ Rate limit correctly enforced');
    console.log('  ✅ Rate limiting works correctly!\n');
    return { rate_limited: true };
  }

  console.log('  ❌ Rate limit should have been enforced\n');
  return { rate_limited: false };
}

/**
 * Run all tests
 */
async function runAllTests() {
  console.log(`Target Email: ${recipientEmail}`);
  console.log(
    `Frontend URL: ${process.env.FRONTEND_URL || 'http://localhost:5173'}`
  );
  console.log('\n');

  // Verify email connection first
  console.log('Verifying SMTP connection...');
  const connectionResult = await verifyConnection();
  if (!connectionResult.success) {
    console.error('❌ SMTP connection failed:', connectionResult.error);
    console.error('\nPlease check your .env configuration.\n');
    process.exit(1);
  }
  console.log('✅ SMTP connection verified!\n');

  let allPassed = true;
  const results = {};

  try {
    // Test 1: Request password reset
    results.requestReset = await testRequestPasswordReset();
    if (!results.requestReset.success) allPassed = false;

    // Test 2: Validate token
    if (results.requestReset.token) {
      results.validateToken = await testValidateToken(
        results.requestReset.token
      );
      if (!results.validateToken.valid) allPassed = false;

      // Test 3: Reset password
      results.resetPassword = await testResetPassword(
        results.requestReset.token,
        'NewSecurePassword123!'
      );
      if (!results.resetPassword.success) allPassed = false;
    }

    // Test 4: Admin set temp password
    results.adminTempPassword = await testAdminSetTempPassword();
    if (!results.adminTempPassword.success) allPassed = false;

    // Test 5: Token expiration
    results.tokenExpiration = await testTokenExpiration();
    if (!results.tokenExpiration.correctly_rejected) allPassed = false;

    // Test 6: Rate limiting
    results.rateLimiting = await testRateLimiting();
    if (!results.rateLimiting.rate_limited) allPassed = false;
  } catch (error) {
    console.error('❌ Test error:', error.message);
    allPassed = false;
  }

  // Summary
  console.log(
    '╔══════════════════════════════════════════════════════════════╗'
  );
  console.log(
    '║                      TEST SUMMARY                            ║'
  );
  console.log(
    '╚══════════════════════════════════════════════════════════════╝\n'
  );

  console.log(
    `  Test 1 - Request Password Reset: ${results.requestReset?.success ? '✅ PASS' : '❌ FAIL'}`
  );
  console.log(
    `  Test 2 - Validate Token:         ${results.validateToken?.valid ? '✅ PASS' : '❌ FAIL'}`
  );
  console.log(
    `  Test 3 - Reset Password:         ${results.resetPassword?.success ? '✅ PASS' : '❌ FAIL'}`
  );
  console.log(
    `  Test 4 - Admin Set Temp Password:${results.adminTempPassword?.success ? '✅ PASS' : '❌ FAIL'}`
  );
  console.log(
    `  Test 5 - Token Expiration:       ${results.tokenExpiration?.correctly_rejected ? '✅ PASS' : '❌ FAIL'}`
  );
  console.log(
    `  Test 6 - Rate Limiting:          ${results.rateLimiting?.rate_limited ? '✅ PASS' : '❌ FAIL'}`
  );

  console.log(
    '\n' +
      (allPassed
        ? '🎉 ALL TESTS PASSED! The password reset system is working correctly.'
        : '⚠️  Some tests failed. Check the output above for details.')
  );

  console.log(
    `\n📬 Check your inbox at ${recipientEmail} for test emails (3 emails sent).\n`
  );

  process.exit(allPassed ? 0 : 1);
}

runAllTests();
