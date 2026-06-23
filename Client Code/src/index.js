const path = require('path');
const fs = require('fs');

const envPath = path.resolve(__dirname, '..', '.env');
console.log('🔍 DOTENV PATH USED:', envPath);
console.log('🔍 ENV FILE EXISTS:', fs.existsSync(envPath));

require('dotenv').config({ path: envPath });

const express = require('express');
const app = express();
const cors = require('cors');
app.set('trust proxy', 1);
const rateLimit = require('express-rate-limit');

if (process.env.NODE_ENV !== 'production') {
  require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
}

const connectDB = require('./config/database');
const dealRoutes = require('./routes/dealRoutes');
const adminRoutes = require('./routes/adminRoutes');
const uploadRoutes = require('./routes/uploadRoutes');
const authRoutes = require('./routes/authRoutes');
const submitterRoutes = require('./routes/submitterRoutes');
const favoriteRoutes = require('./routes/favoriteRoutes');
const userRoutes = require('./routes/userRoutes');
const registrationRoutes = require('./routes/registrationRoutes');
const passwordResetRoutes = require('./routes/passwordResetRoutes');
const disputeRoutes = require('./routes/disputeRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const manageHomepageRoutes = require('./routes/manageHomepageRoutes');
const profileRoutes = require('./routes/profileRoutes');
const draftRoutes = require('./routes/draftRoutes');
const calculateRoutes = require('./routes/calculatorRoutes');
const propertyClaimRoutes = require('./routes/propertyClaimRoutes');

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

// Middleware
// Restrict CORS to specific origins
const corsOptions = {
  origin: ['http://localhost:5173', 'http://127.0.0.1:5173'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
};
app.use(cors(corsOptions));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Security headers
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader(
    'Strict-Transport-Security',
    'max-age=31536000; includeSubDomains'
  );
  res.setHeader(
    'Content-Security-Policy',
    [
      "default-src 'self'",
      "img-src 'self' https://stl-property-api-media-dev.s3.us-east-1.amazonaws.com data:",
      "script-src 'self'",
      "style-src 'self' 'unsafe-inline'",
      "connect-src 'self' http://localhost:3000 http://localhost:5173 http://stl-app-alb-1111386073.us-east-1.elb.amazonaws.com",
    ].join('; ')
  );

  next();
});

// Rate limiting
const { rateLimitConfig } = require('./config/security');

const isProduction = process.env.NODE_ENV === 'production';

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: isProduction ? 500 : 5000, // Higher limit for development
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

const authLimiter = rateLimit(rateLimitConfig.auth);
const uploadLimiter = rateLimit(rateLimitConfig.upload);

// Apply general rate limiting to all API requests
app.use('/api/', apiLimiter);
// Stricter rate limits for auth and upload endpoints
app.use('/api/submitters/login', authLimiter);
app.use('/api/auth/login', authLimiter);
app.use('/api/upload', uploadLimiter);

// Debug logging middleware (development only)
if (process.env.NODE_ENV !== 'production') {
  app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
    next();
  });
}

// Connect to MongoDB (optional for testing)
if (process.env.MONGODB_URI) {
  connectDB().catch((err) => {
    console.warn('MongoDB connection failed:', err.message);
    console.warn('Server will run without database (some endpoints will fail)');
  });
} else {
  console.warn('MONGODB_URI not set - running without database');
}

const PORT = process.env.PORT || 3000;

// Health check route
app.get('/', (req, res) => {
  res.json({ status: 'ok', message: 'Deal Pipeline Backend API version=1 ' });
});

// Also respond at /api root
app.get('/api', (req, res) => {
  res.json({ status: 'ok', message: 'Deal Pipeline Backend API version=1' });
});

// API Routes
app.use('/api/deals', dealRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/submitters', submitterRoutes);
app.use('/api/favorites', favoriteRoutes);
app.use('/api/users', userRoutes);
app.use('/api', registrationRoutes);
app.use('/api/password', passwordResetRoutes);
app.use('/api/disputes', disputeRoutes);
app.use('/api/notifications', notificationRoutes); // non-admin, client-accessible
app.use('/api/manage-homepages', manageHomepageRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/drafts', draftRoutes);
app.use('/api/calculators', calculateRoutes);
app.use('/api/deals', propertyClaimRoutes);


// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error',
  });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server listening on port ${PORT}`);
  console.log(`API available at http://localhost:${PORT}`);
});

const cron = require('node-cron');
const { expireDueDeals, warnExpiringDeals } = require('./services/expirationJob');
const { deleteExpiredRejectedDeals } = require('./services/rejectionCleanupJob');

const CRON_TIMEZONE = process.env.CRON_TIMEZONE || 'America/New_York';

cron.schedule(
  '* 1 * * *',
  () => {
    console.log('[cron] Running property expiration job at 1:00 AM');
    expireDueDeals().catch((err) =>
      console.error('[cron] expireDueDeals failed:', err)
    );
    warnExpiringDeals().catch((err) =>
      console.error('[cron] warnExpiringDeals failed:', err)
    );
  },
  { timezone: CRON_TIMEZONE }
);

cron.schedule(
  '* 2 * * *',
  () => {
    console.log('[cron] Running rejected property cleanup job');
    deleteExpiredRejectedDeals().catch((err) =>
      console.error('[cron] deleteExpiredRejectedDeals failed:', err)
    );
  },
  { timezone: CRON_TIMEZONE }
);