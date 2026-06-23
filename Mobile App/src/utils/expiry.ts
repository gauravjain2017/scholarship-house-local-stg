/**
 * Listing-expiration helpers — kept in sync with the backend's
 * services/expirationJob.js: a deal is expired when its `expiry_date`
 * (normalized to ISO) is on or before today AND it isn't sold. The job flips
 * `expired_status` to true; we treat either signal as "expired".
 */

/** Today as YYYY-MM-DD (local). */
export function todayIso(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

/** ISO (YYYY-MM-DD) for `n` days from today — the renewal extends by 20. */
export function isoDaysFromNow(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() + n);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

/** Normalize an MM/DD/YYYY or ISO date string to YYYY-MM-DD (or null). */
export function parseExpiryIso(v: unknown): string | null {
  if (!v || typeof v !== 'string') return null;
  const trimmed = v.trim();
  if (!trimmed) return null;
  if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) return trimmed.slice(0, 10);
  const parts = trimmed.split('/');
  if (parts.length !== 3) return null;
  const [mm, dd, yyyy] = parts;
  if (!mm || !dd || !yyyy) return null;
  return `${yyyy}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`;
}

/**
 * True when a listing should show the Renew action: it has passed its expiry
 * date (or the backend already flagged it expired) and isn't sold.
 */
export function isExpired(p: Record<string, any> | null | undefined): boolean {
  if (!p) return false;
  if (String(p.status || '').toLowerCase() === 'sold') return false;
  if (p.expired_status === true) return true;
  const iso = parseExpiryIso(p.expiry_date);
  if (!iso) return false;
  return iso <= todayIso();
}
