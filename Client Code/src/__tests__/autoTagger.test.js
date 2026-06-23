/**
 * Auto-Tagger Tests
 * Tests for automatic deal tagging based on price, financing, markets, and properties
 */

const {
  generateAutoTags,
  mergeWithExistingTags,
  getPriceRangeTag,
  getFinancingTags,
  getMarketTags,
  getPropertyTags,
  getSTRMetricTags,
  PRICE_RANGES,
  FINANCING_LABELS,
} = require('../utils/autoTagger');

describe('autoTagger', () => {
  describe('getPriceRangeTag', () => {
    it('should return "Under $200K" for prices below 200000', () => {
      expect(getPriceRangeTag(150000)).toBe('Under $200K');
      expect(getPriceRangeTag(199999)).toBe('Under $200K');
    });

    it('should return "$200K-$300K" for prices in that range', () => {
      expect(getPriceRangeTag(200000)).toBe('$200K-$300K');
      expect(getPriceRangeTag(250000)).toBe('$200K-$300K');
      expect(getPriceRangeTag(299999)).toBe('$200K-$300K');
    });

    it('should return "$500K-$750K" for prices in that range', () => {
      expect(getPriceRangeTag(500000)).toBe('$500K-$750K');
      expect(getPriceRangeTag(600000)).toBe('$500K-$750K');
    });

    it('should return "$1M-$1.5M" for prices in million range', () => {
      expect(getPriceRangeTag(1000000)).toBe('$1M-$1.5M');
      expect(getPriceRangeTag(1250000)).toBe('$1M-$1.5M');
    });

    it('should return "$2M+" for prices above 2 million', () => {
      expect(getPriceRangeTag(2000000)).toBe('$2M+');
      expect(getPriceRangeTag(5000000)).toBe('$2M+');
    });

    it('should return null for invalid prices', () => {
      expect(getPriceRangeTag(null)).toBeNull();
      expect(getPriceRangeTag(undefined)).toBeNull();
      expect(getPriceRangeTag('invalid')).toBeNull();
      expect(getPriceRangeTag(0)).toBeNull();
    });
  });

  describe('getFinancingTags', () => {
    it('should return Traditional Financing tag', () => {
      const tags = getFinancingTags('traditional');
      expect(tags).toContain('Traditional Financing');
      expect(tags).not.toContain('Creative Financing');
    });

    it('should return Subject-To and Creative Financing tags', () => {
      const tags = getFinancingTags('subject-to');
      expect(tags).toContain('Subject-To');
      expect(tags).toContain('Creative Financing');
    });

    it('should return Hybrid Financing and Creative Financing tags', () => {
      const tags = getFinancingTags('hybrid');
      expect(tags).toContain('Hybrid Financing');
      expect(tags).toContain('Creative Financing');
    });

    it('should return Seller Financing and Creative Financing tags', () => {
      const tags = getFinancingTags('seller');
      expect(tags).toContain('Seller Financing');
      expect(tags).toContain('Creative Financing');
    });

    it('should return Cash Deal and No Financing Needed tags', () => {
      const tags = getFinancingTags('cash');
      expect(tags).toContain('Cash Deal');
      expect(tags).toContain('No Financing Needed');
      expect(tags).not.toContain('Creative Financing');
    });

    it('should handle uppercase financing types', () => {
      const tags = getFinancingTags('TRADITIONAL');
      expect(tags).toContain('Traditional Financing');
    });

    it('should return empty array for invalid financing type', () => {
      expect(getFinancingTags(null)).toEqual([]);
      expect(getFinancingTags('')).toEqual([]);
      expect(getFinancingTags('invalid')).toEqual([]);
    });
  });

  describe('getMarketTags', () => {
    it('should convert known market types to tags', () => {
      const tags = getMarketTags(['beach', 'mountain']);
      expect(tags).toContain('Beach Market');
      expect(tags).toContain('Mountain Market');
    });

    it('should format unknown markets with capital case', () => {
      const tags = getMarketTags(['custom_market']);
      expect(tags).toContain('Custom Market');
    });

    it('should handle empty array', () => {
      expect(getMarketTags([])).toEqual([]);
    });

    it('should handle non-array input', () => {
      expect(getMarketTags(null)).toEqual([]);
      expect(getMarketTags(undefined)).toEqual([]);
      expect(getMarketTags('beach')).toEqual([]);
    });

    it('should handle multiple markets', () => {
      const tags = getMarketTags(['beach', 'ski', 'golf', 'national_park']);
      expect(tags).toHaveLength(4);
      expect(tags).toContain('Beach Market');
      expect(tags).toContain('Ski Market');
      expect(tags).toContain('Golf Market');
      expect(tags).toContain('Near National Park');
    });
  });

  describe('getPropertyTags', () => {
    it('should add category tag', () => {
      const deal = { category: 'SINGLE_FAMILY' };
      const tags = getPropertyTags(deal);
      expect(tags).toContain('Single Family');
    });

    it('should add "5+ Bedrooms" tag for large properties', () => {
      const deal = { bedrooms: 6 };
      const tags = getPropertyTags(deal);
      expect(tags).toContain('5+ Bedrooms');
    });

    it('should add "1 Bedroom" tag for studio-like properties', () => {
      const deal = { bedrooms: 1 };
      const tags = getPropertyTags(deal);
      expect(tags).toContain('1 Bedroom');
    });

    it('should not add bedroom tags for 2-4 bedrooms', () => {
      const deal = { bedrooms: 3 };
      const tags = getPropertyTags(deal);
      expect(tags).not.toContain('1 Bedroom');
      expect(tags).not.toContain('5+ Bedrooms');
    });

    it('should add turnkey status tag', () => {
      const deal = { turnkeyFurnished: 'turnkey-operating' };
      const tags = getPropertyTags(deal);
      expect(tags).toContain('Turnkey Operating');
    });

    it('should add HOA tag', () => {
      const deal = { isHOA: true };
      const tags = getPropertyTags(deal);
      expect(tags).toContain('Has HOA');
    });

    it('should add Priority Access tag', () => {
      const deal = { priorityFirstAccess: true };
      const tags = getPropertyTags(deal);
      expect(tags).toContain('Priority Access');
    });

    it('should add 50/50 Partnership tag', () => {
      const deal = { fiftyFiftyPartner: true };
      const tags = getPropertyTags(deal);
      expect(tags).toContain('50/50 Partnership');
    });

    it('should add Done For You tag', () => {
      const deal = { doneForYou: true };
      const tags = getPropertyTags(deal);
      expect(tags).toContain('Done For You');
    });
  });

  describe('getSTRMetricTags', () => {
    it('should add "High Revenue ($100K+)" tag', () => {
      const deal = { strAnnualRevenue: 120000 };
      const tags = getSTRMetricTags(deal);
      expect(tags).toContain('High Revenue ($100K+)');
    });

    it('should add "Strong Revenue ($75K+)" tag', () => {
      const deal = { strAnnualRevenue: 80000 };
      const tags = getSTRMetricTags(deal);
      expect(tags).toContain('Strong Revenue ($75K+)');
      expect(tags).not.toContain('High Revenue ($100K+)');
    });

    it('should add "High Occupancy (70%+)" tag', () => {
      const deal = { strOccupancyRate: 75 };
      const tags = getSTRMetricTags(deal);
      expect(tags).toContain('High Occupancy (70%+)');
    });

    it('should add "High ADR ($300+)" tag', () => {
      const deal = { strAvgDailyRate: 350 };
      const tags = getSTRMetricTags(deal);
      expect(tags).toContain('High ADR ($300+)');
    });

    it('should add "Strong ADR ($200+)" tag', () => {
      const deal = { strAvgDailyRate: 250 };
      const tags = getSTRMetricTags(deal);
      expect(tags).toContain('Strong ADR ($200+)');
      expect(tags).not.toContain('High ADR ($300+)');
    });

    it('should add "Verified STR Data" tag', () => {
      const deal = { strConfidence: 'first-hand' };
      const tags = getSTRMetricTags(deal);
      expect(tags).toContain('Verified STR Data');
    });

    it('should add STR zoning tags', () => {
      const approvedDeal = { strZoning: 'yes' };
      const restrictedDeal = { strZoning: 'no' };

      expect(getSTRMetricTags(approvedDeal)).toContain('STR Zoning Approved');
      expect(getSTRMetricTags(restrictedDeal)).toContain(
        'STR Zoning Restricted'
      );
    });
  });

  describe('generateAutoTags', () => {
    it('should generate all applicable tags for a complete deal', () => {
      const deal = {
        price: 450000,
        financingType: 'subject-to',
        vacationRentalMarkets: ['beach', 'golf'],
        category: 'SINGLE_FAMILY',
        bedrooms: 5,
        turnkeyFurnished: 'turnkey-operating',
        priorityFirstAccess: true,
        strAnnualRevenue: 150000,
        strOccupancyRate: 80,
        strConfidence: 'first-hand',
        strZoning: 'yes',
      };

      const tags = generateAutoTags(deal);

      // Price tag
      expect(tags).toContain('$400K-$500K');

      // Financing tags
      expect(tags).toContain('Subject-To');
      expect(tags).toContain('Creative Financing');

      // Market tags
      expect(tags).toContain('Beach Market');
      expect(tags).toContain('Golf Market');

      // Property tags
      expect(tags).toContain('Single Family');
      expect(tags).toContain('5+ Bedrooms');
      expect(tags).toContain('Turnkey Operating');
      expect(tags).toContain('Priority Access');

      // STR tags
      expect(tags).toContain('High Revenue ($100K+)');
      expect(tags).toContain('High Occupancy (70%+)');
      expect(tags).toContain('Verified STR Data');
      expect(tags).toContain('STR Zoning Approved');
    });

    it('should not have duplicate tags', () => {
      const deal = {
        price: 300000,
        financingType: 'traditional',
      };

      const tags = generateAutoTags(deal);
      const uniqueTags = [...new Set(tags)];

      expect(tags.length).toBe(uniqueTags.length);
    });

    it('should return empty array for null deal', () => {
      expect(generateAutoTags(null)).toEqual([]);
    });

    it('should return empty array for empty deal', () => {
      const tags = generateAutoTags({});
      expect(Array.isArray(tags)).toBe(true);
    });
  });

  describe('mergeWithExistingTags', () => {
    it('should merge auto-tags with existing manual tags', () => {
      const deal = { price: 300000, financingType: 'cash' };
      const existingTags = ['Hot Deal', 'Featured'];

      const merged = mergeWithExistingTags(deal, existingTags);

      // Manual tags should be first
      expect(merged[0]).toBe('Hot Deal');
      expect(merged[1]).toBe('Featured');

      // Auto tags should be added
      expect(merged).toContain('$300K-$400K');
      expect(merged).toContain('Cash Deal');
    });

    it('should not duplicate tags', () => {
      const deal = { price: 300000 };
      const existingTags = ['$300K-$400K']; // Same as auto-generated

      const merged = mergeWithExistingTags(deal, existingTags);
      const count = merged.filter((t) => t === '$300K-$400K').length;

      expect(count).toBe(1);
    });

    it('should handle empty existing tags', () => {
      const deal = { price: 200000 };
      const merged = mergeWithExistingTags(deal, []);

      expect(merged).toContain('$200K-$300K');
    });

    it('should handle null existing tags', () => {
      const deal = { price: 200000 };
      const merged = mergeWithExistingTags(deal, null);

      expect(merged).toContain('$200K-$300K');
    });
  });
});
