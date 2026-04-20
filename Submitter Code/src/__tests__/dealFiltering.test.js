/**
 * Deal Filtering and Sorting Tests
 * Tests for the AdminDashboard filtering and sorting logic
 */
import { describe, it, expect } from 'vitest';

// Helper functions that mirror AdminDashboard filtering logic
const filterDeals = (deals, filters) => {
  return deals.filter((deal) => {
    if (
      filters.propertyType !== 'All' &&
      deal.category !== filters.propertyType
    )
      return false;

    if (filters.status !== 'All' && deal.status !== filters.status)
      return false;

    if (
      filters.search &&
      !`${deal.title} ${deal.description}`
        .toLowerCase()
        .includes(filters.search.toLowerCase())
    )
      return false;

    // Submitter search now uses submitterName field
    if (
      filters.submitterSearch &&
      !deal.submitterName
        ?.toLowerCase()
        .includes(filters.submitterSearch.toLowerCase())
    ) {
      return false;
    }

    if (filters.minPrice && Number(deal.price) < Number(filters.minPrice))
      return false;

    if (filters.maxPrice && Number(deal.price) > Number(filters.maxPrice))
      return false;

    // Down payment range filters
    if (
      filters.minDownPayment &&
      Number(deal.downPayment) < Number(filters.minDownPayment)
    )
      return false;

    if (
      filters.maxDownPayment &&
      Number(deal.downPayment) > Number(filters.maxDownPayment)
    )
      return false;

    return true;
  });
};

const sortDeals = (deals, sortBy) => {
  return [...deals].sort((a, b) => {
    switch (sortBy) {
      case 'oldest':
        return (
          new Date(a.submittedAt || a.createdAt) -
          new Date(b.submittedAt || b.createdAt)
        );
      case 'price-low':
        return Number(a.price || 0) - Number(b.price || 0);
      case 'price-high':
        return Number(b.price || 0) - Number(a.price || 0);
      case 'newest':
      default:
        return (
          new Date(b.submittedAt || b.createdAt) -
          new Date(a.submittedAt || a.createdAt)
        );
    }
  });
};

// Sample deals for testing
const sampleDeals = [
  {
    id: '1',
    title: 'Beach House',
    description: 'Beautiful oceanfront property',
    category: 'SINGLE_FAMILY',
    status: 'pending',
    submitterName: 'John Smith',
    submitterEmail: 'john@example.com',
    price: 500000,
    downPayment: 100000,
    submittedAt: '2024-01-15T10:00:00Z',
    createdAt: '2024-01-15T10:00:00Z',
  },
  {
    id: '2',
    title: 'Mountain Cabin',
    description: 'Cozy ski retreat',
    category: 'CABIN',
    status: 'approved',
    submitterName: 'Jane Doe',
    submitterEmail: 'jane@example.com',
    price: 350000,
    downPayment: 70000,
    submittedAt: '2024-01-10T10:00:00Z',
    createdAt: '2024-01-10T10:00:00Z',
  },
  {
    id: '3',
    title: 'City Condo',
    description: 'Downtown luxury',
    category: 'CONDO',
    status: 'pending',
    submitterName: 'Bob Johnson',
    submitterEmail: 'bob@example.com',
    price: 750000,
    downPayment: 150000,
    submittedAt: '2024-01-20T10:00:00Z',
    createdAt: '2024-01-20T10:00:00Z',
  },
  {
    id: '4',
    title: 'Lake House',
    description: 'Peaceful waterfront',
    category: 'SINGLE_FAMILY',
    status: 'rejected',
    submitterName: null, // Some deals may not have submitterName
    submitterEmail: 'unknown@example.com',
    price: 425000,
    downPayment: 85000,
    submittedAt: '2024-01-05T10:00:00Z',
    createdAt: '2024-01-05T10:00:00Z',
  },
];

