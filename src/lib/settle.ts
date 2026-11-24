import { splitEqually } from './money';

export type ExpenseInput = {
  paidBy: string;
  amountCents: number;
  /** member id -> cents. Must add up to amountCents. */
  shares: Record<string, number>;
};

export type SettlementInput = { from: string; to: string; amountCents: number };

export type Transfer = { from: string; to: string; amountCents: number };

/** Positive means the group owes this member, negative means this member owes the group. */
export type Balances = Record<string, number>;

export function equalShares(amountCents: number, memberIds: string[]): Record<string, number> {
  const sorted = [...memberIds].sort();
  const parts = splitEqually(amountCents, sorted.length);
  return Object.fromEntries(sorted.map((id, i) => [id, parts[i]]));
}

export function computeBalances(
  memberIds: string[],
  expenses: ExpenseInput[],
  settlements: SettlementInput[] = [],
): Balances {
  const bal: Balances = Object.fromEntries(memberIds.map((id) => [id, 0]));
  const touch = (id: string) => {
    if (!(id in bal)) throw new Error(`unknown member ${id}`);
  };
  for (const e of expenses) {
    touch(e.paidBy);
    const total = Object.values(e.shares).reduce((a, b) => a + b, 0);
    if (total !== e.amountCents) {
      throw new Error(`shares add up to ${total}, expense is ${e.amountCents}`);
    }
    bal[e.paidBy] += e.amountCents;
    for (const [id, cents] of Object.entries(e.shares)) {
      touch(id);
      bal[id] -= cents;
    }
  }
  for (const s of settlements) {
    touch(s.from);
    touch(s.to);
    // The payer of a settlement hands cash over, so they owe the group less.
    bal[s.from] += s.amountCents;
    bal[s.to] -= s.amountCents;
  }
  return bal;
}

/**
 * Greedy settle-up: the biggest debtor pays the biggest creditor, as much as
 * either can, repeat. Every transfer clears at least one person, so n people
 * need at most n - 1 transfers. Ties break on member id so output is stable.
 *
 * This is not always the true minimum (that is the NP-hard partition problem);
 * see README. It is exact whenever the balances contain no subset that nets to zero.
 */
export function settleUp(balances: Balances): Transfer[] {
  const sum = Object.values(balances).reduce((a, b) => a + b, 0);
  if (sum !== 0) throw new Error(`balances add up to ${sum}, not zero`);

  const debtors = Object.entries(balances)
    .filter(([, v]) => v < 0)
    .map(([id, v]) => ({ id, left: -v }));
  const creditors = Object.entries(balances)
    .filter(([, v]) => v > 0)
    .map(([id, v]) => ({ id, left: v }));
  const order = (a: { id: string; left: number }, b: { id: string; left: number }) =>
    b.left - a.left || (a.id < b.id ? -1 : 1);

  const out: Transfer[] = [];
  while (debtors.length && creditors.length) {
    debtors.sort(order);
    creditors.sort(order);
    const d = debtors[0];
    const c = creditors[0];
    const amount = Math.min(d.left, c.left);
    out.push({ from: d.id, to: c.id, amountCents: amount });
    d.left -= amount;
    c.left -= amount;
    if (d.left === 0) debtors.shift();
    if (c.left === 0) creditors.shift();
  }
  return out;
}
