const express = require('express');
const router = express.Router();
const submitterController = require('../controllers/submitterController');
const { dynamoDB, TABLES } = require('../config/aws');
const { GetCommand } = require('@aws-sdk/lib-dynamodb');
const { authenticateToken, validateSession } = require('../middleware/auth');
const { submitterExists } = require('../controllers/submitterController');

console.log('submitterRoutes loaded');
router.get('/__debug', (req, res) => {
  res.json({ ok: true });
});

// Registration endpoint for submitters
//router.post('/register', submitterController.register);
// Login endpoint for submitters
router.post('/login', submitterController.login);
router.post('/bulk-register', submitterController.bulkRegister);
router.post('/applogin', submitterController.applogin);
// Logout endpoint - invalidates session token (requires valid auth)
router.post('/logout', authenticateToken, submitterController.logout);

// Protected routes with session validation
router.get('/exists', authenticateToken, validateSession, submitterExists);
router.get(
  '/by-email/:email',
  authenticateToken,
  validateSession,
  async (req, res) => {
    try {
      const email = decodeURIComponent(req.params.email).toLowerCase();

      const result = await dynamoDB.send(
        new GetCommand({
          TableName: TABLES.SUBMITTERS,
          Key: { Email: email },
        })
      );

      if (!result.Item) {
        return res.status(404).json(null);
      }

      return res.json({
        email: result.Item.Email,
        name: result.Item.Name,
        phone: result.Item.Phone || '',
        userType: result.Item.UserType,
      });
    } catch (err) {
      console.error('get submitter by email error:', err);
      return res.status(500).json({ error: 'Failed to fetch submitter' });
    }
  }
);

module.exports = router;
