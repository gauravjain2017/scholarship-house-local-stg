/**
 * Disputes API Client Tests
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { disputesAPI } from '../api/disputes';

// Mock the api module
vi.mock('../api/api', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

import api from '../api/api';

describe('disputesAPI', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('checkDuplicate', () => {
    it('should send POST request with address data', async () => {
      const mockResponse = {
        data: { isDuplicate: false, normalizedAddress: '123_main_st' },
      };
      api.post.mockResolvedValue(mockResponse);

      const result = await disputesAPI.checkDuplicate({
        streetAddress: '123 Main St',
        city: 'Austin',
        stateRegion: 'TX',
        postalCode: '78701',
      });

      expect(api.post).toHaveBeenCalledWith('/disputes/check-duplicate', {
        streetAddress: '123 Main St',
        city: 'Austin',
        stateRegion: 'TX',
        postalCode: '78701',
      });
      expect(result).toEqual(mockResponse.data);
    });

    it('should return duplicate info when address exists', async () => {
      const mockResponse = {
        data: {
          isDuplicate: true,
          normalizedAddress: '123_main_st',
          existingProperty: {
            id: 'prop-123',
            streetAddress: '123 Main St',
            city: 'Austin',
          },
        },
      };
      api.post.mockResolvedValue(mockResponse);

      const result = await disputesAPI.checkDuplicate({
        streetAddress: '123 Main St',
        city: 'Austin',
        stateRegion: 'TX',
        postalCode: '78701',
      });

      expect(result.isDuplicate).toBe(true);
      expect(result.existingProperty).toBeDefined();
    });
  });

  describe('createDispute', () => {
    it('should send POST request to create a dispute', async () => {
      const mockResponse = {
        data: {
          message: 'Ownership dispute created successfully',
          dispute: { disputeId: 'dispute-123' },
          newPropertyId: 'prop-456',
        },
      };
      api.post.mockResolvedValue(mockResponse);

      const result = await disputesAPI.createDispute({
        existingPropertyId: 'prop-123',
        newPropertyData: { streetAddress: '123 Main St' },
        proofUrl: 'https://example.com/proof.pdf',
        claimsOwnership: true,
      });

      expect(api.post).toHaveBeenCalledWith('/disputes', {
        existingPropertyId: 'prop-123',
        newPropertyData: { streetAddress: '123 Main St' },
        proofUrl: 'https://example.com/proof.pdf',
        claimsOwnership: true,
      });
      expect(result).toEqual(mockResponse.data);
    });
  });

  describe('getMyDisputes', () => {
    it('should fetch user disputes', async () => {
      const mockDisputes = [
        { disputeId: 'dispute-1', status: 'pending_both' },
        { disputeId: 'dispute-2', status: 'resolved' },
      ];
      api.get.mockResolvedValue({ data: mockDisputes });

      const result = await disputesAPI.getMyDisputes();

      expect(api.get).toHaveBeenCalledWith('/disputes/my-disputes');
      expect(result).toEqual(mockDisputes);
      expect(result.length).toBe(2);
    });
  });

  describe('uploadProof', () => {
    it('should upload proof for a dispute', async () => {
      const mockResponse = {
        data: {
          message: 'Proof uploaded successfully',
          dispute: {
            disputeId: 'dispute-123',
            originalProofUrl: 'https://example.com/proof.pdf',
          },
        },
      };
      api.post.mockResolvedValue(mockResponse);

      const result = await disputesAPI.uploadProof(
        'dispute-123',
        'https://example.com/proof.pdf'
      );

      expect(api.post).toHaveBeenCalledWith(
        '/disputes/dispute-123/upload-proof',
        {
          proofUrl: 'https://example.com/proof.pdf',
        }
      );
      expect(result).toEqual(mockResponse.data);
    });
  });

  describe('getAllDisputes', () => {
    it('should fetch all disputes (admin)', async () => {
      const mockDisputes = [
        { disputeId: 'dispute-1' },
        { disputeId: 'dispute-2' },
        { disputeId: 'dispute-3' },
      ];
      api.get.mockResolvedValue({ data: mockDisputes });

      const result = await disputesAPI.getAllDisputes();

      expect(api.get).toHaveBeenCalledWith('/disputes');
      expect(result).toEqual(mockDisputes);
    });
  });

  describe('getDisputeById', () => {
    it('should fetch a single dispute by ID', async () => {
      const mockDispute = {
        disputeId: 'dispute-123',
        status: 'pending_review',
        originalProperty: { id: 'prop-1' },
        newProperty: { id: 'prop-2' },
      };
      api.get.mockResolvedValue({ data: mockDispute });

      const result = await disputesAPI.getDisputeById('dispute-123');

      expect(api.get).toHaveBeenCalledWith('/disputes/dispute-123');
      expect(result).toEqual(mockDispute);
    });
  });

  describe('resolveDispute', () => {
    it('should resolve a dispute with resolution type', async () => {
      const mockResponse = {
        data: {
          message: 'Dispute resolved successfully',
          dispute: {
            disputeId: 'dispute-123',
            status: 'resolved',
            resolution: 'original_owner',
          },
        },
      };
      api.post.mockResolvedValue(mockResponse);

      const result = await disputesAPI.resolveDispute(
        'dispute-123',
        'original_owner',
        'Admin notes'
      );

      expect(api.post).toHaveBeenCalledWith('/disputes/dispute-123/resolve', {
        resolution: 'original_owner',
        adminNotes: 'Admin notes',
      });
      expect(result).toEqual(mockResponse.data);
    });

    it('should resolve a dispute without admin notes', async () => {
      const mockResponse = {
        data: {
          message: 'Dispute resolved successfully',
          dispute: { disputeId: 'dispute-123', status: 'resolved' },
        },
      };
      api.post.mockResolvedValue(mockResponse);

      const result = await disputesAPI.resolveDispute(
        'dispute-123',
        'new_owner'
      );

      expect(api.post).toHaveBeenCalledWith('/disputes/dispute-123/resolve', {
        resolution: 'new_owner',
        adminNotes: null,
      });
      expect(result).toEqual(mockResponse.data);
    });
  });

  describe('autoResolveExpired', () => {
    it('should trigger auto-resolution of expired disputes', async () => {
      const mockResponse = {
        data: {
          message: 'Auto-resolved 2 expired disputes',
          resolutions: [
            { disputeId: 'dispute-1', resolution: 'timeout_original' },
            { disputeId: 'dispute-2', resolution: 'timeout_new' },
          ],
        },
      };
      api.post.mockResolvedValue(mockResponse);

      const result = await disputesAPI.autoResolveExpired();

      expect(api.post).toHaveBeenCalledWith('/disputes/cron/auto-resolve');
      expect(result.resolutions.length).toBe(2);
    });
  });

  describe('sendReminders', () => {
    it('should trigger sending reminder emails', async () => {
      const mockResponse = {
        data: {
          message: 'Sent 3 reminder emails',
          remindersSent: [
            { disputeId: 'dispute-1', email: 'user1@example.com' },
            { disputeId: 'dispute-1', email: 'user2@example.com' },
            { disputeId: 'dispute-2', email: 'user3@example.com' },
          ],
        },
      };
      api.post.mockResolvedValue(mockResponse);

      const result = await disputesAPI.sendReminders();

      expect(api.post).toHaveBeenCalledWith('/disputes/cron/send-reminders');
      expect(result.remindersSent.length).toBe(3);
    });
  });

  describe('error handling', () => {
    it('should propagate API errors', async () => {
      const error = new Error('Network error');
      api.get.mockRejectedValue(error);

      await expect(disputesAPI.getMyDisputes()).rejects.toThrow(
        'Network error'
      );
    });
  });
});
