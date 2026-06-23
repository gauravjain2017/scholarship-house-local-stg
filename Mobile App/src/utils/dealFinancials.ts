/**
 * dealFinancials.ts
 *
 * Pure, framework-agnostic finance helpers ported VERBATIM from the web
 * reference `client/src/views/DealDetailView.jsx` so the mobile property-detail
 * page produces byte-for-byte identical numbers.
 *
 * Nothing here touches React or React Native — it's all formatting + math so it
 * can be unit-reasoned and reused by the detail view's calculators.
 */

// ── Enum label maps (mirror web) ────────────────────────────────────────────
export const PROPERTY_TYPES = [
  { value: 'SINGLE_FAMILY', label: 'Single Family Home' },
  { value: 'CONDO', label: 'Condo' },
  { value: 'TOWNHOUSE', label: 'Town House' },
  { value: 'TWO_TO_FOUR_UNIT', label: '2–4 Unit Home' },
  { value: 'UNIQUE_PROPERTY', label: 'Unique Property' },
] as const;

export const PROPERTY_TYPE_LABELS: Record<string, string> = PROPERTY_TYPES.reduce(
  (acc, item) => ({ ...acc, [item.value]: item.label }),
  {} as Record<string, string>,
);

export const MONTHS = [
  { key: '12m', label: '12 Months' },
  { key: '24m', label: '24 Months' },
  { key: '36m', label: '36 Months' },
  { key: '48m', label: '48 Months' },
  { key: '60m', label: '60 Months' },
  { key: '72m', label: '72 Months' },
  { key: '84m', label: '84 Months' },
] as const;

export const VACATION_RENTAL_MARKET_LABELS: Record<string, string> = {
  BEACH: 'Beach',
  MOUNTAIN: 'Mountain',
  URBAN: 'Urban',
  LAKE: 'Lake',
  NATURE_PARKS: 'Nature / Parks',
  THEME_PARKS: 'Theme Parks',
  COLLEGE_TOWN: 'College Town',
  OFF_BEATEN_PATH: 'Off the Beaten Path',
};

// ── Formatters / predicates (mirror web) ────────────────────────────────────
export const formatPrice = (price: unknown): string => {
  const n = parseFloat(String(price));
  if (Number.isNaN(n)) return '0';
  return parseInt(String(n), 10).toLocaleString('en-US');
};

export const hasValue = (v: unknown): boolean => {
  if (v === null || v === undefined || v === '') return false;
  if (typeof v === 'number') return !Number.isNaN(v) && v !== 0;
  return true;
};

export const hasAnyValue = (...values: unknown[]): boolean => values.some(hasValue);
export const hasAnyObjectValue = (obj: Record<string, unknown> = {}): boolean =>
  Object.values(obj).some(hasValue);

export const normalizeTurnkey = (value: unknown): string =>
  String(value ?? '').toUpperCase().replace(/-/g, '_');

export const isTurnkeyDeal = (deal: any): boolean =>
  ['TURNKEY_OPERATING', 'FURNISHED_NOT_OPERATING'].includes(
    normalizeTurnkey(deal?.turnkeyFurnished),
  );

export const fmt$ = (val: unknown): string => {
  const n = parseFloat(String(val));
  if (Number.isNaN(n) || !n) return '—';
  return `$${parseInt(String(n), 10).toLocaleString('en-US')}`;
};

