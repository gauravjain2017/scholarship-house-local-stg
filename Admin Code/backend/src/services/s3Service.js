/**
 * AWS S3 Upload Service
 * Handles file uploads to Amazon S3 and presigned URL generation
 */
const { PutObjectCommand, DeleteObjectCommand, HeadObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const { s3Client } = require('../config/aws');
const { v4: uuidv4 } = require('uuid');

const BUCKET_NAME = process.env.AWS_S3_BUCKET_NAME;
const REGION = process.env.AWS_REGION || 'us-east-1';

/**
 * Generate a presigned URL for direct upload to S3
 * @param {string} fileName - Original file name
 * @param {string} fileType - MIME type of the file
 * @param {string} folder - Folder path in S3 (e.g., 'images' or 'videos')
 * @returns {Object} - Contains presigned URL and the file key
 */
const generatePresignedUrl = async (fileName, fileType, folder = 'uploads') => {
  // console.log('Bucket Name : ', BUCKET_NAME);

  const fileExtension = fileName.split('.').pop();
  const uniqueFileName = `${folder}/${uuidv4()}.${fileExtension}`;

  const command = new PutObjectCommand({
    Bucket: BUCKET_NAME,
    Key: uniqueFileName,
    ContentType: fileType,
  });

  try {
    const presignedUrl = await getSignedUrl(s3Client, command, { expiresIn: 300 });
    const publicUrl = `https://${BUCKET_NAME}.s3.${REGION}.amazonaws.com/${uniqueFileName}`;

    return {
      presignedUrl,
      publicUrl,
      key: uniqueFileName,
    };
  } catch (error) {
    console.error('Error generating presigned URL:', error);
    throw error;
  }
};

/**
 * Delete a file from S3
 * @param {string} fileKey - S3 object key
 */
const deleteFile = async (fileKey) => {
  const command = new DeleteObjectCommand({
    Bucket: BUCKET_NAME,
    Key: fileKey,
  });

  try {
    await s3Client.send(command);
    return { success: true };
  } catch (error) {
    console.error('Error deleting file from S3:', error);
    throw error;
  }
};

/**
 * Check if file exists in S3
 * @param {string} fileKey - S3 object key
 */
const fileExists = async (fileKey) => {
  const command = new HeadObjectCommand({
    Bucket: BUCKET_NAME,
    Key: fileKey,
  });

  try {
    await s3Client.send(command);
    return true;
  } catch (error) {
    if (error.name === 'NotFound') {
      return false;
    }
    throw error;
  }
};

module.exports = {
  generatePresignedUrl,
  deleteFile,
  fileExists,
};
