/**
 * Auto-Tagging Utility
 *
 * Automatically generates tags for deals based on:
 * - Price ranges
 * - Financing type
 * - Vacation rental markets
 * - Property characteristics
 * - STR metrics
 */

/* ------------------ PRICE RANGE TAGS ------------------ */

const PRICE_RANGES = [
  { max: 200000, tag: 'Under $200K' },
  { min: 200000, max: 300000, tag: '$200K-$300K' },
  { min: 300000, max: 400000, tag: '$300K-$400K' },
  { min: 400000, max: 500000, tag: '$400K-$500K' },
  { min: 500000, max: 750000, tag: '$500K-$750K' },
  { min: 750000, max: 1000000, tag: '$750K-$1M' },
  { min: 1000000, max: 1500000, tag: '$1M-$1.5M' },
  { min: 1500000, max: 2000000, tag: '$1.5M-$2M' },
  { min: 2000000, tag: '$2M+' },
];

/**
 * Get price range tag based on deal price
 * @param {number} price - The deal price
 * @returns {string|null} - Price range tag or null
 */
function getPriceRangeTag(price) {
  if (!price || typeof price !== 'number') return null;

  for (const range of PRICE_RANGES) {
    const minMatch = range.min === undefined || price >= range.min;
    const maxMatch = range.max === undefined || price < range.max;

    if (minMatch && maxMatch) {
      return range.tag;
    }
  }
  return null;
}

/* ------------------ FINANCING TYPE TAGS ------------------ */

const FINANCING_LABELS = {
  traditional: 'Traditional Financing',
  'subject-to': 'Subject-To',
  hybrid: 'Hybrid Financing',
  seller: 'Seller Financing',
  cash: 'Cash Deal',
};

const CREATIVE_FINANCING_TYPES = ['subject-to', 'hybrid', 'seller'];

/**
 * Get financing-related tags
 * @param {string} financingType - The financing type
 * @returns {string[]} - Array of financing tags
 */
function getFinancingTags(financingType) {
  const tags = [];

  if (!financingType) return tags;

  const normalizedType = financingType.toLowerCase();

  // Add specific financing type tag
  if (FINANCING_LABELS[normalizedType]) {
    tags.push(FINANCING_LABELS[normalizedType]);
  }

  // Add "Creative Financing" umbrella tag if applicable
  if (CREATIVE_FINANCING_TYPES.includes(normalizedType)) {
    tags.push('Creative Financing');
  }

  // Add cash-specific tag
  if (normalizedType === 'cash') {
    tags.push('No Financing Needed');
  }

  return tags;
}

/* ------------------ MARKET TYPE TAGS ------------------ */

const MARKET_LABELS = {
  beach: 'Beach Market',
  mountain: 'Mountain Market',
  lake: 'Lake Market',
  desert: 'Desert Market',
  urban: 'Urban Market',
  ski: 'Ski Market',
  golf: 'Golf Market',
  wine: 'Wine Country',
  national_park: 'Near National Park',
  theme_park: 'Near Theme Park',
};

/**
 * Get market-based tags from vacation rental markets
 * @param {string[]} vacationRentalMarkets - Array of market identifiers
 * @returns {string[]} - Array of market tags
 */
