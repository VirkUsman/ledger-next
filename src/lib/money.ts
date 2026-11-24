// All money is an integer number of cents. Floats never touch an amount.

export const MAX_CENTS = 100_000_000; // 1,000,000.00

export type ParsedAmount = { ok: true; cents: number } | { ok: false; error: string };

/**
 * Turns what someone typed ("12", "12.5", "1,234.07") into cents by reading the
 * digits, not by multiplying a float. 19.99 * 100 is 1998.9999999999998.
 */
export function parseAmount(input: string): ParsedAmount {
  const raw = input.trim().replace(/,/g, '');
  if (raw === '') return { ok: false, error: 'Enter an amount.' };
  const m = /^(\d+)(?:\.(\d{1,2}))?$/.exec(raw);
  if (!m) {
    if (/^-/.test(raw)) return { ok: false, error: 'The amount cannot be negative.' };
    if (/\.\d{3,}/.test(raw)) return { ok: false, error: 'Use at most two decimal places.' };
    return { ok: false, error: 'Enter the amount as a number, like 12.50.' };
  }
  const whole = Number(m[1]);
  const frac = Number((m[2] ?? '').padEnd(2, '0') || '0');
  const cents = whole * 100 + frac;
  if (cents <= 0) return { ok: false, error: 'The amount must be more than zero.' };
  if (!Number.isSafeInteger(cents) || cents > MAX_CENTS) {
    return { ok: false, error: 'That amount is too large for this ledger.' };
  }
  return { ok: true, cents };
}

export function formatCents(cents: number): string {
  const sign = cents < 0 ? '-' : '';
  const abs = Math.abs(cents);
  const whole = Math.floor(abs / 100)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `${sign}${whole}.${(abs % 100).toString().padStart(2, '0')}`;
}

/**
 * Splits `total` cents across `n` people so the parts add up to `total` exactly.
 * The first `total % n` people carry one extra cent. Callers pass people in a
 * stable order, so the same expense always splits the same way.
 */
export function splitEqually(total: number, n: number): number[] {
  if (!Number.isInteger(total) || total < 0) throw new RangeError('total must be a non-negative integer');
  if (!Number.isInteger(n) || n < 1) throw new RangeError('n must be a positive integer');
  const base = Math.floor(total / n);
  const extra = total % n;
  return Array.from({ length: n }, (_, i) => base + (i < extra ? 1 : 0));
}
