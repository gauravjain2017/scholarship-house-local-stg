/**
 * pdfImportParser.js
 *
 * Client-side parser for the Scholarship House property import feature.
 * Supports both PDF (text-based "Field: Value" blocks) and Excel
 * (.xlsx / .xls / .csv) inputs and yields the same structured row shape
 * for the preview UI.
 *
 * Public API:
 *   parsePropertyFile(file) -> Promise<{ rows: ParsedRow[], rawText: string }>
 *   parsePropertyPdf(file)  -> alias kept for backward compatibility
 *
 * A ParsedRow looks like:
 *   { id, sourceLines, data, errors, include }
 *
 * `data` is the canonical-field shape consumed by /api/propertyImport/commit.
 *
 * Deps:  npm i pdfjs-dist xlsx
 */

import * as pdfjsLib from 'pdfjs-dist';
import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import * as XLSX from 'xlsx';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;


const US_STATES = [
  { code: 'AL', name: 'Alabama' }, { code: 'AK', name: 'Alaska' }, { code: 'AZ', name: 'Arizona' },
  { code: 'AR', name: 'Arkansas' }, { code: 'CA', name: 'California' }, { code: 'CO', name: 'Colorado' },
  { code: 'CT', name: 'Connecticut' }, { code: 'DE', name: 'Delaware' }, { code: 'FL', name: 'Florida' },
  { code: 'GA', name: 'Georgia' }, { code: 'HI', name: 'Hawaii' }, { code: 'ID', name: 'Idaho' },
  { code: 'IL', name: 'Illinois' }, { code: 'IN', name: 'Indiana' }, { code: 'IA', name: 'Iowa' },
  { code: 'KS', name: 'Kansas' }, { code: 'KY', name: 'Kentucky' }, { code: 'LA', name: 'Louisiana' },
  { code: 'ME', name: 'Maine' }, { code: 'MD', name: 'Maryland' }, { code: 'MA', name: 'Massachusetts' },
  { code: 'MI', name: 'Michigan' }, { code: 'MN', name: 'Minnesota' }, { code: 'MS', name: 'Mississippi' },
  { code: 'MO', name: 'Missouri' }, { code: 'MT', name: 'Montana' }, { code: 'NE', name: 'Nebraska' },
  { code: 'NV', name: 'Nevada' }, { code: 'NH', name: 'New Hampshire' }, { code: 'NJ', name: 'New Jersey' },
  { code: 'NM', name: 'New Mexico' }, { code: 'NY', name: 'New York' }, { code: 'NC', name: 'North Carolina' },
  { code: 'ND', name: 'North Dakota' }, { code: 'OH', name: 'Ohio' }, { code: 'OK', name: 'Oklahoma' },
  { code: 'OR', name: 'Oregon' }, { code: 'PA', name: 'Pennsylvania' }, { code: 'RI', name: 'Rhode Island' },
  { code: 'SC', name: 'South Carolina' }, { code: 'SD', name: 'South Dakota' }, { code: 'TN', name: 'Tennessee' },
  { code: 'TX', name: 'Texas' }, { code: 'UT', name: 'Utah' }, { code: 'VT', name: 'Vermont' },
  { code: 'VA', name: 'Virginia' }, { code: 'WA', name: 'Washington' }, { code: 'WV', name: 'West Virginia' },
  { code: 'WI', name: 'Wisconsin' }, { code: 'WY', name: 'Wyoming' },
];


/* ================================================================== */
/* Field aliases — every label the parser will accept, normalized to  */
/* the canonical key used by the rest of the app.                     */
/* ================================================================== */
const FIELD_ALIASES = {
  // Submitter relationship
  'your relationship to this property': 'submitterRelationship',
  'submitter relationship': 'submitterRelationship',
  'relationship': 'submitterRelationship',
  'relationship to property': 'submitterRelationship',

  // Address
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

  // Property
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

  // Money
  'price': 'price',
  'rent': 'rent',
  'monthly rent': 'rent',
  'rent / price': 'priceOrRent',
  'rent/price': 'priceOrRent',

  // Financing
  'type of financing': 'financingType',
  'financing': 'financingType',
  'financing type': 'financingType',

  // STR fields
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

  // Long text
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


  // Optional — escrow
  'expected close of escrow': 'expectedCloseDate',
  'expected close date': 'expectedCloseDate',
  'expected closing date': 'expectedCloseDate',
  'close of escrow': 'expectedCloseDate',

  // Optional — free-form catch-all
  'additional information': 'additionalInfo',
  'additional info': 'additionalInfo',
  'notes': 'additionalInfo',

  // Media
  'interior photos': 'interiorImages',
  'interior images': 'interiorImages',
  'exterior photos': 'exteriorImages',
  'exterior images': 'exteriorImages',
  'images': 'images',          // legacy single-bucket column
  'photos': 'images',
  'image urls': 'images',
};

