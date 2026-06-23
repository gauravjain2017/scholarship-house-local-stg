import { z } from 'zod';
import { resolveStateCode } from '@/utils/usStates';

/**
 * Multi-step property submission schema.
 *
 * Maps to the backend's flat /api/deals payload shape used by the web
 * submitter-frontend. Per-step required fields mirror frontend/utils/validateStep.js.
 *
 * Strings that may be empty are kept as plain strings (not optional()) so the
 * form's controlled inputs always have a defined value — easier to manage in RHF.
 */

const currentYear = new Date().getFullYear();

/**
 * Required numeric field with a per-field "required" message. Returns a Zod
 * schema (not a chain) so we can attach `.refine()` on top.
 *
 * Use as: `bedrooms: requiredNumber('Bedrooms is required').refine(n => n >= 0)`
 */
function requiredNumber(message: string) {
  return z.preprocess(
    (v) => (v === '' || v === undefined || v === null ? undefined : Number(v)),
    z.number({
      required_error: message,
      invalid_type_error: message,
    }),
  );
}

const optionalNumericish = z.preprocess(
  (v) => (v === '' || v === undefined || v === null ? undefined : Number(v)),
  z.number().optional(),
);

/**
 * Coerce a raw snapshot (e.g. a draft payload coming back from the server, or
 * the JSON read from AsyncStorage) into shape the zod schemas accept. Without
 * this, `null` values returned for fields the user never filled in would
 * break validation (zod's `.default()` only fires on `undefined`, not `null`).
 *
 * Apply this BEFORE handing the object to RHF's `methods.reset()`.
 */
const ARRAY_FIELDS = [
  'coverPhoto',
  'interiorImages',
  'exteriorImages',
  'additionalImages',
  'videos',
  'strFinancialDocs',
  'specialTags',
  'vacationRentalMarkets',
  'travelMotivations',
] as const;

const STRING_FIELDS_OPTIONAL = [
  'addressLine2', 'story', 'financialInfo',
  'strListingLink', 'strDataSheetsLink', 'guestDemandInsights', 'valueAddOpportunities',
  'localContacts', 'propertyPdf', 'amenities', 'localAttractions', 'additionalInfo',
  'expectedCloseDate', 'submittedByAdminEmail',
  // Step 1 — contact + source
  'contactName', 'contactPhone', 'contactRelation', 'sourceLink',
  // Step 3 — creative financing strings
  'hasPrimaryMortgage', 'primaryMaturityDate',
  'hasSecondMortgage', 'secondMaturityDate',
  'hasSellerEquity', 'sellerEquityMaturityDate', 'sellerEquityBalloonYears',
  'dealTerms',
  // Step 4 — STR strings
  'isOperatingSTR', 'turnkeyFurnished', 'hasStrFinancials', 'strBookingPlatform',
  'hasCurrentBookings', 'currentBookingsDescription',
] as const;

/**
 * Numeric fields that should render an EMPTY input (not "null" or "0") when
 * the backend returned no value. We coerce `null` → `undefined` here so the
 * input's `value={field.value == null ? '' : String(...)}` renders cleanly.
 */
const NUMERIC_FIELDS_OPTIONAL = [
  // Required by the schema, but listed here so a restored draft with
  // null/empty values renders as an EMPTY input (not "0") — validation
  // still triggers on Next / Save Draft via zod.
  'bedrooms', 'bathrooms', 'squareFootage', 'yearBuilt', 'price',
  'emd', 'downPayment', 'assignmentFee', 'hoaMonthlyFee',
  // Creative financing — primary / second / seller equity
  'primaryLoanBalance', 'primaryInterestRate', 'primaryPrincipalInterest', 'primaryTaxesInsurance',
  'secondLoanBalance', 'secondInterestRate', 'secondPrincipalInterest', 'secondTaxesInsurance',
  'sellerEquityAmount', 'sellerEquityInterestRate', 'sellerEquityPrincipalInterest',
  'totalStartingMonthlyPayment',
  // STR key metrics
  'occupancyRate', 'averageNightlyRate', 'strAnnualRevenue', 'strMonthlyRevenue',
  'strMonthlyUtilities', 'strNOI', 'strCleaningFee', 'strAvgStay', 'strManagementFee',
] as const;

