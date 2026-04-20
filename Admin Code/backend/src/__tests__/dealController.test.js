/**
 * Deal Controller Tests
 * Tests for deal creation with submitterName handling
 */

// Helper function that mirrors the submitterName extraction logic
const extractSubmitterName = (body, submitterLookup) => {
  // Get submitterName from body, trimming empty strings to null
  let submitterName =
    body.submitterFullName?.trim() || body.fullName?.trim() || null;

  // If no submitterName provided, look up from submitter record
  if (!submitterName && submitterLookup) {
    submitterName = submitterLookup.Name || null;
  }

  return submitterName;
};

describe('Deal Controller - submitterName extraction', () => {
  describe('extractSubmitterName', () => {
    it('should use submitterFullName when provided', () => {
      const body = {
        submitterFullName: 'John Smith',
        fullName: 'Jane Doe',
      };

      const result = extractSubmitterName(body, null);
      expect(result).toBe('John Smith');
    });

    it('should fall back to fullName when submitterFullName not provided', () => {
      const body = {
        fullName: 'Jane Doe',
      };

      const result = extractSubmitterName(body, null);
      expect(result).toBe('Jane Doe');
    });

    it('should trim whitespace from submitterFullName', () => {
      const body = {
        submitterFullName: '  John Smith  ',
      };

      const result = extractSubmitterName(body, null);
      expect(result).toBe('John Smith');
    });

    it('should trim whitespace from fullName', () => {
      const body = {
        fullName: '  Jane Doe  ',
      };

      const result = extractSubmitterName(body, null);
      expect(result).toBe('Jane Doe');
    });

    it('should treat empty string as null and use submitter lookup', () => {
      const body = {
        fullName: '',
      };
      const submitterRecord = { Name: 'Database User' };

      const result = extractSubmitterName(body, submitterRecord);
      expect(result).toBe('Database User');
    });

    it('should treat whitespace-only string as null and use submitter lookup', () => {
      const body = {
        fullName: '   ',
      };
      const submitterRecord = { Name: 'Database User' };

      const result = extractSubmitterName(body, submitterRecord);
      expect(result).toBe('Database User');
    });

    it('should return null when no name available anywhere', () => {
      const body = {
        fullName: '',
      };

      const result = extractSubmitterName(body, null);
      expect(result).toBe(null);
    });

    it('should return null when submitter lookup has no Name', () => {
      const body = {
        fullName: '',
      };
      const submitterRecord = { Email: 'user@example.com' }; // No Name field

      const result = extractSubmitterName(body, submitterRecord);
      expect(result).toBe(null);
    });

    it('should prefer body values over submitter lookup', () => {
      const body = {
        fullName: 'Body Name',
      };
      const submitterRecord = { Name: 'Database Name' };

      const result = extractSubmitterName(body, submitterRecord);
      expect(result).toBe('Body Name');
    });

    it('should handle undefined fields gracefully', () => {
      const body = {};

      const result = extractSubmitterName(body, null);
      expect(result).toBe(null);
    });
  });
});
