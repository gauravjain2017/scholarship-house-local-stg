const express = require('express');
const router = express.Router();
const dealController = require('../controllers/dealController');

// Submitter routes
router.post('/', dealController.createDeal);
router.get('/my-submissions', dealController.getMySubmissions);

// Customer routes
router.get('/published', dealController.getPublishedDeals);
router.get('/:id', dealController.getDealById);

module.exports = router;