export const formatCompact = (val: unknown): string => {
  const n = parseFloat(String(val));
  if (Number.isNaN(n) || !n) return '—';
  if (n >= 1000000) return `$${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `$${Math.round(n / 1000)}K`;
  return `$${Math.round(n)}`;
};

export const fmtPct = (val: unknown): string => {
  const n = Number(val);
  if (Number.isNaN(n)) return '';
  return n % 1 === 0 ? String(n) : n.toFixed(1);
};

export const humanizeEnum = (value: unknown): string => {
  if (!value || typeof value !== 'string') return '—';
  return value.toLowerCase().replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
};

const getUrl = (img: any): string => (typeof img === 'string' ? img : img?.url || '');

/** Ordered, de-duped, string-coerced gallery image list (mirrors web). */
export const getDealImages = (deal: any): string[] =>
  [
    ...(Array.isArray(deal?.coverPhoto) ? deal.coverPhoto : []),
    ...(Array.isArray(deal?.exteriorImages) ? deal.exteriorImages : []),
    ...(Array.isArray(deal?.interiorImages) ? deal.interiorImages : []),
    ...(Array.isArray(deal?.additionalImages) ? deal.additionalImages : []),
  ]
    .map((img) => {
      if (typeof img === 'string') return img;
      if (img && typeof img === 'object' && img.url) return img.url;
      return null;
    })
    .filter(Boolean) as string[];

/** Underwriting screenshots, string-coerced (mirrors web). */
export const getUnderwritingImages = (deal: any): string[] =>
  Array.isArray(deal?.underwritingImages)
    ? deal.underwritingImages.map(getUrl).filter(Boolean)
    : [];

/** Property videos, string-coerced. Accepts string[] or {url}[] shapes. */
export const getDealVideos = (deal: any): string[] =>
  Array.isArray(deal?.videos) ? deal.videos.map(getUrl).filter(Boolean) : [];

export function getUserTypeLabel(type?: string): string {
  if (!type) return '';
  const map: Record<string, string> = {
    admin: 'Admin',
    submitter: 'Submitter',
    validator: 'Validator',
    realtor: 'Realtor',
    wholesaler: 'Wholesaler',
    birddogger: 'Bird Dogger',
    team_member: 'Team Member',
    client: 'Client',
    real_estate_professional: 'Real Estate Professional',
  };
  return map[type] || type.charAt(0).toUpperCase() + type.slice(1).replace(/_/g, ' ');
}

// ── 10-Year projection ──────────────────────────────────────────────────────
export interface TenYearGrowth {
  occupancy: { y1to5: number | string; y6to10: number | string };
  nightlyRate: { y1to5: number | string; y6to10: number | string };
  expenses: { y1to5: number | string; y6to10: number | string };
}

export interface TenYearOverride {
  occupancy?: number | string;
  nightlyRate?: number | string;
  expenses?: number | string;
}

export interface TenYearRow {
  year: number;
  occupancy: number;
  nightlyRate: number;
  grossRevenue: number | null;
  expenses: number | null;
  netRevenue: number | null;
  isLocked: boolean;
}

export const DEFAULT_TEN_YEAR_GROWTH: TenYearGrowth = {
  occupancy: { y1to5: 5, y6to10: 2 },
  nightlyRate: { y1to5: 20, y6to10: 5 },
  expenses: { y1to5: 3, y6to10: 3 },
};

export const computeTenYearProjection = (
  baseOccupancy: number,
  baseNightlyRate: number,
  baseExpenses: number,
  growth: TenYearGrowth,
  overrides: Record<number, TenYearOverride> = {},
): TenYearRow[] => {
  const rows: TenYearRow[] = [];
  let occ = Number(baseOccupancy) || 0;
  let rate = Number(baseNightlyRate) || 0;
  let exp = Number(baseExpenses) || 0;

  for (let year = 1; year <= 10; year += 1) {
    if (year > 1) {
      const bucket = year <= 5 ? 'y1to5' : 'y6to10';
      const gOcc = Number((growth?.occupancy as any)?.[bucket]) || 0;
      const gRate = Number((growth?.nightlyRate as any)?.[bucket]) || 0;
      const gExp = Number((growth?.expenses as any)?.[bucket]) || 0;
      occ = Math.min(100, occ + gOcc);
      rate = rate * (1 + gRate / 100);
      exp = exp * (1 + gExp / 100);
    }

    const row = overrides[year] || {};
    const hasOverride = (v: unknown) => v !== undefined && v !== null && v !== '';
    const isCleared = (v: unknown) => v === '';
    const appliedOcc = hasOverride(row.occupancy) ? Math.min(100, Number(row.occupancy)) : occ;
    const appliedRate = hasOverride(row.nightlyRate) ? Number(row.nightlyRate) : rate;
    const appliedExp = hasOverride(row.expenses) ? Number(row.expenses) : exp;

    const occCleared = isCleared(row.occupancy);
    const rateCleared = isCleared(row.nightlyRate);
    const expCleared = isCleared(row.expenses);

    const displayOcc = Math.round(appliedOcc * 10) / 10;
    const displayRate = Math.round(appliedRate);
    const gross =
      occCleared || rateCleared ? null : Math.round(365 * (displayOcc / 100) * displayRate);
    const expenses = expCleared ? null : Math.round(appliedExp);
    const net = gross === null || expenses === null ? null : gross - expenses;

    rows.push({
      year,
      occupancy: appliedOcc,
      nightlyRate: appliedRate,
      grossRevenue: gross,
      expenses,
      netRevenue: net,
      isLocked: year === 1,
    });
  }
  return rows;
};

// ── 50/50 JV pro-forma ──────────────────────────────────────────────────────
export interface ProForma {
  purchasePrice: number;
  llcBuyIn: number;
  totalOOP: number;
  bonusDepr: number;
  taxSavings: number;
  annualDist: number;
  totalDist: number;
  estSalePrice: number;
  apprGain: number;
  clientShare: number;
  totalReturn: number;
  annualizedReturn: string;
  cashOnCash: string;
  netSales: number;
  FEDERAL_TAX_RATE: number;
  FEDERAL_TAX_PERCENTAGE: number;
  cashOnCash1yr: string;
  cashOnCash3yr: string;
  cashOnCash5yr: string;
  federalTaxRateLabel: string;
  dealDownPayment: number;
  dealSalePrice: number;
}

/**
 * Single source of truth for all 50/50 JV pro-forma numbers — ported verbatim.
 * Rate constants mirror the spreadsheet INPUTS sheet:
 *   JV_EQUITY_PCT 30%, PREFERRED_DIST_RATE 8%, APPRECIATION_RATE 7%,
 *   HOLD_YEARS 5, CLIENT_SPLIT 50%. Federal tax rate from taxRateSettings.
 */
export const computeProForma = (deal: any, taxRateSettings?: any): ProForma => {
  const JV_EQUITY_PCT = 0.3;
  const FEDERAL_TAX_RATE = taxRateSettings?.federal_tax_rate
    ? parseFloat(taxRateSettings?.federal_tax_rate) / 100
    : 0;
  const FEDERAL_TAX_PERCENTAGE = taxRateSettings?.federal_tax_rate || 0;
  const APPRECIATION_RATE = 1.07;
  const HOLD_YEARS = 5;
  const PREFERRED_DIST_RATE = 0.08;
  const CLIENT_SPLIT = 0.5;

  const dealSalePrice = Math.round(
    Number(deal.price || 0) + (Number(deal.assignmentFee) > 0 ? Number(deal.assignmentFee) : 0),
  );
  const dealDownPayment = parseInt(
    String(
      Number(deal.downPayment || 0) +
        (Number(deal.assignmentFee) > 0 ? Number(deal.assignmentFee) : 0),
    ),
    10,
  );

  const purchasePrice = dealSalePrice || 0;
  const llcBuyIn =
    deal.costsIncluded && deal.customJvValues
      ? parseInt(deal.customJvValues, 10)
      : purchasePrice
        ? purchasePrice * JV_EQUITY_PCT
        : dealDownPayment || 0;

  const totalOOP = llcBuyIn;
  const bonusDepr = purchasePrice * JV_EQUITY_PCT;
  const taxSavings = purchasePrice
    ? Math.round(FEDERAL_TAX_RATE * bonusDepr)
    : deal.taxSavings || 0;

  const annualDist = Math.round(totalOOP * PREFERRED_DIST_RATE);
  const totalDist = Math.round(annualDist * HOLD_YEARS);
  const estSalePrice = purchasePrice
    ? Math.round(purchasePrice * Math.pow(APPRECIATION_RATE, HOLD_YEARS))
    : 0;
  const apprGain = estSalePrice - purchasePrice;
  const clientShare = apprGain - totalOOP;
  const netSales = Math.round(clientShare * CLIENT_SPLIT);

  const totalReturn = purchasePrice
    ? Math.round(totalOOP + Math.round(netSales) + totalDist + taxSavings)
    : deal.totalReturnBenefit || deal.totalReturnAndBenefit || 0;
  const annualizedReturn =
    purchasePrice && llcBuyIn > 0
      ? `${((Math.pow(totalReturn / llcBuyIn, 1 / HOLD_YEARS) - 1) * 100).toFixed(2)}%`
      : deal.annualizedReturn
        ? `${deal.annualizedReturn}%`
        : '—';

  const cashOnCash =
    purchasePrice && llcBuyIn > 0
      ? `${(((annualDist + taxSavings) / llcBuyIn) * 100).toFixed(0)}%`
      : deal.cashOnCashReturn
        ? `${deal.cashOnCashReturn}%`
        : '—';

  const federalTaxRateLabel = deal.effectiveTaxRate ? `${deal.effectiveTaxRate}%` : '37%';

  const cashOnCash1yr =
    purchasePrice && totalOOP > 0
      ? `${(((annualDist + taxSavings) / totalOOP) * 100).toFixed(2)}%`
      : deal.cashOnCashReturn
        ? `${deal.cashOnCashReturn}%`
        : '—';
  const cashOnCash3yr =
    purchasePrice && totalOOP > 0
      ? `${(((annualDist * 3 + taxSavings) / totalOOP) * 100).toFixed(2)}%`
      : '—';
  const cashOnCash5yr =
    purchasePrice && totalOOP > 0
      ? `${((totalReturn / totalOOP) * 100).toFixed(2)}%`
      : '—';

  return {
    purchasePrice,
    llcBuyIn,
    totalOOP,
    bonusDepr,
    taxSavings,
    annualDist,
    totalDist,
    estSalePrice,
    apprGain,
    clientShare,
    totalReturn,
    annualizedReturn,
    cashOnCash,
    netSales,
    FEDERAL_TAX_RATE,
    FEDERAL_TAX_PERCENTAGE,
    cashOnCash1yr,
    cashOnCash3yr,
    cashOnCash5yr,
    federalTaxRateLabel,
    dealDownPayment,
    dealSalePrice,
  };
};

// ── What's-included content for the JV "View All" modal (mirror web) ────────
export const LLC_INCLUDED_ITEMS = [
  {
    icon: '🏠',
    category: 'Acquisition',
    items: [
      'Earnest Money Deposit',
      'Home Inspection',
      'Title Report',
      'Entry / Down',
      'Entry Fee',
      'Closing Costs',
      'Real Estate Agent Commissions',
      'Wholesale Fees',
    ],
  },
  {
    icon: '🎨',
    category: 'Design & Setup',
    items: [
      'Design Market Research',
      'On-Site Measurements and Photos',
      'Renovations',
      'Furniture and Décor',
      'Theming and Design Setup and Staging',
    ],
  },
  {
    icon: '⚖️',
    category: 'Legal & Admin',
    items: [
      'Setting Up the LLC',
      'Adding Client to LLC',
      'Setting Up Utilities',
      'Utility Deposits',
      'Third Party Mortgage Payment Services',
    ],
  },
  {
    icon: '💰',
    category: 'Financial Carry',
    items: [
      'Back Payments (When Mortgages Are Behind)',
      'Back Taxes (When Applicable)',
      'Mortgage Payments During Setup',
      'Monthly Expenses During Setup',
    ],
  },
  {
    icon: '🚀',
    category: 'Launch & Marketing',
    items: [
      'Management Onboarding',
      'Professional Photo Shoot',
      'Property Listing Setup',
      'Initial Marketing',
      'Etc',
    ],
  },
] as const;
