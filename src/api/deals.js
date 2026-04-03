import api from './api';
import axios from 'axios';

import { mockDeals } from './mockData';

// Public API instance (no auth headers)
const publicApi = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
});

// Toggle mock mode with VITE_USE_MOCK=true in .env
const USE_MOCK = import.meta.env.VITE_USE_MOCK === 'true';

function normalizeDeal(deal) {
  return deal;
}

// Helper: simulate latency
const delay = (ms = 300) => new Promise((r) => setTimeout(r, ms));

// Helper: filter + sort published deals in mock mode
const filterAndSortPublished = (filters = {}) => {

  let deals = mockDeals.filter((d) => d.status === 'published');

  if (filters.category && filters.category !== 'All') {
    deals = deals.filter((d) => d.category === filters.category);
  }
  if (filters.search) {
    const term = filters.search.toLowerCase();
    deals = deals.filter((d) => d.title.toLowerCase().includes(term));
  }
  if (filters.minPrice) {
    deals = deals.filter(
      (d) => parseFloat(d.discountedPrice) >= parseFloat(filters.minPrice)
    );
  }
  if (filters.maxPrice) {
    deals = deals.filter(
      (d) => parseFloat(d.discountedPrice) <= parseFloat(filters.maxPrice)
    );
  }
  if (filters.minDownPayment) {
    deals = deals.filter(
      (d) => parseFloat(d.downPayment || 0) >= parseFloat(filters.minDownPayment)
    );
  }
  if (filters.maxDownPayment) {
    deals = deals.filter(
      (d) => parseFloat(d.downPayment || 0) <= parseFloat(filters.maxDownPayment)
    );
  }
  if (filters.interestRateMin) {
    deals = deals.filter(
      (d) => parseFloat(d.interestRate || 0) >= parseFloat(filters.interestRateMin)
    );
  }
  if (filters.subjectToInterestRateMax) {
    deals = deals.filter(
      (d) => parseFloat(d.interestRate || 0) <= parseFloat(filters.subjectToInterestRateMax)
    );
  }
  if (filters.advMonthlyPaymentMin) {
    deals = deals.filter(
      (d) => parseFloat(d.totalMonthlyPayment || 0) >= parseFloat(filters.advMonthlyPaymentMin)
    );
  }
  if (filters.advMonthlyPaymentMax) {
    deals = deals.filter(
      (d) => parseFloat(d.totalMonthlyPayment || 0) <= parseFloat(filters.advMonthlyPaymentMax)
    );
  }
  // Sort logic (priority first always)
  deals.sort((a, b) => {
    switch (filters.sortBy) {
      case 'price-low':
        return parseFloat(a.discountedPrice) - parseFloat(b.discountedPrice);
      case 'price-high':
        return parseFloat(b.discountedPrice) - parseFloat(a.discountedPrice);
      case 'discount':
        return (
          parseFloat(b.discountPercentage) - parseFloat(a.discountPercentage)
        );
      case 'newest':
      default:
        return new Date(b.publishedAt) - new Date(a.publishedAt);
    }
  });

  return deals;
};

