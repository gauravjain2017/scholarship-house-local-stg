const express = require('express');
const router = express.Router();
const { authenticateToken, validateSession } = require('../middleware/auth');
const calculatorController = require('../controllers/calculatorController');

// auth middleware
router.use(authenticateToken);
router.use(validateSession);

// Create or save calculator
router.post('/', calculatorController.saveCalculation);
router.get(
  '/:client_email/:type',
  calculatorController.getCalculationsByClientEmail
);
module.exports = router;