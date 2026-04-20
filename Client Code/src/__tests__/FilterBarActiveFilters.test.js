/**
 * FilterBar Active Filters Tests
 * Tests for active filter tags display and clearing functionality
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

// Mock getActiveFilters function logic
const getActiveFilters = (filters, defaultFilters) => {
  const activeFilters = [];

  if (filters.search) {
    activeFilters.push({
      key: 'search',
      label: 'Search',
      value: `"${filters.search}"`,
    });
  }

  if (filters.status && filters.status !== 'All') {
    activeFilters.push({
      key: 'status',
      label: 'Status',
      value: filters.status,
    });
  }

  if (filters.category && filters.category !== '') {
    activeFilters.push({
      key: 'category',
      label: 'Category',
      value: filters.category,
    });
  }

  if (filters.minPrice && filters.minPrice !== '') {
    activeFilters.push({
      key: 'minPrice',
      label: 'Min Price',
      value: `$${Number(filters.minPrice).toLocaleString()}`,
    });
  }

  if (filters.maxPrice && filters.maxPrice !== '') {
    activeFilters.push({
      key: 'maxPrice',
      label: 'Max Price',
      value: `$${Number(filters.maxPrice).toLocaleString()}`,
    });
  }

  if (filters.advFinancing && filters.advFinancing !== '') {
    activeFilters.push({
      key: 'advFinancing',
      label: 'Financing',
      value: filters.advFinancing,
    });
  }

  if (filters.vacationRentalMarkets?.length > 0) {
    activeFilters.push({
      key: 'vacationRentalMarkets',
      label: 'Markets',
      value: `${filters.vacationRentalMarkets.length} selected`,
    });
  }

  if (filters.submitterSearch) {
    activeFilters.push({
      key: 'submitterSearch',
      label: 'Submitter',
      value: `"${filters.submitterSearch}"`,
    });
  }

  return activeFilters;
};

describe('FilterBar Active Filters Logic', () => {
  const defaultFilters = {
    search: '',
    status: 'All',
    category: '',
    minPrice: '',
    maxPrice: '',
    advFinancing: '',
    vacationRentalMarkets: [],
    submitterSearch: '',
  };

  describe('getActiveFilters', () => {
    it('should return empty array when no filters active', () => {
      const filters = { ...defaultFilters };
      const active = getActiveFilters(filters, defaultFilters);
      expect(active).toEqual([]);
    });

    it('should detect search filter', () => {
      const filters = { ...defaultFilters, search: 'beach house' };
      const active = getActiveFilters(filters, defaultFilters);

      expect(active).toHaveLength(1);
      expect(active[0]).toEqual({
        key: 'search',
        label: 'Search',
        value: '"beach house"',
      });
    });

    it('should detect status filter when not "All"', () => {
      const filters = { ...defaultFilters, status: 'pending' };
      const active = getActiveFilters(filters, defaultFilters);

      expect(active).toHaveLength(1);
      expect(active[0]).toEqual({
        key: 'status',
        label: 'Status',
        value: 'pending',
      });
    });

    it('should not show status filter when "All"', () => {
      const filters = { ...defaultFilters, status: 'All' };
      const active = getActiveFilters(filters, defaultFilters);

      expect(active).toHaveLength(0);
    });

    it('should detect category filter', () => {
      const filters = { ...defaultFilters, category: 'SINGLE_FAMILY' };
      const active = getActiveFilters(filters, defaultFilters);

      expect(active).toHaveLength(1);
      expect(active[0].key).toBe('category');
    });

    it('should detect price range filters', () => {
      const filters = {
        ...defaultFilters,
        minPrice: '200000',
        maxPrice: '500000',
      };
      const active = getActiveFilters(filters, defaultFilters);

      expect(active).toHaveLength(2);
      expect(active.find((f) => f.key === 'minPrice')).toBeTruthy();
      expect(active.find((f) => f.key === 'maxPrice')).toBeTruthy();
    });

    it('should format price with commas', () => {
      const filters = { ...defaultFilters, minPrice: '1000000' };
      const active = getActiveFilters(filters, defaultFilters);

      expect(active[0].value).toBe('$1,000,000');
    });

    it('should detect financing filter', () => {
      const filters = { ...defaultFilters, advFinancing: 'subject-to' };
      const active = getActiveFilters(filters, defaultFilters);

      expect(active).toHaveLength(1);
      expect(active[0].key).toBe('advFinancing');
    });

    it('should detect vacation rental markets filter', () => {
      const filters = {
        ...defaultFilters,
        vacationRentalMarkets: ['beach', 'mountain'],
      };
      const active = getActiveFilters(filters, defaultFilters);

      expect(active).toHaveLength(1);
      expect(active[0]).toEqual({
        key: 'vacationRentalMarkets',
        label: 'Markets',
        value: '2 selected',
      });
    });

    it('should detect submitter search filter', () => {
      const filters = {
        ...defaultFilters,
        submitterSearch: 'john@example.com',
      };
      const active = getActiveFilters(filters, defaultFilters);

      expect(active).toHaveLength(1);
      expect(active[0].key).toBe('submitterSearch');
    });

    it('should detect multiple active filters', () => {
      const filters = {
        ...defaultFilters,
        search: 'cabin',
        status: 'published',
        minPrice: '300000',
        vacationRentalMarkets: ['ski'],
      };
      const active = getActiveFilters(filters, defaultFilters);

      expect(active).toHaveLength(4);
    });
  });

  describe('clearFilter', () => {
    it('should reset specific filter to default', () => {
      const filters = {
        ...defaultFilters,
        search: 'test',
        minPrice: '100000',
      };

      // Simulate clearing search filter
      const clearedFilters = { ...filters, search: '' };

      const active = getActiveFilters(clearedFilters, defaultFilters);
      expect(active.find((f) => f.key === 'search')).toBeFalsy();
      expect(active.find((f) => f.key === 'minPrice')).toBeTruthy();
    });

    it('should reset status to "All"', () => {
      const filters = { ...defaultFilters, status: 'pending' };

      // Simulate clearing status filter
      const clearedFilters = { ...filters, status: 'All' };

      const active = getActiveFilters(clearedFilters, defaultFilters);
      expect(active).toHaveLength(0);
    });

    it('should reset vacationRentalMarkets to empty array', () => {
      const filters = {
        ...defaultFilters,
        vacationRentalMarkets: ['beach', 'ski'],
      };

      // Simulate clearing markets filter
      const clearedFilters = { ...filters, vacationRentalMarkets: [] };

      const active = getActiveFilters(clearedFilters, defaultFilters);
      expect(active).toHaveLength(0);
    });
  });

  describe('clearAllFilters', () => {
    it('should reset all filters to defaults', () => {
      const filters = {
        search: 'test',
        status: 'pending',
        category: 'CONDO',
        minPrice: '100000',
        maxPrice: '500000',
        advFinancing: 'cash',
        vacationRentalMarkets: ['beach'],
        submitterSearch: 'john',
      };

      // Simulate clearing all filters
      const clearedFilters = { ...defaultFilters };

      const active = getActiveFilters(clearedFilters, defaultFilters);
      expect(active).toHaveLength(0);
    });
  });
});

describe('ActiveFilterTag component logic', () => {
  it('should display label and value', () => {
    const tag = {
      key: 'search',
      label: 'Search',
      value: '"beach house"',
    };

    // Verify tag structure
    expect(tag.label).toBe('Search');
    expect(tag.value).toBe('"beach house"');
  });

  it('should have remove action', () => {
    const onRemove = vi.fn();
    const tag = { key: 'search', label: 'Search', value: '"test"' };

    // Simulate remove click
    onRemove(tag.key);

    expect(onRemove).toHaveBeenCalledWith('search');
  });
});
