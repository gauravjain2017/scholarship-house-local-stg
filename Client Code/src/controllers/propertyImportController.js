/**
 * Property Import Controller
 *
 * All the business logic for /api/propertyImport. The route file is now
 * just thin glue — it wires middleware + multer to these handlers.
 *
 * Behavior:
 *   parseFile     — upload a PDF/XLSX/XLS/CSV; returns the parsed rows for
 *                   preview. Nothing is written.
 *   commitImport  — receive the rows the admin approved and either CREATE
 *                   a new deal or UPDATE an existing one when the
 *                   normalizedAddress matches a deal already in DynamoDB.
 *
 * FILE: backend/src/controllers/propertyImportController.js
 */
const Submitter = require('../models/Submitter');
const Deal                   = require('../models/Deal');
const { generateAddressKey } = require('../utils/addressNormalizer');
const { dynamoDB, TABLES }   = require('../config/aws');
const { ScanCommand }        = require('@aws-sdk/lib-dynamodb');
const pdfParserService       = require('../services/pdfParserService');

const DEALS_TABLE =
  TABLES?.DEALS || process.env.PROPERTIES_TABLE || 'properties';

/* ------------------------------------------------------------------ */
/* Validation                                                         */
/* ------------------------------------------------------------------ */
const REQUIRED = [
  'submitterRelationship',
  'streetAddress', 'city', 'stateRegion', 'postalCode',
  'category', 'bedrooms', 'bathrooms',
  'squareFootage', 'yearBuilt', 'price',
  'financingType', 'expiry_date',
  'strConfidence', 'turnkeyFurnished', 'strZoning',
  'description', 'interiorImages', 'exteriorImages',
];

const VALID_CATEGORIES     = ['SINGLE_FAMILY', 'CONDO', 'TOWNHOUSE', 'TWO_TO_FOUR_UNIT', 'UNIQUE_PROPERTY'];
const VALID_RELATIONSHIPS  = ['TEAM_MEMBER', 'REALTOR_LISTING_OWNER', 'REALTOR_NOT_LISTING_OWNER', 'WHOLESALER_HOLDS_CONTRACT', 'WHOLESALER_NO_CONTRACT', 'REAL_ESTATE_PROFESSIONAL', 'BIRDDOGGER'];
const VALID_FINANCING      = ['traditional', 'subject-to', 'hybrid', 'seller', 'cash'];
const VALID_STR_CONFIDENCE = ['FIRST_HAND', 'AIRDNA', 'DIRECTIONAL_ONLY'];
const VALID_TURNKEY        = ['TURNKEY_OPERATING', 'FURNISHED_NOT_OPERATING', 'PARTIALLY_FURNISHED', 'NOT_FURNISHED'];
const VALID_STR_ZONING     = ['YES', 'NO', 'UNSURE'];

// All 50 US state codes — used to reject "ZZ" and other 2-char strings
// that aren't real states.
const VALID_STATE_CODES = new Set([
  'AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA',
  'KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ',
  'NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT',
  'VA','WA','WV','WI','WY',
]);

function validateRowServerSide(row) {
  for (const f of REQUIRED) {
    const v = row[f];
    if (Array.isArray(v)) {
      if (v.length === 0) return `Missing ${f}`;
    } else if (!v || String(v).trim() === '') {
      return `Missing ${f}`;
    }
  }
  if (!/^\d{5}(-\d{4})?$/.test(String(row.postalCode).trim())) return 'Invalid postal code';
  if (!/^[A-Z]{2}$/.test(row.stateRegion)) return 'Invalid state code';
  if (!VALID_STATE_CODES.has(row.stateRegion)) return `"${row.stateRegion}" is not a US state`;
  if (!VALID_CATEGORIES.includes(row.category)) return 'Invalid property type';

  if (!VALID_RELATIONSHIPS.includes(row.submitterRelationship)) return 'Invalid relationship';
  if (!VALID_FINANCING.includes(row.financingType))             return 'Invalid financing type';
  if (!VALID_STR_CONFIDENCE.includes(row.strConfidence))        return 'Invalid STR confidence';
  if (!VALID_TURNKEY.includes(row.turnkeyFurnished))            return 'Invalid turnkey/furnished value';
  if (!VALID_STR_ZONING.includes(row.strZoning))                return 'Invalid STR zoning value';

  // Optional fields — only validate format when supplied. None of these
  // are in REQUIRED, so a row without them stays valid.
  if (row.expectedCloseDate && !/^\d{4}-\d{2}-\d{2}$/.test(row.expectedCloseDate)) {
    return 'Invalid expected close date (use YYYY-MM-DD)';
  }
  if (row.emd          !== undefined && row.emd          !== '' && !Number.isFinite(Number(row.emd)))          return 'Invalid EMD amount';
  if (row.downPayment  !== undefined && row.downPayment  !== '' && !Number.isFinite(Number(row.downPayment)))  return 'Invalid down payment amount';
  if (row.assignmentFee !== undefined && row.assignmentFee !== '' && !Number.isFinite(Number(row.assignmentFee))) return 'Invalid assignment fee amount';


  return null;
}

