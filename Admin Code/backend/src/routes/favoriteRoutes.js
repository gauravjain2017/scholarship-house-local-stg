/**
 * Favorite Routes
 *
 * User-specific property favorites
 */

const express = require('express');
const router = express.Router();

const { authenticateToken, validateSession } = require('../middleware/auth');
const favoriteController = require('../controllers/favoriteController');

// All favorite routes require authentication and session validation
router.use(authenticateToken);
router.use(validateSession);

// GET /favorites
router.get('/', favoriteController.getFavorites);

// POST /favorites/:propertyId
router.post('/:propertyId', favoriteController.addFavorite);

// DELETE /favorites/:propertyId
router.delete('/:propertyId', favoriteController.removeFavorite);

module.exports = router;
