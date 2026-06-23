/**
 * Test Password Reset Flow
 * Run from backend directory: node test-reset-flow.js
 */
require('dotenv').config();

const Submitter = require('./src/models/Submitter');
const { dynamoDB, TABLES } = require('./src/config/aws');
const { PutCommand, ScanCommand } = require('@aws-sdk/lib-dynamodb');
const crypto = require('crypto');
const { sendPasswordResetEmail } = require('./src/services/emailService');

async function test() {
  console.log('\n=== Testing Password Reset Flow ===\n');

  const testEmail = 'sahasta@saimithrallc.com';

  // Step 1: Check if user exists
  console.log('Step 1: Checking if user exists in submitters table...');
  try {
    const user = await Submitter.findByEmail(testEmail);
    if (user) {
      console.log('   ✅ User found!');
      console.log(`   Email: ${user.email}`);
      console.log(`   Has password: ${user.Auth?.passwordHash ? 'Yes' : 'No'}`);
    } else {
      console.log('   ❌ User NOT found in submitters table');
      console.log('   This is why password reset fails - no user to reset!');
      console.log('\n   You need to have at least one user registered.');
      return;
    }
  } catch (error) {
    console.log('   ❌ Error finding user:', error.message);
    return;
  }

  // Step 2: Test DynamoDB connection to password_reset_tokens table
  console.log('\nStep 2: Testing password_reset_tokens table access...');
  try {
    const result = await dynamoDB.send(
      new ScanCommand({
        TableName: TABLES.PASSWORD_RESET_TOKENS,
        Limit: 1,
      })
    );
    console.log('   ✅ Table accessible!');
    console.log(`   Current items: ${result.Count || 0}`);
  } catch (error) {
    console.log('   ❌ Error accessing table:', error.message);
    if (error.name === 'ResourceNotFoundException') {
      console.log(
        '   The table does not exist! Please create it in AWS Console.'
      );
    }
    return;
  }

  // Step 3: Try to store a test token
  console.log('\nStep 3: Testing token storage...');
  const testToken = crypto.randomBytes(32).toString('hex');
  const now = Date.now();
  const expiresAt = Math.floor(now / 1000) + 3600; // 1 hour

  try {
    await dynamoDB.send(
      new PutCommand({
        TableName: TABLES.PASSWORD_RESET_TOKENS,
        Item: {
          token: testToken,
          email: testEmail.toLowerCase(),
          expiresAt,
          createdAt: new Date().toISOString(),
          createdAtNum: now,
          used: false,
          initiatedBy: 'test',
        },
      })
    );
    console.log('   ✅ Token stored successfully!');
    console.log(`   Token: ${testToken.substring(0, 20)}...`);
  } catch (error) {
    console.log('   ❌ Error storing token:', error.message);
    return;
  }

  // Step 4: Test email sending
  console.log('\nStep 4: Testing email sending...');
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
  const resetUrl = `${frontendUrl}/auth/reset-password/${testToken}`;

  try {
    await sendPasswordResetEmail(testEmail, resetUrl, 'test');
    console.log('   ✅ Email sent successfully!');
    console.log(`   Reset URL: ${resetUrl}`);
  } catch (error) {
    console.log('   ❌ Error sending email:', error.message);
    return;
  }

  console.log('\n=== All Tests Passed! ===');
  console.log(
    `\nCheck your inbox at ${testEmail} for the password reset email.`
  );
  console.log(`You can use this URL to test the reset flow:`);
  console.log(`${resetUrl}\n`);
}

test().catch((err) => {
  console.error('Test failed with error:', err);
  process.exit(1);
});
