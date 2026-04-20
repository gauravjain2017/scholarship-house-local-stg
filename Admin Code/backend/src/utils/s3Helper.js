const { DeleteObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const { s3Client, S3 } = require('../config/aws');

/**
 * Delete multiple S3 objects by URL
 * @param {string[]} urls - Array of S3 URLs
 */
async function deleteS3Objects(urls) {
  if (!urls || urls.length === 0) return;

  const deletePromises = urls.map(async (url) => {
    try {
      const urlObj = new URL(url);
      const key = urlObj.pathname.substring(1);

      console.log(`Deleting S3 object: ${key}`);

      const command = new DeleteObjectCommand({
        Bucket: S3.BUCKET_NAME,
        Key: key,
      });

      await s3Client.send(command);
      console.log(`Deleted: ${key}`);
    } catch (error) {
      console.error(`Failed to delete S3 object ${url}:`, error);
    }
  });

  await Promise.all(deletePromises);
}

/**
 * Convert a private S3 URL into a signed GET URL
 */
async function getSignedViewUrl(url) {
  if (!url) return null;

  try {
    const urlObj = new URL(url);
    const key = urlObj.pathname.substring(1);

    const command = new GetObjectCommand({
      Bucket: S3.BUCKET_NAME,
      Key: key,
    });

    return await getSignedUrl(s3Client, command, {
      expiresIn: 60 * 60, // 1 hour
    });
  } catch (err) {
    console.error('Failed to sign S3 URL:', url, err);
    return null;
  }
}

module.exports = {
  deleteS3Objects,
  getSignedViewUrl,
};
