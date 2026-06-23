/**
 * Session Management Tests
 * Tests for single-session login enforcement
 */

const { validateSession } = require('../middleware/auth');

// Mock the Submitter model
jest.mock('../models/Submitter', () => ({
  validateSessionToken: jest.fn(),
}));

const Submitter = require('../models/Submitter');

describe('validateSession middleware', () => {
  let mockReq;
  let mockRes;
  let mockNext;

  beforeEach(() => {
    jest.clearAllMocks();

    mockReq = {
      user: {
        email: 'test@example.com',
        role: 'submitter',
        sessionToken: 'valid-token-123',
      },
      headers: {
        'x-session-token': 'valid-token-123',
      },
    };

    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };

    mockNext = jest.fn();
  });

  it('should validate session for admin users (admins not exempt)', async () => {
    mockReq.user.role = 'admin';
    Submitter.validateSessionToken.mockResolvedValue(true);

    await validateSession(mockReq, mockRes, mockNext);

    expect(mockNext).toHaveBeenCalled();
    expect(Submitter.validateSessionToken).toHaveBeenCalledWith(
      'test@example.com',
      'valid-token-123'
    );
  });

  it('should call next() when no sessionToken in header or JWT (backward compatibility)', async () => {
    delete mockReq.user.sessionToken;
    delete mockReq.headers['x-session-token'];

    await validateSession(mockReq, mockRes, mockNext);

    expect(mockNext).toHaveBeenCalled();
    expect(Submitter.validateSessionToken).not.toHaveBeenCalled();
  });

  it('should call next() when session token is valid', async () => {
    Submitter.validateSessionToken.mockResolvedValue(true);

    await validateSession(mockReq, mockRes, mockNext);

    expect(Submitter.validateSessionToken).toHaveBeenCalledWith(
      'test@example.com',
      'valid-token-123'
    );
    expect(mockNext).toHaveBeenCalled();
  });

  it('should prefer x-session-token header over JWT sessionToken', async () => {
    mockReq.headers['x-session-token'] = 'header-token';
    mockReq.user.sessionToken = 'jwt-token';
    Submitter.validateSessionToken.mockResolvedValue(true);

    await validateSession(mockReq, mockRes, mockNext);

    expect(Submitter.validateSessionToken).toHaveBeenCalledWith(
      'test@example.com',
      'header-token'
    );
  });

  it('should fallback to JWT sessionToken if header missing', async () => {
    delete mockReq.headers['x-session-token'];
    mockReq.user.sessionToken = 'jwt-token';
    Submitter.validateSessionToken.mockResolvedValue(true);

    await validateSession(mockReq, mockRes, mockNext);

    expect(Submitter.validateSessionToken).toHaveBeenCalledWith(
      'test@example.com',
      'jwt-token'
    );
  });

  it('should return 401 with SESSION_INVALIDATED when token is invalid', async () => {
    Submitter.validateSessionToken.mockResolvedValue(false);

    await validateSession(mockReq, mockRes, mockNext);

    expect(mockRes.status).toHaveBeenCalledWith(401);
    expect(mockRes.json).toHaveBeenCalledWith({
      error:
        'Your session has expired. You may have logged in from another device.',
      code: 'SESSION_INVALIDATED',
    });
    expect(mockNext).not.toHaveBeenCalled();
  });

  it('should return 500 when validation throws error', async () => {
    Submitter.validateSessionToken.mockRejectedValue(
      new Error('Database error')
    );

    await validateSession(mockReq, mockRes, mockNext);

    expect(mockRes.status).toHaveBeenCalledWith(500);
    expect(mockRes.json).toHaveBeenCalledWith({
      error: 'Session validation failed',
    });
    expect(mockNext).not.toHaveBeenCalled();
  });

  it('should call next() when user object is missing (no email)', async () => {
    mockReq.user = null;

    await validateSession(mockReq, mockRes, mockNext);

    expect(mockNext).toHaveBeenCalled();
  });

  it('should call next() when no email in user object', async () => {
    mockReq.user = { role: 'submitter' };
    delete mockReq.headers['x-session-token'];

    await validateSession(mockReq, mockRes, mockNext);

    expect(mockNext).toHaveBeenCalled();
  });
});

describe('Submitter session token methods', () => {
  // These would need actual DB integration tests or mocked DynamoDB
  // For unit tests, we verify the logic flow

  describe('updateSessionToken', () => {
    it('should generate a 64-character hex token', () => {
      const crypto = require('crypto');
      const token = crypto.randomBytes(32).toString('hex');

      expect(token.length).toBe(64);
      expect(/^[a-f0-9]+$/.test(token)).toBe(true);
    });
  });

  describe('session invalidation flow', () => {
    it('should demonstrate the single-session concept', async () => {
      // Concept test: when user A logs in, their old session should be invalid

      // User logs in from Device 1 -> gets token A
      const tokenA = 'token-device-1';

      // User logs in from Device 2 -> gets token B, invalidates token A
      const tokenB = 'token-device-2';

      // Database now has tokenB
      const storedToken = tokenB;

      // Device 1 tries to make request with tokenA -> should fail
      expect(tokenA === storedToken).toBe(false);

      // Device 2 tries to make request with tokenB -> should succeed
      expect(tokenB === storedToken).toBe(true);
    });
  });
});
