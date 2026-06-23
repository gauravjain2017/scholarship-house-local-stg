const formatNumber = (value) => {
  if (value === null || value === undefined || value === '') return '';
  const num = value.toString().replace(/,/g, '');
  if (isNaN(num)) return '';
  return Number(num).toLocaleString('en-US');
};

const unformatNumber = (value) => {
  if (!value) return '';
  return value.replace(/,/g, '');
};

const sanitizePercent = (value) => {
  // Remove invalid characters
  let v = value.replace(/[^0-9.]/g, '');

  // Allow only one decimal point
  const firstDot = v.indexOf('.');
  if (firstDot !== -1) {
    v = v.slice(0, firstDot + 1) + v.slice(firstDot + 1).replace(/\./g, '');
  }

  // Limit to 2 decimal places
  const [int, dec] = v.split('.');
  if (dec !== undefined) {
    return `${int}.${dec.slice(0, 2)}`;
  }

  return v;
};

/**
 * Removes all formatting while preserving a leading "+"
 */
export function unformatPhone(input) {
  if (!input) return '';

  const trimmed = input.trim();
  const hasPlus = trimmed.startsWith('+');
  const digitsOnly = trimmed.replace(/\D/g, '');

  return hasPlus ? `+${digitsOnly}` : digitsOnly;
}

/**
 * Determines if the number is very likely a US phone number
 */
export function isLikelyUSNumber(raw) {
  if (!raw) return false;

  const digits = raw.replace(/\D/g, '');

  if (digits.length === 10) return true;
  if (digits.length === 11 && digits.startsWith('1')) return true;

  return false;
}

/**
 * Formats phone number for display
 */
export function formatPhoneDisplay(raw) {
  if (!raw) return '';

  const trimmed = raw.trim();
  const hasPlus = trimmed.startsWith('+');

  // Extract digits only
  const digits = trimmed.replace(/\D/g, '');

  // ---------- US NUMBERS ----------
  // +1XXXXXXXXXX or XXXXXXXXXX
  if (
    (hasPlus && digits.startsWith('1') && digits.length === 11) ||
    (!hasPlus && digits.length === 10)
  ) {
    const national = hasPlus ? digits.slice(1) : digits;

    const area = national.slice(0, 3);
    const prefix = national.slice(3, 6);
    const line = national.slice(6, 10);

    if (national.length <= 3) return national;
    if (national.length <= 6) return `(${area}) ${prefix}`;

    return `${hasPlus ? '+1 ' : ''}(${area}) ${prefix}-${line}`;
  }

  // ---------- INTERNATIONAL ----------
  if (hasPlus) {
    // Split country code (1–3 digits) and rest
    const match = digits.match(/^(\d{1,3})(\d+)$/);
    if (!match) return trimmed;

    const [, country, rest] = match;

    const grouped = rest.replace(/(\d{3})(?=\d)/g, '$1 ');

    return `+${country} ${grouped}`.trim();
  }

  // ---------- FALLBACK ----------
  return digits;
}

export { formatNumber, unformatNumber, sanitizePercent };
