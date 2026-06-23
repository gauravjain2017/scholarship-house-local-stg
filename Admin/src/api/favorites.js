/**
 * Favorites API
 *
 * User-specific property favorites
 */

import api from './api';

/**
 * Get all favorited property IDs for the current user
 * GET /api/favorites
 */
export const getFavorites = async () => {
  const res = await api.get('/favorites');
  return res.data.favorites || [];
};

/**
 * Add a favorite
 * POST /api/favorites/:propertyId
 */
export const addFavorite = async (propertyId) => {
  if (!propertyId) throw new Error('propertyId is required');
  await api.post(`/favorites/${propertyId}`);
};

/**
 * Remove a favorite
 * DELETE /api/favorites/:propertyId
 */
export const removeFavorite = async (propertyId) => {
  if (!propertyId) throw new Error('propertyId is required');
  await api.delete(`/favorites/${propertyId}`);
};
