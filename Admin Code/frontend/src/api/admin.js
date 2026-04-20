import api from './api';

export const getAdminUsers = (params = {}) =>
  api.get('/admin/users', { params });

export const updateAdminUser = (email, updates) =>
  api.patch(`/admin/users/${encodeURIComponent(email)}`, updates);

export const getAdminUser = (token) =>
   api.get(`/admin/user/${token}`);