/* ------------------------------------------------------------------ */
/* Helpers                                                            */
/* ------------------------------------------------------------------ */
function generateDealTitle({ bedrooms, bathrooms, city, stateRegion }) {
  const bed  = bedrooms  ? `${bedrooms} Bedroom`   : '';
  const bath = bathrooms ? `${bathrooms} Bathroom` : '';
  const loc  = city && stateRegion ? `in ${city}, ${stateRegion}` : '';
  return [bed, bath, loc].filter(Boolean).join(', ');
}

const stripUndefined = (obj) => {
  Object.keys(obj).forEach((k) => {
    const v = obj[k];
    if (v === undefined || v === '' || v === null) delete obj[k];
    if (typeof v === 'number' && Number.isNaN(v)) delete obj[k];
  });
  return obj;
};

/**
 * Look up an existing deal by `normalizedAddress` so an import can update
 * (rather than duplicate) a property already in DynamoDB.
 *
 * Uses the same `generateAddressKey` helper as dealController.createDeal,
 * so a PDF/Excel import will recognize a property already submitted via
 * the regular form (and vice versa). Same street + city + state + zip,
 * normalized to a single string.
 *
 * DynamoDB scan semantics note:
 *   FilterExpression is applied AFTER each page is read. `Limit: N` caps
 *   how many items are READ, not how many match — so `Limit: 1` would
 *   read one item, filter it, and return nothing if that item happens
 *   not to match. We paginate through LastEvaluatedKey until we either
 *   find a match or exhaust the table.
 *
 * For tables larger than a few thousand rows you should add a GSI on
 * `normalizedAddress` and switch this to QueryCommand.
 */
async function findExistingDeal(normalizedAddress) {
  if (!normalizedAddress) return null;

  let exclusiveStartKey;
  do {
    const result = await dynamoDB.send(new ScanCommand({
      TableName: DEALS_TABLE,
      FilterExpression: 'normalizedAddress = :addr',
      ExpressionAttributeValues: { ':addr': normalizedAddress },
      ExclusiveStartKey: exclusiveStartKey,
    }));

    if (result.Items && result.Items.length > 0) {
      return result.Items[0];
    }
    exclusiveStartKey = result.LastEvaluatedKey;
  } while (exclusiveStartKey);

  return null;
}

/**
 * Build the payload that will be sent to Deal.create / Deal.update.
 * Mirrors dealController.createDeal so imports behave identically to
 * properties submitted through the regular form.
 */
function buildDealPayload(row, { adminEmail, adminName, normalizedAddress, title }) {
  return stripUndefined({
    title,

    // Address
    streetAddress:    row.streetAddress,
    addressLine2:     row.addressLine2 || '',
    city:             row.city,
    stateRegion:      row.stateRegion,
    postalCode:       String(row.postalCode).trim(),
    normalizedAddress,

    // Property
    category:         row.category,
    bedrooms:         Number(row.bedrooms),
    bathrooms:        Number(row.bathrooms),
    squareFootage:    row.squareFootage ? Number(row.squareFootage) : undefined,
    yearBuilt:        row.yearBuilt     ? Number(row.yearBuilt)     : undefined,

    // Money
    price:            row.price ? Number(row.price) : undefined,
    rent:             row.rent  ? Number(row.rent)  : undefined,
    financingType:    row.financingType || undefined,

    // Optional money fields. `stripUndefined` will drop blanks, so the
    // existing record won't get its values blown away on update.
    emd:              row.emd          !== undefined && row.emd          !== '' ? Number(row.emd)          : undefined,
    downPayment:      row.downPayment  !== undefined && row.downPayment  !== '' ? Number(row.downPayment)  : undefined,
    assignmentFee:    row.assignmentFee !== undefined && row.assignmentFee !== '' ? Number(row.assignmentFee) : undefined,

    // Lifecycle / submitter context
    expiry_date:           row.expiry_date || undefined,
    expectedCloseDate:     row.expectedCloseDate || undefined,
    submitterRelationship: row.submitterRelationship || undefined,

    // STR-specific
    strConfidence:    row.strConfidence    || undefined,
    turnkeyFurnished: row.turnkeyFurnished || undefined,
    strZoning:        row.strZoning        || undefined,
   

    // Long text + media
    description:      row.description || '',
    amenities:        row.amenities   || '',
    story:            row.story         || undefined,
    financialInfo:    row.financialInfo || undefined,
    additionalInfo:   row.additionalInfo || undefined,
    interiorImages:   Array.isArray(row.interiorImages) ? row.interiorImages : [],
    exteriorImages:   Array.isArray(row.exteriorImages) ? row.exteriorImages : [],

    // Source / submitter tracking
    submitterEmail:    adminEmail,
    submitterName:     adminName,
    submitterUserType: 'Admin',
    importSource:      'pdf',
  });
}