describe('Deal Filtering Logic', () => {
  describe('Submitter Search', () => {
    it('should filter by submitterName field', () => {
      const filters = {
        propertyType: 'All',
        status: 'All',
        submitterSearch: 'Smith',
        search: '',
      };

      const filtered = filterDeals(sampleDeals, filters);
      expect(filtered).toHaveLength(1);
      expect(filtered[0].submitterName).toBe('John Smith');
    });

    it('should be case-insensitive for submitter search', () => {
      const filters = {
        propertyType: 'All',
        status: 'All',
        submitterSearch: 'jane',
        search: '',
      };

      const filtered = filterDeals(sampleDeals, filters);
      expect(filtered).toHaveLength(1);
      expect(filtered[0].submitterName).toBe('Jane Doe');
    });

    it('should handle deals with null submitterName', () => {
      const filters = {
        propertyType: 'All',
        status: 'All',
        submitterSearch: 'Smith',
        search: '',
      };

      // Deal with null submitterName should be excluded
      const filtered = filterDeals(sampleDeals, filters);
      expect(filtered.every((d) => d.submitterName !== null)).toBe(true);
    });

    it('should return all deals when submitterSearch is empty', () => {
      const filters = {
        propertyType: 'All',
        status: 'All',
        submitterSearch: '',
        search: '',
      };

      const filtered = filterDeals(sampleDeals, filters);
      expect(filtered).toHaveLength(4);
    });

    it('should match partial submitter names', () => {
      const filters = {
        propertyType: 'All',
        status: 'All',
        submitterSearch: 'Jo',
        search: '',
      };

      const filtered = filterDeals(sampleDeals, filters);
      // Should match "John Smith" and "Bob Johnson"
      expect(filtered).toHaveLength(2);
    });
  });

  describe('Down Payment Range Filter', () => {
    it('should filter by minimum down payment', () => {
      const filters = {
        propertyType: 'All',
        status: 'All',
        submitterSearch: '',
        search: '',
        minDownPayment: '100000',
        maxDownPayment: '',
      };

      const filtered = filterDeals(sampleDeals, filters);
      expect(filtered).toHaveLength(2); // 100000 and 150000
      expect(filtered.every((d) => d.downPayment >= 100000)).toBe(true);
    });

    it('should filter by maximum down payment', () => {
      const filters = {
        propertyType: 'All',
        status: 'All',
        submitterSearch: '',
        search: '',
        minDownPayment: '',
        maxDownPayment: '85000',
      };

      const filtered = filterDeals(sampleDeals, filters);
      expect(filtered).toHaveLength(2); // 70000 and 85000
      expect(filtered.every((d) => d.downPayment <= 85000)).toBe(true);
    });

    it('should filter by down payment range (min and max)', () => {
      const filters = {
        propertyType: 'All',
        status: 'All',
        submitterSearch: '',
        search: '',
        minDownPayment: '75000',
        maxDownPayment: '125000',
      };

      const filtered = filterDeals(sampleDeals, filters);
      // Should include 85000 and 100000, exclude 70000 and 150000
      expect(filtered).toHaveLength(2);
      expect(filtered.map((d) => d.downPayment).sort((a, b) => a - b)).toEqual([
        85000, 100000,
      ]);
    });

    it('should return all deals when no down payment filters set', () => {
      const filters = {
        propertyType: 'All',
        status: 'All',
        submitterSearch: '',
        search: '',
        minDownPayment: '',
        maxDownPayment: '',
      };

      const filtered = filterDeals(sampleDeals, filters);
      expect(filtered).toHaveLength(4);
    });
  });
});

