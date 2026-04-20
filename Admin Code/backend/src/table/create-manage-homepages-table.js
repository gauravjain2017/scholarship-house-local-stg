/**
 * Create manage_homepages DynamoDB table
 * Run with: node table/create-manage-homepages-table.js
 *
 * Columns: id, type, payload (JSON), global_css, created_at, updated_at
 */
require('dotenv').config();

const {
  DynamoDBClient,
  CreateTableCommand,
  DescribeTableCommand,
} = require('@aws-sdk/client-dynamodb');

const client = new DynamoDBClient({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

const TABLE_NAME = 'manage_homepages';

async function createTable() {
  console.log('\n=== Creating manage_homepages DynamoDB Table ===\n');

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
    KeySchema: [{ AttributeName: 'id', KeyType: 'HASH' }],
    AttributeDefinitions: [{ AttributeName: 'id', AttributeType: 'S' }],
    BillingMode: 'PAY_PER_REQUEST',
  };

  try {
    const result = await client.send(new CreateTableCommand(createParams));
    console.log(`Table '${TABLE_NAME}' created successfully!`);
    console.log(`   Status: ${result.TableDescription.TableStatus}`);
    console.log(`   ARN: ${result.TableDescription.TableArn}`);

    // Wait for table to become active
    console.log('\nWaiting for table to become ACTIVE...');
    await waitForTableActive();

    return { created: true };
  } catch (error) {
    console.error('Failed to create table:', error.message);
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
        console.log('Table is now ACTIVE!');
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
    console.error('\nAWS credentials not found in .env file!');
    process.exit(1);
  }

  try {
    await createTable();

    console.log('\n=== Setup Complete ===\n');
    console.log('The manage_homepages table is ready to use!\n');
    console.log('Table columns (stored as DynamoDB attributes):');
    console.log('  - id         (String, Primary Key)');
    console.log('  - type       (String)');
    console.log('  - payload    (String - JSON stringified blocks array)');
    console.log('  - global_css (String - raw CSS text)');
    console.log('  - created_at (String - ISO timestamp)');
    console.log('  - updated_at (String - ISO timestamp)');
  } catch (error) {
    console.error('\nSetup failed:', error.message);
    process.exit(1);
  }
}

main();
