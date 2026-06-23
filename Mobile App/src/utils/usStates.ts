/**
 * Canonical list of US states used across the app's address selectors.
 * Mirrors the admin portal's `US_STATES` array (admin/views/UserManagement.jsx)
 * so values stored in the backend are consistent across portals — the
 * `code` (two-letter abbreviation) is what gets persisted, the `name` is
 * for display only.
 */
export interface UsState {
  code: string;
  name: string;
}

export const US_STATES: UsState[] = [
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

/** Convenience shape for our `Select` component. */
export const US_STATE_OPTIONS = US_STATES.map((s) => ({ value: s.code, label: s.name }));

// Index for case-insensitive lookup. Built once at module load so per-call
// resolution stays O(1) regardless of which representation we get back.
const CODE_INDEX = new Map<string, string>();
const NAME_INDEX = new Map<string, string>();
for (const { code, name } of US_STATES) {
  CODE_INDEX.set(code.toLowerCase(), code);
  NAME_INDEX.set(name.toLowerCase(), code);
}

/**
 * Normalize whatever shape the backend / a legacy record has for a US state
 * into the canonical two-letter code our `<Select>` matches against.
 *
 * Accepts (all case-insensitive, whitespace-trimmed):
 *   - The 2-letter code itself ("CA", "ca", " ca ")  → "CA"
 *   - The full state name ("California", "california") → "CA"
 *   - Anything else (other strings, null, undefined, numbers) → original-string-trimmed
 *     (so a value that doesn't map to a known US state still round-trips and
 *     the Select correctly renders the placeholder instead of mangling the
 *     stored value on save).
 *
 * Returns "" for empty / nullish input. This fixes the "State field shows
 * 'Select a state' on a freshly-installed device even though I saved it"
 * symptom — older records may have been stored as a full name or lowercase
 * code, and the Select only matches the exact "CA"-style code in its options.
 */
export function resolveStateCode(input: unknown): string {
  if (input == null) return '';
  const trimmed = String(input).trim();
  if (!trimmed) return '';
  const lower = trimmed.toLowerCase();
  const fromCode = CODE_INDEX.get(lower);
  if (fromCode) return fromCode;
  const fromName = NAME_INDEX.get(lower);
  if (fromName) return fromName;
  // Unknown value — return the trimmed original so it's not silently lost.
  return trimmed;
}
