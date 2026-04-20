/**
 * Input Validation Middleware
 * Validates request data using Joi schemas
 */
const Joi = require('joi');

/* ---------------- ENUMS ---------------- */

const PROPERTY_CATEGORIES = [
  'SINGLE_FAMILY',
  'CONDO',
  'TOWNHOUSE',
  'TWO_TO_FOUR_UNIT',
  'UNIQUE_PROPERTY',
];

const RELATIONSHIP_TYPES = [
  'TEAM_MEMBER',
  'REALTOR_LISTING_OWNER',
  'REALTOR_NOT_LISTING_OWNER',
  'WHOLESALER_HOLDS_CONTRACT',
  'WHOLESALER_NO_CONTRACT',
  'REAL_ESTATE_PROFESSIONAL',
  'BIRDDOGGER',
];

const FINANCING_TYPES = [
  'traditional',
  'subject-to',
  'hybrid',
  'seller',
  'cash',
];

const STR_CONFIDENCE = [
  'first-hand',
  'airdna',
  'not-confident',
  'FIRST_HAND',
  'AIRDNA',
  'DIRECTIONAL_ONLY',
];

const STR_ZONING = ['yes', 'no', 'unsure', 'YES', 'NO', 'UNSURE'];

const TURNKEY_FURNISHED = [
  'turnkey-operating',
  'furnished-not-operating',
  'partially-furnished',
  'not-furnished',
  'TURNKEY_OPERATING',
  'FURNISHED_NOT_OPERATING',
  'PARTIALLY_FURNISHED',
  'NOT_FURNISHED',
];

/* ---------------- CREATE DEAL ---------------- */

