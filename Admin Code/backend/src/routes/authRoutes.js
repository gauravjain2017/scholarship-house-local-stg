/**
 * Authentication Routes (Future Implementation)
 *
 * Uncomment and implement these routes when adding user authentication.
 * The middleware and utilities are already in place.
 */

const express = require('express');
const router = express.Router();
const backendConstants = require('../../backend_constants');
const { generateToken } = require('../middleware/auth');
//const { ScanCommand, DeleteCommand } = require('@aws-sdk/lib-dynamodb');
//const { dynamoDB, TABLES } = require('../config/aws');
const Submitter = require('../models/Submitter');
//const bcrypt = require('bcryptjs');

const { userModel } = backendConstants.schemas;
const {
  hash,
  checkUserExistence,
  checkPassword,
  USE_DYNAMODB,
  getUserByEmail,
  addUserToDynamoDB,
} = backendConstants.authentication;
const {
  submitRegistrationRequest,
} = require('../controllers/registrationController');

/**
 * Register new user
 */
/*
const register = async (req, res) => {
  try {
    const { email, password, role } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    // Check if user already exists
    const exists = await checkUserExistence(email);
    if (exists) {
      return res.status(409).json({ error: 'User already exists' });
    }

    // Hash password and create user
    const hashedPassword = hash(password);
    const newUser = new userModel({
      email,
      password: hashedPassword,
      role: role || 0, // Default role
    });

    USE_DYNAMODB
      ? await addUserToDynamoDB({
          email: email,
          password: hashedPassword,
          role: role || 0,
          createdAt: new Date().toISOString(),
        })
      : await newUser.save();

    // Generate token
    const token = generateToken({
      id: newUser._id,
      email: newUser.email,
      role: newUser.role,
    });

    res.status(201).json({
      success: true,
      token,
      user: {
        id: newUser._id,
        email: newUser.email,
        role: newUser.role,
      },
    });
  } catch (error) {
    console.error('Error registering user:', error);
    res.status(500).json({ error: 'Failed to register user' });
  }
};
*/

/**
 * Login user
 */
/*
const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    // Check if user exists
    const user = await getUserByEmail(email);
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Verify password
    const isValidPassword = await checkPassword(email, password);
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Generate token
    const token = generateToken({
      id: user._id,
      email: user.email,
      role: user.role,
    });

    res.json({
      success: true,
      token,
      user: {
        id: user._id,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    console.error('Error logging in:', error);
    res.status(500).json({ error: 'Failed to login' });
  }
};
*/
/**
 * Get current user (requires authentication)
 */
const getCurrentUser = async (req, res) => {
  try {
    // Fetch submitter profile using JWT email
    const submitter = await Submitter.findByEmail(req.user.email);

    return res.json({
      email: req.user.email,
      role: req.user.role,

      // Submitter profile fields
      name: submitter?.Name || null,
      phone: submitter?.Phone || null,
      userType: submitter?.UserType || null,
      access: submitter?.Access || {},

      createdAt: submitter?.createdAt || null,
      updatedAt: submitter?.updatedAt || null,
    });
  } catch (err) {
    console.error('AUTH /me error:', err);
    return res.status(500).json({ error: 'Failed to load user profile' });
  }
};

const authenticateToken = require('../middleware/auth').authenticateToken;

//router.post('/register', register);
//router.post('/login', login);
router.get('/me', authenticateToken, getCurrentUser);
router.post('/register-request', submitRegistrationRequest);
router.post('/login', (req, res) => {
  res.status(410).json({
    error: 'Deprecated. Use /submitters/login instead.',
  });
});

module.exports = router;