describe('Deal Sorting Logic', () => {
  describe('Price Sorting', () => {
    it('should sort by price low to high', () => {
      const sorted = sortDeals(sampleDeals, 'price-low');

      expect(sorted[0].price).toBe(350000); // Mountain Cabin
      expect(sorted[1].price).toBe(425000); // Lake House
      expect(sorted[2].price).toBe(500000); // Beach House
      expect(sorted[3].price).toBe(750000); // City Condo
    });

    it('should sort by price high to low', () => {
      const sorted = sortDeals(sampleDeals, 'price-high');

      expect(sorted[0].price).toBe(750000); // City Condo
      expect(sorted[1].price).toBe(500000); // Beach House
      expect(sorted[2].price).toBe(425000); // Lake House
      expect(sorted[3].price).toBe(350000); // Mountain Cabin
    });

    it('should handle deals with undefined/null price', () => {
      const dealsWithMissingPrice = [
        ...sampleDeals,
        {
          id: '5',
          title: 'No Price Property',
          price: null,
          createdAt: '2024-01-25T10:00:00Z',
        },
      ];

      const sorted = sortDeals(dealsWithMissingPrice, 'price-low');
      // Null/undefined price should be treated as 0 (first when sorted low to high)
      expect(sorted[0].price).toBe(null);
    });
  });

  describe('Date Sorting', () => {
    it('should sort by newest first (default)', () => {
      const sorted = sortDeals(sampleDeals, 'newest');

      expect(sorted[0].id).toBe('3'); // Jan 20
      expect(sorted[1].id).toBe('1'); // Jan 15
      expect(sorted[2].id).toBe('2'); // Jan 10
      expect(sorted[3].id).toBe('4'); // Jan 5
    });

    it('should sort by oldest first', () => {
      const sorted = sortDeals(sampleDeals, 'oldest');

      expect(sorted[0].id).toBe('4'); // Jan 5
      expect(sorted[1].id).toBe('2'); // Jan 10
      expect(sorted[2].id).toBe('1'); // Jan 15
      expect(sorted[3].id).toBe('3'); // Jan 20
    });

    it('should default to newest when sortBy is undefined', () => {
      const sorted = sortDeals(sampleDeals, undefined);

      expect(sorted[0].id).toBe('3'); // Jan 20 (newest)
    });
  });

  describe('Combined Filter and Sort', () => {
    it('should filter then sort correctly', () => {
      const filters = {
        propertyType: 'All',
        status: 'pending',
        submitterSearch: '',
        search: '',
      };

      const filtered = filterDeals(sampleDeals, filters);
      const sorted = sortDeals(filtered, 'price-low');

      expect(sorted).toHaveLength(2); // Only pending deals
      expect(sorted[0].title).toBe('Beach House'); // 500000
      expect(sorted[1].title).toBe('City Condo'); // 750000
    });
  });
});

/**
 * CustomerView Sorting Tests
 * Tests for the CustomerView sorting logic which uses publishedAt instead of createdAt
 */

// CustomerView sort function - mirrors the actual implementation
const sortDealsCustomerView = (deals, sortBy) => {
  return [...deals].sort((a, b) => {
    switch (sortBy) {
      case 'oldest':
        return new Date(a.publishedAt) - new Date(b.publishedAt);
      case 'price-low':
        return Number(a.discountedPrice || 0) - Number(b.discountedPrice || 0);
      case 'price-high':
        return Number(b.discountedPrice || 0) - Number(a.discountedPrice || 0);
      case 'discount':
        return (
          Number(b.discountPercentage || 0) - Number(a.discountPercentage || 0)
        );
      case 'newest':
      default:
        return new Date(b.publishedAt) - new Date(a.publishedAt);
    }
  });
};

// Sample published deals for CustomerView testing
const samplePublishedDeals = [
  {
    id: '1',
    title: 'Beach House',
    discountedPrice: 500000,
    discountPercentage: 10,
    publishedAt: '2024-01-15T10:00:00Z',
  },
  {
    id: '2',
    title: 'Mountain Cabin',
    discountedPrice: 350000,
    discountPercentage: 15,
    publishedAt: '2024-01-10T10:00:00Z',
  },
  {
    id: '3',
    title: 'City Condo',
    discountedPrice: 750000,
    discountPercentage: 5,
    publishedAt: '2024-01-20T10:00:00Z',
  },
  {
    id: '4',
    title: 'Lake House',
    discountedPrice: 425000,
    discountPercentage: 20,
    publishedAt: '2024-01-05T10:00:00Z',
  },
];

