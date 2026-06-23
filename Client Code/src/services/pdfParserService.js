/**
 * services/pdfParserService.js
 *
 * Server-side counterpart to /utils/pdfImportParser.js. Handles both PDF
 * (via pdf-parse) and Excel/CSV (via xlsx) buffers. Output shape is
 * identical to the client parser so /parse on the server and in-browser
 * parsing are interchangeable.
 *
 * Install deps: `npm i pdf-parse xlsx`
 */

const pdfParse = require('pdf-parse');
const XLSX     = require('xlsx');

/* ================================================================== */
/* Field aliases                                                      */
/* ================================================================== */
const FIELD_ALIASES = {
  'your relationship to this property': 'submitterRelationship',
  'submitter relationship': 'submitterRelationship',
  'relationship': 'submitterRelationship',
  'relationship to property': 'submitterRelationship',

  'address': 'streetAddress',
  'street address': 'streetAddress',
  'street': 'streetAddress',
  'address line 2': 'addressLine2',
  'unit': 'addressLine2',
  'apt': 'addressLine2',

  'city': 'city',
  'state': 'stateRegion',
  'state/region': 'stateRegion',
  'state / region': 'stateRegion',
  'zip': 'postalCode',
  'zip code': 'postalCode',
  'postal code': 'postalCode',
  'postal/zip': 'postalCode',
  'postal/zip code': 'postalCode',
  'postal / zip code': 'postalCode',

  'property type': 'category',
  'type': 'category',
  'category': 'category',

  'bedrooms': 'bedrooms',
  'beds': 'bedrooms',
  'bathrooms': 'bathrooms',
  'baths': 'bathrooms',

  'square footage': 'squareFootage',
  'sq ft': 'squareFootage',
  'sqft': 'squareFootage',

  'year built': 'yearBuilt',

  'property expiry date': 'expiry_date',
  'expiry date': 'expiry_date',
  'listing expiry': 'expiry_date',
  'expires': 'expiry_date',

  'price': 'price',
  'rent': 'rent',
  'monthly rent': 'rent',
  'rent / price': 'priceOrRent',
  'rent/price': 'priceOrRent',

  'type of financing': 'financingType',
  'financing': 'financingType',
  'financing type': 'financingType',

  'how confident are you in the accuracy of the following data?': 'strConfidence',
  'how confident are you in the accuracy of the following data': 'strConfidence',
  'data confidence': 'strConfidence',
  'str confidence': 'strConfidence',

  'turnkey or furnished str property?': 'turnkeyFurnished',
  'turnkey or furnished str property': 'turnkeyFurnished',
  'turnkey/furnished': 'turnkeyFurnished',
  'turnkey furnished': 'turnkeyFurnished',

  'confirm str zoning availability': 'strZoning',
  'str zoning': 'strZoning',
  'str zoning availability': 'strZoning',

  'description': 'description',
  'amenities': 'amenities',

  // Optional — narrative
  'story': 'story',
  'property story': 'story',
  'background story': 'story',

  // Optional — money
  'earnest money deposit': 'emd',
  'earnest money deposit (emd)': 'emd',
  'earnest money deposit (emd) ($)': 'emd',
  'emd': 'emd',
  'emd ($)': 'emd',
  'down payment': 'downPayment',
  'down payment (excluding closing costs)': 'downPayment',
  'down payment (excluding closing costs) ($)': 'downPayment',
  'down payment ($)': 'downPayment',
  'assignment fee': 'assignmentFee',
  'assignment fee ($)': 'assignmentFee',
  'additional financial information': 'financialInfo',
  'financial information': 'financialInfo',
  'financial info': 'financialInfo',

  // Optional — STR / market
  'occupancy rate': 'occupancyRate',
  'occupancy rate (%)': 'occupancyRate',
  'occupancy': 'occupancyRate',

  // Optional — escrow / catch-all
  'expected close of escrow': 'expectedCloseDate',
  'expected close date': 'expectedCloseDate',
  'expected closing date': 'expectedCloseDate',
  'close of escrow': 'expectedCloseDate',
  'additional information': 'additionalInfo',
  'additional info': 'additionalInfo',
  'notes': 'additionalInfo',

  'interior photos': 'interiorImages',
  'interior images': 'interiorImages',
  'exterior photos': 'exteriorImages',
  'exterior images': 'exteriorImages',
  'images': 'images',
  'photos': 'images',
  'image urls': 'images',
};

