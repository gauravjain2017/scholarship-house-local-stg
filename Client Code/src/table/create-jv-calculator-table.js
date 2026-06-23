/**
 * Create jv_calculator DynamoDB table
 * Run with: node table/create-jv-calculator-table.js
 *
 * Columns: client_email (PK), type (SK), payload (JSON), createdAt, updatedAt
 */
require('dotenv').config();

const {
  DynamoDBClient,
  CreateTableCommand,
  DeleteTableCommand,
  DescribeTableCommand,
} = require('@aws-sdk/client-dynamodb');

const client = new DynamoDBClient({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

const TABLE_NAME = 'jv_calculator';

async function deleteTableIfExists() {
  try {
    await client.send(new DeleteTableCommand({ TableName: TABLE_NAME }));
    console.log(`🗑️  Table '${TABLE_NAME}' deleted. Waiting for deletion...`);

    // Wait until table is fully gone
    for (let i = 0; i < 30; i++) {
      await new Promise(r => setTimeout(r, 2000));
      try {
        await client.send(new DescribeTableCommand({ TableName: TABLE_NAME }));
        console.log(`   Still deleting... (attempt ${i + 1}/30)`);
      } catch (err) {
        if (err.name === 'ResourceNotFoundException') {
          console.log('✅ Table fully deleted.\n');
          return;
        }
      }
    }
    throw new Error('Table deletion timed out');
  } catch (err) {
    if (err.name === 'ResourceNotFoundException') {
      console.log(`ℹ️  Table '${TABLE_NAME}' does not exist. Skipping delete.\n`);
    } else {
      throw err;
    }
  }
}

async function createTable() {
  console.log('\n=== Creating jv_calculator DynamoDB Table ===\n');

  // Check if table already exists
  try {
    const describeResult = await client.send(
      new DescribeTableCommand({ TableName: TABLE_NAME })
    );
    console.log(`⚠️  Table '${TABLE_NAME}' already exists!`);
    console.log(`  Status: ${describeResult.Table.TableStatus}`);
    console.log(`  Item Count: ${describeResult.Table.ItemCount}`);
    console.log(`\n  To recreate with new schema, set RECREATE=true in your .env\n`);

    // ✅ Auto-recreate if env flag set
    if (process.env.RECREATE === 'true') {
      console.log('🔄 RECREATE=true detected. Deleting and recreating...\n');
      await deleteTableIfExists();
    } else {
      return { exists: true, status: describeResult.Table.TableStatus };
    }
  } catch (error) {
    if (error.name !== 'ResourceNotFoundException') {
      throw error;
    }
    console.log(`Table '${TABLE_NAME}' does not exist. Creating...`);
  }

  // ✅ Updated schema — client_email (HASH) + type (RANGE)
  const createParams = {
    TableName: TABLE_NAME,
    KeySchema: [
      { AttributeName: 'client_email', KeyType: 'HASH' },
      { AttributeName: 'type', KeyType: 'RANGE' },
    ],
    AttributeDefinitions: [
      { AttributeName: 'client_email', AttributeType: 'S' },
      { AttributeName: 'type', AttributeType: 'S' },
    ],
    BillingMode: 'PAY_PER_REQUEST',
  };

  try {
    const result = await client.send(new CreateTableCommand(createParams));
    console.log(`✅ Table '${TABLE_NAME}' created successfully!`);
    console.log(`   Status: ${result.TableDescription.TableStatus}`);
    console.log(`   ARN: ${result.TableDescription.TableArn}`);

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
        console.log('✅ Table is now ACTIVE!\n');
        return true;
      }
      console.log(`   Status: ${result.Table.TableStatus} (waiting...)`);
    } catch (error) {
      console.log(`   Checking... (attempt ${i + 1}/${maxAttempts})`);
    }
    await new Promise(r => setTimeout(r, 2000));
  }
  throw new Error('Table did not become active in time');
}

async function main() {
  console.log('AWS Configuration:');
  console.log(`  Region: ${process.env.AWS_REGION || 'us-east-1'}`);
  console.log(`  Access Key ID: ${process.env.AWS_ACCESS_KEY_ID
    ? process.env.AWS_ACCESS_KEY_ID.substring(0, 8) + '...'
    : 'NOT SET'}`);
  console.log(`  Secret Access Key: ${process.env.AWS_SECRET_ACCESS_KEY ? '***SET***' : 'NOT SET'}`);

  if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
    console.error('\n❌ AWS credentials not found in .env file!');
    process.exit(1);
  }

  try {
    await createTable();

    console.log('=== Setup Complete ===\n');
    console.log('The jv_calculator table is ready to use!\n');
    console.log('Table schema:');
    console.log('  - client_email  (String, Partition Key)  ← HASH');
    console.log('  - type          (String, Sort Key)       ← RANGE');
    console.log('  - payload       (Map - full calculator data)');
    console.log('  - createdAt     (String - ISO timestamp)');
    console.log('  - updatedAt     (String - ISO timestamp)');
  } catch (error) {
    console.error('\n❌ Setup failed:', error.message);
    process.exit(1);
  }
}

main();