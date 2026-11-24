import { describe, expect, it } from 'vitest';
import { formatCents, parseAmount, splitEqually } from '@/lib/money';

const cents = (s: string) => {
  const r = parseAmount(s);
  if (!r.ok) throw new Error(r.error);
  return r.cents;
};

describe('parseAmount', () => {
  it.each([
    ['12', 1200],
    ['12.5', 1250],
    ['12.50', 1250],
    ['0.07', 7],
    ['0.7', 70],
    ['1,234.07', 123407],
    ['  8.00 ', 800],
  ])('reads %s as %i cents', (input, expected) => {
    expect(cents(input)).toBe(expected);
  });

  it('does not suffer the float error on 19.99', () => {
    expect(19.99 * 100).not.toBe(1999);
    expect(cents('19.99')).toBe(1999);
  });

  it('does not suffer the float error on 1.005 style input', () => {
    const r = parseAmount('1.005');
    expect(r.ok).toBe(false);
  });

  it.each(['', '   ', 'abc', '12abc', '1.2.3', '$5', '.5', '5.'])('rejects %j as not a number', (input) => {
    expect(parseAmount(input).ok).toBe(false);
  });

  it('says why a negative amount is refused', () => {
    expect(parseAmount('-5')).toEqual({ ok: false, error: 'The amount cannot be negative.' });
  });

  it('refuses three decimal places instead of rounding', () => {
    expect(parseAmount('2.345')).toEqual({ ok: false, error: 'Use at most two decimal places.' });
  });

  it('refuses zero', () => {
    expect(parseAmount('0').ok).toBe(false);
    expect(parseAmount('0.00').ok).toBe(false);
  });

  it('accepts the largest amount and refuses one cent more', () => {
    expect(cents('1000000.00')).toBe(100_000_000);
    expect(parseAmount('1000000.01').ok).toBe(false);
  });

  it('refuses an absurd amount without producing Infinity', () => {
    expect(parseAmount('9'.repeat(400)).ok).toBe(false);
  });
});

describe('formatCents', () => {
  it.each([
    [0, '0.00'],
    [5, '0.05'],
    [100, '1.00'],
    [123456, '1,234.56'],
    [100_000_000, '1,000,000.00'],
    [-250, '-2.50'],
  ])('formats %i as %s', (input, expected) => {
    expect(formatCents(input)).toBe(expected);
  });

  it('round-trips through parseAmount', () => {
    for (const c of [1, 99, 100, 101, 99999, 123456]) {
      expect(cents(formatCents(c))).toBe(c);
    }
  });
});

describe('splitEqually', () => {
  it('splits evenly when it can', () => {
    expect(splitEqually(900, 3)).toEqual([300, 300, 300]);
  });

  it('gives the spare cent to the first person', () => {
    expect(splitEqually(100, 3)).toEqual([34, 33, 33]);
  });

  it('gives two spare cents to the first two', () => {
    expect(splitEqually(101, 3)).toEqual([34, 34, 33]);
  });

  it('handles one cent between three', () => {
    expect(splitEqually(1, 3)).toEqual([1, 0, 0]);
  });

  it('handles one person', () => {
    expect(splitEqually(1234, 1)).toEqual([1234]);
  });

  it('handles zero total', () => {
    expect(splitEqually(0, 4)).toEqual([0, 0, 0, 0]);
  });

  it('always adds up to the total, for many totals and sizes', () => {
    for (let total = 0; total <= 400; total += 7) {
      for (let n = 1; n <= 13; n++) {
        const parts = splitEqually(total, n);
        expect(parts.reduce((a, b) => a + b, 0)).toBe(total);
        expect(Math.max(...parts) - Math.min(...parts)).toBeLessThanOrEqual(1);
      }
    }
  });

  it('puts the larger parts first so the order is stable', () => {
    const parts = splitEqually(1003, 7);
    expect([...parts].sort((a, b) => b - a)).toEqual(parts);
  });

  it('rejects a fractional or negative total', () => {
    expect(() => splitEqually(1.5, 2)).toThrow(RangeError);
    expect(() => splitEqually(-1, 2)).toThrow(RangeError);
  });

  it('rejects zero or fractional people', () => {
    expect(() => splitEqually(100, 0)).toThrow(RangeError);
    expect(() => splitEqually(100, 2.5)).toThrow(RangeError);
  });
});