/**
 * Date fields stored as `YYYY-MM-DD`. The backend often returns them as full ISO
 * datetimes (e.g. "2026-06-15T00:00:00.000Z"), which the <input type="date"> on
 * web can't render and the native DatePicker can't parse — so we strip them back
 * to the date-only form here, before the values ever reach the form.
 */
const DATE_FIELDS = [
  'expectedCloseDate',
  'primaryMaturityDate',
  'secondMaturityDate',
  'sellerEquityMaturityDate',
  'expiry_date',
] as const;

/**
 * Extract the `YYYY-MM-DD` portion of any date string; '' if unparseable.
 *
 * Handles the formats produced across the stack:
 *   - ISO `YYYY-MM-DD` (optionally with a time suffix) — the mobile app + imports
 *   - `MM/DD/YYYY` — the web submitter's react-datepicker (DateInput.jsx)
 * We parse both with explicit regex rather than `new Date(str)` because Hermes
 * (React Native's engine) returns Invalid Date for non-ISO strings like
 * "06/21/2026", which is exactly why web-saved dates showed up blank in-app.
 */
function toDateOnly(v: unknown): string {
  if (typeof v !== 'string') return '';
  const s = v.trim();
  if (s === '') return '';
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const us = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (us) return `${us[3]}-${us[1].padStart(2, '0')}-${us[2].padStart(2, '0')}`;
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return '';
  const y = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, '0');
  const da = String(d.getDate()).padStart(2, '0');
  return `${y}-${mo}-${da}`;
}

export function normalizeFormSnapshot(raw: Record<string, unknown> | undefined | null): Record<string, unknown> {
  if (!raw || typeof raw !== 'object') return {};
  const out: Record<string, unknown> = { ...raw };
  for (const k of ARRAY_FIELDS) {
    if (out[k] == null) out[k] = [];
  }
  for (const k of STRING_FIELDS_OPTIONAL) {
    if (out[k] == null) out[k] = '';
  }
  for (const k of NUMERIC_FIELDS_OPTIONAL) {
    if (out[k] === null) out[k] = undefined;
  }
  // Strip any time portion off date fields so they render in <input type="date">
  // (web) and parse cleanly in the native DatePicker (both expect YYYY-MM-DD).
  for (const k of DATE_FIELDS) {
    if (out[k] != null) out[k] = toDateOnly(out[k]);
  }
  // Backend stores `isHOA` as a boolean, but the Select widget renders against
  // the string keys 'yes' / 'no' / ''. Convert in either direction defensively.
  if (typeof out.isHOA === 'boolean') {
    out.isHOA = out.isHOA ? 'yes' : 'no';
  } else if (out.isHOA == null) {
    out.isHOA = '';
  }

  // The admin's Joi schema accepts `amenities` and `localAttractions` as
  // EITHER an array of strings OR a plain string. The form uses a multiline
  // textarea so we always end up with a STRING here. Coerce every shape:
  //   - string  → trimmed string
  //   - array   → comma-joined string of its string members
  //   - other   → '' (null/undefined fell through STRING_FIELDS_OPTIONAL above)
  // Without this, an unexpected shape (e.g. a stringified array or a number
  // from a legacy record) leaves the field with a non-string value that the
  // <TextInput multiline> renders as empty — the symptom users see as
  // "amenities don't show in edit case".
  (['amenities', 'localAttractions'] as const).forEach((k) => {
    const v = out[k];
    if (Array.isArray(v)) {
      out[k] = v.filter((s) => typeof s === 'string').join(', ');
    } else if (typeof v === 'string') {
      // Already a string — leave as-is (preserve trailing whitespace the user typed).
    } else {
      out[k] = '';
    }
  });

  // Coerce state into the canonical 2-letter code expected by US_STATE_OPTIONS.
  // Legacy records sometimes stored the full name ("California") or a lowercased
  // code ("ca"); without this normalization the <Select> can't match its
  // options and renders the placeholder instead of the user's saved value.
  if (out.stateRegion !== undefined) {
    out.stateRegion = resolveStateCode(out.stateRegion);
  }

  return out;
}