/* ================================================================== */
/* Enum maps — display label -> canonical key. Any value not found    */
/* in the map is left blank and flagged as a validation error.        */
/* ================================================================== */
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
  'traditional':'traditional',
  'subject-to':'subject-to',
  'subject to':'subject-to',
  'hybrid':'hybrid',
  'seller financing':'seller',
  'seller': 'seller',
  'cash only': 'cash',
  'cash':'cash',
};

const STR_CONFIDENCE_MAP = {
  'first-hand': 'FIRST_HAND',
  'first hand': 'FIRST_HAND',
  'airdna':'AIRDNA',
  'directional only':'DIRECTIONAL_ONLY',
  'directional':'DIRECTIONAL_ONLY',
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

/* ================================================================== */
/* PDF -> plain text                                                  */
/* ================================================================== */
async function extractTextFromPdf(file) {
  const buffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;

  const pageTexts = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();

    // Group items by y-coordinate so we recover line breaks even when
    // items span columns. Items within ~3px vertically are the same line.
    const lines = [];
    let currentY = null;
    let currentLine = [];

    for (const item of content.items) {
      const y = item.transform ? item.transform[5] : 0;
      if (currentY === null || Math.abs(y - currentY) < 3) {
        currentLine.push(item.str);
        currentY = currentY === null ? y : currentY;
      } else {
        lines.push(currentLine.join(' ').trim());
        currentLine = [item.str];
        currentY = y;
      }
    }
    if (currentLine.length) lines.push(currentLine.join(' ').trim());
    pageTexts.push(lines.filter(Boolean).join('\n'));
  }
  return pageTexts.join('\n\n');
}

/* ================================================================== */
/* Text -> structured rows                                            */
/* ================================================================== */
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
  if (current.lines.length) {
    blocks.push({ ...current, endLine: lines.length - 1 });
  }
  return blocks.filter((b) =>
    // A block is interesting if any line either contains a "Field: Value"
    // pair OR starts with a known field label (tabular layout).
    b.lines.some((l) =>
      /^[A-Za-z][A-Za-z /?&]+:\s*\S/.test(l) ||
      matchLabelPrefix(l.trim()) !== null
    )
  );
}

function normalizeKey(label) {
  return label.trim().toLowerCase().replace(/\s+/g, ' ').replace(/\s*\?\s*$/, '?');
}

/**
 * Sort the alias list once by length (longest first) so a multi-word label
 * like "Postal/Zip Code" isn't shadowed by a shorter one like "Postal".
 */
const ALIAS_KEYS_SORTED = Object.keys(FIELD_ALIASES).sort(
  (a, b) => b.length - a.length
);

function findAlias(label) {
  const key = normalizeKey(label);
  if (FIELD_ALIASES[key]) return FIELD_ALIASES[key];
  // Some PDFs render "?" with extra spacing — try without trailing ?
  const stripped = key.replace(/\?$/, '').trim();
  return FIELD_ALIASES[stripped] || null;
}

/**
 * Strip trailing decoration (colon, question mark, asterisk, period,
 * exclamation, whitespace) from a label so matching is robust against
 * minor PDF layout changes like adding ":" to every field. The alias
 * map stores bare labels like "story" — anything that compares against
 * it should run through this helper first.
 */
function stripLabelChrome(s) {
  return (s || '').replace(/[\s:?*.!]+$/g, '');
}

/**
 * Match a line that doesn't have a "Field: Value" colon by checking
 * whether it starts with a known field label. Used for tabular PDFs
 * where each table row produces text like "Property Name Sunset Ridge".
 *
 * Returns { aliasKey, value } if a label is recognized, or null.
 */
