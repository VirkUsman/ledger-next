import { describe, expect, it } from 'vitest';
import { computeBalances, equalShares, settleUp, type Balances } from '@/lib/settle';

const A = 'a';
const B = 'b';
const C = 'c';
const D = 'd';

function apply(balances: Balances, transfers: { from: string; to: string; amountCents: number }[]) {
  const b = { ...balances };
  for (const t of transfers) {
    b[t.from] += t.amountCents;
    b[t.to] -= t.amountCents;
  }
  return b;
}

describe('equalShares', () => {
  it('sums to the amount and orders by member id', () => {
    expect(equalShares(100, [C, A, B])).toEqual({ a: 34, b: 33, c: 33 });
  });

  it('gives the same result whatever order the members arrive in', () => {
    expect(equalShares(1001, [B, C, A, D])).toEqual(equalShares(1001, [D, A, C, B]));
  });
});

describe('computeBalances', () => {
  it('is all zero with no activity', () => {
    expect(computeBalances([A, B], [])).toEqual({ a: 0, b: 0 });
  });

  it('credits the payer and debits the sharers', () => {
    const bal = computeBalances([A, B, C], [{ paidBy: A, amountCents: 3000, shares: equalShares(3000, [A, B, C]) }]);
    expect(bal).toEqual({ a: 2000, b: -1000, c: -1000 });
  });

  it('keeps the odd cent with the first sharer', () => {
    const bal = computeBalances([A, B, C], [{ paidBy: A, amountCents: 100, shares: equalShares(100, [A, B, C]) }]);
    expect(bal).toEqual({ a: 66, b: -33, c: -33 });
  });

  it('handles a payer who is not in the split', () => {
    const bal = computeBalances([A, B], [{ paidBy: A, amountCents: 500, shares: { b: 500 } }]);
    expect(bal).toEqual({ a: 500, b: -500 });
  });

  it('applies a settlement towards zero', () => {
    const expense = { paidBy: A, amountCents: 2000, shares: equalShares(2000, [A, B]) };
    const bal = computeBalances([A, B], [expense], [{ from: B, to: A, amountCents: 1000 }]);
    expect(bal).toEqual({ a: 0, b: 0 });
  });

  it('always nets to zero', () => {
    const bal = computeBalances(
      [A, B, C, D],
      [
        { paidBy: A, amountCents: 1001, shares: equalShares(1001, [A, B, C]) },
        { paidBy: D, amountCents: 77, shares: equalShares(77, [A, B, C, D]) },
      ],
      [{ from: B, to: A, amountCents: 100 }],
    );
    expect(Object.values(bal).reduce((x, y) => x + y, 0)).toBe(0);
  });

  it('throws if shares do not add up to the amount', () => {
    expect(() => computeBalances([A, B], [{ paidBy: A, amountCents: 100, shares: { a: 50, b: 49 } }])).toThrow(/shares add up/);
  });

  it('throws on a member it does not know', () => {
    expect(() => computeBalances([A], [{ paidBy: 'zz', amountCents: 1, shares: { a: 1 } }])).toThrow(/unknown member/);
  });
});

describe('settleUp', () => {
  it('returns nothing when everyone is square', () => {
    expect(settleUp({ a: 0, b: 0 })).toEqual([]);
  });

  it('makes one transfer for two people', () => {
    expect(settleUp({ a: 500, b: -500 })).toEqual([{ from: 'b', to: 'a', amountCents: 500 }]);
  });

  it('makes two transfers for one creditor and two debtors', () => {
    const t = settleUp({ a: 2000, b: -1000, c: -1000 });
    expect(t).toHaveLength(2);
    expect(apply({ a: 2000, b: -1000, c: -1000 }, t)).toEqual({ a: 0, b: 0, c: 0 });
  });

  it('avoids a chain when a direct payment does it', () => {
    // b owes 10, c is owed 10: one transfer, not b -> a -> c.
    const t = settleUp({ a: 0, b: -1000, c: 1000 });
    expect(t).toEqual([{ from: 'b', to: 'c', amountCents: 1000 }]);
  });

  it('uses at most n - 1 transfers', () => {
    const b = { a: 700, b: 300, c: -400, d: -600 };
    expect(settleUp(b).length).toBeLessThanOrEqual(3);
  });

  it('clears four people with two debtors and two creditors', () => {
    const b = { a: 500, b: 500, c: -600, d: -400 };
    const t = settleUp(b);
    expect(apply(b, t)).toEqual({ a: 0, b: 0, c: 0, d: 0 });
    expect(t.length).toBeLessThanOrEqual(3);
  });

  it('is deterministic when balances tie', () => {
    const b = { x: 100, y: 100, z: -100, w: -100 };
    expect(settleUp(b)).toEqual(settleUp({ ...b }));
    expect(settleUp(b)[0]).toEqual({ from: 'w', to: 'x', amountCents: 100 });
  });

  it('refuses balances that do not net to zero', () => {
    expect(() => settleUp({ a: 100, b: -99 })).toThrow(/not zero/);
  });

  it('never creates a transfer of zero or a payment to oneself', () => {
    const t = settleUp({ a: 1, b: 1, c: -2, d: 0 });
    for (const x of t) {
      expect(x.amountCents).toBeGreaterThan(0);
      expect(x.from).not.toBe(x.to);
    }
  });

  it('settles the 100 cents between three case without losing a cent', () => {
    const bal = computeBalances([A, B, C], [{ paidBy: A, amountCents: 100, shares: equalShares(100, [A, B, C]) }]);
    const t = settleUp(bal);
    expect(t.reduce((s, x) => s + x.amountCents, 0)).toBe(66);
    expect(apply(bal, t)).toEqual({ a: 0, b: 0, c: 0 });
  });

  it('clears every balance across 300 pseudo-random ledgers', () => {
    let seed = 20261124;
    const rnd = (n: number) => {
      seed = (seed * 1664525 + 1013904223) % 4294967296;
      return seed % n;
    };
    for (let round = 0; round < 300; round++) {
      const n = 2 + rnd(8);
      const ids = Array.from({ length: n }, (_, i) => `m${i}`);
      const expenses = Array.from({ length: 1 + rnd(12) }, () => {
        const amount = 1 + rnd(50_000);
        const sharers = ids.filter(() => rnd(3) > 0);
        const who = sharers.length ? sharers : [ids[0]];
        return { paidBy: ids[rnd(n)], amountCents: amount, shares: equalShares(amount, who) };
      });
      const bal = computeBalances(ids, expenses);
      const t = settleUp(bal);
      expect(apply(bal, t)).toEqual(Object.fromEntries(ids.map((id) => [id, 0])));
      expect(t.length).toBeLessThanOrEqual(Math.max(0, n - 1));
    }
  });

  it('settling in two steps reaches the same place as settling once', () => {
    const bal = { a: 900, b: -400, c: -500 };
    const [first, ...rest] = settleUp(bal);
    const after = apply(bal, [first]);
    expect(settleUp(after)).toEqual(rest);
  });
});
