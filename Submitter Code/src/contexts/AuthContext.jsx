import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { authAPI } from '../api/auth';
import { setLogoutHandler } from './authEvents';
import { getCanonicalRole } from '../utils/roles';
import { getPermissionsForRole } from '../utils/permissions';

const AuthContext = createContext(null);

// Only these roles are permitted to log in to the submitter portal.
// Any user whose role is not in this list will be rejected and no
// session will be created for them.
const ALLOWED_ROLES = ['submitter'];

/* -------------------- hooks -------------------- */

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};

export const useAuthSafe = () =>
  useContext(AuthContext) ?? { user: null, isAuthenticated: false };

/* -------------------- helpers -------------------- */

function normalizeAuthUser(rawUser) {
  const canonicalRole = getCanonicalRole(
    rawUser.userType ?? rawUser.role ?? rawUser.access
  );

  return {
    user: {
      ...rawUser,
      role: canonicalRole,
      isSubmitter: canonicalRole === 'submitter',
    },
    permissions: getPermissionsForRole(canonicalRole),
  };
}

/* -------------------- provider -------------------- */

export const AuthProvider = ({ children }) => {
  const queryClient = useQueryClient();

  const [user, setUser] = useState(null);
  const [permissions, setPermissions] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [sessionToken, setSessionToken] = useState(
    localStorage.getItem('sessionToken')
  );
  const [loading, setLoading] = useState(true);
  const [sessionError, setSessionError] = useState(null); // For session invalidation messages

  /* -------------------- logout -------------------- */

  const logout = useCallback(
    async (message = null) => {
      // Try to invalidate session on server (don't wait or fail on errors)
      try {
        await authAPI.submitterLogout();
      } catch {
        // Ignore errors - we still want to clear local state
      }

      localStorage.removeItem('token');
      localStorage.removeItem('sessionToken');
      localStorage.removeItem('submitterUser');

      queryClient.clear();

      setToken(null);
      setSessionToken(null);
      setUser(null);
      setPermissions(null);

      // Set session error message if provided (e.g., for session invalidation)
      if (message) {
        setSessionError(message);
        // Persist message for login page (state is lost on redirect)
        sessionStorage.setItem('sessionExpiredMessage', message);
      }

      // Always redirect to login so user is not left on current page
      window.location.replace('/auth/login');
    },
    [queryClient]
  );

  // Expose logout for global handlers (e.g., API interceptors)
  useEffect(() => {
    setLogoutHandler(logout);
  }, [logout]);

  // Clear session error after it's been displayed
  const clearSessionError = useCallback(() => {
    setSessionError(null);
  }, []);

  /* -------------------- bootstrap -------------------- */

  useEffect(() => {
    const bootstrap = async () => {
      try {
        // No JWT session: try to restore from localStorage
        if (!token) {
          const stored = localStorage.getItem('submitterUser');
          const storedSessionToken = localStorage.getItem('sessionToken');
          if (stored) {
            const parsed = JSON.parse(stored);
            const normalized = normalizeAuthUser(parsed);

            // Defensive: if the stored user is not an allowed role
            // (e.g. a client/admin session left over in the same browser),
            // do NOT restore it. Clear it so nothing leaks into the app.
            if (!ALLOWED_ROLES.includes(normalized.user.role)) {
              localStorage.removeItem('submitterUser');
              localStorage.removeItem('sessionToken');
              return;
            }

            setUser(normalized.user);
            setPermissions(normalized.permissions);
            if (storedSessionToken) {
              setSessionToken(storedSessionToken);
            }
          }
          return;
        }

        // Token-based session
        const response = await authAPI.getProfile();
        const apiUser = response?.user ?? response;

        if (!apiUser?.email) {
          logout();
          return;
        }

        const normalized = normalizeAuthUser(apiUser);

        // Defensive: server returned a profile whose role is not allowed
        // in the submitter portal. Tear down the session immediately.
        if (!ALLOWED_ROLES.includes(normalized.user.role)) {
          logout();
          return;
        }

        setUser(normalized.user);
        setPermissions(normalized.permissions);
      } catch (err) {
        console.log(err);
        // Handle session invalidation
        if (err.response?.data?.code === 'SESSION_INVALIDATED') {
          logout(
            'Your session has expired. You may have logged in from another device.'
          );
          return;
        }
        if (err.response?.status === 401) logout();
      } finally {
        setLoading(false);
      }
    };

    bootstrap();
  }, [token, logout]);

  /* -------------------- auth actions -------------------- */

  const login = async (email, password) => {
    const response = await authAPI.login(email, password);

    localStorage.setItem('token', response.token);
    setToken(response.token);

    const normalized = normalizeAuthUser(response.user);
    setUser(normalized.user);
    setPermissions(normalized.permissions);

    return { success: true, user: normalized.user };
  };

  // NOTE: `type` is forwarded to the backend so it can enforce role-based
  // login. In this submitter interface it defaults to 'submitter', which on
  // the backend allows only role "submitter" through. We ALSO re-verify the
  // role on the frontend before creating any session state, so a user with
  // any other role is never signed in here.
  const submitterLogin = async (email, password, type = 'submitter') => {
    try {
      const response = await authAPI.submitterLogin(email, password, type);

      const normalized = normalizeAuthUser(response);

      // Defensive frontend guard: only submitter is allowed here.
      // If the backend lets anything else through, reject it BEFORE we set
      // any user, token, or localStorage state. This guarantees no session
      // is created for a non-submitter user.
      if (!ALLOWED_ROLES.includes(normalized.user.role)) {
        return {
          success: false,
          error:
            'No submitter account found with this email address. Please use a submitter email to sign in.',
          code: 'INVALID_ROLE',
        };
      }

      setUser(normalized.user);
      setPermissions(normalized.permissions);
      setToken(response.token || null);

      // Store session token for single-session enforcement
      if (response.sessionToken) {
        localStorage.setItem('sessionToken', response.sessionToken);
        setSessionToken(response.sessionToken);
      }

      // Store token if provided
      if (response.token) {
        localStorage.setItem('token', response.token);
      }

      localStorage.setItem('submitterUser', JSON.stringify(normalized.user));

      return { success: true, user: normalized.user };
    } catch (err) {
      const errorData = err.response?.data || {};
      return {
        success: false,
        error: errorData.error || err.message || 'Login failed',
        code: errorData.code || null,
      };
    }
  };

  const register = async (payload) => {
    const response = await authAPI.register(payload);

    localStorage.setItem('token', response.token);
    setToken(response.token);

    const normalized = normalizeAuthUser(response.user);
    setUser(normalized.user);
    setPermissions(normalized.permissions);

    return { success: true };
  };

  const submitRegistrationRequest = async (payload) => {
    try {
      await authAPI.submitRegistrationRequest(payload);
      return { success: true };
    } catch (err) {
      return {
        success: false,
        error:
          err.response?.data?.error || err.message || 'Registration failed',
      };
    }
  };

  const updateProfile = async (updates) => {
    const response = await authAPI.updateProfile(updates);

    const normalized = normalizeAuthUser(response.user);
    setUser(normalized.user);
    setPermissions(normalized.permissions);

    return { success: true };
  };

  /* -------------------- helpers -------------------- */

  const can = useCallback(
    (permission) => Boolean(permissions?.[permission]),
    [permissions]
  );

  const hasRole = useCallback((role) => user?.role === role, [user]);

  /* -------------------- context -------------------- */

  const value = {
    user,
    permissions,
    token,
    sessionToken,
    loading,
    isAuthenticated: Boolean(user),
    sessionError, // Error message when session is invalidated

    login,
    submitterLogin,
    register,
    submitRegistrationRequest,
    updateProfile,
    logout,
    clearSessionError, // Clear session error message after displaying

    can,
    hasRole,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
