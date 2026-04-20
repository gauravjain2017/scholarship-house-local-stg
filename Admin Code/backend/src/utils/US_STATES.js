/**
 * US_STATES.js
 * Static array of all 50 US states with code and name.
 * Also exports lookup helpers used by dealFilterMatcher and the frontend.
 */

const US_STATES = [
  { code: 'AL', name: 'Alabama' },
  { code: 'AK', name: 'Alaska' },
  { code: 'AZ', name: 'Arizona' },
  { code: 'AR', name: 'Arkansas' },
  { code: 'CA', name: 'California' },
  { code: 'CO', name: 'Colorado' },
  { code: 'CT', name: 'Connecticut' },
  { code: 'DE', name: 'Delaware' },
  { code: 'FL', name: 'Florida' },
  { code: 'GA', name: 'Georgia' },
  { code: 'HI', name: 'Hawaii' },
  { code: 'ID', name: 'Idaho' },
  { code: 'IL', name: 'Illinois' },
  { code: 'IN', name: 'Indiana' },
  { code: 'IA', name: 'Iowa' },
  { code: 'KS', name: 'Kansas' },
  { code: 'KY', name: 'Kentucky' },
  { code: 'LA', name: 'Louisiana' },
  { code: 'ME', name: 'Maine' },
  { code: 'MD', name: 'Maryland' },
  { code: 'MA', name: 'Massachusetts' },
  { code: 'MI', name: 'Michigan' },
  { code: 'MN', name: 'Minnesota' },
  { code: 'MS', name: 'Mississippi' },
  { code: 'MO', name: 'Missouri' },
  { code: 'MT', name: 'Montana' },
  { code: 'NE', name: 'Nebraska' },
  { code: 'NV', name: 'Nevada' },
  { code: 'NH', name: 'New Hampshire' },
  { code: 'NJ', name: 'New Jersey' },
  { code: 'NM', name: 'New Mexico' },
  { code: 'NY', name: 'New York' },
  { code: 'NC', name: 'North Carolina' },
  { code: 'ND', name: 'North Dakota' },
  { code: 'OH', name: 'Ohio' },
  { code: 'OK', name: 'Oklahoma' },
  { code: 'OR', name: 'Oregon' },
  { code: 'PA', name: 'Pennsylvania' },
  { code: 'RI', name: 'Rhode Island' },
  { code: 'SC', name: 'South Carolina' },
  { code: 'SD', name: 'South Dakota' },
  { code: 'TN', name: 'Tennessee' },
  { code: 'TX', name: 'Texas' },
  { code: 'UT', name: 'Utah' },
  { code: 'VT', name: 'Vermont' },
  { code: 'VA', name: 'Virginia' },
  { code: 'WA', name: 'Washington' },
  { code: 'WV', name: 'West Virginia' },
  { code: 'WI', name: 'Wisconsin' },
  { code: 'WY', name: 'Wyoming' },
];

// O(1) lookups — built once at module load, never recomputed
const STATE_BY_CODE = Object.fromEntries(
  US_STATES.map((s) => [s.code.toUpperCase(), s])
);

const STATE_BY_NAME = Object.fromEntries(
  US_STATES.map((s) => [s.name.toUpperCase(), s])
);

/**
 * Resolve a value that may be a 2-letter code ("FL") OR a full name
 * ("Florida") to its uppercase 2-letter code.
 * Returns null if the value cannot be resolved.
 *
 * @param {string} value
 * @returns {string|null}  e.g. "FL"
 */
function resolveStateCode(value) {
  if (!value || typeof value !== 'string') return null;
  const upper = value.trim().toUpperCase();

  // Direct code match  →  "FL"
  if (STATE_BY_CODE[upper]) return upper;

  // Full name match  →  "FLORIDA"
  const byName = STATE_BY_NAME[upper];
  if (byName) return byName.code;

  return null;
}

/**
 * Given an array of state codes and/or full names (mixed is fine),
 * return a Set of resolved uppercase 2-letter codes.
 * Invalid / unrecognised entries are silently dropped.
 *
 * @param {string[]} values
 * @returns {Set<string>}
 */
function buildStateCodeSet(values) {
  const result = new Set();
  if (!Array.isArray(values)) return result;

  for (const v of values) {
    const code = resolveStateCode(v);
    if (code) result.add(code);
  }

  return result;
}

module.exports = {
  US_STATES,
  STATE_BY_CODE,
  STATE_BY_NAME,
  resolveStateCode,
  buildStateCodeSet,
};
