/**
 * Create draft_properties DynamoDB table
 * Run with: node src/table/create-draft-properties-table.js
 *
 * Purpose:
 *   Stores in-progress property submissions (drafts) separately from the
 *   finalized `properties` table. Drafts can be resumed, updated, and deleted.
 *
 * Primary key:
 *   id (String) — uuid for each draft
 *
 * Global Secondary Index:
 *   submitterEmail-index — enables efficient lookup of all drafts belonging
 *   to a given user (so the frontend "My Drafts" list can fetch quickly
 *   without scanning the full table).
 *
 * Columns (application-level, DynamoDB is schemaless beyond the key):
 *   id, submitterEmail, submitterFullName, submitterPhone, submitterUserType,
 *   submitterRelationship, allowUnregisteredSeller, submittedByAdmin,
 *   submittedByAdminEmail, category, description, streetAddress, addressLine2,
 *   city, stateRegion, postalCode, bedrooms, bathrooms, squareFootage, yearBuilt,
 *   expiry_date, price, expectedCloseDate, financingType, emd, downPayment,
 *   financialInfo, isHOA, hoaMonthlyFee, subjLoanBalance, subjInterestRate,
 *   subjLoanMaturity, subjMonthlyPrincipal, subjMonthlyInterest,
 *   subjMonthlyTaxesInsurance, sellerLoanAmount, sellerInterestRate,
 *   sellerLoanMaturity, sellerMonthlyPayment, totalMonthlyPayment,
 *   strZoning, turnkeyFurnished, strConfidence, occupancyRate,
 *   vacationRentalMarkets, travelMotivations, strListingLink, strDataSheetsLink,
 *   guestDemandInsights, valueAddOpportunities, localContacts, amenities,
 *   localAttractions, specialTags, autoTags, interiorImages, exteriorImages,
 *   additionalImages, videos, priorityFirstAccess, fiftyFiftyPartner, turnkey,
 *   doneForYou, additionalInfo, draftStep, title, created_at, updated_at
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

const TABLE_NAME = 'draft_properties';

async function createTable() {
  console.log('\n=== Creating draft_properties DynamoDB Table ===\n');

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

  // Create the table with a GSI on submitterEmail so we can efficiently
  // query "all drafts for a given user" without scanning the whole table.
  const createParams = {
    TableName: TABLE_NAME,
    KeySchema: [{ AttributeName: 'id', KeyType: 'HASH' }],
    AttributeDefinitions: [
      { AttributeName: 'id', AttributeType: 'S' },
      { AttributeName: 'submitterEmail', AttributeType: 'S' },
    ],
    GlobalSecondaryIndexes: [
      {
        IndexName: 'submitterEmail-index',
        KeySchema: [{ AttributeName: 'submitterEmail', KeyType: 'HASH' }],
        Projection: { ProjectionType: 'ALL' },
      },
    ],
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
    console.log('The draft_properties table is ready to use!\n');
  } catch (error) {
    console.error('\nSetup failed:', error.message);
    process.exit(1);
  }
}

main();
