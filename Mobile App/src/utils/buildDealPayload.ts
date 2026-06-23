import type { PropertyFormInput } from '@/utils/propertyFormSchema';

/**
 * Sanitize a form snapshot into the EXACT shape the backend's
 * POST /drafts / POST /deals handlers expect. Mirrors the admin's
 * buildDraftPayload (admin/views/SubmitterView.jsx):
 *   - Empty / `undefined` numeric fields become `null` (not '' or undefined)
 *   - Date strings normalize to ISO `YYYY-MM-DD`
 *   - Array fields default to `[]` if null/undefined
 *   - `isHOA` is a literal 'yes' / 'no' string
 *   - A `title` is computed from beds / baths / city → street → category
 *   - `submitterEmail` and `email` are set from the auth context
 *
 * Unknown keys pass through unchanged so future form fields work without
 * needing a schema update.
 */

function numOrNull(v: unknown): number | null {
  if (v === '' || v === undefined || v === null) return null;
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

function toIsoDate(v: unknown): string | null {
  if (!v) return null;
  if (typeof v !== 'string') return null;
  // Accepts YYYY-MM-DD already, OR ISO strings — strip time portion.
  const m = v.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  // Web submitter's MM/DD/YYYY (react-datepicker) — parse explicitly so we don't
  // depend on Hermes Date parsing (which rejects "06/21/2026") and wipe the date.
  const us = v.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (us) return `${us[3]}-${us[1].padStart(2, '0')}-${us[2].padStart(2, '0')}`;
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

// Trim so whitespace-only input ("   ") is saved as "" (and leading/trailing
// spaces are stripped) instead of persisting blank spaces to the database.
function strOrEmpty(v: unknown): string {
  return typeof v === 'string' ? v.trim() : '';
}

/** ISO (YYYY-MM-DD) for `n` days from today — used for the hidden expiry field. */
function isoDaysFromNow(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() + n);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function strArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.filter((x) => typeof x === 'string');
}

function computeTitle(form: Partial<PropertyFormInput>): string {
  const beds = (form as any).bedrooms;
  const baths = (form as any).bathrooms;
  const city = typeof (form as any).city === 'string' ? (form as any).city.trim() : (form as any).city;
  const street =
    typeof form.streetAddress === 'string' ? form.streetAddress.trim() : form.streetAddress;
  const bbc = [
    beds ? `${beds} Bed` : null,
    baths ? `${baths} Bath` : null,
    city ? String(city) : null,
  ].filter(Boolean);
  if (bbc.length >= 2) return bbc.join(', ');
  if (street) return String(street);
  if (form.category) return String(form.category).replace(/_/g, ' ');
  return 'Untitled Draft';
}

export interface BuildDealPayloadOpts {
  /** Authenticated user's email — used for `submitterEmail` and legacy `email`. */
  email?: string;
  /** Authenticated user's display name — admin's payload requires `fullName`. */
  fullName?: string;
  /** Authenticated user's phone — admin's payload requires `phone`. */
  phone?: string;
  /** Wizard step the user was on when the snapshot was taken (for Resume). */
  draftStep?: number;
}

export function buildDealPayload(
  form: PropertyFormInput,
  opts: BuildDealPayloadOpts = {},
): Record<string, unknown> {
  const email = opts.email ?? '';
  return {
    // Identity — admin POSTs all three; the backend's Joi schema for /deals
    // expects fullName and phone even though the JWT also carries an email.
    submitterEmail: email,
    email,
    fullName: opts.fullName ?? '',
    phone: opts.phone ?? '',

    // Hidden tracking field: every create / edit / draft submitted through this
    // builder originates from the mobile app, so stamp the source. Lets the
    // admin distinguish mobile-app submissions from web/admin ones.
    submitted_source: 'mobile_app',

    // Title (always include — backend may store/display it directly)
    title: computeTitle(form),

    // ── Step 1 ───────────────────────────────────────────────
    submitterRelationship: strOrEmpty(form.submitterRelationship),
    submittedByAdmin: !!(form as any).submittedByAdmin,
    submittedByAdminEmail: strOrEmpty((form as any).submittedByAdminEmail) || null,
    allowUnregisteredSeller: (form as any).allowUnregisteredSeller ?? null,
    category: strOrEmpty(form.category),
    description: strOrEmpty(form.description),
    story: strOrEmpty(form.story),
    // Property's Main Point of Contact + source link (Step 1)
    contactName: strOrEmpty((form as any).contactName),
    contactPhone: strOrEmpty((form as any).contactPhone),
    contactRelation: strOrEmpty((form as any).contactRelation),
    sourceLink: strOrEmpty((form as any).sourceLink),
    bedrooms: numOrNull(form.bedrooms),
    bathrooms: numOrNull(form.bathrooms),
    squareFootage: numOrNull(form.squareFootage),
    yearBuilt: numOrNull(form.yearBuilt),
    // Hidden auto field: fall back to today + 20 days if the form never set it.
    expiry_date: toIsoDate(form.expiry_date) ?? isoDaysFromNow(20),
    // HOA now lives in Step 1 (mirrors the submitter). Backend wants a boolean.
    isHOA: form.isHOA === 'yes',
    hoaMonthlyFee: numOrNull(form.hoaMonthlyFee),

    // ── Step 2 ───────────────────────────────────────────────
    streetAddress: strOrEmpty(form.streetAddress),
    addressLine2: strOrEmpty(form.addressLine2),
    city: strOrEmpty(form.city),
    stateRegion: strOrEmpty(form.stateRegion),
    postalCode: strOrEmpty(form.postalCode),

    // ── Step 3 ───────────────────────────────────────────────
    price: numOrNull(form.price),
    financingType: strOrEmpty(form.financingType),
    financialInfo: strOrEmpty(form.financialInfo),
    expectedCloseDate: toIsoDate(form.expectedCloseDate),
    emd: numOrNull(form.emd),
    downPayment: numOrNull(form.downPayment),
    assignmentFee: numOrNull(form.assignmentFee),
    // Creative financing — Primary mortgage
    hasPrimaryMortgage: strOrEmpty((form as any).hasPrimaryMortgage) || null,
    primaryLoanBalance: numOrNull((form as any).primaryLoanBalance),
    primaryInterestRate: numOrNull((form as any).primaryInterestRate),
    primaryMaturityDate: toIsoDate((form as any).primaryMaturityDate),
    primaryPrincipalInterest: numOrNull((form as any).primaryPrincipalInterest),
    primaryTaxesInsurance: numOrNull((form as any).primaryTaxesInsurance),
    // Creative financing — Second mortgage
    hasSecondMortgage: strOrEmpty((form as any).hasSecondMortgage) || null,
    secondLoanBalance: numOrNull((form as any).secondLoanBalance),
    secondInterestRate: numOrNull((form as any).secondInterestRate),
    secondMaturityDate: toIsoDate((form as any).secondMaturityDate),
    secondPrincipalInterest: numOrNull((form as any).secondPrincipalInterest),
    secondTaxesInsurance: numOrNull((form as any).secondTaxesInsurance),
    // Creative financing — Seller equity
    hasSellerEquity: strOrEmpty((form as any).hasSellerEquity) || null,
    sellerEquityAmount: numOrNull((form as any).sellerEquityAmount),
    sellerEquityInterestRate: numOrNull((form as any).sellerEquityInterestRate),
    sellerEquityMaturityDate: toIsoDate((form as any).sellerEquityMaturityDate),
    sellerEquityPrincipalInterest: numOrNull((form as any).sellerEquityPrincipalInterest),
    sellerEquityBalloonYears: strOrEmpty((form as any).sellerEquityBalloonYears) || null,
    // Creative financing — deal terms + total
    dealTerms: strOrEmpty((form as any).dealTerms),
    totalStartingMonthlyPayment: numOrNull((form as any).totalStartingMonthlyPayment),

    // ── Step 4 ───────────────────────────────────────────────
    strZoning: strOrEmpty(form.strZoning),
    isOperatingSTR: strOrEmpty((form as any).isOperatingSTR) || null,
    turnkeyFurnished: strOrEmpty(form.turnkeyFurnished),
    hasStrFinancials: strOrEmpty((form as any).hasStrFinancials) || null,
    strConfidence: strOrEmpty(form.strConfidence),
    occupancyRate: numOrNull(form.occupancyRate),
    // STR key metrics
    averageNightlyRate: numOrNull((form as any).averageNightlyRate),
    strAnnualRevenue: numOrNull((form as any).strAnnualRevenue),
    strMonthlyRevenue: numOrNull((form as any).strMonthlyRevenue),
    strMonthlyUtilities: numOrNull((form as any).strMonthlyUtilities),
    strNOI: numOrNull((form as any).strNOI),
    strCleaningFee: numOrNull((form as any).strCleaningFee),
    strAvgStay: numOrNull((form as any).strAvgStay),
    strManagementFee: numOrNull((form as any).strManagementFee),
    strBookingPlatform: strOrEmpty((form as any).strBookingPlatform) || null,
    hasCurrentBookings: strOrEmpty((form as any).hasCurrentBookings) || null,
    currentBookingsDescription: strOrEmpty((form as any).currentBookingsDescription),
    strFinancialDocs: strArray((form as any).strFinancialDocs),
    vacationRentalMarkets: strArray(form.vacationRentalMarkets),
    travelMotivations: strArray(form.travelMotivations),
    strListingLink: strOrEmpty(form.strListingLink),
    strDataSheetsLink: strOrEmpty(form.strDataSheetsLink),
    guestDemandInsights: strOrEmpty(form.guestDemandInsights),
    valueAddOpportunities: strOrEmpty(form.valueAddOpportunities),
    localContacts: strOrEmpty(form.localContacts),
    // Derived: the backend stores a boolean turnkey flag alongside the enum.
    turnkey: strOrEmpty(form.turnkeyFurnished) === 'TURNKEY_OPERATING',

    // ── Step 5 ───────────────────────────────────────────────
    coverPhoto: strArray((form as any).coverPhoto),
    interiorImages: strArray(form.interiorImages),
    exteriorImages: strArray(form.exteriorImages),
    additionalImages: strArray(form.additionalImages),
    videos: strArray(form.videos),
    propertyPdf: strOrEmpty(form.propertyPdf),
    amenities: strOrEmpty(form.amenities),
    localAttractions: strOrEmpty(form.localAttractions),
    specialTags: strArray(form.specialTags),

    // ── Step 6 ───────────────────────────────────────────────
    priorityFirstAccess: !!form.priorityFirstAccess,
    fiftyFiftyPartner: !!form.fiftyFiftyPartner,
    doneForYou: !!form.doneForYou,
    additionalInfo: strOrEmpty(form.additionalInfo),

    // Wizard position — admin uses this for the Resume button.
    ...(opts.draftStep !== undefined ? { draftStep: opts.draftStep } : {}),
  };
}
