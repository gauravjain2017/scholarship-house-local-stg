import axios from 'axios';
import { getLogoutHandler } from '../contexts/authEvents';

const api = axios.create({
  baseURL: '/api',
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  // Send session token for single-session validation
  const sessionToken = localStorage.getItem('sessionToken');
  if (sessionToken) {
    config.headers['x-session-token'] = sessionToken;
  }

  return config;
});

// Track if we're already logging out to prevent multiple simultaneous logouts
let isLoggingOut = false;

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const logout = getLogoutHandler();
    const status = error.response?.status;
    const code = error.response?.data?.code;

    // Skip logout if no response (network error / timeout) - don't logout on transient failures
    if (!error.response) {
      return Promise.reject(error);
    }

    // Skip if already logging out
    if (isLoggingOut) {
      return Promise.reject(error);
    }

    // If the backend signals that the session is invalid, force logout + redirect
    if (logout && code === 'SESSION_INVALIDATED') {
      isLoggingOut = true;
      logout(
        'Your session has expired. You may have logged in from another device.'
      ).finally(() => { isLoggingOut = false; });
    } else if (logout && status === 429) {
      // Too many requests - force logout to stop further API abuse
      isLoggingOut = true;
      logout(
        'Too many requests from your IP address. Please try again later.'
      ).finally(() => { isLoggingOut = false; });
    } else if (logout && status === 401) {
      // Only logout on 401 if we actually have a token (means it's expired/invalid)
      const token = localStorage.getItem('token') || localStorage.getItem('sessionToken');
      if (token) {
        isLoggingOut = true;
        logout().finally(() => { isLoggingOut = false; });
      }
    }

    return Promise.reject(error);
  }
);

export default api;
