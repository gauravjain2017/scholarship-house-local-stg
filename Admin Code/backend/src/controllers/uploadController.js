/**
 * Upload Controllers
 * Handle file upload operations to S3
 */
const s3Service = require('../services/s3Service');

/**
 * Generate presigned URL for file upload
 */
const getPresignedUrl = async (req, res) => {
  try {
    const { fileName, fileType, fileCategory } = req.body;

    if (!fileName || !fileType) {
      return res
        .status(400)
        .json({ error: 'fileName and fileType are required' });
    }

    // Determine folder based on file type
    let folder = 'uploads';
    if (fileCategory === 'image' || fileType.startsWith('image/')) {
      folder = 'images';
    } else if (fileCategory === 'video' || fileType.startsWith('video/')) {
      folder = 'videos';
    }

    const result = await s3Service.generatePresignedUrl(
      fileName,
      fileType,
      folder
    );


    res.json({
      uploadUrl: result.presignedUrl,
      fileUrl: result.publicUrl,
      key: result.key,
    });
  } catch (error) {
    console.error('Error generating presigned URL:', error);
    res.status(500).json({ error: 'Failed to generate presigned URL' });
  }
};

/**
 * Delete a file from S3
 */
const deleteFile = async (req, res) => {
  try {
    const { fileKey } = req.body;

    if (!fileKey) {
      return res.status(400).json({ error: 'fileKey is required' });
    }

    await s3Service.deleteFile(fileKey);
    res.json({ success: true, message: 'File deleted successfully' });
  } catch (error) {
    console.error('Error deleting file:', error);
    res.status(500).json({ error: 'Failed to delete file' });
  }
};

/**
 * Get multiple presigned URLs for batch upload
 */
const getBatchPresignedUrls = async (req, res) => {
  try {
    const { files } = req.body; // Array of { fileName, fileType, fileCategory }

    if (!files || !Array.isArray(files)) {
      return res.status(400).json({ error: 'files array is required' });
    }

    const results = await Promise.all(
      files.map(async (file) => {
        let folder = 'uploads';
        if (
          file.fileCategory === 'image' ||
          file.fileType.startsWith('image/')
        ) {
          folder = 'images';
        } else if (
          file.fileCategory === 'video' ||
          file.fileType.startsWith('video/')
        ) {
          folder = 'videos';
        }

        const result = await s3Service.generatePresignedUrl(
          file.fileName,
          file.fileType,
          folder
        );

        return {
          fileName: file.fileName,
          presignedUrl: result.presignedUrl,
          publicUrl: result.publicUrl,
          key: result.key,
        };
      })
    );

    res.json(results);
  } catch (error) {
    console.error('Error generating batch presigned URLs:', error);
    res.status(500).json({ error: 'Failed to generate presigned URLs' });
  }
};

module.exports = {
  getPresignedUrl,
  deleteFile,
  getBatchPresignedUrls,
};
