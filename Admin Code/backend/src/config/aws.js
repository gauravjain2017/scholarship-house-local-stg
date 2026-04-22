const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient } = require('@aws-sdk/lib-dynamodb');
const { S3Client } = require('@aws-sdk/client-s3');

const REGION =
  process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || 'us-east-1';

const S3 = {
  BUCKET_NAME: process.env.AWS_S3_BUCKET_NAME,
  REGION,
};

if (!S3.BUCKET_NAME) {
  throw new Error('AWS_S3_BUCKET_NAME is not set');
}

/* DynamoDB */
const dynamoDBClient = new DynamoDBClient({ region: REGION });

const dynamoDB = DynamoDBDocumentClient.from(dynamoDBClient, {
  marshallOptions: {
    removeUndefinedValues: true,
  },
});

/* S3 */
const s3Client = new S3Client({
  region: REGION,
  requestChecksumCalculation: 'when_required',
  responseChecksumValidation: 'when_required',
});



/* Tables */
const TABLES = {
  DRAFT_PROPERTIES: 'draft_properties',
  PROPERTIES: 'properties',
  SUBMITTERS: 'submitters',
  USER_FAVORITES: 'favorite_property',
  PENDING_REGISTRATIONS: 'pending_registrations',
  PASSWORD_RESET_TOKENS: 'password_reset_tokens',
  OWNERSHIP_DISPUTES: 'ownership_disputes',
  NOTIFICATIONS: 'notifications',
  BUY_BOXES: 'buy_boxes',
  MANAGE_FILTERS: 'manage_filters',
  MANAGE_HOMEPAGES: 'manage_homepages',
  MANAGE_TAX_RATES: 'manage_tax_rates',
};

module.exports = {
  dynamoDB,
  s3Client,
  TABLES,
  S3,
};
