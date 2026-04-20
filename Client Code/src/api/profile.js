import api from './api';

/** Fetch the current user's full profile */
export const getProfile = () => api.get('/profile/me');

/**
 * Check whether an email is available (i.e. not used by any other account).
 * Returns { available: boolean }.
 */
export const checkEmail = (email) =>
  api.get('/profile/check-email', { params: { email } });

/**
 * Update the current user's profile.
 * Pass { firstName, lastName, phone, email, address? }.
 */
export const updateProfile = (payload) =>
  api.put('/profile/update', payload);

/** Change the current user's password */
export const changePassword = (payload) =>
  api.post('/profile/change-password', payload);
