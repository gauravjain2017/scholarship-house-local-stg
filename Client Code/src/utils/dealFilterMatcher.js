/**
 * dealFilterMatcher.js
 * Checks whether a published deal matches a user's saved filter (filters_json).
 * Mirrors the exact filter logic in getPublishedDeals so behaviour is consistent.
 */
const { buildStateCodeSet } = require('./US_STATES');
/**
 * Returns true if `deal` satisfies every active criterion in `filters`.
 * Any filter key that is absent / null / empty is simply skipped (no constraint).
 *
 * @param {Object} deal        - The full deal item from DynamoDB
 * @param {Object} filters     - Parsed filters_json stored in buy_boxes
 * @returns {boolean}
 */  
 
function dealMatchesFilter(deal, filters) {
  if (!filters || typeof filters !== 'object') return false;

  const {
    // Location
    state_regions,
	selectedStates,   // current key saved by the frontend
	minPrice,
	maxPrice,
    // Down payment
    minDownPayment,
    maxDownPayment,

    // Subject-to interest rate
    interestRateMin,
    subjectToInterestRateMax,

    // Monthly payment
    advMonthlyPaymentMin,
    advMonthlyPaymentMax,

    // Property attributes
    advPropertyType,
    advBedroomsMin,
    advBathroomsMin,
    advYearBuiltMin,
    advYearBuiltMax,
    advSqftMin,
    advSqftMax,

    // Turnkey
    turnkeyFurnished,

    // Tax benefits
    incomeReductionMin,
    incomeReductionMax,
    taxSavingsMin,
    taxSavingsMax,
   selectedStatuses,
   fiftyFiftyPartner,
   selectedTags,
    // Text search
    search,

    // Premium
    premium,
  } = filters;

  // ── State / Region ──────────────────────────────────────────────────────────

  const rawStates = selectedStates || state_regions;
  if (rawStates && rawStates.length > 0) {
    const statesArray = Array.isArray(rawStates) ? rawStates : [rawStates];
    // buildStateCodeSet resolves both full names ("Florida") and codes ("FL")
    const regionSet = buildStateCodeSet(statesArray);
    const dealCode = deal.stateRegion ? deal.stateRegion.trim().toUpperCase() : null;
    if (!dealCode || !regionSet.has(dealCode)) {
      return false;
    }
  }
    // ── Status ───────────────────────────────────────────────────────────────────
  if (selectedStatuses && selectedStatuses.length > 0) {
    const statusList = Array.isArray(selectedStatuses)
      ? selectedStatuses
      : selectedStatuses.split(',').map((s) => s.trim());
    if (statusList.length > 0 && !statusList.includes(deal.status)) {
      return false;
    }
  }

  	  // ── Price Range ─────────────────────────────────────────────────────────────
  if (minPrice != null && minPrice !== '') {
    if (deal.price == null || Number(deal.price) < Number(minPrice)) return false;
  }
  if (maxPrice != null && maxPrice !== '') {
    if (deal.price == null || Number(deal.price) > Number(maxPrice)) return false;
  }


  // ── Down Payment ────────────────────────────────────────────────────────────
  if (minDownPayment != null && minDownPayment !== '') {
    if (deal.downPayment == null || Number(deal.downPayment) < Number(minDownPayment)) return false;
  }
  if (maxDownPayment != null && maxDownPayment !== '') {
    if (deal.downPayment == null || Number(deal.downPayment) > Number(maxDownPayment)) return false;
  }

  // ── Subject-To Interest Rate ─────────────────────────────────────────────────
  if (interestRateMin != null && interestRateMin !== '') {
    if (deal.subjInterestRate == null || parseFloat(deal.subjInterestRate) < parseFloat(interestRateMin)) return false;
  }
  if (subjectToInterestRateMax != null && subjectToInterestRateMax !== '') {
    if (deal.subjInterestRate == null || parseFloat(deal.subjInterestRate) > parseFloat(subjectToInterestRateMax)) return false;
  }

  // ── Property Type ────────────────────────────────────────────────────────────
  if (advPropertyType && advPropertyType !== '') {
    if (!deal.category || deal.category.toLowerCase() !== advPropertyType.toLowerCase()) return false;
  }

  // ── Bedrooms / Bathrooms ─────────────────────────────────────────────────────
  if (advBedroomsMin != null && advBedroomsMin !== '') {
    if (deal.bedrooms == null || Number(deal.bedrooms) < Number(advBedroomsMin)) return false;
  }
  if (advBathroomsMin != null && advBathroomsMin !== '') {
    if (deal.bathrooms == null || Number(deal.bathrooms) < Number(advBathroomsMin)) return false;
  }

  // ── Year Built ───────────────────────────────────────────────────────────────
  if (advYearBuiltMin != null && advYearBuiltMin !== '') {
    if (deal.yearBuilt == null || Number(deal.yearBuilt) < Number(advYearBuiltMin)) return false;
  }
  if (advYearBuiltMax != null && advYearBuiltMax !== '') {
    if (deal.yearBuilt == null || Number(deal.yearBuilt) > Number(advYearBuiltMax)) return false;
  }

  // ── Square Footage ───────────────────────────────────────────────────────────
  if (advSqftMin != null && advSqftMin !== '') {
    if (deal.squareFootage == null || Number(deal.squareFootage) < Number(advSqftMin)) return false;
  }
  if (advSqftMax != null && advSqftMax !== '') {
    if (deal.squareFootage == null || Number(deal.squareFootage) > Number(advSqftMax)) return false;
  }

  // ── Monthly Payment ──────────────────────────────────────────────────────────
  if (advMonthlyPaymentMin != null && advMonthlyPaymentMin !== '') {
    if (deal.totalMonthlyPayment == null || Number(deal.totalMonthlyPayment) < Number(advMonthlyPaymentMin)) return false;
  }
  if (advMonthlyPaymentMax != null && advMonthlyPaymentMax !== '') {
    if (deal.totalMonthlyPayment == null || parseFloat(deal.totalMonthlyPayment) > parseFloat(advMonthlyPaymentMax)) return false;
  }

// ── Turnkey Furnished ────────────────────────────────────────────────────────
if (turnkeyFurnished && turnkeyFurnished !== '') {
  if (turnkeyFurnished.toUpperCase() === 'FURNISHED') {
    if (!deal.turnkeyFurnished || !['TURNKEY_OPERATING', 'FURNISHED_NOT_OPERATING'].includes(deal.turnkeyFurnished.toUpperCase())) return false;
  } else {
    if (!deal.turnkeyFurnished || !['NOT_FURNISHED', 'PARTIALLY_FURNISHED'].includes(deal.turnkeyFurnished.toUpperCase())) return false;
  }
}

  // ── Average Nightly Rate (ANR) per tier ──────────────────────────────────────
  const anrTiers = ['budget', 'economy', 'midscale', 'upscale', 'luxury'];
  for (const tier of anrTiers) {
    const minVal = filters[`anrMin_${tier}`];
    const maxVal = filters[`anrMax_${tier}`];
    if (minVal != null && minVal !== '') {
      if (deal[`anr_${tier}`] == null || Number(deal[`anr_${tier}`]) < Number(minVal)) return false;
    }
    if (maxVal != null && maxVal !== '') {
      if (deal[`anr_${tier}`] == null || Number(deal[`anr_${tier}`]) > Number(maxVal)) return false;
    }
  }

  // ── Estimated Gross Revenue (EGR) per tier ───────────────────────────────────
  const egrTiers = ['budget', 'economy', 'midscale', 'upscale', 'luxury'];
  for (const tier of egrTiers) {
    const minVal = filters[`egrMin_${tier}`];
    const maxVal = filters[`egrMax_${tier}`];
    if (minVal != null && minVal !== '') {
      if (deal[`egr_${tier}`] == null || Number(deal[`egr_${tier}`]) < Number(minVal)) return false;
    }
    if (maxVal != null && maxVal !== '') {
      if (deal[`egr_${tier}`] == null || Number(deal[`egr_${tier}`]) > Number(maxVal)) return false;
    }
  }

  // ── Tax Benefits ─────────────────────────────────────────────────────────────
  if (incomeReductionMin != null && incomeReductionMin !== '') {
    if (deal.incomeReduction == null || Number(deal.incomeReduction) < Number(incomeReductionMin)) return false;
  }
  if (incomeReductionMax != null && incomeReductionMax !== '') {
    if (deal.incomeReduction == null || Number(deal.incomeReduction) > Number(incomeReductionMax)) return false;
  }
  if (taxSavingsMin != null && taxSavingsMin !== '') {
    if (deal.taxSavings == null || Number(deal.taxSavings) < Number(taxSavingsMin)) return false;
  }
  if (taxSavingsMax != null && taxSavingsMax !== '') {
    if (deal.taxSavings == null || Number(deal.taxSavings) > Number(taxSavingsMax)) return false;
  }

  // ── Text Search ──────────────────────────────────────────────────────────────
  if (search && search.trim() !== '') {
    const q = search.toLowerCase();
    const inTitle = String(deal.title || '').toLowerCase().includes(q);
    const inDesc  = String(deal.description || '').toLowerCase().includes(q);
    if (!inTitle && !inDesc) return false;
  }

  // ── Premium ──────────────────────────────────────────────────────────────────
  if (premium === 'true' || premium === true) {
    if (deal.priorityFirstAccess !== true) return false;
  }
  // ── 50/50 Partnership Opportunity ────────────────────────────────────────────
  if (fiftyFiftyPartner === 'true' || fiftyFiftyPartner === true) {
    if (deal.fiftyFiftyPartner !== true) return false;
  }
  

  // ── Tags ─────────────────────────────────────────────────────────────────────
  if (selectedTags && selectedTags.length > 0) {
    const interestRate       = parseFloat(deal.subjInterestRate || deal.sellerInterestRate);
    const downPaymentVal     = parseFloat(deal.downPayment);
    const priceVal           = parseFloat(deal.price);
    const downPaymentPercent = priceVal > 0 ? (downPaymentVal / priceVal) * 100 : null;

    const normalizedFinancing = (deal.financingType || '').toUpperCase().replace(/[\s_-]+/g, '');
    const isCreativeFinancing =
      normalizedFinancing === 'SELLER' ||
      normalizedFinancing === 'SUBJECTTO' ||
      normalizedFinancing === 'HYBRID';

    const isTurnkey = ['TURNKEY_OPERATING', 'FURNISHED_NOT_OPERATING'].includes(
      (deal.turnkeyFurnished || '').toString().toUpperCase().replace(/-/g, '_')
    );

    const tagMatchers = {
      jv:         () => deal.fiftyFiftyPartner === true,
      turnkey:    () => isTurnkey,
      creative:   () => isCreativeFinancing,
      lowrate:    () => !isNaN(interestRate) && interestRate > 0 && interestRate < 5,
      lowentry:   () => downPaymentPercent !== null && downPaymentPercent < 10,
      discounted: () => deal.discountPrice === true,
    };

    // Deal must match AT LEAST ONE of the selected tags
    const matchesAny = selectedTags.some((t) => tagMatchers[t]?.());
    if (!matchesAny) return false;
  }

  return true;
}

module.exports = { dealMatchesFilter };
