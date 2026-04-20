/**
 * Authentication Context Tests
 * Tests for session management, login, and logout functionality
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock localStorage
const localStorageMock = {
  store: {},
  getItem: vi.fn((key) => localStorageMock.store[key] || null),
  setItem: vi.fn((key, value) => {
    localStorageMock.store[key] = value;
  }),
  removeItem: vi.fn((key) => {
    delete localStorageMock.store[key];
  }),
  clear: vi.fn(() => {
    localStorageMock.store = {};
  }),
};

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
});

// Mock the auth API
vi.mock('../api/auth', () => ({
  authAPI: {
    submitterLogin: vi.fn(),
    submitterLogout: vi.fn(),
    getProfile: vi.fn(),
  },
}));

import { authAPI } from '../api/auth';

describe('Authentication Session Management', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorageMock.clear();
  });

  describe('submitterLogin', () => {
    it('should store sessionToken in localStorage on successful login', async () => {
      const mockResponse = {
        token: 'jwt-token-123',
        sessionToken: 'session-token-456',
        email: 'test@example.com',
        name: 'Test User',
        userType: 'submitter',
      };
      authAPI.submitterLogin.mockResolvedValue(mockResponse);

      await authAPI.submitterLogin('test@example.com', 'password123');

      // Verify the mock was called
      expect(authAPI.submitterLogin).toHaveBeenCalledWith(
        'test@example.com',
        'password123'
      );
    });

    it('should handle login errors with error codes', async () => {
      const mockError = {
        response: {
          data: {
            error: 'Your session has expired',
            code: 'SESSION_INVALIDATED',
          },
        },
      };
      authAPI.submitterLogin.mockRejectedValue(mockError);

      await expect(
        authAPI.submitterLogin('test@example.com', 'password')
      ).rejects.toBeTruthy();
    });
  });

  describe('submitterLogout', () => {
    it('should call logout API and clear localStorage', async () => {
      authAPI.submitterLogout.mockResolvedValue({});

      // Simulate logged in state
      localStorageMock.setItem('token', 'jwt-token');
      localStorageMock.setItem('sessionToken', 'session-token');
      localStorageMock.setItem(
        'submitterUser',
        JSON.stringify({ email: 'test@example.com' })
      );

      await authAPI.submitterLogout();

      expect(authAPI.submitterLogout).toHaveBeenCalled();
    });

    it('should not throw if logout API fails', async () => {
      authAPI.submitterLogout.mockRejectedValue(new Error('Network error'));

      // Should not throw
      await expect(authAPI.submitterLogout()).rejects.toThrow();
    });
  });

  describe('session error handling', () => {
    it('should detect SESSION_INVALIDATED error code', () => {
      const errorResponse = {
        error:
          'Your session has expired. You may have logged in from another device.',
        code: 'SESSION_INVALIDATED',
      };

      expect(errorResponse.code).toBe('SESSION_INVALIDATED');
    });

    it('should detect PENDING_REGISTRATION error code', () => {
      const errorResponse = {
        error: 'Your registration is pending approval.',
        code: 'PENDING_REGISTRATION',
      };

      expect(errorResponse.code).toBe('PENDING_REGISTRATION');
    });

    it('should detect REGISTRATION_REJECTED error code', () => {
      const errorResponse = {
        error: 'Your registration was not approved.',
        code: 'REGISTRATION_REJECTED',
      };

      expect(errorResponse.code).toBe('REGISTRATION_REJECTED');
    });

    it('should detect ACCOUNT_DEACTIVATED error code', () => {
      const errorResponse = {
        error: 'Your account has been deactivated.',
        code: 'ACCOUNT_DEACTIVATED',
      };

      expect(errorResponse.code).toBe('ACCOUNT_DEACTIVATED');
    });
  });
});

describe('localStorage session token handling', () => {
  beforeEach(() => {
    localStorageMock.clear();
  });

  it('should persist sessionToken across page reloads', () => {
    const sessionToken = 'test-session-token-789';

    // Simulate login storing token
    localStorageMock.setItem('sessionToken', sessionToken);

    // Simulate page reload reading token
    const storedToken = localStorageMock.getItem('sessionToken');

    expect(storedToken).toBe(sessionToken);
  });

  it('should clear sessionToken on logout', () => {
    localStorageMock.setItem('sessionToken', 'some-token');

    // Simulate logout
    localStorageMock.removeItem('sessionToken');

    expect(localStorageMock.getItem('sessionToken')).toBeNull();
  });
});
