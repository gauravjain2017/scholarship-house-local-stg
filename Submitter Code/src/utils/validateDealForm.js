export function validateDealForm(formData, options = {}) {
  const { requireMedia = true, requireRequiredFields = true } = options;

  const errors = {};

  const isPresent = (v) => v !== null && v !== undefined && v !== '';

  const isEmpty = (v) =>
    v === null || v === undefined || (typeof v === 'string' && v.trim() === '');

  const validatePercent = (value, field) => {
    if (isEmpty(value)) return;
    const n = Number(value);
    if (Number.isNaN(n) || n < 0 || n > 100) {
      errors[field] = 'Must be between 0 and 100';
    }
  };

  const validateNumber = (value, field, min = 0, max = 1_000_000_000) => {
    if (isEmpty(value)) return;
    const n = Number(value);
    if (Number.isNaN(n) || n < min || n > max) {
    const formatted = (val) => `$${val.toLocaleString('en-US')}`;
    errors[field] = `Must be between ${formatted(0)} and ${formatted(max)}`;
	  
    }
  };

const validateCurrency = (value, field, max = 1_000_000_000) => {
  if (isEmpty(value)) return;
  const n = Number(value);
  if (Number.isNaN(n) || n < 0 || n > max) {
    const formatted = (val) => `$${val.toLocaleString('en-US')}`;
    errors[field] = `Must be between ${formatted(0)} and ${formatted(max)}`;
  }
};

  const validateTextLength = (value, field, maxLen = 2000000) => {
    if (!isPresent(value)) return;
    if (String(value).length > maxLen) {
      errors[field] = `Must be under ${maxLen} characters`;
    }
  };

  const validateYear = (value, field, min = 1800) => {
    if (!isPresent(value)) return;
    const n = Number(value);
    const currentYear = new Date().getFullYear();

    if (!Number.isInteger(n) || n < min || n > currentYear) {
      errors[field] = `Must be between ${min} and ${currentYear}`;
    }
  };

  const validateFutureDate = (value, field) => {
    if (!isPresent(value)) return;

    const date = new Date(value);
    if (isNaN(date.getTime())) {
      errors[field] = 'Invalid date format';
      return;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (date < today) {
      errors[field] = 'Date cannot be in the past';
    }
  };

  /* ---------------- REQUIRED FIELDS ---------------- */

  if (requireRequiredFields) {
    if (!formData.streetAddress?.trim()) {
      errors.streetAddress = 'Street address is required';
    }

    if (!formData.city?.trim()) {
      errors.city = 'City is required';
    }

    if (!formData.stateRegion?.trim()) {
      errors.stateRegion = 'State/Region is required';
    }

    if (!formData.postalCode?.trim()) {
      errors.postalCode = 'Postal code is required';
    }

    if (!formData.category) {
      errors.category = 'Property type is required';
    }

    if (!formData.description || formData.description.length < 30) {
      errors.description = 'Description must be at least 30 characters';
    }

    validateCurrency(formData.price, 'price', 1_000_000_000);

    if (!formData.financingType) {
      errors.financingType = 'Financing type is required';
    }

    if (!formData.isOperatingSTR) {
      errors.isOperatingSTR =
        'Please indicate if the property is currently operating as an STR';
    }

    if (!formData.strConfidence) {
      errors.strConfidence = 'STR Data Confidence is required';
    }

    // Turnkey/Furnished is only relevant when the property is currently
    // operating as an STR (matches the submitter form's conditional logic).
    if (formData.isOperatingSTR === 'yes' && !formData.turnkeyFurnished) {
      errors.turnkeyFurnished = 'Turnkey Furnished is required';
    }

    if (!formData.strZoning) {
      errors.strZoning = 'STR Zoning is required';
    }

    if (formData.isHOA && isEmpty(formData.hoaMonthlyFee)) {
      errors.hoaMonthlyFee = 'HOA Monthly Fee is required when HOA is selected';
    }
  }

  /* ---------------- MEDIA ---------------- */

  if (requireMedia) {
    if (!formData.interiorImages?.length) {
      errors.interiorImages = 'At least 1 interior photo is required';
    }
    if (!formData.exteriorImages?.length) {
      errors.exteriorImages = 'At least 1 exterior photo is required';
    }
  }

  /* ---------------- OPTIONAL NUMERIC GUARDS ---------------- */

  [
    'occupancyRate',
    'managementCommissionPercent',
    'costSegregationPercent',
    'effectiveTaxRate',
    'sellerInterestRate',
    'subjInterestRate',
    'revenueIncreasePercent',
    'propertyAppreciationPercent',
  ].forEach((f) => validatePercent(formData[f], f));

  [
    'hoaMonthlyFee',
    'emd',
    'downPayment',
    'subjLoanBalance',
    'subjMonthlyPrincipal',
    'subjMonthlyInterest',
    'subjMonthlyTaxesInsurance',
    'sellerLoanAmount',
    'sellerMonthlyPayment',
    'totalMonthlyPayment',
    'furnitureBudget',
    'annualCleaningAndVariable',
    'annualFixedOperatingExpenses',
  ].forEach((f) => validateCurrency(formData[f], f));
  
  // ✅ NEW: Income Reduction — $0 to $1,000,000
  validateCurrency(formData.incomeReduction, 'incomeReduction', 1_000_000);

  // ✅ NEW: Tax Savings — $0 to $500,000
  validateCurrency(formData.taxSavings, 'taxSavings', 500_000);
  
  

  [
    'averageNightlyRate',
    'marketRevenue_12m',
    'marketRevenue_24m',
    'marketRevenue_36m',
    'marketRevenue_48m',
    'marketRevenue_60m',
    'marketRevenue_72m',
    'marketRevenue_84m',
  ].forEach((f) => validateNumber(formData[f], f, 0, 100_000_000));

  [
    'financialInfo',
    'guestDemandInsights',
    'valueAddOpportunities',
    'localContacts',
    'amenities',
    'localAttractions',
    'additionalInfo',
  ].forEach((f) => validateTextLength(formData[f], f));

  ['yearBuilt'].forEach((f) => validateYear(formData[f], f));

  ['subjLoanMaturity', 'sellerLoanMaturity'].forEach((f) =>
    validateFutureDate(formData[f], f)
  );

  /* ---------------- UNDERWRITING TIME-SERIES GUARDS ---------------- */

  // Market occupancy (%) by month
  [12, 24, 36, 48, 60, 72, 84].forEach((m) => {
    const field = `marketOccupancy_${m}m`;
    validatePercent(formData[field], field);
  });

  // ANR ($) by month + tier
  const ANR_TIERS = ['budget', 'economy', 'midscale', 'upscale', 'luxury'];

  [12, 24, 36, 48, 60, 72, 84].forEach((m) => {
    ANR_TIERS.forEach((tier) => {
      const field = `anr_${m}m_${tier}`;
      validateNumber(formData[field], field, 0, 10_000);
    });
  });

  /* ---------------- UNDERWRITING (DYNAMIC FIELDS) ---------------- */

  const MONTHS = [12, 24, 36, 48, 60, 72, 84];
  const TIERS = ['budget', 'economy', 'midscale', 'upscale', 'luxury'];

  /* Market Occupancy (%): 12–84 months */
  MONTHS.forEach((m) =>
    validatePercent(formData[`marketOccupancy_${m}m`], `marketOccupancy_${m}m`)
  );

  /* Total Market Revenue ($): 12–84 months */
  MONTHS.forEach((m) =>
    validateNumber(
      formData[`marketRevenue_${m}m`],
      `marketRevenue_${m}m`,
      0,
      100_000_000
    )
  );

  /* ANR (Average Nightly Rate) by tier: 12–84 months */
  MONTHS.forEach((m) =>
    TIERS.forEach((tier) =>
      validateNumber(
        formData[`anr_${m}m_${tier}`],
        `anr_${m}m_${tier}`,
        0,
        10_000_000
      )
    )
  );

  /* Projected Revenue (ANR Revenue) by tier: 12–84 months */
  MONTHS.forEach((m) =>
    TIERS.forEach((tier) =>
      validateNumber(
        formData[`projectedRevenue_${m}m_${tier}`],
        `projectedRevenue_${m}m_${tier}`,
        0,
        10_000_000
      )
    )
  );

  return {
    errors,
    firstErrorField: Object.keys(errors)[0] || null,
  };
}
