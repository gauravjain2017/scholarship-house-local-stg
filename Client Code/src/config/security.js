/**
 * Security Configuration
 * Centralized security settings and utilities
 */

/**
 * CORS Configuration
 */
const getCorsOptions = () => {
  const allowedOrigins = process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',')
    : ['http://localhost:5173', 'http://127.0.0.1:5173','https://scholarshiphouses.com/api'];

  return {
    origin: (origin, callback) => {
      // Allow requests with no origin (mobile apps, Postman, etc.)
      if (!origin) return callback(null, true);

      if (allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        console.warn(`Blocked CORS request from origin: ${origin}`);
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-session-token'],
    maxAge: 86400, // 24 hours
  };
};

/**
 * Rate Limiting Configuration
 */
// const rateLimitConfig = {
//   // General API rate limit
//   api: {
//     windowMs: 15 * 60 * 1000, // 15 minutes
//     max: 100,
//     message: 'Too many requests from this IP, please try again later.',
//     standardHeaders: true,
//     legacyHeaders: false,
//   },

//   // Strict rate limit for authentication endpoints
//   auth: {
//     windowMs: 15 * 60 * 1000, // 15 minutes
//     max: 50,
//     message: 'Too many authentication attempts, please try again after 15 minutes.',
//     standardHeaders: true,
//     legacyHeaders: false,
//     skipSuccessfulRequests: true, // Don't count successful logins
//   },

//   // Password reset rate limit
//   passwordReset: {
//     windowMs: 60 * 60 * 1000, // 1 hour
//     max: 30,
//     message: 'Too many password reset requests, please try again later.',
//     standardHeaders: true,
//     legacyHeaders: false,
//   },

//   // File upload rate limit
//   upload: {
//     windowMs: 60 * 60 * 1000, // 1 hour
//     max: 30,
//     message: 'Too many upload requests, please try again later.',
//     standardHeaders: true,
//     legacyHeaders: false,
//   },
// };

const rateLimitConfig = {
  // General API rate limit
  api: {
    windowMs: parseInt(process.env.API_WINDOW_TIME) * 60 * 1000,
    max: parseInt(process.env.API_REQUEST_LIMIT),
    message: 'Too many requests from this IP, please try again later.',
    standardHeaders: true,
    legacyHeaders: false,
  },

  // Authentication endpoints (login/signup)
  auth: {
    windowMs: parseInt(process.env.AUTH_WINDOW_TIME) * 60 * 1000,
    max: parseInt(process.env.AUTH_REQUEST_LIMIT),
    message: 'Too many authentication attempts, please try again after 15 minutes.',
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: true,
  },

  // Password reset (keep stricter for security)
  passwordReset: {
    windowMs: parseInt(process.env.PASSWORD_RESET_WINDOW_TIME) * 60 * 1000,
    max: parseInt(process.env.PASSWORD_REQUEST_LIMIT),
    message: 'Too many password reset requests, please try again later.',
    standardHeaders: true,
    legacyHeaders: false,
  },

  // File uploads
  upload: {
    windowMs: parseInt(process.env.UPLOAD_WINDOW_TIME) * 60 * 1000,
    max: parseInt(process.env.UPLOAD_REQUEST_LIMIT),
    message: 'Too many upload requests, please try again later.',
    standardHeaders: true,
    legacyHeaders: false,
  },
};

/**
 * Security Headers Configuration
 */
const securityHeaders = (req, res, next) => {
  // Prevent MIME type sniffing
  res.setHeader('X-Content-Type-Options', 'nosniff');

  // Prevent clickjacking
  res.setHeader('X-Frame-Options', 'DENY');

  // XSS Protection (legacy browsers)
  res.setHeader('X-XSS-Protection', '1; mode=block');

  // HTTPS enforcement
  res.setHeader(
    'Strict-Transport-Security',
    'max-age=31536000; includeSubDomains; preload'
  );

  // Content Security Policy
  const cspDirectives = [
    "default-src 'self'",
    "img-src 'self' https://*.amazonaws.com data:",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline'",
    "font-src 'self'",
    "connect-src 'self' " + getAllowedConnectSources(),
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ];
  res.setHeader('Content-Security-Policy', cspDirectives.join('; '));

  // Referrer Policy
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

  // Permissions Policy (formerly Feature Policy)
  res.setHeader(
    'Permissions-Policy',
    'geolocation=(), microphone=(), camera=()'
  );

  next();
};

/**
 * Get allowed connect sources for CSP
 */
const getAllowedConnectSources = () => {
  const sources = ['http://localhost:3000', 'http://localhost:5173'];

  if (process.env.API_URL) {
    sources.push(process.env.API_URL);
  }

  if (process.env.FRONTEND_URL) {
    sources.push(process.env.FRONTEND_URL);
  }

  return sources.join(' ');
};

/**
 * JWT Configuration
 */
const jwtConfig = {
  secret: process.env.JWT_SECRET,
  expiresIn: '7d',
  algorithm: 'HS256',
  issuer: 'deal-pipeline-api',
  audience: 'deal-pipeline-app',
};

/**
 * Password Policy
 */
const passwordPolicy = {
  minLength: 8,
  maxLength: 128,
  requireUppercase: true,
  requireLowercase: true,
  requireNumbers: true,
  requireSpecialChars: false,
};

/**
 * Validate password against policy
 */
const validatePassword = (password) => {
  const errors = [];

  if (password.length < passwordPolicy.minLength) {
    errors.push(`Password must be at least ${passwordPolicy.minLength} characters long`);
  }

  if (password.length > passwordPolicy.maxLength) {
    errors.push(`Password must not exceed ${passwordPolicy.maxLength} characters`);
  }

  if (passwordPolicy.requireUppercase && !/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }

  if (passwordPolicy.requireLowercase && !/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  }

  if (passwordPolicy.requireNumbers && !/\d/.test(password)) {
    errors.push('Password must contain at least one number');
  }

  if (passwordPolicy.requireSpecialChars && !/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
    errors.push('Password must contain at least one special character');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
};

/**
 * Session Configuration
 */
const sessionConfig = {
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  refreshThreshold: 24 * 60 * 60 * 1000, // Refresh if less than 1 day remaining
};

/**
 * File Upload Configuration
 */
const uploadConfig = {
  maxFileSize: 10 * 1024 * 1024, // 10MB
  allowedMimeTypes: [
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'application/pdf',
  ],
  allowedExtensions: ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.pdf'],
};

/**
 * Audit Log Configuration
 */
const auditConfig = {
  enabled: process.env.AUDIT_LOGGING === 'true',
  logLevel: process.env.AUDIT_LOG_LEVEL || 'info',
  sensitiveFields: ['password', 'token', 'secret', 'apiKey'],
};

/**
 * Sanitize object for logging (remove sensitive fields)
 */
const sanitizeForLogging = (obj) => {
  if (typeof obj !== 'object' || obj === null) return obj;

  const sanitized = { ...obj };

  auditConfig.sensitiveFields.forEach((field) => {
    if (field in sanitized) {
      sanitized[field] = '[REDACTED]';
    }
  });

  return sanitized;
};

module.exports = {
  getCorsOptions,
  rateLimitConfig,
  securityHeaders,
  jwtConfig,
  passwordPolicy,
  validatePassword,
  sessionConfig,
  uploadConfig,
  auditConfig,
  sanitizeForLogging,
};