const CATEGORY_MAP = {
  'single family':       'SINGLE_FAMILY',
  'single-family':       'SINGLE_FAMILY',
  'condo':               'CONDO',
  'town house':          'TOWNHOUSE',
  'townhouse':           'TOWNHOUSE',
  '2-4 unit home':       'TWO_TO_FOUR_UNIT',
  '2–4 unit home':       'TWO_TO_FOUR_UNIT',  // unicode en-dash
  '2 to 4 unit':         'TWO_TO_FOUR_UNIT',
  '2-4 unit':            'TWO_TO_FOUR_UNIT',
  'unique property':     'UNIQUE_PROPERTY',
  'unique':              'UNIQUE_PROPERTY',
 
};

const RELATIONSHIP_MAP = {
  'team member': 'TEAM_MEMBER',
  'listing realtor': 'REALTOR_LISTING_OWNER',
  'non listing realtor': 'REALTOR_NOT_LISTING_OWNER',
  'contract wholesaler': 'WHOLESALER_HOLDS_CONTRACT',
  'non contract wholesaler': 'WHOLESALER_NO_CONTRACT',
  'client representative': 'REAL_ESTATE_PROFESSIONAL',
  'property birddogger': 'BIRDDOGGER'
};

const FINANCING_MAP = {
  'traditional':                          'traditional',
  'subject-to':                           'subject-to',
  'subject to':                           'subject-to',
  'hybrid':                               'hybrid',
  'seller financing':                     'seller',
  'seller':                               'seller',
  'cash only':                            'cash',
  'cash':                                 'cash',
};

const STR_CONFIDENCE_MAP = {
  'first-hand':'FIRST_HAND',
  'first hand': 'FIRST_HAND',
  'airdna':'AIRDNA',
  'directional only':'DIRECTIONAL_ONLY',
  'directional': 'DIRECTIONAL_ONLY',
};



const TURNKEY_MAP = {
'turnkey':'TURNKEY_OPERATING',
'fully furnished':'FURNISHED_NOT_OPERATING',
'partially furnished':'PARTIALLY_FURNISHED',
'not furnished':'NOT_FURNISHED',
};



const STR_ZONING_MAP = {
  'yes':      'YES',
  'no':       'NO',
  'not sure': 'UNSURE',
  'unsure':   'UNSURE',
};


const STATE_NAME_TO_CODE = {
  alabama: 'AL', alaska: 'AK', arizona: 'AZ', arkansas: 'AR', california: 'CA',
  colorado: 'CO', connecticut: 'CT', delaware: 'DE', florida: 'FL', georgia: 'GA',
  hawaii: 'HI', idaho: 'ID', illinois: 'IL', indiana: 'IN', iowa: 'IA',
  kansas: 'KS', kentucky: 'KY', louisiana: 'LA', maine: 'ME', maryland: 'MD',
  massachusetts: 'MA', michigan: 'MI', minnesota: 'MN', mississippi: 'MS',
  missouri: 'MO', montana: 'MT', nebraska: 'NE', nevada: 'NV',
  'new hampshire': 'NH', 'new jersey': 'NJ', 'new mexico': 'NM',
  'new york': 'NY', 'north carolina': 'NC', 'north dakota': 'ND',
  ohio: 'OH', oklahoma: 'OK', oregon: 'OR', pennsylvania: 'PA',
  'rhode island': 'RI', 'south carolina': 'SC', 'south dakota': 'SD',
  tennessee: 'TN', texas: 'TX', utah: 'UT', vermont: 'VT', virginia: 'VA',
  washington: 'WA', 'west virginia': 'WV', wisconsin: 'WI', wyoming: 'WY',
};