// ============================================================================
// Step 1 — Property Information
// ============================================================================
export const step1Schema = z
  .object({
    submitterRelationship: z.string().min(1, 'Your relationship to this property is required'),
    submittedByAdmin: z.boolean().default(false),
    submittedByAdminEmail: z.string().optional().or(z.literal('')),
    allowUnregisteredSeller: z.boolean().nullable().default(null),
    category: z.string().min(1, 'Property type is required'),
    description: z.string().min(30, 'Description must be at least 30 characters'),
    story: z.string().default(''),
    bedrooms: requiredNumber('Bedrooms is required').refine(
      (n) => Number.isInteger(n) && n >= 0 && n <= 50,
      'Enter a valid number of bedrooms (0–50)',
    ),
    bathrooms: requiredNumber('Bathrooms is required').refine(
      (n) => n >= 0 && n <= 50,
      'Enter a valid number of bathrooms (0–50)',
    ),
    squareFootage: requiredNumber('Square footage is required').refine(
      (n) => n > 0 && n <= 1_000_000,
      'Square footage must be between 1 and 1,000,000',
    ),
    yearBuilt: requiredNumber('Year built is required').refine(
      (n) => Number.isInteger(n) && n >= 1800 && n <= currentYear,
      `Year built must be between 1800 and ${currentYear}`,
    ),
    // HOA lives in step 1 to mirror the submitter's PropertyInformationSection.
    // Stored as 'yes' | 'no' (or '' before user touches it) to match the select.
    isHOA: z.string().default(''),
    hoaMonthlyFee: optionalNumericish,
    // Property's Main Point of Contact — all three required.
    contactName: z.string().min(1, 'Contact name is required'),
    contactPhone: z.string().min(1, 'Contact phone number is required'),
    contactRelation: z.string().min(1, 'Contact relation to property is required'),
    sourceLink: z.string().default(''),
    // Hidden auto field — set to today + 20 days in Step1 (add flow). No
    // validation: the user never edits it directly.
    expiry_date: z.string().default(''),
  })
  .refine(
    (d) => d.isHOA !== 'yes' || (d.hoaMonthlyFee !== undefined && d.hoaMonthlyFee !== null),
    { path: ['hoaMonthlyFee'], message: 'HOA Monthly Fee is required when HOA is selected' },
  );

// ============================================================================
// Step 2 — Location
// ============================================================================
export const step2Schema = z.object({
  streetAddress: z
    .string()
    .trim()
    .min(1, 'Street address is required')
    .max(200, 'Street address must be under 200 characters'),
  addressLine2: z.string().trim().max(200, 'Address Line 2 must be under 200 characters').default(''),
  city: z.string().trim().min(1, 'City is required').max(100, 'City must be under 100 characters'),
  stateRegion: z.string().trim().min(1, 'State/Region is required'),
  postalCode: z
    .string()
    .trim()
    .min(1, 'Postal code is required')
    .max(20, 'Postal code must be under 20 characters'),
});

// ============================================================================
// Step 3 — Financial Information
// ============================================================================
export const step3Schema = z.object({
  price: requiredNumber('Price is required').refine(
    (n) => n > 0 && n <= 1_000_000_000,
    'Price must be between 1 and 1,000,000,000',
  ),
  financingType: z.string().min(1, 'Financing type is required'),
  // Traditional financing — free-text notes only.
  financialInfo: z.string().default(''),
  // Creative financing — top-level money/date fields.
  expectedCloseDate: z.string().default(''),
  emd: optionalNumericish,
  downPayment: optionalNumericish,
  assignmentFee: optionalNumericish,
  // Creative financing — Primary mortgage (shown when hasPrimaryMortgage === 'yes')
  hasPrimaryMortgage: z.string().default(''),
  primaryLoanBalance: optionalNumericish,
  primaryInterestRate: optionalNumericish,
  primaryMaturityDate: z.string().default(''),
  primaryPrincipalInterest: optionalNumericish,
  primaryTaxesInsurance: optionalNumericish,
  // Creative financing — Second mortgage (shown when hasSecondMortgage === 'yes')
  hasSecondMortgage: z.string().default(''),
  secondLoanBalance: optionalNumericish,
  secondInterestRate: optionalNumericish,
  secondMaturityDate: z.string().default(''),
  secondPrincipalInterest: optionalNumericish,
  secondTaxesInsurance: optionalNumericish,
  // Creative financing — Seller equity (shown when hasSellerEquity === 'yes')
  hasSellerEquity: z.string().default(''),
  sellerEquityAmount: optionalNumericish,
  sellerEquityInterestRate: optionalNumericish,
  sellerEquityMaturityDate: z.string().default(''),
  sellerEquityPrincipalInterest: optionalNumericish,
  sellerEquityBalloonYears: z.string().default(''),
  // Creative financing — deal terms + total
  dealTerms: z.string().default(''),
  totalStartingMonthlyPayment: optionalNumericish,
});

