/**
 * Create password_reset_tokens DynamoDB table
 * Run with: node create-password-reset-table.js
 */
require('dotenv').config();

const {
  DynamoDBClient,
  CreateTableCommand,
  DescribeTableCommand,
  UpdateTimeToLiveCommand,
} = require('@aws-sdk/client-dynamodb');

const client = new DynamoDBClient({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

const TABLE_NAME = 'password_reset_tokens';

async function createTable() {
  console.log('\n=== Creating password_reset_tokens DynamoDB Table ===\n');

  // Check if table already exists
  try {
    const describeResult = await client.send(
      new DescribeTableCommand({ TableName: TABLE_NAME })
    );
    console.log(`Table '${TABLE_NAME}' already exists!`);
    console.log(`  Status: ${describeResult.Table.TableStatus}`);
    console.log(`  Item Count: ${describeResult.Table.ItemCount}`);
    return { exists: true, status: describeResult.Table.TableStatus };
  } catch (error) {
    if (error.name !== 'ResourceNotFoundException') {
      throw error;
    }
    console.log(`Table '${TABLE_NAME}' does not exist. Creating...`);
  }

  // Create the table
  const createParams = {
    TableName: TABLE_NAME,
    KeySchema: [{ AttributeName: 'token', KeyType: 'HASH' }],
    AttributeDefinitions: [{ AttributeName: 'token', AttributeType: 'S' }],
    BillingMode: 'PAY_PER_REQUEST',
  };

  try {
    const result = await client.send(new CreateTableCommand(createParams));
    console.log(`✅ Table '${TABLE_NAME}' created successfully!`);
    console.log(`   Status: ${result.TableDescription.TableStatus}`);
    console.log(`   ARN: ${result.TableDescription.TableArn}`);

    // Wait for table to become active
    console.log('\nWaiting for table to become ACTIVE...');
    await waitForTableActive();

    return { created: true };
  } catch (error) {
    console.error('❌ Failed to create table:', error.message);
    throw error;
  }
}

async function waitForTableActive(maxAttempts = 30) {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const result = await client.send(
        new DescribeTableCommand({ TableName: TABLE_NAME })
      );
      if (result.Table.TableStatus === 'ACTIVE') {
        console.log('✅ Table is now ACTIVE!');
        return true;
      }
      console.log(`   Status: ${result.Table.TableStatus} (waiting...)`);
    } catch (error) {
      console.log(`   Checking... (attempt ${i + 1}/${maxAttempts})`);
    }
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }
  throw new Error('Table did not become active in time');
}

async function enableTTL() {
  console.log('\n=== Enabling TTL on expiresAt attribute ===\n');

  try {
    await client.send(
      new UpdateTimeToLiveCommand({
        TableName: TABLE_NAME,
        TimeToLiveSpecification: {
          Enabled: true,
          AttributeName: 'expiresAt',
        },
      })
    );
    console.log('✅ TTL enabled on expiresAt attribute!');
    console.log('   Expired tokens will be automatically deleted by DynamoDB.');
    return { success: true };
  } catch (error) {
    if (
      error.name === 'ValidationException' &&
      error.message.includes('already enabled')
    ) {
      console.log('✅ TTL is already enabled on this table.');
      return { success: true, alreadyEnabled: true };
    }
    console.error('❌ Failed to enable TTL:', error.message);
    throw error;
  }
}

async function main() {
  console.log('AWS Configuration:');
  console.log(`  Region: ${process.env.AWS_REGION || 'us-east-1'}`);
  console.log(
    `  Access Key ID: ${process.env.AWS_ACCESS_KEY_ID ? process.env.AWS_ACCESS_KEY_ID.substring(0, 8) + '...' : 'NOT SET'}`
  );
  console.log(
    `  Secret Access Key: ${process.env.AWS_SECRET_ACCESS_KEY ? '***SET***' : 'NOT SET'}`
  );

  if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
    console.error('\n❌ AWS credentials not found in .env file!');
    process.exit(1);
  }

  try {
    await createTable();
    await enableTTL();

    console.log('\n=== Setup Complete ===\n');
    console.log('The password_reset_tokens table is ready to use!');
    console.log(
      'You can now start the backend server and test password reset.\n'
    );
  } catch (error) {
    console.error('\n❌ Setup failed:', error.message);
    process.exit(1);
  }
}

main();
