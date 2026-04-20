/**
 * Disputes API Client
 *
 * Handles all dispute-related API calls
 */

import api from './api';

export const disputesAPI = {
  /**
   * Check if an address already exists in the system
   */
  checkDuplicate: async ({ streetAddress, city, stateRegion, postalCode }) => {
    const response = await api.post('/disputes/check-duplicate', {
      streetAddress,
      city,
      stateRegion,
      postalCode,
    });
    return response.data;
  },

  /**
   * Create a new ownership dispute
   */
  createDispute: async ({
    existingPropertyId,
    newPropertyData,
    proofUrl,
    claimsOwnership,
  }) => {
    const response = await api.post('/disputes', {
      existingPropertyId,
      newPropertyData,
      proofUrl,
      claimsOwnership,
    });
    return response.data;
  },

  /**
   * Get current user's disputes
   */
  getMyDisputes: async () => {
    const response = await api.get('/disputes/my-disputes');
    return response.data;
  },

  /**
   * Upload proof of ownership for a dispute
   */
  uploadProof: async (disputeId, proofUrl) => {
    const response = await api.post(`/disputes/${disputeId}/upload-proof`, {
      proofUrl,
    });
    return response.data;
  },

  /**
   * Get all disputes (admin only)
   */
  getAllDisputes: async () => {
    const response = await api.get('/disputes');
    return response.data;
  },

  /**
   * Get a single dispute by ID (admin only)
   */
  getDisputeById: async (disputeId) => {
    const response = await api.get(`/disputes/${disputeId}`);
    return response.data;
  },

  /**
   * Resolve a dispute (admin only)
   */
  resolveDispute: async (disputeId, resolution, adminNotes = null) => {
    const response = await api.post(`/disputes/${disputeId}/resolve`, {
      resolution,
      adminNotes,
    });
    return response.data;
  },

  /**
   * Trigger auto-resolution of expired disputes (admin only)
   */
  autoResolveExpired: async () => {
    const response = await api.post('/disputes/cron/auto-resolve');
    return response.data;
  },

  /**
   * Send reminder emails (admin only)
   */
  sendReminders: async () => {
    const response = await api.post('/disputes/cron/send-reminders');
    return response.data;
  },
};

export default disputesAPI;
