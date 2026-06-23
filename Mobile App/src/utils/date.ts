/**
 * Best-available "published" date for a listing, formatted for display
 * (e.g. "Jun 10, 2026").
 *
 * Mirrors the timestamp precedence used for sorting elsewhere
 * (publishedAt → submittedAt → createdAt → updatedAt) so the date shown on a
 * card matches the order it appears in. Returns null when nothing parses, so
 * callers can omit the row entirely instead of rendering "Invalid Date".
 */
export function formatPublishedDate(source: unknown): string | null {
  const a = (source ?? {}) as Record<string, any>;
  const raw = a.publishedAt || a.submittedAt || a.createdAt || a.updatedAt;
  if (!raw) return null;
  const t = Date.parse(raw);
  if (Number.isNaN(t)) return null;
  return new Date(t).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}
