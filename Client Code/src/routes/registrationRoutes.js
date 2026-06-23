const express = require('express');
const {
  submitRegistrationRequest,
} = require('../controllers/registrationController');

const router = express.Router();

router.post('/register-request', submitRegistrationRequest);

module.exports = router;
