/**
 * Input Validation Middleware
 * Provides reusable validation schemas and middleware for request validation
 */
const Joi = require('joi');

/**
 * Validation schemas
 */
const schemas = {
  email: Joi.string().email().lowercase().trim().max(255).required(),
  password: Joi.string().min(8).max(128).required(),
  token: Joi.string().hex().length(64).required(),
  dealId: Joi.string().uuid().required(),
  pagination: {
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(20),
  },
};

/**
 * Validation middleware factory
 * @param {Object} schema - Joi schema object
 * @param {string} property - Request property to validate ('body', 'query', 'params')
 */
const validate = (schema, property = 'body') => {
  return (req, res, next) => {
    const { error, value } = schema.validate(req[property], {
      abortEarly: false,
      stripUnknown: true,
    });

    if (error) {
      const errors = error.details.map((detail) => ({
        field: detail.path.join('.'),
        message: detail.message,
      }));

      return res.status(400).json({
        error: 'Validation failed',
        details: errors,
      });
    }

    // Replace request property with validated and sanitized value
    req[property] = value;
    next();
  };
};

/**
 * Common validation schemas
 */
const validationSchemas = {
  // Authentication
  login: Joi.object({
    email: schemas.email,
    password: schemas.password,
  }),

  register: Joi.object({
    email: schemas.email,
    password: schemas.password,
    firstName: Joi.string().trim().min(1).max(100).required(),
    lastName: Joi.string().trim().min(1).max(100).required(),
    organization: Joi.string().trim().max(255).optional(),
  }),

  // Password reset
  requestPasswordReset: Joi.object({
    email: schemas.email,
  }),

  resetPassword: Joi.object({
    token: schemas.token,
    newPassword: schemas.password,
  }),

  // Deal operations
  createDeal: Joi.object({
    address: Joi.string().trim().min(5).max(500).required(),
    city: Joi.string().trim().min(2).max(100).required(),
    state: Joi.string().trim().length(2).uppercase().required(),
    zipCode: Joi.string()
      .trim()
      .pattern(/^\d{5}(-\d{4})?$/)
      .required(),
    price: Joi.number().positive().max(999999999).required(),
    description: Joi.string().trim().max(5000).optional(),
    propertyType: Joi.string()
      .valid('single-family', 'multi-family', 'condo', 'townhouse', 'land')
      .required(),
    bedrooms: Joi.number().integer().min(0).max(50).optional(),
    bathrooms: Joi.number().min(0).max(50).optional(),
    squareFeet: Joi.number().integer().positive().max(999999).optional(),
  }),

  updateDeal: Joi.object({
    address: Joi.string().trim().min(5).max(500).optional(),
    city: Joi.string().trim().min(2).max(100).optional(),
    state: Joi.string().trim().length(2).uppercase().optional(),
    zipCode: Joi.string()
      .trim()
      .pattern(/^\d{5}(-\d{4})?$/)
      .optional(),
    price: Joi.number().positive().max(999999999).optional(),
    description: Joi.string().trim().max(5000).optional(),
    propertyType: Joi.string()
      .valid('single-family', 'multi-family', 'condo', 'townhouse', 'land')
      .optional(),
    bedrooms: Joi.number().integer().min(0).max(50).optional(),
    bathrooms: Joi.number().min(0).max(50).optional(),
    squareFeet: Joi.number().integer().positive().max(999999).optional(),
    status: Joi.string()
      .valid('pending', 'approved', 'rejected', 'archived')
      .optional(),
  }).min(1), // At least one field must be present

  // Query parameters
  pagination: Joi.object({
    page: schemas.pagination.page,
    limit: schemas.pagination.limit,
    sortBy: Joi.string()
      .valid('createdAt', 'price', 'address', 'status')
      .default('createdAt'),
    sortOrder: Joi.string().valid('asc', 'desc').default('desc'),
  }),

  // Search
  search: Joi.object({
    query: Joi.string().trim().min(1).max(200).optional(),
    city: Joi.string().trim().max(100).optional(),
    state: Joi.string().trim().length(2).uppercase().optional(),
    minPrice: Joi.number().positive().optional(),
    maxPrice: Joi.number().positive().optional(),
    propertyType: Joi.string()
      .valid('single-family', 'multi-family', 'condo', 'townhouse', 'land')
      .optional(),
    status: Joi.string()
      .valid('pending', 'approved', 'rejected', 'archived')
      .optional(),
  }),

  // Admin operations
  adminTriggerPasswordReset: Joi.object({
    email: schemas.email,
  }),

  adminSetTemporaryPassword: Joi.object({
    email: schemas.email,
  }),

  // Dispute
  createDispute: Joi.object({
    dealId: schemas.dealId,
    reason: Joi.string().trim().min(10).max(2000).required(),
    category: Joi.string()
      .valid('pricing', 'description', 'photos', 'availability', 'other')
      .required(),
  }),
};

/**
 * Sanitize string to prevent XSS
 */
const sanitizeString = (str) => {
  if (typeof str !== 'string') return str;
  return str
    .replace(/[<>]/g, '') // Remove < and >
    .trim();
};

/**
 * Sanitize object recursively
 */
const sanitizeObject = (obj) => {
  if (typeof obj !== 'object' || obj === null) return obj;

  const sanitized = Array.isArray(obj) ? [] : {};

  for (const key in obj) {
    if (typeof obj[key] === 'string') {
      sanitized[key] = sanitizeString(obj[key]);
    } else if (typeof obj[key] === 'object') {
      sanitized[key] = sanitizeObject(obj[key]);
    } else {
      sanitized[key] = obj[key];
    }
  }

  return sanitized;
};

/**
 * Sanitization middleware
 */
const sanitize = (req, res, next) => {
  if (req.body) req.body = sanitizeObject(req.body);
  if (req.query) req.query = sanitizeObject(req.query);
  if (req.params) req.params = sanitizeObject(req.params);
  next();
};

module.exports = {
  validate,
  validationSchemas,
  sanitize,
  schemas,
};