function matchLabelPrefix(line) {
  const lower = line.toLowerCase();
  for (const aliasLabel of ALIAS_KEYS_SORTED) {
    // Two acceptable shapes:
    //   "<alias> <value>"          → classic
    //   "<alias>{:?* punctuation} <value>"  → label decorated with colon etc.
    if (lower.startsWith(aliasLabel + ' ') || lower === aliasLabel) {
      const value = line.slice(aliasLabel.length).trim();
      return { aliasKey: FIELD_ALIASES[aliasLabel], value };
    }
    // Tolerate up to a few decoration chars between alias and value.
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

/**
 * Match a partial (wrapped) label: line starts with the FIRST words of
 * a known alias followed by one or more spaces and a value, while the
 * REST of the alias appears on the next PDF line.
 *
 * We try every word boundary inside each alias from longest down to 2
 * words. The first match wins. To avoid false positives (e.g., line
 * "Property Type Single Family Home" partially matching "Property Expiry
 * Date" through "Property"), we require:
 *   - the partial spans at least 2 words of the alias
 *   - the leftover after the partial doesn't itself start with a known
 *     full label (which would mean we picked the wrong alias)
 */
function matchPartialLabel(line) {
  const lower = line.toLowerCase();
  for (const aliasLabel of ALIAS_KEYS_SORTED) {
    const words = aliasLabel.split(' ');
    // Need at least 3 words for a wrap to be plausible.
    if (words.length < 3) continue;
    for (let n = words.length - 1; n >= 2; n--) {
      const partial = words.slice(0, n).join(' ');
      if (lower.startsWith(partial + ' ')) {
        const value = line.slice(partial.length).trim();
        if (!value) continue;
        // Reject if value itself starts with a known full label (means we
        // matched the wrong, shorter alias).
        if (matchLabelPrefix(value)) continue;
        return {
          aliasKey: FIELD_ALIASES[aliasLabel],
          value,
          labelTail: words.slice(n).join(' ').toLowerCase(),
        };
      }
    }
  }
  return null;
}

/**
 * True when `text` (lowercased) IS exactly a tail of one of our aliases —
 * i.e. it's the wrapped-onto-next-line portion of a known label. Used to
 * recognize and discard lines like "The Following Data?" so they don't
 * get appended to the previous field's value as a continuation.
 */
function isAliasTail(text) {
  // Strip trailing colon / "?" / "*" so a wrapped tail rendered as
  // "The Following Data?:" is recognized as a tail.
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

/**
 * Match a partial (wrapped) label and resolve ambiguity by looking at
 * what the NEXT non-empty line says. The next line should be the rest
 * of the alias. Among all candidate split points, the one whose tail
 * the next line starts with is the correct one.
 *
 * Returns { aliasKey, value, labelTail, consumedNextLine } on success.
 * `consumedNextLine` is true when the entire next line was the tail and
 * should be skipped by the caller.
 */
function matchPartialLabelWithLookahead(line, nextLine) {
  const lower = line.toLowerCase();
  // Strip trailing decoration on the next-line tail (e.g., the wrapped
  // tail "The Following Data?:" should still match alias tail
  // "the following data?").
  const nextLowerRaw = (nextLine || '').toLowerCase().trim();
  const nextLower = stripLabelChrome(nextLowerRaw);

  // Collect every candidate split point across every alias.
  const candidates = [];
  for (const aliasLabel of ALIAS_KEYS_SORTED) {
    const words = aliasLabel.split(' ');
    if (words.length < 3) continue;
    for (let n = words.length - 1; n >= 2; n--) {
      const partial = words.slice(0, n).join(' ');
      // Accept either "<partial> <value>" OR "<partial><decoration> <value>"
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
      // Reject when the value itself starts with a known full label —
      // that signals we matched a shorter alias by accident.
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

  // Best candidate: the one whose tail equals the next line, or whose
  // tail is a prefix of the next line. Both sides go through
  // stripLabelChrome so the comparison ignores trailing
  // colon / question mark / asterisks etc., on either the alias tail
  // or the wrapped tail line in the PDF.
  const tailMatches = (tail) => {
    const t = stripLabelChrome(tail);
    return nextLower === t || nextLower.startsWith(t + ' ');
  };
  const confirmed = candidates.filter((c) => tailMatches(c.labelTail));
  const pool = confirmed.length > 0 ? confirmed : candidates;
  pool.sort((a, b) => b.aliasLength - a.aliasLength);
  const best = pool[0];

  const consumedNextLine = tailMatches(best.labelTail);

  return {
    aliasKey: best.aliasKey,
    value: best.value,
    labelTail: best.labelTail,
    consumedNextLine,
  };
}

function parseBlock(block) {
  const fields = {};
  let lastKey = null;
  const lines = block.lines;
  let i = 0;

  // Helper for accumulating into fields.
  const append = (key, val) => {
    fields[key] = (fields[key] ? fields[key] + ' ' : '') + val;
    lastKey = key;
  };

  while (i < lines.length) {
    const line = lines[i].trim();
    if (!line) { i++; continue; }

    // 1. "Field: Value" with a colon separator.
    const m = line.match(/^([A-Za-z][A-Za-z0-9 /&?-]{1,80}?)\s*[:\-–]\s*(.*)$/);
    if (m) {
      const aliasKey = findAlias(m[1]);
      if (aliasKey) {
        append(aliasKey, m[2].trim());
        i++;
        continue;
      }
    }

    // 2. Full label match (tabular).
    const prefixMatch = matchLabelPrefix(line);
    if (prefixMatch && prefixMatch.value) {
      append(prefixMatch.aliasKey, prefixMatch.value);
      i++;
      continue;
    }

    // 3. Partial (wrapped) label — disambiguate via lookahead.
    let nextLine = '';
    let nextLineIdx = -1;
    for (let j = i + 1; j < lines.length; j++) {
      const t = lines[j].trim();
      if (t) { nextLine = t; nextLineIdx = j; break; }
    }
    const partialMatch = matchPartialLabelWithLookahead(line, nextLine);
    if (partialMatch && partialMatch.value) {
      append(partialMatch.aliasKey, partialMatch.value);
      // Skip past current line, and (if confirmed) the tail line.
      i = partialMatch.consumedNextLine && nextLineIdx >= 0
        ? nextLineIdx + 1
        : i + 1;
      continue;
    }

    // 4. Standalone alias-tail (e.g. "The Following Data?" left over) — discard.
    if (isAliasTail(line)) { i++; continue; }

    // 5. Continuation line (multi-line description, wrapped enum value).
    if (lastKey) append(lastKey, line);
    i++;
  }
  return fields;
}

/* ================================================================== */
/* Field-level normalization                                          */
/* ================================================================== */
const normalizeNumber = (v) => {
  if (v === undefined || v === null || v === '') return '';
  return String(v).replace(/[^0-9.]/g, '');
};

const normalizeWhole = (v) => {
  const n = normalizeNumber(v);
  if (!n) return '';
  return String(parseInt(n, 10) || '');
};

function normalizeState(v) {
  if (!v) return '';
  const cleaned = String(v).trim().replace(/\.$/, '');
  if (cleaned.length === 2) return cleaned.toUpperCase();
  const code = STATE_NAME_TO_CODE[cleaned.toLowerCase()];
  return code || cleaned.toUpperCase().slice(0, 2);
}

/**
 * Map a free-text enum value through a label->key map. Strips trailing
 * punctuation, lower-cases, collapses whitespace. Returns '' if no match
 * (which becomes a validation error downstream).
 */
function mapEnum(rawValue, lookup) {
  if (!rawValue) return '';
  const cleaned = String(rawValue)
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/[.\u2019\u2018]+$/, '')  // trailing dot or smart-quote
    .toLowerCase();
  if (lookup[cleaned]) return lookup[cleaned];

  // If the value already looks like a canonical key (e.g. user typed
  // SINGLE_FAMILY directly), accept it.
  const upper = String(rawValue).trim().toUpperCase().replace(/[\s-]+/g, '_');
  if (Object.values(lookup).includes(rawValue.trim())) return rawValue.trim();
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

/** Accept YYYY-MM-DD, MM/DD/YYYY, "Aug 1, 2026" — return ISO YYYY-MM-DD. */
function normalizeDate(v) {
  if (!v) return '';
  const s = String(v).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return s; // leave it; validator will flag
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

/* ================================================================== */
/* Validation                                                         */
/* ================================================================== */
// Set of valid 2-letter state codes — built once from US_STATES so we can
// reject "ZZ" or any other non-state code that happens to be 2 characters.
const VALID_STATE_CODES = new Set(US_STATES.map((s) => s.code));

const REQUIRED_FIELDS = [
  'submitterRelationship',
  'streetAddress',
  'city',
  'stateRegion',
  'postalCode',
  'category',
  'bedrooms',
  'bathrooms',
  'squareFootage',
  'yearBuilt',
  'price',
  'financingType',
  'expiry_date',
  'strConfidence',
  'turnkeyFurnished',
  'strZoning',
  'description',
  'interiorImages',
  'exteriorImages',
];



const VALID_CATEGORIES         = ['SINGLE_FAMILY', 'CONDO', 'TOWNHOUSE', 'TWO_TO_FOUR_UNIT', 'UNIQUE_PROPERTY'];
const VALID_RELATIONSHIPS      = ['TEAM_MEMBER', 'REALTOR_LISTING_OWNER', 'REALTOR_NOT_LISTING_OWNER', 'WHOLESALER_HOLDS_CONTRACT', 'WHOLESALER_NO_CONTRACT', 'REAL_ESTATE_PROFESSIONAL', 'BIRDDOGGER'];
const VALID_FINANCING          = ['traditional', 'subject-to', 'hybrid', 'seller', 'cash'];
const VALID_STR_CONFIDENCE     = ['FIRST_HAND', 'AIRDNA', 'DIRECTIONAL_ONLY'];
const VALID_TURNKEY            = ['TURNKEY_OPERATING', 'FURNISHED_NOT_OPERATING', 'PARTIALLY_FURNISHED', 'NOT_FURNISHED'];
const VALID_STR_ZONING         = ['YES', 'NO', 'UNSURE'];

function validateRow(row) {
  const errors = {};

  // Required-presence check. Arrays (interiorImages, exteriorImages)
  // count as "present" only if they have at least one URL.
  REQUIRED_FIELDS.forEach((f) => {
    const v = row[f];
    if (Array.isArray(v)) {
      if (v.length === 0) errors[f] = 'Required';
    } else if (!v || String(v).trim() === '') {
      errors[f] = 'Required';
    }
  });

  // Format checks. Each only runs if the field has a value, since
  // missing-value errors are already attached above.
  if (row.bedrooms      && !/^\d+$/.test(String(row.bedrooms)))      errors.bedrooms = 'Must be a whole number';
  if (row.bathrooms     && !/^\d+(\.\d+)?$/.test(String(row.bathrooms))) errors.bathrooms = 'Must be a number';
  if (row.squareFootage && !/^\d+$/.test(String(row.squareFootage))) errors.squareFootage = 'Must be a whole number';
  if (row.yearBuilt     && !/^\d{4}$/.test(String(row.yearBuilt)))   errors.yearBuilt = 'Must be a 4-digit year';
  if (row.postalCode    && !/^\d{5}(-\d{4})?$/.test(String(row.postalCode).trim())) errors.postalCode = 'Must be a 5-digit ZIP';
  if (row.expiry_date   && !/^\d{4}-\d{2}-\d{2}$/.test(row.expiry_date)) errors.expiry_date = 'Use YYYY-MM-DD';

  // Optional fields — only validate format when a value is supplied.
  if (row.expectedCloseDate && !/^\d{4}-\d{2}-\d{2}$/.test(row.expectedCloseDate)) {
    errors.expectedCloseDate = 'Use YYYY-MM-DD';
  }
  if (row.emd          && !/^\d+(\.\d+)?$/.test(String(row.emd)))          errors.emd          = 'Must be a number';
  if (row.downPayment  && !/^\d+(\.\d+)?$/.test(String(row.downPayment)))  errors.downPayment  = 'Must be a number';
  if (row.assignmentFee && !/^\d+(\.\d+)?$/.test(String(row.assignmentFee))) errors.assignmentFee = 'Must be a number';
  
  


  // State must be a real US state code, not just any 2 letters.
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
/* Apply all normalizers to a parsed-fields bag                        */
/* ================================================================== */
function normalizeFields(fields) {
  const cleanedConfidence = fields.strConfidence?.replace(/\bof\b/gi, '').trim();
  
  console.log('testing.....');
  console.log(cleanedConfidence);
  
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
  fields.strConfidence         = mapEnum(cleanedConfidence, STR_CONFIDENCE_MAP);
  fields.turnkeyFurnished      = mapEnum(fields.turnkeyFurnished, TURNKEY_MAP);
  fields.strZoning             = mapEnum(fields.strZoning, STR_ZONING_MAP);
  fields.expiry_date           = normalizeDate(fields.expiry_date);
  fields.amenities             = normalizeAmenities(fields.amenities);
  fields.interiorImages        = normalizeImages(fields.interiorImages);
  fields.exteriorImages        = normalizeImages(fields.exteriorImages);

  // Optional — money fields. Strip "$" / "," / spaces; keep blanks blank.
  fields.emd                   = normalizeNumber(fields.emd);
  fields.downPayment           = normalizeNumber(fields.downPayment);
  fields.assignmentFee         = normalizeNumber(fields.assignmentFee);

 

  // Optional — date in same YYYY-MM-DD format as expiry_date.
  fields.expectedCloseDate     = normalizeDate(fields.expectedCloseDate);

  // Optional — text fields. Just trim trailing whitespace; don't drop content.
  fields.story                 = (fields.story         || '').trim();
  fields.addressLine2          = (fields.addressLine2  || '').trim();
  fields.financialInfo         = (fields.financialInfo || '').trim();
  fields.additionalInfo        = (fields.additionalInfo || '').trim();

  // Legacy single-bucket "Images" column — split into interior if no
  // explicit interior column was present.
  if (fields.images) {
    const imgs = normalizeImages(fields.images);
    if (!fields.interiorImages.length) fields.interiorImages = imgs;
    delete fields.images;
  }

  resolvePriceOrRent(fields);
  return fields;
}

/* ================================================================== */
/* Excel -> rows                                                       */
/* ================================================================== */
async function extractRowsFromExcel(file) {
  const buffer = await file.arrayBuffer();
  const wb = XLSX.read(buffer, { type: 'array' });

  // Use the first sheet that has data. Skip the "Field Reference" guide
  // sheet our sample Excel ships with.
  const sheetName = wb.SheetNames.find((n) => n.toLowerCase() !== 'field reference')
                 || wb.SheetNames[0];
  const ws = wb.Sheets[sheetName];
  if (!ws) return { rows: [], rawText: '' };

  const json = XLSX.utils.sheet_to_json(ws, { defval: '', raw: false });

  return {
    rawText: XLSX.utils.sheet_to_csv(ws),
    rows: json.map((rawRow, idx) => {
      const fields = {};
      for (const [header, value] of Object.entries(rawRow)) {
        if (value === '' || value === null || value === undefined) continue;
        const cleanHeader = String(header).replace(/\s*\*\s*$/, ''); // drop "*" suffix
        const aliasKey = findAlias(cleanHeader);
        if (!aliasKey) continue;
        fields[aliasKey] = String(value).trim();
      }
      return { block: { startLine: idx + 2, endLine: idx + 2 }, fields };
    }),
  };
}

/* ================================================================== */
/* Public entry points                                                */
/* ================================================================== */
function buildRowsFromBlocks(blocks, blockToFields) {
  return blocks
    .map((block) => ({ block, fields: blockToFields(block) }))
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
}

export async function parsePropertyFile(file) {
  if (!file) throw new Error('No file provided');

  const name = (file.name || '').toLowerCase();
  const isExcel = /\.(xlsx|xls|csv)$/i.test(name)
               || /(spreadsheet|excel|csv)/i.test(file.type || '');

  if (isExcel) {
    const { rows: rawRows, rawText } = await extractRowsFromExcel(file);
    const rows = rawRows
      .filter(({ fields }) => Object.keys(fields).length > 0)
      .map(({ block, fields }, idx) => {
        const normalized = normalizeFields(fields);
        const errors = validateRow(normalized);
        return {
          id: `row-${idx + 1}`,
          sourceLines: [block.startLine, block.endLine],
          data: normalized,
          errors,
          include: Object.keys(errors).length === 0,
        };
      });
    return { rows, rawText };
  }

  // PDF
  if (file.type && file.type !== 'application/pdf' && !name.endsWith('.pdf')) {
    throw new Error('Only PDF, .xlsx, .xls, and .csv files are supported');
  }
  const rawText = await extractTextFromPdf(file);
  const blocks = splitIntoBlocks(rawText);
  const rows = buildRowsFromBlocks(blocks, parseBlock);
  return { rows, rawText };
}

// Backward-compat alias — anything that was importing parsePropertyPdf
// keeps working.
export const parsePropertyPdf = parsePropertyFile;

export const __testing = {
  splitIntoBlocks, parseBlock, normalizeFields, validateRow,
  mapEnum, normalizeState, REQUIRED_FIELDS,
  CATEGORY_MAP, RELATIONSHIP_MAP, FINANCING_MAP,
  STR_CONFIDENCE_MAP, TURNKEY_MAP, STR_ZONING_MAP,
};
	