export const dealsAPI = {
  // Submitter endpoints
  createDeal: async (dealData) => {
    if (USE_MOCK) {
      await delay();
      const mock = {
        ...dealData,
        id: Date.now().toString(),
        status: 'pending',
        submittedAt: new Date().toISOString(),
      };
      mockDeals.push(mock);
      return mock;
    }
    const response = await api.post('/deals', dealData);
    return response.data;
  },

  getMyDeals: async () => {
    const response = await api.get('/deals/my-submissions');
    return response.data;
  },

  // Admin endpoints
  getAllDeals: async (filters = {}) => {
    if (USE_MOCK) {
      await delay();
      return mockDeals.map(normalizeDeal);
    }

    const response = await api.get('/admin/deals', {
      params: filters,
    });

    let deals = [];

    // CASE 1: plain array
    if (Array.isArray(response.data)) {
      deals = response.data;
    }
    // CASE 2: { items: [...] }
    else if (Array.isArray(response.data.items)) {
      deals = response.data.items;
    }
    // CASE 3: Dynamo-style { Items: [...] }
    else if (Array.isArray(response.data.Items)) {
      deals = response.data.Items;
    }
    // CASE 4: serverless-offline { body: "JSON STRING" }
    else if (typeof response.data.body === 'string') {
      deals = JSON.parse(response.data.body);
    }

    return deals.map(normalizeDeal);
  },
  unsubmitDeal: (dealId) => api.post(`/deals/${dealId}/unsubmit`),

  updateDeal: async (dealId, updates) => {
    if (USE_MOCK) {
      await delay();
      const idx = mockDeals.findIndex((d) => d.id === dealId);
      if (idx !== -1) {
        mockDeals[idx] = { ...mockDeals[idx], ...updates };
        return mockDeals[idx];
      }
      throw new Error('Deal not found');
    }
    const response = await api.patch(`/admin/deals/${dealId}`, updates);
    return response.data;
  },

  approveDeal: async (dealId) => {

    if (USE_MOCK) {
      await delay();
      const deal = mockDeals.find((d) => d.id === dealId);
      if (deal) {
        deal.status = 'approved';
        return deal;
      }
      throw new Error('Deal not found');
    }
    const response = await api.post(`/admin/deals/${dealId}/approve`);
    return response.data;
  },

  rejectDeal: async (dealId, reason) => {
    if (USE_MOCK) {
      await delay();
      const deal = mockDeals.find((d) => d.id === dealId);
      if (deal) {
        deal.status = 'rejected';
        deal.rejectionReason = reason;
        return deal;
      }
      throw new Error('Deal not found');
    }
    const response = await api.post(`/admin/deals/${dealId}/reject`, {
      reason,
    });
    return response.data;
  },

  deleteDeal: async (dealId) => {
    if (USE_MOCK) {
      await delay();
      const idx = mockDeals.findIndex((d) => d.id === dealId);
      if (idx !== -1) {
        mockDeals.splice(idx, 1);
        return { success: true };
      }
      throw new Error('Deal not found');
    }

    const response = await api.delete(`/admin/deals/${dealId}`);
    return response.data;
  },

  publishDeal: async (dealId) => {
    if (USE_MOCK) {
      await delay();
      const deal = mockDeals.find((d) => d.id === dealId);
      if (deal) {
        deal.status = 'published';
        deal.publishedAt = new Date().toISOString();
        console.log(
          'Deal published:',
          deal.id,
          deal.title,
          'status:',
          deal.status
        );
        return deal;
      }
      throw new Error('Deal not found');
    }
    const response = await api.post(`/admin/deals/${dealId}/publish`);
    return response.data;
  },

  unpublishDeal: async (dealId) => {
    if (USE_MOCK) {
      await delay();
      const deal = mockDeals.find((d) => d.id === dealId);
      if (deal) {
        deal.status = 'pending';
        deal.publishedAt = null;
        console.log(
          'Deal unpublished:',
          deal.id,
          deal.title,
          'status:',
          deal.status
        );
        return deal;
      }
      throw new Error('Deal not found');
    }
    const response = await api.post(`/admin/deals/${dealId}/unpublish`);
    return response.data;
  },

  // Customer endpoints
  getPublishedDeals: async (filters = {}) => {

    if (USE_MOCK) {
      await delay();
      return filterAndSortPublished(filters).map(normalizeDeal);
    }

    const params = {};

    console.log(USE_MOCK,filters)

    if (filters.search) params.search = filters.search;
    if (filters.status && filters.status !== 'All') {
      params.status = filters.status;
    }
    if (filters.category && filters.category !== 'All') {
      params.category = filters.category;
    }
    if (filters.sortBy) {
      params.sortBy = filters.sortBy;
    }
    if (filters.minPrice) params.minPrice = filters.minPrice;
    if (filters.maxPrice) params.maxPrice = filters.maxPrice;
    if (filters.minDownPayment) params.minDownPayment = filters.minDownPayment;
    if (filters.maxDownPayment) params.maxDownPayment = filters.maxDownPayment;
    if (filters.interestRateMin) params.interestRateMin = filters.interestRateMin;
    if (filters.subjectToInterestRateMax) {
      params.subjectToInterestRateMax = filters.subjectToInterestRateMax;
    }
    if (filters.advMonthlyPaymentMin) params.advMonthlyPaymentMin = filters.advMonthlyPaymentMin;
    if (filters.advMonthlyPaymentMax) params.advMonthlyPaymentMax = filters.advMonthlyPaymentMax;
    // Property Details
    if (filters.advPropertyType) params.advPropertyType = filters.advPropertyType;
    if (filters.advBedroomsMin) params.advBedroomsMin = filters.advBedroomsMin;
    if (filters.advBathroomsMin) params.advBathroomsMin = filters.advBathroomsMin;
    if (filters.advYearBuiltMin) params.advYearBuiltMin = filters.advYearBuiltMin;
    if (filters.advYearBuiltMax) params.advYearBuiltMax = filters.advYearBuiltMax;
    if (filters.advSqftMin) params.advSqftMin = filters.advSqftMin;
    if (filters.advSqftMax) params.advSqftMax = filters.advSqftMax;
    if (filters.selectedStates && filters.selectedStates.length > 0) params.state_regions = filters.selectedStates;
    // ANR & EGR per-tier filters
    ['budget', 'economy', 'midscale', 'upscale', 'luxury'].forEach((tier) => {
      if (filters[`anrMin_${tier}`]) params[`anrMin_${tier}`] = filters[`anrMin_${tier}`];
      if (filters[`anrMax_${tier}`]) params[`anrMax_${tier}`] = filters[`anrMax_${tier}`];
      if (filters[`egrMin_${tier}`]) params[`egrMin_${tier}`] = filters[`egrMin_${tier}`];
      if (filters[`egrMax_${tier}`]) params[`egrMax_${tier}`] = filters[`egrMax_${tier}`];
    });
    // Financing & STR
    if (filters.advFinancing) params.advFinancing = filters.advFinancing;
    if (filters.turnkeyFurnished) params.turnkeyFurnished = filters.turnkeyFurnished;
    if (filters.occupancyRateMin) params.occupancyRateMin = filters.occupancyRateMin;
    if (filters.occupancyRateMax) params.occupancyRateMax = filters.occupancyRateMax;
    // Tax Benefits
    if (filters.incomeReductionMin) params.incomeReductionMin = filters.incomeReductionMin;
    if (filters.incomeReductionMax) params.incomeReductionMax = filters.incomeReductionMax;
    if (filters.taxSavingsMin) params.taxSavingsMin = filters.taxSavingsMin;
    if (filters.taxSavingsMax) params.taxSavingsMax = filters.taxSavingsMax;
    
    const response = await api.get('/deals/published', { params });

    return (response.data || []).map(normalizeDeal);
  },

  getDealById: async (dealId) => {
    if (USE_MOCK) {

      await delay();
      const found = mockDeals.find((d) => d.id === dealId);
      if (!found) throw new Error('Deal not found');
      return normalizeDeal(found);
    }

    const response = await api.get(`/deals/${dealId}`);
    return normalizeDeal(response.data);
  },

  // File upload
  getUploadUrl: async (fileName, fileType) => {
    const response = await api.post('/upload/presigned-url', {
      fileName,
      fileType,
    });
    return response.data;
  },

  uploadToS3: async (presignedUrl, file) => {
    const res = await fetch(presignedUrl, {
      method: 'PUT',
      headers: {
        'Content-Type': file.type,
      },
      body: file,
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`S3 upload failed: ${res.status} ${text}`);
    }
  },

  // Mark property as sold
  markAsSold: async (dealId) => {
    if (USE_MOCK) {
      await delay();
      const deal = mockDeals.find((d) => d.id === dealId);
      if (deal) {
        deal.status = 'sold';
        deal.soldAt = new Date().toISOString();
        deal.soldBy = 'admin@example.com';
        return deal;
      }
      throw new Error('Deal not found');
    }
    const response = await api.post(`/deals/${dealId}/mark-sold`);

    return response.data;
  },

  // Revert sold status
  revertSold: async (dealId) => {
    if (USE_MOCK) {
      await delay();
      const deal = mockDeals.find((d) => d.id === dealId);
      if (deal) {
        deal.status = 'published';
        deal.soldAt = null;
        deal.soldBy = null;
        return deal;
      }
      throw new Error('Deal not found');
    }
    const response = await api.post(`/deals/${dealId}/revert-sold`);
    return response.data;
  },

  // Public endpoint — no auth required
  getPublicDealById: async (dealId) => {
    if (USE_MOCK) {
      await delay();
      const found = mockDeals.find((d) => d.id === dealId);
      if (!found) throw new Error('Deal not found');
      return normalizeDeal(found);
    }
    const response = await publicApi.get(`/deals/${dealId}/public`);
    return normalizeDeal(response.data);
  },

  getFilter: async () => {
    const response = await api.get('/deals/get-filter');
    return response.data;
  },

  storefilter: async (payload) => {
    const response = await api.post(`/deals/store-filter`, payload);
    return response.data;
  },

  deleteFilter: async () => {
    const response = await api.delete('/deals/delete-filter');
    return response.data;
  },

  getFilterSettings: async () => {
    const response = await api.get('/deals/manage-filters');
    return response.data;
  },

  saveFilterSettings: async (filters) => {
    const response = await api.post(`/deals/manage-filters`, filters);
    return response.data;
  }
};
