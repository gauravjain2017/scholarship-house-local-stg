/**
 * US phone formatting shared by the Register and Edit-Profile forms so both
 * enforce the same 10-digit input + "(555) 123-4567" display. Pair with the
 * 10-digit zod refine in validation.ts.
 */
export function formatPhone(input: string): string {
  const digits = input.replace(/\D/g, '').slice(0, 10);
  if (digits.length === 0) return '';
  if (digits.length < 4) return `(${digits}`;
  if (digits.length < 7) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}
