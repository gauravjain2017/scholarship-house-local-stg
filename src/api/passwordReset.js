import apiClient from './client';

/**
 * Password Reset API Client
 * Handles all password reset related API calls
 */

/**
 * Request a password reset email (user-initiated)
 * @param {string} email - User's email address
 */
export const requestPasswordReset = async (email) => {
  const { data } = await apiClient.post('/password/request-reset', { email });
  return data;
};

/**
 * Validate a password reset token
 * @param {string} token - Reset token from URL
 */
export const validateResetToken = async (token) => {
  const { data } = await apiClient.get(`/password/validate-token/${token}`);
  return data;
};

/**
 * Reset password with token
 * @param {string} token - Reset token
 * @param {string} newPassword - New password
 */
export const resetPassword = async (token, newPassword) => {
  const { data } = await apiClient.post('/password/reset', {
    token,
    newPassword,
  });
  return data;
};

/**
 * Admin: Trigger password reset email for a user
 * @param {string} email - User's email address
 */
export const adminTriggerPasswordReset = async (email) => {
  const { data } = await apiClient.post('/admin/trigger-password-reset', {
    email,
  });
  return data;
};

/**
 * Admin: Set a temporary password for a user
 * @param {string} email - User's email address
 */
export const adminSetTemporaryPassword = async (email) => {
  const { data } = await apiClient.post('/admin/set-temporary-password', {
    email,
  });
  return data;
};

export const passwordResetAPI = {
  requestPasswordReset,
  validateResetToken,
  resetPassword,
  adminTriggerPasswordReset,
  adminSetTemporaryPassword,
};

export default passwordResetAPI;
