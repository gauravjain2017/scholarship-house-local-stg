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

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const logout = getLogoutHandler();
    const status = error.response?.status;
    const code = error.response?.data?.code;

    // If the backend signals that the session is invalid, force logout + redirect
    if (logout && code === 'SESSION_INVALIDATED') {
      logout(
        'Your session has expired. You may have logged in from another device.'
      );
    } else if (logout && status === 401) {
      // Generic unauthorized -> logout to avoid leaving user on a broken page
      logout();
    }

    return Promise.reject(error);
  }
);

export default api;