const SEPARATOR_RE = /^\s*(-{3,}|={3,}|\*{3,}|_{3,}|property\s*#?\s*\d+)\s*$/i;

// Set of valid 2-letter state codes derived from STATE_NAME_TO_CODE so we
// can reject "ZZ" and any other 2-char string that isn't a real US state.
const VALID_STATE_CODES = new Set(Object.values(STATE_NAME_TO_CODE));

const REQUIRED_FIELDS = [
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

/* ================================================================== */
/* Helpers (logic mirrors client/utils/pdfImportParser.js)             */
/* ================================================================== */
function normalizeKey(label) {
  return label.trim().toLowerCase().replace(/\s+/g, ' ');
}

function findAlias(label) {
  const k = normalizeKey(label);
  if (FIELD_ALIASES[k]) return FIELD_ALIASES[k];
  const stripped = k.replace(/\?$/, '').trim();
  return FIELD_ALIASES[stripped] || null;
}

function splitIntoBlocks(text) {
  const lines = text.split(/\r?\n/);
  const blocks = [];
  let current = { lines: [], startLine: 0 };

  lines.forEach((line, idx) => {
    if (SEPARATOR_RE.test(line)) {
      if (current.lines.length) blocks.push({ ...current, endLine: idx - 1 });
      current = { lines: [], startLine: idx + 1 };
    } else {
      current.lines.push(line);
    }
  });
  if (current.lines.length) blocks.push({ ...current, endLine: lines.length - 1 });

  return blocks.filter((b) =>
    b.lines.some((l) =>
      /^[A-Za-z][A-Za-z0-9 /?&-]+:\s*\S/.test(l) ||
      matchLabelPrefix(l.trim()) !== null
    )
  );
}

const ALIAS_KEYS_SORTED = Object.keys(FIELD_ALIASES).sort(
  (a, b) => b.length - a.length
);

// Strip trailing decoration (colon, "?", "*", "!", ".", whitespace)
// from a label so matching is robust against minor PDF layout changes
// like adding ":" to every field. The alias map stores bare labels —
// anything compared against it should run through this helper first.
function stripLabelChrome(s) {
  return (s || '').replace(/[\s:?*.!]+$/g, '');
}

function matchLabelPrefix(line) {
  const lower = line.toLowerCase();
  for (const aliasLabel of ALIAS_KEYS_SORTED) {
    if (lower.startsWith(aliasLabel + ' ') || lower === aliasLabel) {
      const value = line.slice(aliasLabel.length).trim();
      return { aliasKey: FIELD_ALIASES[aliasLabel], value };
    }
    // Tolerate punctuation between alias and value: "Story: <value>".
    const lenA = aliasLabel.length;
    if (lower.length > lenA && lower.startsWith(aliasLabel)) {
      const after = lower.slice(lenA);
      const m = after.match(/^[\s:?*.!]+/);
      if (m) {
        const value = line.slice(lenA + m[0].length).trim();
        return { aliasKey: FIELD_ALIASES[aliasLabel], value };
      }
    }
  }
  return null;
}

// Match a partial (wrapped) label and disambiguate via the next line's
// content. Returns { aliasKey, value, labelTail, consumedNextLine }.
function matchPartialLabelWithLookahead(line, nextLine) {
  const lower = line.toLowerCase();
  const nextLower = stripLabelChrome((nextLine || '').toLowerCase().trim());
  const candidates = [];
  for (const aliasLabel of ALIAS_KEYS_SORTED) {
    const words = aliasLabel.split(' ');
    if (words.length < 3) continue;
    for (let n = words.length - 1; n >= 2; n--) {
      const partial = words.slice(0, n).join(' ');
      let value;
      if (lower.startsWith(partial + ' ')) {
        value = line.slice(partial.length).trim();
      } else if (lower.startsWith(partial)) {
        const after = lower.slice(partial.length);
        const m = after.match(/^[\s:?*.!]+/);
        if (!m) continue;
        value = line.slice(partial.length + m[0].length).trim();
      } else {
        continue;
      }
      if (!value) continue;
      if (matchLabelPrefix(value)) continue;
      const tail = words.slice(n).join(' ').toLowerCase();
      candidates.push({
        aliasKey: FIELD_ALIASES[aliasLabel],
        aliasLength: aliasLabel.length,
        value,
        labelTail: tail,
      });
    }
  }
  if (candidates.length === 0) return null;
  const tailMatches = (tail) => {
    const t = stripLabelChrome(tail);
    return nextLower === t || nextLower.startsWith(t + ' ');
  };
  const confirmed = candidates.filter((c) => tailMatches(c.labelTail));
  const pool = confirmed.length > 0 ? confirmed : candidates;
  pool.sort((a, b) => b.aliasLength - a.aliasLength);
  const best = pool[0];
  return {
    aliasKey: best.aliasKey,
    value: best.value,
    labelTail: best.labelTail,
    consumedNextLine: tailMatches(best.labelTail),
  };
}

// True when text is the wrapped tail of a known alias.
function isAliasTail(text) {
  const lower = stripLabelChrome((text || '').toLowerCase().trim());
  if (!lower) return false;
  for (const aliasLabel of ALIAS_KEYS_SORTED) {
    if (aliasLabel.length > lower.length &&
        aliasLabel.endsWith(' ' + lower)) {
      return true;
    }
  }
  return false;
}

function parseBlock(block) {
  const fields = {};
  let lastKey = null;
  const lines = block.lines;
  let i = 0;
  const append = (key, val) => {
    fields[key] = (fields[key] ? fields[key] + ' ' : '') + val;
    lastKey = key;
  };

  while (i < lines.length) {
    const line = lines[i].trim();
    if (!line) { i++; continue; }

    // 1. Field: Value with colon
    const m = line.match(/^([A-Za-z][A-Za-z0-9 /&?-]{1,80}?)\s*[:\-\u2013]\s*(.*)$/);
    if (m) {
      const aliasKey = findAlias(m[1]);
      if (aliasKey) { append(aliasKey, m[2].trim()); i++; continue; }
    }

    // 2. Full label match
    const prefixMatch = matchLabelPrefix(line);
    if (prefixMatch && prefixMatch.value) {
      append(prefixMatch.aliasKey, prefixMatch.value);
      i++; continue;
    }

    // 3. Partial label with lookahead
    let nextLine = '';
    let nextLineIdx = -1;
    for (let j = i + 1; j < lines.length; j++) {
      const t = lines[j].trim();
      if (t) { nextLine = t; nextLineIdx = j; break; }
    }
    const partialMatch = matchPartialLabelWithLookahead(line, nextLine);
    if (partialMatch && partialMatch.value) {
      append(partialMatch.aliasKey, partialMatch.value);
      i = partialMatch.consumedNextLine && nextLineIdx >= 0
        ? nextLineIdx + 1
        : i + 1;
      continue;
    }

    // 4. Standalone alias-tail
    if (isAliasTail(line)) { i++; continue; }

    // 5. Continuation
    if (lastKey) append(lastKey, line);
    i++;
  }
  return fields;
}

const normalizeNumber = (v) => (v ? String(v).replace(/[^0-9.]/g, '') : '');
const normalizeWhole  = (v) => {
  const n = normalizeNumber(v);
  return n ? String(parseInt(n, 10) || '') : '';
};

function normalizeState(v) {
  if (!v) return '';
  const cleaned = String(v).trim().replace(/\.$/, '');
  if (cleaned.length === 2) return cleaned.toUpperCase();
  return STATE_NAME_TO_CODE[cleaned.toLowerCase()] || cleaned.toUpperCase().slice(0, 2);
}

function mapEnum(rawValue, lookup) {
  if (!rawValue) return '';
  const cleaned = String(rawValue)
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/[.\u2019\u2018]+$/, '')
    .toLowerCase();
  if (lookup[cleaned]) return lookup[cleaned];
  if (Object.values(lookup).includes(String(rawValue).trim())) return String(rawValue).trim();
  const upper = String(rawValue).trim().toUpperCase().replace(/[\s-]+/g, '_');
  if (Object.values(lookup).includes(upper)) return upper;
  return '';
}

function normalizeImages(v) {
  if (!v) return [];
  if (Array.isArray(v)) return v.filter((s) => /^https?:\/\//i.test(String(s).trim()));
  return String(v)
    .split(/[,;|\n]+/)
    .map((s) => s.trim())
    .filter((s) => /^https?:\/\//i.test(s));
}

function normalizeAmenities(v) {
  if (!v) return '';
  return String(v).replace(/\s*\n\s*/g, ', ').replace(/\s{2,}/g, ' ').trim();
}

function normalizeDate(v) {
  if (!v) return '';
  const s = String(v).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return s;
  return d.toISOString().slice(0, 10);
}

function resolvePriceOrRent(fields) {
  const blob = fields.priceOrRent;
  if (!blob) return;
  delete fields.priceOrRent;
  const looksLikeRent = /\b(rent|month|\/mo|per\s+month)\b/i.test(blob);
  const num = normalizeNumber(blob);
  if (!num) return;
  if (looksLikeRent) fields.rent = num;
  else fields.price = num;
}

function normalizeFields(fields) {
  fields.bedrooms              = normalizeWhole(fields.bedrooms);
  fields.bathrooms             = normalizeNumber(fields.bathrooms);
  fields.squareFootage         = normalizeWhole(fields.squareFootage);
  fields.yearBuilt             = normalizeWhole(fields.yearBuilt);
  fields.price                 = normalizeNumber(fields.price);
  fields.rent                  = normalizeNumber(fields.rent);
  fields.postalCode            = (fields.postalCode || '').trim();
  fields.stateRegion           = normalizeState(fields.stateRegion);
  fields.category              = mapEnum(fields.category, CATEGORY_MAP);
  fields.submitterRelationship = mapEnum(fields.submitterRelationship, RELATIONSHIP_MAP);
  fields.financingType         = mapEnum(fields.financingType, FINANCING_MAP);
  fields.strConfidence         = mapEnum(fields.strConfidence, STR_CONFIDENCE_MAP);
  fields.turnkeyFurnished      = mapEnum(fields.turnkeyFurnished, TURNKEY_MAP);
  fields.strZoning             = mapEnum(fields.strZoning, STR_ZONING_MAP);
  fields.expiry_date           = normalizeDate(fields.expiry_date);
  fields.amenities             = normalizeAmenities(fields.amenities);
  fields.interiorImages        = normalizeImages(fields.interiorImages);
  fields.exteriorImages        = normalizeImages(fields.exteriorImages);

  // Optional — money / percent / date / text fields. Mirror frontend.
  fields.emd                   = normalizeNumber(fields.emd);
  fields.downPayment           = normalizeNumber(fields.downPayment);
  fields.assignmentFee         = normalizeNumber(fields.assignmentFee);
  if (fields.occupancyRate !== undefined && fields.occupancyRate !== null) {
    const cleaned = String(fields.occupancyRate).replace(/[^\d.]/g, '');
    fields.occupancyRate = cleaned === '' ? '' : cleaned;
  }
  fields.expectedCloseDate     = normalizeDate(fields.expectedCloseDate);
  fields.story                 = (fields.story          || '').trim();
  fields.addressLine2          = (fields.addressLine2   || '').trim();
  fields.financialInfo         = (fields.financialInfo  || '').trim();
  fields.additionalInfo        = (fields.additionalInfo || '').trim();

  if (fields.images) {
    const imgs = normalizeImages(fields.images);
    if (!fields.interiorImages.length) fields.interiorImages = imgs;
    delete fields.images;
  }

  resolvePriceOrRent(fields);
  return fields;
}

function validateRow(row) {
  const errors = {};
  REQUIRED_FIELDS.forEach((f) => {
    const v = row[f];
    if (Array.isArray(v)) {
      if (v.length === 0) errors[f] = 'Required';
    } else if (!v || String(v).trim() === '') {
      errors[f] = 'Required';
    }
  });

  if (row.bedrooms      && !/^\d+$/.test(String(row.bedrooms)))      errors.bedrooms = 'Must be a whole number';
  if (row.bathrooms     && !/^\d+(\.\d+)?$/.test(String(row.bathrooms))) errors.bathrooms = 'Must be a number';
  if (row.squareFootage && !/^\d+$/.test(String(row.squareFootage))) errors.squareFootage = 'Must be a whole number';
  if (row.yearBuilt     && !/^\d{4}$/.test(String(row.yearBuilt)))   errors.yearBuilt = 'Must be a 4-digit year';
  if (row.postalCode    && !/^\d{5}(-\d{4})?$/.test(String(row.postalCode).trim())) errors.postalCode = 'Must be a 5-digit ZIP';
  if (row.expiry_date   && !/^\d{4}-\d{2}-\d{2}$/.test(row.expiry_date)) errors.expiry_date = 'Use YYYY-MM-DD';

  // Optional fields — only validate when supplied.
  if (row.expectedCloseDate && !/^\d{4}-\d{2}-\d{2}$/.test(row.expectedCloseDate)) {
    errors.expectedCloseDate = 'Use YYYY-MM-DD';
  }
  if (row.emd          && !/^\d+(\.\d+)?$/.test(String(row.emd)))          errors.emd          = 'Must be a number';
  if (row.downPayment  && !/^\d+(\.\d+)?$/.test(String(row.downPayment)))  errors.downPayment  = 'Must be a number';
  if (row.assignmentFee && !/^\d+(\.\d+)?$/.test(String(row.assignmentFee))) errors.assignmentFee = 'Must be a number';
  if (row.occupancyRate !== undefined && row.occupancyRate !== null && row.occupancyRate !== '') {
    const n = Number(row.occupancyRate);
    if (!Number.isFinite(n) || n < 0 || n > 100) {
      errors.occupancyRate = 'Must be between 0 and 100';
    }
  }

  if (row.stateRegion) {
    if (!/^[A-Z]{2}$/.test(row.stateRegion)) {
      errors.stateRegion = 'Use a 2-letter state code';
    } else if (!VALID_STATE_CODES.has(row.stateRegion)) {
      errors.stateRegion = `"${row.stateRegion}" is not a US state`;
    }
  }

  if (row.category               && !VALID_CATEGORIES.includes(row.category))           errors.category = 'Unrecognized property type';
  if (row.submitterRelationship  && !VALID_RELATIONSHIPS.includes(row.submitterRelationship)) errors.submitterRelationship = 'Unrecognized relationship';
  if (row.financingType          && !VALID_FINANCING.includes(row.financingType))       errors.financingType = 'Unrecognized financing type';
  if (row.strConfidence          && !VALID_STR_CONFIDENCE.includes(row.strConfidence))  errors.strConfidence = 'Unrecognized confidence value';
  if (row.turnkeyFurnished       && !VALID_TURNKEY.includes(row.turnkeyFurnished))      errors.turnkeyFurnished = 'Unrecognized turnkey/furnished value';
  if (row.strZoning              && !VALID_STR_ZONING.includes(row.strZoning))          errors.strZoning = 'Use Yes / No / Not Sure';

  return errors;
}

/* ================================================================== */
/* Public API                                                         */
/* ================================================================== */
async function parsePropertiesFromPdf(buffer) {
  const { text } = await pdfParse(buffer);
  const blocks = splitIntoBlocks(text);

  const rows = blocks
    .map((block) => ({ block, fields: parseBlock(block) }))
    .filter(({ fields }) => Object.keys(fields).length > 0)
    .map(({ block, fields }, idx) => {
      const normalized = normalizeFields(fields);
      const errors = validateRow(normalized);
      return {
        id: `row-${idx + 1}`,
        sourceLines: [block.startLine + 1, block.endLine + 1],
        data: normalized,
        errors,
        include: Object.keys(errors).length === 0,
      };
    });
  return { rows, rawText: text };
}

async function parsePropertiesFromExcel(buffer) {
  const wb = XLSX.read(buffer, { type: 'buffer' });
  const sheetName = wb.SheetNames.find((n) => n.toLowerCase() !== 'field reference')
                 || wb.SheetNames[0];
  const ws = wb.Sheets[sheetName];
  if (!ws) return { rows: [], rawText: '' };

  const json = XLSX.utils.sheet_to_json(ws, { defval: '', raw: false });
  const rawText = XLSX.utils.sheet_to_csv(ws);

  const rows = json
    .map((rawRow, idx) => {
      const fields = {};
      for (const [header, value] of Object.entries(rawRow)) {
        if (value === '' || value === null || value === undefined) continue;
        const cleanHeader = String(header).replace(/\s*\*\s*$/, '');
        const aliasKey = findAlias(cleanHeader);
        if (!aliasKey) continue;
        fields[aliasKey] = String(value).trim();
      }
      return { lineNumber: idx + 2, fields };
    })
    .filter(({ fields }) => Object.keys(fields).length > 0)
    .map(({ lineNumber, fields }, idx) => {
      const normalized = normalizeFields(fields);
      const errors = validateRow(normalized);
      return {
        id: `row-${idx + 1}`,
        sourceLines: [lineNumber, lineNumber],
        data: normalized,
        errors,
        include: Object.keys(errors).length === 0,
      };
    });

  return { rows, rawText };
}

/**
 * Auto-detect from buffer signature whether the upload is PDF or XLSX/CSV.
 */
async function parsePropertiesFromBuffer(buffer, originalName = '') {
  const name = String(originalName).toLowerCase();
  const head = buffer.slice(0, 4).toString('binary');
  const looksLikePdf = head.startsWith('%PDF') || name.endsWith('.pdf');
  if (looksLikePdf) return parsePropertiesFromPdf(buffer);
  return parsePropertiesFromExcel(buffer);
}

module.exports = {
  parsePropertiesFromPdf,
  parsePropertiesFromExcel,
  parsePropertiesFromBuffer,
  __testing: {
    splitIntoBlocks, parseBlock, normalizeFields, validateRow,
    mapEnum, normalizeState, REQUIRED_FIELDS,
  },
};
