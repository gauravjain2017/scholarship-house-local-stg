const express = require('express');
const router = express.Router();
const uploadController = require('../controllers/uploadController');

// Upload routes
router.post('/presigned-url', uploadController.getPresignedUploadUrl);
router.get('/download-url', uploadController.getPresignedDownloadUrl);

module.exports = router;