// ============================================================================
// Step 4 — Rental Data (STR)
// ============================================================================
export const step4Schema = z
  .object({
    strZoning: z.string().min(1, 'STR Zoning is required'),
    // Required Yes/No — gates the "currently operating" sub-section below.
    isOperatingSTR: z.string().min(1, 'Please indicate if the property is currently operating as an STR'),
    strConfidence: z.string().min(1, 'STR Data Confidence is required'),
    // turnkeyFurnished is only relevant (and required) when operating as an STR.
    turnkeyFurnished: z.string().default(''),
    // STR financials gate + uploads
    hasStrFinancials: z.string().default(''),
    strFinancialDocs: z.array(z.string()).default([]),
    // STR key metrics
    occupancyRate: optionalNumericish,
    averageNightlyRate: optionalNumericish,
    strAnnualRevenue: optionalNumericish,
    strMonthlyRevenue: optionalNumericish,
    strMonthlyUtilities: optionalNumericish,
    strNOI: optionalNumericish,
    strCleaningFee: optionalNumericish,
    strAvgStay: optionalNumericish,
    strManagementFee: optionalNumericish,
    strBookingPlatform: z.string().default(''),
    hasCurrentBookings: z.string().default(''),
    currentBookingsDescription: z.string().default(''),
    vacationRentalMarkets: z.array(z.string()).default([]),
    travelMotivations: z.array(z.string()).default([]),
    strListingLink: z.string().default(''),
    strDataSheetsLink: z.string().default(''),
    guestDemandInsights: z.string().default(''),
    valueAddOpportunities: z.string().default(''),
    localContacts: z.string().default(''),
  })
  .refine(
    (d) => d.isOperatingSTR !== 'yes' || !!d.turnkeyFurnished,
    { path: ['turnkeyFurnished'], message: 'Turnkey/Furnished status is required' },
  );

// ============================================================================
// Step 5 — Photos & Media
//
// Interior + Exterior photos are REQUIRED (at least one each). Additional
// photos and Videos remain optional client-side — the backend's Joi schema
// is still the final gatekeeper. The .any().transform(...) prefix coerces
// null/wrong-shape inputs from legacy drafts into a clean string array
// before the .refine() length check fires.
// ============================================================================
const stringArrayOrEmpty = z
  .any()
  .transform((v) => (Array.isArray(v) ? v.filter((s) => typeof s === 'string') : []));

const stringOrEmpty = z
  .any()
  .transform((v) => (typeof v === 'string' ? v : ''));

export const step5Schema = z.object({
  coverPhoto: stringArrayOrEmpty.refine(
    (arr) => arr.length > 0,
    'A cover photo is required',
  ),
  interiorImages: stringArrayOrEmpty.refine(
    (arr) => arr.length > 0,
    'At least one interior photo is required',
  ),
  exteriorImages: stringArrayOrEmpty.refine(
    (arr) => arr.length > 0,
    'At least one exterior photo is required',
  ),
  additionalImages: stringArrayOrEmpty,
  videos: stringArrayOrEmpty,
  propertyPdf: stringOrEmpty,
  amenities: stringOrEmpty,
  localAttractions: stringOrEmpty,
  specialTags: stringArrayOrEmpty,
});

// ============================================================================
// Step 6 — Review (final flags only; everything else already validated)
// ============================================================================
export const step6Schema = z.object({
  priorityFirstAccess: z.boolean().default(false),
  fiftyFiftyPartner: z.boolean().default(false),
  doneForYou: z.boolean().default(false),
  additionalInfo: z.string().default(''),
});

