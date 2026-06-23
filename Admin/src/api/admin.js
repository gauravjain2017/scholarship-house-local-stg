/**
 * Admin API client
 *
 * Thin wrappers around the /admin/* REST endpoints used by the
 * User Management dashboard.
 */
import api from './api';

/** List all users (supports optional query params for future filtering). */
export const getAdminUsers = (params = {}) =>
  api.get('/admin/users', { params });


/** Get a single user by (base64-encoded) email token. */
export const getAdminUser = (token) =>
  api.get(`/admin/user/${token}`);

/** Create a new user (used by the "Add User" modal). */
export const createAdminUser = (payload) =>
  api.post('/admin/users', payload);

/** Update an existing user (used by "Edit User" and activate/deactivate). */
export const updateAdminUser = (email, updates) =>
  api.patch(`/admin/users/${encodeURIComponent(email)}`, updates);

/** Permanently delete a user. */
export const deleteAdminUser = (email) =>
  api.delete(`/admin/users/${encodeURIComponent(email)}`);

/** Update a pending/rejected registration record. */
export const updateRegistration = (email, updates) =>
  api.patch(`/admin/registrations/${encodeURIComponent(email)}`, updates);

/** Create New Role */
export const createRole = (payload) => 
  api.post('/admin/create-role',payload);

/** Fetch All Roles */
export const getRoles = (params = {}) =>
  api.get('/admin/roles', { params });

/** Delete a role by ID */
export const deleteRole = (roleId) =>
  api.delete(`/admin/role/${roleId}`);

/** Fetch roles filtered by portal type (public endpoint under /auth/public-roles). */
export const getPublicRoles = (params = {}) =>
  api.get('/auth/public-roles', { params });
