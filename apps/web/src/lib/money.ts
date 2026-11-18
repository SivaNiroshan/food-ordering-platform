/**
 * Money is handled in integer cents, never as floating-point numbers.
 * In JavaScript 0.1 + 0.2 === 0.30000000000000004, so adding prices as floats
 * would slowly drift. The API sends prices as strings ("1200.00") for the same reason.
 */

const AMOUNT_PATTERN = /^(\d+)(?:\.(\d{1,2}))?$/;

/** "1200.5" → 120050. Parses the string directly, so no float is ever involved. */
export function toCents(amount: string): number {
  const match = AMOUNT_PATTERN.exec(amount.trim());
  if (!match) throw new Error(`Invalid amount: ${amount}`);
  const [, whole = '0', fraction = ''] = match;
  return Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
}

const formatter = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** 285000 → "LKR 2,850.00" */
export function formatCents(cents: number): string {
  return `LKR ${formatter.format(cents / 100)}`;
}

/** "1200.00" → "LKR 1,200.00" */
export function formatPrice(amount: string): string {
  return formatCents(toCents(amount));
}
