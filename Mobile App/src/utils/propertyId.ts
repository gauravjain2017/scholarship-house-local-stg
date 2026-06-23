import type { Property } from '@/types';

/**
 * Returns a human-readable property reference for display on cards and
 * detail pages — e.g. "751-37863".
 *
 * The format mirrors the admin web `DealCard.jsx` derivation so mobile
 * and web show the **same** ID for the same deal:
 *
 *   streetNum = digits at the start of `streetAddress` (e.g. "751 Main St" → "751")
 *   postal    = trimmed `postalCode`                  (e.g. "37863")
 *   →  `${streetNum}-${postal}`                        ("751-37863")
 *
 * Fallback order if those fields are missing:
 *   • backend-supplied `propertyId` / `referenceId`
 *   • nested `address.street` / `address.zip` (older payloads)
 *   • derived from the database `id`           (last resort)
 */
export function formatPropertyId(
  p: Property | null | undefined,
): string {
  if (!p) return '';

  // 1. Admin-web pattern: streetAddress + postalCode.
  const streetNum = extractStreetNumber(p.streetAddress);
  const postal = (p.postalCode || '').toString().trim();
  if (streetNum || postal) {
    return joinId(streetNum, postal);
  }

  // 2. Backend-supplied short ID (some payloads expose it directly).
  const supplied = (p.propertyId || p.referenceId || '').toString().trim();
  if (supplied) return supplied;

  // 3. Nested address.* fields (iOS native payload shape).
  const nestedStreet = extractStreetNumber(p.address?.street);
  const nestedPostal = (p.address?.zip || '').toString().trim();
  if (nestedStreet || nestedPostal) {
    return joinId(nestedStreet, nestedPostal);
  }

  // 4. Final fallback — derive from the database id.
  return deriveFromId(p.id);
}

/** "751 Main St" → "751"; "Apt 4B" → "" (no leading digits). */
function extractStreetNumber(streetAddress?: string): string {
  if (!streetAddress) return '';
  const firstToken = streetAddress.trim().split(/\s+/)[0] || '';
  return firstToken.replace(/\D/g, '');
}

/**
 * Builds the canonical listing title used on submitter property cards and the
 * draft list — e.g. `2024 4 Bedroom, 4 Bathroom in San Antonio, TX`.
 *
 * Pieces are dropped gracefully when missing:
 *   • street number only ("2024 in San Antonio, TX")
 *   • beds/baths only    ("4 Bedroom, 4 Bathroom")
 *   • city only          ("in San Antonio")
 * Returns an empty string when there's nothing to render so callers can fall
 * back to a stored title or "Untitled".
 */
export function formatListingTitle(source: {
  streetAddress?: string | null;
  address?: { street?: string | null; city?: string | null; state?: string | null } | null;
  city?: string | null;
  state?: string | null;
  /** Flat deal field for the state on submitter/admin records. */
  stateRegion?: string | null;
  /** Preferred title prefix — mirrors the web view ("2017 11 Bedroom …"). */
  yearBuilt?: number | string | null;
  bedrooms?: number | string | null;
  bathrooms?: number | string | null;
}): string {
  const street = source.streetAddress || source.address?.street || '';
  const streetNum = extractStreetNumber(typeof street === 'string' ? street : undefined);
  const year = source.yearBuilt != null && String(source.yearBuilt).trim() !== ''
    ? String(source.yearBuilt).trim()
    : '';
  // Read both the flat (`city`/`stateRegion`) and nested (`address.*`) shapes —
  // submitter/admin deal records store them flat; the iOS-native payload nests.
  const city = (source.city || source.address?.city || '').toString().trim();
  const state = (source.state || source.stateRegion || source.address?.state || '').toString().trim();
  const beds = source.bedrooms != null && String(source.bedrooms).trim() !== ''
    ? String(source.bedrooms).trim()
    : '';
  const baths = source.bathrooms != null && String(source.bathrooms).trim() !== ''
    ? String(source.bathrooms).trim()
    : '';

  const bbParts: string[] = [];
  if (beds) bbParts.push(`${beds} Bedroom`);
  if (baths) bbParts.push(`${baths} Bathroom`);
  const bb = bbParts.join(', ');

  const locParts: string[] = [];
  if (city) locParts.push(city);
  if (state) locParts.push(state);
  const loc = locParts.join(', ');

  // Compose like the web view: "{year} {beds} Bedroom, {baths} Bathroom in {city}, {state}".
  // Prefer the year as the prefix (matches web); fall back to the street number.
  const prefix = year || streetNum;
  const segments: string[] = [];
  if (prefix) segments.push(prefix);
  if (bb) segments.push(bb);
  if (loc) segments.push(`in ${loc}`);
  return segments.join(' ').trim();
}

function joinId(streetNum: string, postal: string): string {
  if (!streetNum && !postal) return '';
  if (!streetNum) return postal;
  if (!postal) return streetNum;
  return `${streetNum}-${postal}`;
}

function deriveFromId(raw?: string): string {
  if (!raw) return '';
  const cleaned = raw.replace(/[^A-Za-z0-9]/g, '');
  if (!cleaned) return '';
  const tail = cleaned.slice(-8);
  if (tail.length <= 3) return tail.toUpperCase();
  return `${tail.slice(0, 3)}-${tail.slice(3)}`.toUpperCase();
}
