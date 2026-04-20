/**
 * Address Normalizer Utility
 *
 * Normalizes addresses for consistent comparison to detect duplicates.
 * Uses a combination of local normalization and optional Nominatim (OpenStreetMap)
 * geocoding for more accurate standardization.
 */

// Common street type abbreviations and their standard forms
const STREET_ABBREVIATIONS = {
  // Suffixes
  st: 'street',
  str: 'street',
  ave: 'avenue',
  av: 'avenue',
  blvd: 'boulevard',
  bld: 'boulevard',
  rd: 'road',
  dr: 'drive',
  drv: 'drive',
  ln: 'lane',
  ct: 'court',
  crt: 'court',
  pl: 'place',
  plc: 'place',
  cir: 'circle',
  circ: 'circle',
  trl: 'trail',
  tr: 'trail',
  way: 'way',
  pkwy: 'parkway',
  pk: 'parkway',
  hwy: 'highway',
  hw: 'highway',
  fwy: 'freeway',
  expy: 'expressway',
  exp: 'expressway',
  sq: 'square',
  ter: 'terrace',
  terr: 'terrace',
  aly: 'alley',
  apt: 'apartment',
  ste: 'suite',
  unit: 'unit',
  fl: 'floor',
  flr: 'floor',
  bldg: 'building',
  // Directional
  n: 'north',
  s: 'south',
  e: 'east',
  w: 'west',
  ne: 'northeast',
  nw: 'northwest',
  se: 'southeast',
  sw: 'southwest',
};

// US State abbreviations to full names
const STATE_ABBREVIATIONS = {
  al: 'alabama',
  ak: 'alaska',
  az: 'arizona',
  ar: 'arkansas',
  ca: 'california',
  co: 'colorado',
  ct: 'connecticut',
  de: 'delaware',
  fl: 'florida',
  ga: 'georgia',
  hi: 'hawaii',
  id: 'idaho',
  il: 'illinois',
  in: 'indiana',
  ia: 'iowa',
  ks: 'kansas',
  ky: 'kentucky',
  la: 'louisiana',
  me: 'maine',
  md: 'maryland',
  ma: 'massachusetts',
  mi: 'michigan',
  mn: 'minnesota',
  ms: 'mississippi',
  mo: 'missouri',
  mt: 'montana',
  ne: 'nebraska',
  nv: 'nevada',
  nh: 'new hampshire',
  nj: 'new jersey',
  nm: 'new mexico',
  ny: 'new york',
  nc: 'north carolina',
  nd: 'north dakota',
  oh: 'ohio',
  ok: 'oklahoma',
  or: 'oregon',
  pa: 'pennsylvania',
  ri: 'rhode island',
  sc: 'south carolina',
  sd: 'south dakota',
  tn: 'tennessee',
  tx: 'texas',
  ut: 'utah',
  vt: 'vermont',
  va: 'virginia',
  wa: 'washington',
  wv: 'west virginia',
  wi: 'wisconsin',
  wy: 'wyoming',
  dc: 'district of columbia',
};

/**
 * Normalize a single word/token in an address
 * @param {string} token - The token to normalize
 * @param {boolean} isStateContext - Whether this token is in the state position
 */
const normalizeToken = (token, isStateContext = false) => {
  const lower = token.toLowerCase();

  // If in state context, check state abbreviations first
  if (isStateContext && STATE_ABBREVIATIONS[lower]) {
    return STATE_ABBREVIATIONS[lower];
  }

  // Check if it's an abbreviation
  if (STREET_ABBREVIATIONS[lower]) {
    return STREET_ABBREVIATIONS[lower];
  }

  // Check if it's a state abbreviation (for non-context-aware calls)
  if (STATE_ABBREVIATIONS[lower]) {
    return STATE_ABBREVIATIONS[lower];
  }

  return lower;
};

/**
 * Local normalization of an address (no external API)
 * Used for quick comparison and as fallback
 *
 * @param {Object} address - Address object
 * @param {string} address.streetAddress - Street address
 * @param {string} address.city - City name
 * @param {string} address.stateRegion - State/region
 * @param {string} address.postalCode - Postal/ZIP code
 * @returns {string} Normalized address string for comparison
 */
const normalizeAddressLocal = ({
  streetAddress,
  city,
  stateRegion,
  postalCode,
}) => {
  // Normalize each component separately to handle state abbreviation context
  const normalizeComponent = (str, isState = false) => {
    if (!str) return [];
    const cleaned = str.toLowerCase().replace(/[^\w\s]/g, ' ');
    const tokens = cleaned.split(/\s+/).filter((t) => t.length > 0);
    return tokens.map((t) => normalizeToken(t, isState));
  };

  // Normalize each part with appropriate context
  const streetTokens = normalizeComponent(streetAddress, false);
  const cityTokens = normalizeComponent(city, false);
  const stateTokens = normalizeComponent(stateRegion, true); // State context
  const postalTokens = normalizeComponent(postalCode, false);

  // Combine all tokens
  const allTokens = [
    ...streetTokens,
    ...cityTokens,
    ...stateTokens,
    ...postalTokens,
  ];

  // Remove common words that don't affect uniqueness
  const stopWords = ['the', 'a', 'an', 'and', 'of'];
  const filteredTokens = allTokens.filter((t) => !stopWords.includes(t));

  // Sort alphabetically for consistent comparison (except keep number first for street number)
  // Extract street number (first numeric token)
  const streetNumber = filteredTokens.find((t) => /^\d+$/.test(t)) || '';
  const otherTokens = filteredTokens.filter((t) => t !== streetNumber);

  // Rejoin with single spaces
  return `${streetNumber} ${otherTokens.sort().join(' ')}`.trim();
};

