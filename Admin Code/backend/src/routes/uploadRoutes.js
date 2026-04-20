/**
 * Upload Routes
 * Routes for file upload operations to S3
 */
const express = require('express');
const router = express.Router();
const uploadController = require('../controllers/uploadController');

// Upload routes
router.post('/presigned-url', uploadController.getPresignedUrl);
router.post('/batch-presigned-urls', uploadController.getBatchPresignedUrls);
router.delete('/file', uploadController.deleteFile);

module.exports = router;
