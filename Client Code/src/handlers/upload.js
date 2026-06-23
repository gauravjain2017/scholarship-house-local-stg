const { PutObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const { s3Client } = require('../config/aws');
const crypto = require('crypto');
const { createResponse, createErrorResponse } = require('../utils/response');

exports.getPresignedUploadUrl = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers':
          'Content-Type,Authorization,X-Amz-Date,X-Api-Key,X-Amz-Security-Token,X-Amz-User-Agent',
        'Access-Control-Allow-Methods': 'POST,OPTIONS',
      },
      body: '',
    };
  }

  try {
    if (!event.body) {
      return createErrorResponse(400, 'Missing request body');
    }

    const { fileName, fileType } =
      typeof event.body === 'string' ? JSON.parse(event.body) : event.body;

    if (!fileName || !fileType) {
      return createErrorResponse(400, 'fileName and fileType are required');
    }

    const BUCKET = process.env.AWS_S3_BUCKET_NAME;
    const REGION = process.env.AWS_REGION || 'us-east-1';

    if (!BUCKET) {
      throw new Error('MEDIA_BUCKET not set');
    }

    const ext = fileName.split('.').pop();
    const key = `uploads/${crypto.randomUUID()}.${ext}`;

    const command = new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      ContentType: fileType, // ✅ FIXED
    });

    const uploadUrl = await getSignedUrl(s3Client, command, {
      expiresIn: 300,
    });

    const fileUrl = `https://${BUCKET}.s3.${REGION}.amazonaws.com/${key}`;

    return createResponse(200, { uploadUrl, fileUrl, key });
  } catch (error) {
    console.error('Error generating presigned URL:', error);
    return createErrorResponse(500, 'Failed to generate upload URL');
  }
};
