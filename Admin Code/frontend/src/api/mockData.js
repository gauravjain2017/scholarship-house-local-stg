/**
 * Mock data for frontend development and testing
 * Remove or disable this file once backend is connected
 */

export const mockDeals = [
  {
    id: '1',
    title: '3BR Single Family Home - Suburban Paradise',
    description:
      'Beautiful 3-bedroom, 2-bathroom home in quiet neighborhood. Recently renovated kitchen, large backyard.',
    category: 'single-family',
    seller: 'Premier_Realty',
    price: '450000.00',
    discountedPrice: '425000.00',
    discountPercentage: '6',
    bedrooms: 3,
    bathrooms: 2,
    squareFootage: 2200,
    projectedDailyRevenue: '350.00',
    address: '123 Oak Street, Springfield, IL 62701',
    priorityFirstAccess: true,
    images: [
      'https://images.unsplash.com/photo-1570129477492-45c003edd2be?w=800&h=600&fit=crop',
    ],
    videos: [],
    textSections:
      'Attached garage, new HVAC system, hardwood floors throughout.',
    status: 'published',
    submittedAt: '2025-11-28T10:00:00Z',
    publishedAt: '2025-11-28T14:00:00Z',
  },
  {
    id: '2',
    title: 'Modern Downtown Condo - 2BR/2BA',
    description:
      'Luxury condo in the heart of downtown. Floor-to-ceiling windows with city views.',
    category: 'condo',
    seller: 'Urban_Living_Group',
    price: '380000.00',
    discountedPrice: '365000.00',
    discountPercentage: '4',
    bedrooms: 2,
    bathrooms: 2,
    squareFootage: 1400,
    projectedDailyRevenue: '275.00',
    address: '456 Market Plaza Unit 12A, Chicago, IL 60601',
    priorityFirstAccess: false,
    images: [
      'https://images.unsplash.com/photo-1523217582562-09d0def993a6?w=800&h=600&fit=crop',
    ],
    videos: [],
    textSections:
      'HOA includes gym, pool, and parking. Concierge service available.',
    status: 'published',
    submittedAt: '2025-11-27T10:00:00Z',
    publishedAt: '2025-11-27T14:00:00Z',
  },
  {
    id: '3',
    title: 'Spacious Townhouse - 3BR/2.5BA',
    description:
      'Well-maintained townhouse with open floor plan. Private patio and two-car garage.',
    category: 'townhouse',
    seller: 'Family_Homes_LLC',
    price: '325000.00',
    discountedPrice: '310000.00',
    discountPercentage: '5',
    bedrooms: 3,
    bathrooms: 2.5,
    squareFootage: 1850,
    address: '789 Maple Lane, Aurora, IL 60506',
    priorityFirstAccess: true,
    images: [
      'https://images.unsplash.com/photo-1599427303058-f04e64f7833b?w=800&h=600&fit=crop',
    ],
    videos: [],
    textSections:
      'End unit with extra windows. Near shopping and schools. Updated kitchen.',
    status: 'published',
    submittedAt: '2025-11-26T10:00:00Z',
    publishedAt: '2025-11-26T14:00:00Z',
  },
  {
    id: '4',
    title: 'Investment Opportunity - Duplex',
    description:
      'Great income property with two 2BR units. Both currently rented with excellent tenants.',
    category: 'multi-family',
    seller: 'Investment_Properties_Co',
    price: '520000.00',
    discountedPrice: '495000.00',
    discountPercentage: '5',
    bedrooms: 4,
    bathrooms: 4,
    squareFootage: 3200,
    address: '321 Elm Drive, Naperville, IL 60540',
    priorityFirstAccess: false,
    images: [
      'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=800&h=600&fit=crop',
    ],
    videos: [],
    textSections:
      'Separate utilities, off-street parking for 4 cars. Strong rental history.',
    status: 'published',
    submittedAt: '2025-11-25T10:00:00Z',
    publishedAt: '2025-11-25T14:00:00Z',
  },
  {
    id: '5',
    title: 'Prime Commercial Property - Retail Space',
    description:
      'High-traffic location, 3,500 sq ft retail space. Perfect for restaurant or retail store.',
    category: 'commercial',
    seller: 'Commercial_Realty_Group',
    price: '750000.00',
    discountedPrice: '725000.00',
    discountPercentage: '3',
    bedrooms: 0,
    bathrooms: 2,
    squareFootage: 3500,
    address: '555 Commerce Boulevard, Schaumburg, IL 60173',
    priorityFirstAccess: false,
    images: [
      'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=800&h=600&fit=crop',
    ],
    videos: [],
    textSections:
      'Corner lot, ample parking, recent renovations. Zoned for retail/restaurant.',
    status: 'published',
    submittedAt: '2025-11-24T10:00:00Z',
    publishedAt: '2025-11-24T14:00:00Z',
  },
];

export const mockUser = {
  id: 'user1',
  email: 'submitter@example.com',
  role: 'submitter',
};

export const mockAdmin = {
  id: 'admin1',
  email: 'admin@example.com',
  role: 'admin',
};

// Helper function to simulate API delay
export const delay = (ms = 500) =>
  new Promise((resolve) => setTimeout(resolve, ms));

// Mock API functions (use these temporarily until backend is ready)
export const mockAPI = {
  createDeal: async (dealData) => {
    await delay();
    const newDeal = {
      ...dealData,
      id: Date.now().toString(),
      status: 'pending',
      submittedAt: new Date().toISOString(),
    };
    return { success: true, data: newDeal };
  },

  getMyDeals: async () => {
    await delay();
    return mockDeals.filter(
      (d) => d.status === 'pending' || d.status === 'approved'
    );
  },

  getPendingDeals: async (filters) => {
    await delay();
    return mockDeals.filter((d) => {
      if (
        filters.status &&
        filters.status !== 'All' &&
        d.status !== filters.status
      )
        return false;
      if (
        filters.category &&
        filters.category !== 'All' &&
        d.category !== filters.category
      )
        return false;
      return true;
    });
  },

  getPublishedDeals: async (filters) => {
    await delay();
    return mockDeals.filter((d) => d.status === 'published');
  },

  getDealById: async (dealId) => {
    await delay();
    return mockDeals.find((d) => d.id === dealId);
  },

  approveDeal: async (dealId) => {
    await delay();
    return { success: true, message: 'Deal approved' };
  },

  rejectDeal: async (dealId, reason) => {
    await delay();
    return { success: true, message: 'Deal rejected', reason };
  },

  publishDeal: async (dealId) => {
    await delay();
    return { success: true, message: 'Deal published' };
  },

  updateDeal: async (dealId, updates) => {
    await delay();
    return {
      success: true,
      data: { ...mockDeals.find((d) => d.id === dealId), ...updates },
    };
  },
};
