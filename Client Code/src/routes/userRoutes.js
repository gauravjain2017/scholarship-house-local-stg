const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const { userExists } = require('../controllers/userController');

const router = express.Router();

router.get('/exists', authenticateToken, userExists);

module.exports = router;