// ============================================================================
// Master schema — union of all steps
// ============================================================================
// step1Schema and step4Schema carry conditional `.refine()`s (so they're
// ZodEffects, not plain ZodObjects). `.merge()` only exists on ZodObject, so we
// compose every step with `.and()` (intersection), which works uniformly.
export const propertyFormSchema = step1Schema
  .and(step2Schema)
  .and(step3Schema)
  .and(step4Schema)
  .and(step5Schema)
  .and(step6Schema);

export type PropertyFormInput = z.infer<typeof propertyFormSchema>;

// Helper used by the wrapper to pick the right schema for each step.
export const stepSchemas = [
  step1Schema,
  step2Schema,
  step3Schema,
  step4Schema,
  step5Schema,
  step6Schema,
];

/**
 * Human-readable label for every form field. Used by ValidationErrorModal to
 * turn a zod issue path into a meaningful error message — falls back to the
 * raw key if no entry is found.
 */
export const FIELD_LABELS: Record<string, string> = {
  submitterRelationship: 'Your relationship to this property',
  category: 'Property type',
  description: 'Description',
  bedrooms: 'Bedrooms',
  bathrooms: 'Bathrooms',
  squareFootage: 'Square footage',
  yearBuilt: 'Year built',
  expiry_date: 'Property expiry date',
  streetAddress: 'Street address',
  addressLine2: 'Address line 2',
  city: 'City',
  stateRegion: 'State',
  postalCode: 'Postal/Zip code',
  price: 'Price',
  financingType: 'Type of financing',
  hoaMonthlyFee: 'HOA monthly fee',
  strConfidence: 'STR data confidence',
  turnkeyFurnished: 'Turnkey/Furnished status',
  strZoning: 'STR zoning availability',
  interiorImages: 'Interior photos',
  exteriorImages: 'Exterior photos',
  additionalImages: 'Additional photos',
  videos: 'Videos',
  propertyPdf: 'Property document',
  amenities: 'Amenities',
  localAttractions: 'Local attractions',
  specialTags: 'Special tags',
  vacationRentalMarkets: 'Vacation rental markets',
  travelMotivations: 'Travel motivations',
  occupancyRate: 'Occupancy rate',
  expectedCloseDate: 'Expected close date',
  emd: 'Earnest money deposit',
  downPayment: 'Down payment',
  assignmentFee: 'Assignment fee',
  isHOA: 'HOA status',
  // Step 1 — contact + source
  contactName: 'Contact name',
  contactPhone: 'Contact phone number',
  contactRelation: 'Contact relation to property',
  sourceLink: 'Source link',
  // Step 4 — STR operating / financials / metrics
  isOperatingSTR: 'Currently operating as an STR',
  hasStrFinancials: 'Access to STR financials',
  averageNightlyRate: 'Average nightly rate',
  strAnnualRevenue: 'Annual gross revenue',
  strMonthlyRevenue: 'Average monthly revenue',
  strMonthlyUtilities: 'Monthly utilities',
  strNOI: 'Net operating income (NOI)',
  strCleaningFee: 'Cleaning fee per stay',
  strAvgStay: 'Average length of stay',
  strManagementFee: 'Property management fee',
  strBookingPlatform: 'Primary booking platform',
  hasCurrentBookings: 'Current bookings',
  currentBookingsDescription: 'Current bookings description',
  // Step 3 — creative financing
  hasPrimaryMortgage: 'Primary mortgage',
  hasSecondMortgage: 'Second mortgage',
  hasSellerEquity: 'Seller equity',
  dealTerms: 'Deal terms',
  totalStartingMonthlyPayment: 'Total starting monthly payment',
  // Step 5 — media
  coverPhoto: 'Cover photo',
};

// Step metadata for the StepIndicator.
export const STEPS: { key: string; label: string }[] = [
  { key: 'property', label: 'Property' },
  { key: 'location', label: 'Location' },
  { key: 'financial', label: 'Financial' },
  { key: 'rental', label: 'Rental' },
  { key: 'media', label: 'Media' },
  { key: 'review', label: 'Review' },
];