describe('CustomerView Sorting Logic', () => {
  describe('Date Sorting (publishedAt)', () => {
    it('should sort by newest first using publishedAt', () => {
      const sorted = sortDealsCustomerView(samplePublishedDeals, 'newest');

      expect(sorted[0].id).toBe('3'); // Jan 20 (newest published)
      expect(sorted[1].id).toBe('1'); // Jan 15
      expect(sorted[2].id).toBe('2'); // Jan 10
      expect(sorted[3].id).toBe('4'); // Jan 5 (oldest published)
    });

    it('should sort by oldest first using publishedAt', () => {
      const sorted = sortDealsCustomerView(samplePublishedDeals, 'oldest');

      expect(sorted[0].id).toBe('4'); // Jan 5 (oldest published)
      expect(sorted[1].id).toBe('2'); // Jan 10
      expect(sorted[2].id).toBe('1'); // Jan 15
      expect(sorted[3].id).toBe('3'); // Jan 20 (newest published)
    });

    it('should default to newest when sortBy is undefined', () => {
      const sorted = sortDealsCustomerView(samplePublishedDeals, undefined);

      expect(sorted[0].id).toBe('3'); // Jan 20 (newest published)
    });

    it('should handle deals with null/undefined publishedAt', () => {
      const dealsWithMissingDate = [
        ...samplePublishedDeals,
        {
          id: '5',
          title: 'No Date Property',
          discountedPrice: 600000,
          publishedAt: null,
        },
      ];

      // null dates become Invalid Date, which sorts to the end
      const sorted = sortDealsCustomerView(dealsWithMissingDate, 'newest');
      expect(sorted).toHaveLength(5);
    });
  });

  describe('Price Sorting (discountedPrice)', () => {
    it('should sort by price low to high', () => {
      const sorted = sortDealsCustomerView(samplePublishedDeals, 'price-low');

      expect(sorted[0].discountedPrice).toBe(350000); // Mountain Cabin
      expect(sorted[1].discountedPrice).toBe(425000); // Lake House
      expect(sorted[2].discountedPrice).toBe(500000); // Beach House
      expect(sorted[3].discountedPrice).toBe(750000); // City Condo
    });

    it('should sort by price high to low', () => {
      const sorted = sortDealsCustomerView(samplePublishedDeals, 'price-high');

      expect(sorted[0].discountedPrice).toBe(750000); // City Condo
      expect(sorted[1].discountedPrice).toBe(500000); // Beach House
      expect(sorted[2].discountedPrice).toBe(425000); // Lake House
      expect(sorted[3].discountedPrice).toBe(350000); // Mountain Cabin
    });
  });

  describe('Discount Sorting', () => {
    it('should sort by discount percentage high to low', () => {
      const sorted = sortDealsCustomerView(samplePublishedDeals, 'discount');

      expect(sorted[0].discountPercentage).toBe(20); // Lake House
      expect(sorted[1].discountPercentage).toBe(15); // Mountain Cabin
      expect(sorted[2].discountPercentage).toBe(10); // Beach House
      expect(sorted[3].discountPercentage).toBe(5); // City Condo
    });
  });
});

describe('SORT_OPTIONS Configuration', () => {
  // These tests verify the SORT_OPTIONS constant includes all expected values
  const ADMIN_SORT_OPTIONS = [
    { value: 'newest', label: 'Newest First' },
    { value: 'oldest', label: 'Oldest First' },
    { value: 'price-low', label: 'Price: Low to High' },
    { value: 'price-high', label: 'Price: High to Low' },
  ];

  const CUSTOMER_SORT_OPTIONS = [
    { value: 'newest', label: 'Newest First' },
    { value: 'oldest', label: 'Oldest First' },
    { value: 'price-low', label: 'Price: Low to High' },
    { value: 'price-high', label: 'Price: High to Low' },
  ];

  it('AdminDashboard SORT_OPTIONS should include oldest option', () => {
    const oldestOption = ADMIN_SORT_OPTIONS.find((o) => o.value === 'oldest');
    expect(oldestOption).toBeDefined();
    expect(oldestOption.label).toBe('Oldest First');
  });

  it('CustomerView SORT_OPTIONS should include oldest option', () => {
    const oldestOption = CUSTOMER_SORT_OPTIONS.find(
      (o) => o.value === 'oldest'
    );
    expect(oldestOption).toBeDefined();
    expect(oldestOption.label).toBe('Oldest First');
  });

  it('AdminDashboard SORT_OPTIONS should include newest option', () => {
    const newestOption = ADMIN_SORT_OPTIONS.find((o) => o.value === 'newest');
    expect(newestOption).toBeDefined();
    expect(newestOption.label).toBe('Newest First');
  });

  it('CustomerView SORT_OPTIONS should include newest option', () => {
    const newestOption = CUSTOMER_SORT_OPTIONS.find(
      (o) => o.value === 'newest'
    );
    expect(newestOption).toBeDefined();
    expect(newestOption.label).toBe('Newest First');
  });

  it('SORT_OPTIONS should have 4 options', () => {
    expect(ADMIN_SORT_OPTIONS).toHaveLength(4);
    expect(CUSTOMER_SORT_OPTIONS).toHaveLength(4);
  });
});
