/**
 * Draft routes — save-draft functionality for in-progress property submissions.
 *
 * Mount in index.js with:
 *   const draftRoutes = require('./routes/draftRoutes');
 *   app.use('/api/drafts', draftRoutes);
 *
 * All endpoints require a valid JWT + active session (same as profileRoutes).
 * A user can only read/write/delete their own drafts — ownership is enforced
 * inside the controller against req.user.email.
 */
const express = require('express');
const router = express.Router();
const { authenticateToken, validateSession } = require('../middleware/auth');
const draftController = require('../controllers/draftController');

// Every route below requires a valid JWT + active session
router.use(authenticateToken);
router.use(validateSession);

// GET /api/drafts/mine?email=foo@bar.com -> list current user's drafts
router.get('/mine', draftController.getMyDrafts);

// POST /api/drafts -> create a new draft
router.post('/', draftController.createDraft);

// GET /api/drafts/:id -> fetch one draft by id
router.get('/:id', draftController.getDraftById);

// PUT /api/drafts/:id -> update/overwrite an existing draft
router.put('/:id', draftController.updateDraft);

// DELETE /api/drafts/:id -> permanently delete a draft
router.delete('/:id', draftController.deleteDraft);

module.exports = router;