const createDealSchema = Joi.object({
  /* -------- CORE -------- */
  relationshipToProperty: Joi.string()
    .valid(...RELATIONSHIP_TYPES)
    .allow(null),

  submitterRelationship: Joi.string()
    .valid(...RELATIONSHIP_TYPES)
    .allow(null),

  description: Joi.string().max(2000).required(),

  category: Joi.string()
    .valid(...PROPERTY_CATEGORIES)
    .required(),

  priorityFirstAccess: Joi.boolean().default(false),
  fiftyFiftyPartner: Joi.boolean().default(false),
  doneForYou: Joi.boolean().default(false),
  additionalInfo: Joi.string().allow('', null),

  /* -------- SOLD STATUS -------- */
  soldAt: Joi.string().isoDate().allow(null),
  soldBy: Joi.string().email().allow(null),

  /* -------- LOCATION -------- */
  streetAddress: Joi.string().required(),
  addressLine2: Joi.string().allow('', null),
  city: Joi.string().required(),
  stateRegion: Joi.string().required(),
  postalCode: Joi.string().required(),

  /* -------- SPECS -------- */
  bedrooms: Joi.number().min(0).required(),
  bathrooms: Joi.number().min(0).required(),
  squareFootage: Joi.number().positive().required(),
  yearBuilt: Joi.number().integer().required(),

  /* -------- PRICING -------- */
  price: Joi.number().positive().required(),
  expectedCloseOfEscrow: Joi.string().allow(null),

  /* -------- HOA -------- */
  isHOA: Joi.boolean().default(false),
  hoaMonthlyFee: Joi.when('isHOA', {
    is: true,
    then: Joi.number().positive().required(),
    otherwise: Joi.allow(null),
  }),

  /* -------- MEDIA -------- */
  interiorImages: Joi.array().items(Joi.string().uri()).min(1).required(),
  exteriorImages: Joi.array().items(Joi.string().uri()).min(1).required(),
  videos: Joi.array().items(Joi.string().uri()).default([]),

  /* -------- STR DATA -------- */
  strConfidence: Joi.string()
    .valid(...STR_CONFIDENCE)
    .required(),

  strZoning: Joi.string()
    .valid(...STR_ZONING)
    .required(),

  turnkeyFurnished: Joi.string()
    .valid(...TURNKEY_FURNISHED)
    .required(),

  strMarketScore: Joi.number().allow(null),
  strOccupancyRate: Joi.number().allow(null),
  strAvgDailyRate: Joi.number().allow(null),
  strAnnualRevenue: Joi.number().allow(null),
  strOperatingExpenses: Joi.number().allow(null),
  strNetOperatingIncome: Joi.number().allow(null),

  strListingLink: Joi.string().allow('', null),
  strDataSheetsLink: Joi.string().allow('', null),

  vacationRentalMarkets: Joi.array().items(Joi.string()).allow(null),

  /* -------- FINANCING -------- */
  financingType: Joi.string()
    .valid(...FINANCING_TYPES)
    .required(),

  emd: Joi.number().allow(null),
  downPayment: Joi.number().allow(null),

  subjLoanBalance: Joi.number().allow(null),
  subjInterestRate: Joi.number().allow(null),
  subjLoanMaturity: Joi.string().allow(null),
  subjMonthlyPrincipal: Joi.number().allow(null),
  subjMonthlyInterest: Joi.number().allow(null),
  subjMonthlyTaxesInsurance: Joi.number().allow(null),

  sellerLoanAmount: Joi.number().allow(null),
  sellerInterestRate: Joi.number().allow(null),
  sellerLoanMaturity: Joi.string().allow(null),
  sellerMonthlyPayment: Joi.number().allow(null),

  totalMonthlyPayment: Joi.number().allow(null),

  /* -------- UNDERWRITING -------- */
  marketType: Joi.string().allow(null),
  marketSize: Joi.string().allow(null),

  occupancyRate: Joi.number().allow(null),
  averageNightlyRate: Joi.number().allow(null),

  furnitureBudget: Joi.number().allow(null),
  managementCommissionPct: Joi.number().allow(null),
  cleaningAndVariableExpenses: Joi.number().allow(null),
  fixedOperatingExpenses: Joi.number().allow(null),

  costSegregationPct: Joi.number().allow(null),
  effectiveTaxRatePct: Joi.number().allow(null),

  revenueIncreasePct: Joi.number().allow(null),
  propertyAppreciationPct: Joi.number().allow(null),

  travelDrivers: Joi.array().items(Joi.string()).allow(null),
  guestPreferences: Joi.string().allow(null),
  valueAddIdeas: Joi.string().allow(null),
  localRecommendations: Joi.string().allow(null),

  amenities: Joi.alternatives()
    .try(Joi.array().items(Joi.string()), Joi.string().allow(''))
    .allow(null),

  localAttractions: Joi.alternatives()
    .try(Joi.array().items(Joi.string()), Joi.string().allow(''))
    .allow(null),

  specialTags: Joi.array().items(Joi.string()).allow(null),
})
  /* -------- DYNAMIC NUMERIC FIELDS -------- */
  .pattern(/^marketRevenue_\d+m$/, Joi.number().allow(null))
  .pattern(/^marketOccupancy_\d+m$/, Joi.number().allow(null))
  .pattern(/^projectedRevenue_\d+m$/, Joi.number().allow(null))
  .pattern(
    /^anr_\d+m_(budget|economy|midscale|upscale|luxury)$/,
    Joi.number().allow(null)
  )
  .pattern(
    /^projectedRevenue_\d+m_(budget|economy|midscale|upscale|luxury)$/,
    Joi.number().allow(null)
  )
  .unknown(true);

/* ---------------- UPDATE DEAL ---------------- */

const updateDealSchema = createDealSchema.fork(
  Object.keys(createDealSchema.describe().keys),
  (schema) => schema.optional()
);

/* ---------------- VALIDATION MIDDLEWARE ---------------- */

const validate = (schema) => (req, res, next) => {
  const { error, value } = schema.validate(req.body, {
    abortEarly: false,
    stripUnknown: false,
    convert: true,
  });

  if (error) {
    return res.status(400).json({
      error: 'Validation failed',
      details: error.details.map((err) => ({
        field: err.path.join('.'),
        message: err.message,
      })),
    });
  }

  req.validatedBody = value;
  next();
};

module.exports = {
  validate,
  createDealSchema,
  updateDealSchema,
};