/**
 * Default field values applied only on CREATE (not on update). Updates
 * shouldn't reset, e.g., `priorityFirstAccess` if a deal already has it.
 */
function createOnlyDefaults() {
  return {
    priorityFirstAccess:    true,
    fiftyFiftyPartner:      false,
    fiftyFiftyPreApproved:  false,
    doneForYou:             false,
  };
}

/* ================================================================== */
/* Handlers                                                            */
/* ================================================================== */

/**
 * POST /api/propertyImport/parse
 *   multipart/form-data, file=<PDF | XLSX | XLS | CSV>
 */
const parseFile = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    const result = await pdfParserService.parsePropertiesFromBuffer(
      req.file.buffer,
      req.file.originalname
    );
    return res.json({ data: result });
  } catch (err) {
    console.error('[propertyImport.parseFile]', err);
    return res.status(500).json({ error: err.message || 'Failed to parse file' });
  }
};

/**
 * POST /api/propertyImport/commit
 *   JSON body: { properties: [ ... ] }
 *
 * Each row is upserted by `normalizedAddress`:
 *   - no match in DynamoDB        -> Deal.create()      (counted in `created`)
 *   - match found                  -> Deal.update()      (counted in `updated`)
 *   - validation failure           -> ignored            (counted in `failed`)
 *
 * Response shape:
 *   { data: { created, createdIds, updated, updatedIds,
 *             skipped, skippedDetails, failed } }
 *
 * `skipped` is kept in the response for API stability with the original
 * flow, but it'll always be 0 now that duplicates are upserted instead.
 */
const commitImport = async (req, res) => {
  const { properties } = req.body || {};
  if (!Array.isArray(properties) || properties.length === 0) {
    return res.status(400).json({ error: 'No properties supplied' });
  }


const usersDetail = await Submitter.listAll(req.query);
const userEmail = req.user?.email;
const usersDetailArr = usersDetail.find(u => u.email === userEmail);
const created     = [];
const updated     = [];
const failed      = [];
const skipped     = []; // kept empty for API back-compat
const adminEmail = (req.user?.email || '').toLowerCase();
const adminName = `${usersDetailArr?.firstName || ''} ${usersDetailArr?.lastName || ''}`.trim();


  for (let i = 0; i < properties.length; i++) {
    const row = properties[i];

    try {
      const validationError = validateRowServerSide(row);
      if (validationError) {
        failed.push({ index: i, reason: validationError });
        continue;
      }

      const normalizedAddress = generateAddressKey({
        streetAddress: row.streetAddress,
        city:          row.city,
        stateRegion:   row.stateRegion,
        postalCode:    row.postalCode,
      });

      const title = generateDealTitle({
        bedrooms:    row.bedrooms,
        bathrooms:   row.bathrooms,
        city:        row.city,
        stateRegion: row.stateRegion,
      });

      const payload = buildDealPayload(row, {
        adminEmail,
        adminName,
        normalizedAddress,
        title,
      });

      const existing = await findExistingDeal(normalizedAddress);

      console.log(
        `[propertyImport] row ${i} address=${JSON.stringify(normalizedAddress)} ` +
        `match=${existing ? `update(${existing.id})` : 'create'}`
      );

      if (existing) {
        // ---- UPDATE PATH ----
        // Don't overwrite the original submitter info or status — those
        // belong to whoever first created the deal. We're refreshing the
        // property data, not taking ownership.
        const updatePayload = { ...payload };
        delete updatePayload.submitterEmail;
        delete updatePayload.submitterName;
        delete updatePayload.submitterUserType;

        const result = await Deal.update(existing.id, updatePayload);
        updated.push(result?.id || existing.id);
      } else {
        // ---- CREATE PATH ----
        // Deal.create() injects id, status='pending', submittedAt,
        // createdAt, updatedAt. We add the create-only defaults here.
        const createPayload = {
          ...payload,
          ...createOnlyDefaults(),
        };
        const result = await Deal.create(createPayload);
        created.push(result.id);
      }

    } catch (err) {
      console.error('[propertyImport.commitImport] row', i, err);
      failed.push({ index: i, reason: err.message || 'Unknown error' });
    }
  }

  return res.json({
    data: {
      created:        created.length,
      createdIds:     created,
      updated:        updated.length,
      updatedIds:     updated,
      skipped:        skipped.length,
      skippedDetails: skipped,
      failed,
    },
  });
};

module.exports = {
  parseFile,
  commitImport,

  // Exported for unit tests / reuse
  __internal: {
    validateRowServerSide,
    generateDealTitle,
    buildDealPayload,
    findExistingDeal,
    stripUndefined,
  },
};