// Default values for a fresh form. Provides a defined value for every controlled
// input so RHF doesn't warn about uncontrolled → controlled transitions.
export const defaultPropertyFormValues: PropertyFormInput = {
  // Step 1
  submitterRelationship: '',
  submittedByAdmin: false,
  submittedByAdminEmail: '',
  allowUnregisteredSeller: null,
  category: '',
  description: '',
  story: '',
  // Numeric required fields start UNDEFINED so the input renders empty.
  // The user typing a real "0" stays as 0 — validation still rejects
  // squareFootage/yearBuilt/price=0 per their own refinements.
  bedrooms: undefined as unknown as number,
  bathrooms: undefined as unknown as number,
  squareFootage: undefined as unknown as number,
  yearBuilt: undefined as unknown as number,
  isHOA: '',
  hoaMonthlyFee: undefined,
  contactName: '',
  contactPhone: '',
  contactRelation: '',
  sourceLink: '',
  expiry_date: '',
  // Step 2
  streetAddress: '',
  addressLine2: '',
  city: '',
  stateRegion: '',
  postalCode: '',
  // Step 3
  price: undefined as unknown as number,
  financingType: '',
  financialInfo: '',
  expectedCloseDate: '',
  emd: undefined,
  downPayment: undefined,
  assignmentFee: undefined,
  hasPrimaryMortgage: '',
  primaryLoanBalance: undefined,
  primaryInterestRate: undefined,
  primaryMaturityDate: '',
  primaryPrincipalInterest: undefined,
  primaryTaxesInsurance: undefined,
  hasSecondMortgage: '',
  secondLoanBalance: undefined,
  secondInterestRate: undefined,
  secondMaturityDate: '',
  secondPrincipalInterest: undefined,
  secondTaxesInsurance: undefined,
  hasSellerEquity: '',
  sellerEquityAmount: undefined,
  sellerEquityInterestRate: undefined,
  sellerEquityMaturityDate: '',
  sellerEquityPrincipalInterest: undefined,
  sellerEquityBalloonYears: '',
  dealTerms: '',
  totalStartingMonthlyPayment: undefined,
  // Step 4
  strZoning: '',
  isOperatingSTR: '',
  turnkeyFurnished: '',
  strConfidence: '',
  hasStrFinancials: '',
  strFinancialDocs: [],
  occupancyRate: undefined,
  averageNightlyRate: undefined,
  strAnnualRevenue: undefined,
  strMonthlyRevenue: undefined,
  strMonthlyUtilities: undefined,
  strNOI: undefined,
  strCleaningFee: undefined,
  strAvgStay: undefined,
  strManagementFee: undefined,
  strBookingPlatform: '',
  hasCurrentBookings: '',
  currentBookingsDescription: '',
  vacationRentalMarkets: [],
  travelMotivations: [],
  strListingLink: '',
  strDataSheetsLink: '',
  guestDemandInsights: '',
  valueAddOpportunities: '',
  localContacts: '',
  // Step 5
  coverPhoto: [],
  interiorImages: [],
  exteriorImages: [],
  additionalImages: [],
  videos: [],
  propertyPdf: '',
  amenities: '',
  localAttractions: '',
  specialTags: [],
  // Step 6
  priorityFirstAccess: false,
  fiftyFiftyPartner: false,
  doneForYou: false,
  additionalInfo: '',
};

// ============================================================================
// Option lists — values match admin/components/submitter/* enums EXACTLY so
// data submitted from this mobile app is indistinguishable from data submitted
// via the admin/web client.
// ============================================================================

export const RELATIONSHIP_OPTIONS = [
  { value: 'TEAM_MEMBER', label: 'I am a CFS team member' },
  { value: 'REALTOR_LISTING_OWNER', label: 'I am a realtor and this is my listing' },
  { value: 'REALTOR_NOT_LISTING_OWNER', label: 'I am a realtor, but this is not my listing' },
  { value: 'WHOLESALER_HOLDS_CONTRACT', label: 'I am a wholesaler and I have the contrac' },
  { value: 'WHOLESALER_NO_CONTRACT', label: "I am a real estate professional and this is my client" },
  { value: 'REAL_ESTATE_PROFESSIONAL', label: 'I am a real estate professional and this is my client' },
  { value: 'BIRDDOGGER', label: 'I am a birddogger and found this property' },
];



export const CATEGORY_OPTIONS = [
  { value: 'SINGLE_FAMILY', label: 'Single Family Home' },
  { value: 'CONDO', label: 'Condo' },
  { value: 'TOWNHOUSE', label: 'Town House' },
  { value: 'TWO_TO_FOUR_UNIT', label: '2–4 Unit Home' },
  { value: 'UNIQUE_PROPERTY', label: 'Unique Property (Treehouses, Castles, Yurts, Etc.)' },
];