/**
 * Generate a normalized address key for database lookup
 * This creates a consistent key that can be used for duplicate detection
 *
 * @param {Object} address - Address object
 * @returns {string} Normalized key suitable for database index
 */
const generateAddressKey = ({
  streetAddress,
  city,
  stateRegion,
  postalCode,
}) => {
  const normalized = normalizeAddressLocal({
    streetAddress,
    city,
    stateRegion,
    postalCode,
  });

  // Create a simple hash-like key by removing all spaces and truncating
  // This helps with slight variations in normalization
  return normalized.replace(/\s+/g, '_').substring(0, 100);
};

/**
 * Use Nominatim (OpenStreetMap) to normalize an address
 * This provides more accurate standardization by using real geocoding
 *
 * Note: Nominatim has usage limits (1 request/second, no bulk requests)
 * For production, consider caching results
 *
 * @param {Object} address - Address object
 * @returns {Promise<Object|null>} Normalized address data or null if not found
 */
const normalizeWithNominatim = async ({
  streetAddress,
  city,
  stateRegion,
  postalCode,
}) => {
  try {
    const query = encodeURIComponent(
      `${streetAddress}, ${city}, ${stateRegion} ${postalCode}, USA`
    );

    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${query}&format=json&addressdetails=1&limit=1`,
      {
        headers: {
          'User-Agent': 'STL-App/1.0 (Property Management Application)',
        },
      }
    );

    if (!response.ok) {
      console.warn('Nominatim API request failed:', response.status);
      return null;
    }

    const data = await response.json();

    if (data.length === 0) {
      return null;
    }

    const result = data[0];
    const addr = result.address || {};

    return {
      normalizedStreet: addr.house_number
        ? `${addr.house_number} ${addr.road || ''}`.trim()
        : addr.road || streetAddress,
      normalizedCity: addr.city || addr.town || addr.village || city,
      normalizedState: addr.state || stateRegion,
      normalizedPostalCode: addr.postcode || postalCode,
      latitude: parseFloat(result.lat),
      longitude: parseFloat(result.lon),
      osmId: result.osm_id,
      displayName: result.display_name,
    };
  } catch (error) {
    console.error('Error calling Nominatim API:', error);
    return null;
  }
};

/**
 * Check if two addresses are likely duplicates
 * Uses both local normalization and optional geocoding verification
 *
 * @param {Object} address1 - First address
 * @param {Object} address2 - Second address
 * @param {boolean} useGeocoding - Whether to verify with geocoding (slower but more accurate)
 * @returns {Promise<Object>} Comparison result
 */
const compareAddresses = async (address1, address2, useGeocoding = false) => {
  // First, do local comparison
  const key1 = generateAddressKey(address1);
  const key2 = generateAddressKey(address2);

  const localMatch = key1 === key2;

  if (!useGeocoding) {
    return {
      isDuplicate: localMatch,
      confidence: localMatch ? 0.8 : 0,
      method: 'local',
    };
  }

  // If local comparison says they match, verify with geocoding
  if (localMatch) {
    const [geo1, geo2] = await Promise.all([
      normalizeWithNominatim(address1),
      normalizeWithNominatim(address2),
    ]);

    if (geo1 && geo2) {
      // If both geocode successfully, check if they're the same location
      const sameOsm = geo1.osmId && geo1.osmId === geo2.osmId;
      const sameCoords =
        geo1.latitude &&
        geo2.latitude &&
        Math.abs(geo1.latitude - geo2.latitude) < 0.0001 &&
        Math.abs(geo1.longitude - geo2.longitude) < 0.0001;

      return {
        isDuplicate: sameOsm || sameCoords || localMatch,
        confidence: sameOsm ? 1.0 : sameCoords ? 0.95 : 0.8,
        method: 'geocoding',
        geo1,
        geo2,
      };
    }
  }

  return {
    isDuplicate: localMatch,
    confidence: localMatch ? 0.8 : 0,
    method: 'local_fallback',
  };
};

/**
 * Extract just the street number and name for primary comparison
 * This ignores unit/apt numbers which shouldn't affect duplicate detection
 * for the main property
 */
const extractPrimaryStreet = (streetAddress) => {
  if (!streetAddress) return '';

  // Remove unit/apartment designations
  let cleaned = streetAddress.toLowerCase();
  // Remove apt, apartment, unit, suite, ste followed by alphanumeric
  cleaned = cleaned.replace(
    /\b(apt|apartment|unit|suite|ste)\s*[a-z0-9]*/gi,
    ''
  );
  // Remove # followed by alphanumeric (e.g., #3a, # 101)
  cleaned = cleaned.replace(/#\s*[a-z0-9]*/gi, '');
  cleaned = cleaned.replace(/\s+/g, ' ').trim();

  return cleaned;
};

module.exports = {
  normalizeAddressLocal,
  generateAddressKey,
  normalizeWithNominatim,
  compareAddresses,
  extractPrimaryStreet,
  STREET_ABBREVIATIONS,
  STATE_ABBREVIATIONS,
};
