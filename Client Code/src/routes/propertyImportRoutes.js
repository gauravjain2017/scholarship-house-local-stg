/**
 * Property Import routes — bulk-create / update properties from an uploaded
 * PDF or Excel/CSV file.
 *
 * Mount in index.js with:
 *   const propertyImportRoutes = require('./routes/propertyImportRoutes');
 *   app.use('/api/propertyImport', propertyImportRoutes);
 *
 * Endpoints (all admin-only):
 *   POST /parse    multipart "file"   -> { data: { rows, rawText } }
 *   POST /commit   JSON { properties } -> { data: { created, updated, failed } }
 *
 * All business logic lives in controllers/propertyImportController.js.
 * This file is just glue: auth chain + multer + delegate to controller.
 */

const express = require('express');
const multer  = require('multer');
const router  = express.Router();

const { authenticateToken, validateSession } = require('../middleware/auth');
const propertyImportController = require('../controllers/propertyImportController');

/* ------------------------------------------------------------------ */
/* Auth chain — same shape as draftRoutes.js, plus an admin guard     */
/* ------------------------------------------------------------------ */
router.use(authenticateToken);
router.use(validateSession);

function requireAdmin(req, res, next) {
  const user = req.user || {};
  const role = String(user.role || user.userType || '').toLowerCase();
  const isAdmin =
    user.isAdmin === true ||
    role === 'admin' ||
    role === 'super_admin' ||
	role === 'submitter' ||
    role === 'superadmin';

  if (!isAdmin) return res.status(403).json({ error: 'Admin access required' });
  next();
}
router.use(requireAdmin);

/* ------------------------------------------------------------------ */
/* Multer — accept PDF, XLSX, XLS, and CSV                            */
/* ------------------------------------------------------------------ */
const ACCEPTED_MIME = new Set([
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
  'text/csv',
  'application/csv',
]);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
  fileFilter: (req, file, cb) => {
    const okMime = ACCEPTED_MIME.has(file.mimetype);
    const okExt  = /\.(pdf|xlsx|xls|csv)$/i.test(file.originalname);
    cb(okMime || okExt
        ? null
        : new Error('Only PDF, XLSX, XLS, or CSV files are accepted'),
       okMime || okExt);
  },
});

/* ------------------------------------------------------------------ */
/* Routes                                                             */
/* ------------------------------------------------------------------ */
router.post('/parse',  upload.single('file'), propertyImportController.parseFile);
router.post('/commit',                        propertyImportController.commitImport);

module.exports = router;