function getMarketTags(vacationRentalMarkets) {
  const tags = [];

  if (!Array.isArray(vacationRentalMarkets)) return tags;

  for (const market of vacationRentalMarkets) {
    const normalizedMarket = String(market)
      .toLowerCase()
      .replace(/[^a-z_]/g, '_');

    // Check for known market labels
    if (MARKET_LABELS[normalizedMarket]) {
      tags.push(MARKET_LABELS[normalizedMarket]);
    } else {
      // Use the market name as-is if not in predefined labels
      // Capitalize first letter of each word
      const formattedMarket = market
        .replace(/_/g, ' ')
        .split(' ')
        .map(
          (word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
        )
        .join(' ');
      tags.push(formattedMarket);
    }
  }

  return tags;
}

/* ------------------ PROPERTY CHARACTERISTIC TAGS ------------------ */

const PROPERTY_CATEGORY_LABELS = {
  SINGLE_FAMILY: 'Single Family',
  CONDO: 'Condo',
  TOWNHOUSE: 'Townhouse',
  TWO_TO_FOUR_UNIT: 'Multi-Unit (2-4)',
  UNIQUE_PROPERTY: 'Unique Property',
};

const TURNKEY_LABELS = {
  'turnkey-operating': 'Turnkey Operating',
  'furnished-not-operating': 'Furnished',
  'partially-furnished': 'Partially Furnished',
  'not-furnished': 'Unfurnished',
  TURNKEY_OPERATING: 'Turnkey Operating',
  FURNISHED_NOT_OPERATING: 'Furnished',
  PARTIALLY_FURNISHED: 'Partially Furnished',
  NOT_FURNISHED: 'Unfurnished',
};

/**
 * Get property characteristic tags
 * @param {object} deal - The deal object
 * @returns {string[]} - Array of property tags
 */
function getPropertyTags(deal) {
  const tags = [];

  // Property category
  if (deal.category && PROPERTY_CATEGORY_LABELS[deal.category]) {
    tags.push(PROPERTY_CATEGORY_LABELS[deal.category]);
  }

  // Bedroom count tags
  if (deal.bedrooms) {
    if (deal.bedrooms >= 5) {
      tags.push('5+ Bedrooms');
    } else if (deal.bedrooms === 1) {
      tags.push('1 Bedroom');
    }
  }

  // Turnkey status
  if (deal.turnkeyFurnished && TURNKEY_LABELS[deal.turnkeyFurnished]) {
    tags.push(TURNKEY_LABELS[deal.turnkeyFurnished]);
  }

  // HOA
  if (deal.isHOA === true) {
    tags.push('Has HOA');
  }

  // Premium access
  if (deal.priorityFirstAccess === true) {
    tags.push('Priority Access');
  }

  // 50/50 Partner
  if (deal.fiftyFiftyPartner === true) {
    tags.push('50/50 Partnership');
  }

  // Done for You
  if (deal.doneForYou === true) {
    tags.push('Done For You');
  }

  return tags;
}

/* ------------------ STR METRICS TAGS ------------------ */

/**
 * Get STR performance tags based on metrics
 * @param {object} deal - The deal object
 * @returns {string[]} - Array of STR metric tags
 */
function getSTRMetricTags(deal) {
  const tags = [];

  // High revenue tag
  if (deal.strAnnualRevenue && deal.strAnnualRevenue >= 100000) {
    tags.push('High Revenue ($100K+)');
  } else if (deal.strAnnualRevenue && deal.strAnnualRevenue >= 75000) {
    tags.push('Strong Revenue ($75K+)');
  }

  // High occupancy tag
  if (deal.strOccupancyRate && deal.strOccupancyRate >= 70) {
    tags.push('High Occupancy (70%+)');
  }

  // High ADR tag
  if (deal.strAvgDailyRate && deal.strAvgDailyRate >= 300) {
    tags.push('High ADR ($300+)');
  } else if (deal.strAvgDailyRate && deal.strAvgDailyRate >= 200) {
    tags.push('Strong ADR ($200+)');
  }

  // STR confidence tags
  if (
    deal.strConfidence === 'first-hand' ||
    deal.strConfidence === 'FIRST_HAND'
  ) {
    tags.push('Verified STR Data');
  }

  // STR zoning tags
  if (deal.strZoning === 'yes' || deal.strZoning === 'YES') {
    tags.push('STR Zoning Approved');
  } else if (deal.strZoning === 'no' || deal.strZoning === 'NO') {
    tags.push('STR Zoning Restricted');
  }

  return tags;
}

/* ------------------ MAIN AUTO-TAG FUNCTION ------------------ */

/**
 * Generate all auto-tags for a deal
 * @param {object} deal - The deal object
 * @returns {string[]} - Array of all generated tags (deduplicated)
 */
function generateAutoTags(deal) {
  if (!deal) return [];

  const allTags = [];

  // Price range tag
  const priceTag = getPriceRangeTag(deal.price);
  if (priceTag) allTags.push(priceTag);

  // Financing tags
  const financingTags = getFinancingTags(deal.financingType);
  allTags.push(...financingTags);

  // Market tags
  const marketTags = getMarketTags(deal.vacationRentalMarkets);
  allTags.push(...marketTags);

  // Property characteristic tags
  const propertyTags = getPropertyTags(deal);
  allTags.push(...propertyTags);

  // STR metric tags
  const strTags = getSTRMetricTags(deal);
  allTags.push(...strTags);

  // Deduplicate and return
  return [...new Set(allTags)];
}

/**
 * Merge auto-generated tags with existing special tags
 * @param {object} deal - The deal object
 * @param {string[]} existingTags - Existing manual/special tags
 * @returns {string[]} - Merged array of all tags
 */
function mergeWithExistingTags(deal, existingTags = []) {
  const autoTags = generateAutoTags(deal);
  const manualTags = Array.isArray(existingTags) ? existingTags : [];

  // Combine and deduplicate, keeping manual tags at the front
  const allTags = [...manualTags];
  for (const tag of autoTags) {
    if (!allTags.includes(tag)) {
      allTags.push(tag);
    }
  }

  return allTags;
}

module.exports = {
  generateAutoTags,
  mergeWithExistingTags,
  getPriceRangeTag,
  getFinancingTags,
  getMarketTags,
  getPropertyTags,
  getSTRMetricTags,
  // Export constants for testing
  PRICE_RANGES,
  FINANCING_LABELS,
  MARKET_LABELS,
  PROPERTY_CATEGORY_LABELS,
};