// Financing type now mirrors the submitter exactly: a simple traditional /
// creative split. Legacy values (subject-to / hybrid / seller / cash) are no
// longer offered for new submissions but are still accepted by the backend and
// recognised by the conditional show/hide logic when editing older records.
export const FINANCING_OPTIONS = [
  { value: 'traditional', label: 'Traditional Financing' },
  { value: 'creative', label: 'Creative Financing' },
];

// Mirrors admin/components/submitter/RentalDataSection.jsx — only shown when the
// property is currently operating as an STR.
export const TURNKEY_OPTIONS = [
  { value: 'TURNKEY_OPERATING', label: 'Yes — Turnkey / Furnished' },
  { value: 'PARTIALLY_FURNISHED', label: 'Partially Furnished' },
  { value: 'NOT_FURNISHED', label: 'No — Not Turnkey' },
];

export const YES_NO_OPTIONS = [
  { value: 'yes', label: 'Yes' },
  { value: 'no', label: 'No' },
];

export const STR_BOOKING_PLATFORM_OPTIONS = [
  { value: 'AIRBNB', label: 'Airbnb' },
  { value: 'VRBO', label: 'VRBO' },
  { value: 'BOTH', label: 'Both Airbnb & VRBO' },
  { value: 'DIRECT', label: 'Direct Booking' },
  { value: 'OTHER', label: 'Other' },
];

// 1–30 years, matching the submitter's seller-equity balloon-payment dropdown.
export const BALLOON_YEARS_OPTIONS = Array.from({ length: 30 }, (_, i) => {
  const n = i + 1;
  return { value: `${n}`, label: `${n} Year${n > 1 ? 's' : ''}` };
});

export const STR_CONFIDENCE_OPTIONS = [
  { value: 'FIRST_HAND', label: 'I have first-hand information and can verify accuracy' },
  { value: 'AIRDNA', label: 'The information is based on AirDNA or similar data' },
  { value: 'DIRECTIONAL_ONLY', label: 'The information is directional only' },
];

export const STR_ZONING_OPTIONS = [
  { value: 'YES', label: 'Yes' },
  { value: 'NO', label: 'No' },
  { value: 'UNSURE', label: 'Not Sure' },
];

export const IS_HOA_OPTIONS = [
  { value: 'yes', label: 'Yes' },
  { value: 'no', label: 'No' },
];

export const VACATION_RENTAL_MARKETS = [
  { value: 'BEACH', label: 'Beach Destinations' },
  { value: 'MOUNTAIN', label: 'Mountain Destinations' },
  { value: 'URBAN', label: 'Cities / Urban Destinations' },
  { value: 'LAKE', label: 'Lake Destinations' },
  { value: 'NATURE_PARKS', label: 'Nature / State & National Parks' },
  { value: 'THEME_PARKS', label: 'Theme Parks' },
  { value: 'COLLEGE_TOWN', label: 'College Towns' },
  { value: 'OFF_BEATEN_PATH', label: 'Off The Beaten Path' },
];

// Travel motivations are stored as the exact label string (not an enum) per the
// admin's implementation. Keep `value === label` so the chip component still works.
export const TRAVEL_MOTIVATIONS = [
  'Conventions & Conferences',
  'Exhibitions & Trade Shows',
  'Medical Facilities',
  'College Activities',
  'Sporting Events',
  'Theme Parks',
  'Relax & Unwind',
  'Sportsman Destinations – Fishing & Hunting',
  'Outdoor Activities – Hiking, Biking, Rafting, Skiing, Boating',
  'State & National Park Visits',
  'Unplug & Disconnect',
  'Experience a Unique Culture',
  'Romantic Getaway',
  'Historic Districts & Attractions',
  'Bleisure – Business & Leisure Travel',
  'Food & Wine Tasting',
  'Art & Cultural Experience',
].map((s) => ({ value: s, label: s }));

export const SPECIAL_TAGS = [
  { value: 'MOTIVATED_SELLER', label: 'Motivated Seller' },
  { value: 'OFF_MARKET', label: 'Off-Market Property' },
];
