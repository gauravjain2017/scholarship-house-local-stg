/**
 * MongoDB Database Connection Configuration
 */
const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    if (!process.env.MONGODB_URI) {
      console.warn(
        '⚠ MONGODB_URI not configured - skipping database connection'
      );
      return null;
    }

    const conn = await mongoose.connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 5000, // Timeout after 5s instead of 30s
    });

    console.log(`✓ MongoDB Connected: ${conn.connection.host}`);
    return conn;
  } catch (error) {
    console.error(`✗ MongoDB Connection Error: ${error.message}`);
    console.warn(
      '⚠ Server will run without database (some endpoints will fail)'
    );
    return null;
  }
};

module.exports = connectDB;
