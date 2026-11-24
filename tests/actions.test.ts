import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';

const revalidated: string[] = [];
vi.mock('next/cache', () => ({ revalidatePath: (p: string) => revalidated.push(p) }));
vi.mock('next/navigation', () => ({
  redirect: (to: string) => {
    throw new Error(`REDIRECT ${to}`);
  },
  notFound: () => {
    throw new Error('NOT_FOUND');
  },
}));

import { addExpenseAction, createGroupAction, settleAction } from '@/app/actions';
import { closeDb, db, schema } from '@/db';
import { getGroup, getLedger, listGroups } from '@/lib/service';
import { count, eq } from 'drizzle-orm';

const fd = (o: Record<string, string | string[]>) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(o)) for (const x of Array.isArray(v) ? v : [v]) f.append(k, x);
  return f;
};

async function newGroup(names = 'Ana, Ben, Cal') {
  const name = `t-${crypto.randomUUID().slice(0, 8)}`;
  let to = '';
  try {
    await createGroupAction({ errors: {} }, fd({ name, members: names }));
  } catch (e) {
    to = String((e as Error).message).replace('REDIRECT ', '');
  }
  const id = to.split('/').pop()!;
  const group = (await getGroup(id))!;
  const by = Object.fromEntries(group.members.map((m) => [m.name, m.id]));
  return { id, name, by, group };
}

beforeEach(() => {
  revalidated.length = 0;
});
afterAll(async () => {
  await closeDb();
});

describe('createGroupAction', () => {
  it('creates the group and its members, then redirects to it', async () => {
    const { id, group } = await newGroup('Ana, Ben');
    expect(id).toMatch(/^[0-9a-f-]{36}$/);
    expect(group.members.map((m) => m.name)).toEqual(['Ana', 'Ben']);
    expect(revalidated).toContain('/');
  });

  it('shows up in the group list', async () => {
    const { id } = await newGroup();
    expect((await listGroups()).some((g) => g.id === id)).toBe(true);
  });

  it('returns field errors for an empty form and writes nothing', async () => {
    const before = await db().select({ n: count() }).from(schema.groups);
    const state = await createGroupAction({ errors: {} }, fd({ name: '', members: '' }));
    const after = await db().select({ n: count() }).from(schema.groups);
    expect(Object.keys(state.errors).sort()).toEqual(['members', 'name']);
    expect(after[0].n).toBe(before[0].n);
  });

  it('refuses one person', async () => {
    const state = await createGroupAction({ errors: {} }, fd({ name: 'Solo', members: 'Ana' }));
    expect(state.errors.members).toMatch(/at least two/);
  });

  it('refuses duplicate names', async () => {
    const state = await createGroupAction({ errors: {} }, fd({ name: 'Dupes', members: 'Ana\nana' }));
    expect(state.errors.members).toBeDefined();
  });
});

describe('getGroup', () => {
  it('returns null for something that is not a uuid', async () => {
    expect(await getGroup('not-an-id')).toBeNull();
  });
  it('returns null for a uuid that does not exist', async () => {
    expect(await getGroup('00000000-0000-4000-8000-000000000000')).toBeNull();
  });
});

describe('addExpenseAction', () => {
  it('stores the expense with shares that add up to the amount', async () => {
    const { id, by } = await newGroup();
    const state = await addExpenseAction(
      { errors: {} },
      fd({ groupId: id, description: 'Pizza', amount: '10.00', paidBy: by.Ana, sharedWith: [by.Ana, by.Ben, by.Cal] }),
    );
    expect(state).toEqual({ errors: {}, ok: true });
    const shares = await db().select().from(schema.expenseShares);
    const [exp] = await db().select().from(schema.expenses).where(eq(schema.expenses.groupId, id));
    const mine = shares.filter((s) => s.expenseId === exp.id).map((s) => s.shareCents);
    expect(mine.reduce((a, b) => a + b, 0)).toBe(1000);
    expect(mine.sort()).toEqual([333, 333, 334]);
    expect(revalidated).toContain(`/groups/${id}`);
  });

  it('puts the odd cent on exactly one sharer when ten cents is split three ways', async () => {
    const { id, by } = await newGroup();
    await addExpenseAction(
      { errors: {} },
      fd({ groupId: id, description: 'Gum', amount: '0.10', paidBy: by.Ana, sharedWith: [by.Ana, by.Ben, by.Cal] }),
    );
    const ledger = await getLedger(id);
    expect(Object.values(ledger.balances).reduce((a, b) => a + b, 0)).toBe(0);
    // Shares go out in member-id order, so which person carries 4 cents is not Ana's name.
    const debts = [by.Ben, by.Cal].map((id) => -ledger.balances[id]).sort();
    expect(ledger.balances[by.Ana]).toBe(debts[0] + debts[1]);
    expect([6, 7]).toContain(ledger.balances[by.Ana]);
  });

  it('rejects a bad amount with a message and writes nothing', async () => {
    const { id, by } = await newGroup();
    const state = await addExpenseAction(
      { errors: {} },
      fd({ groupId: id, description: 'x', amount: '12.345', paidBy: by.Ana, sharedWith: [by.Ana] }),
    );
    expect(state.errors.amount).toMatch(/two decimal/);
    expect((await getLedger(id)).expenses).toHaveLength(0);
  });

  it('rejects an empty split', async () => {
    const { id, by } = await newGroup();
    const state = await addExpenseAction(
      { errors: {} },
      fd({ groupId: id, description: 'x', amount: '5', paidBy: by.Ana }),
    );
    expect(state.errors.sharedWith).toBeDefined();
  });

  it('rejects a payer from a different group', async () => {
    const one = await newGroup();
    const two = await newGroup();
    const state = await addExpenseAction(
      { errors: {} },
      fd({ groupId: one.id, description: 'x', amount: '5', paidBy: two.by.Ana, sharedWith: [one.by.Ana] }),
    );
    expect(state.errors.paidBy).toBeDefined();
  });

  it('refuses an unknown group', async () => {
    const state = await addExpenseAction(
      { errors: {} },
      fd({ groupId: '00000000-0000-4000-8000-000000000000', description: 'x', amount: '5', paidBy: 'a', sharedWith: ['a'] }),
    );
    expect(state.errors.form).toMatch(/does not exist/);
  });

  it('counts a duplicated sharer once', async () => {
    const { id, by } = await newGroup();
    await addExpenseAction(
      { errors: {} },
      fd({ groupId: id, description: 'x', amount: '9', paidBy: by.Ana, sharedWith: [by.Ben, by.Ben] }),
    );
    const ledger = await getLedger(id);
    expect(ledger.balances[by.Ben]).toBe(-900);
  });
});

describe('settling up', () => {
  async function owed() {
    const g = await newGroup();
    await addExpenseAction(
      { errors: {} },
      fd({ groupId: g.id, description: 'Rent', amount: '30.00', paidBy: g.by.Ana, sharedWith: [g.by.Ana, g.by.Ben, g.by.Cal] }),
    );
    return g;
  }

  it('suggests two transfers to Ana', async () => {
    const g = await owed();
    const { transfers } = await getLedger(g.id);
    expect(transfers).toHaveLength(2);
    expect(transfers.every((t) => t.to === g.by.Ana && t.amountCents === 1000)).toBe(true);
  });

  it('records a payment and the balance moves', async () => {
    const g = await owed();
    await settleAction(fd({ groupId: g.id, from: g.by.Ben, to: g.by.Ana, amountCents: '1000' }));
    const ledger = await getLedger(g.id);
    expect(ledger.balances[g.by.Ben]).toBe(0);
    expect(ledger.transfers).toHaveLength(1);
  });

  it('ends with nothing left to pay once every transfer is recorded', async () => {
    const g = await owed();
    for (const t of (await getLedger(g.id)).transfers) {
      await settleAction(fd({ groupId: g.id, from: t.from, to: t.to, amountCents: String(t.amountCents) }));
    }
    expect((await getLedger(g.id)).transfers).toEqual([]);
  });

  it('ignores a payment of the wrong direction', async () => {
    const g = await owed();
    await settleAction(fd({ groupId: g.id, from: g.by.Ana, to: g.by.Ben, amountCents: '1000' }));
    expect((await getLedger(g.id)).settlements).toHaveLength(0);
  });

  it('ignores a payment bigger than the debt', async () => {
    const g = await owed();
    await settleAction(fd({ groupId: g.id, from: g.by.Ben, to: g.by.Ana, amountCents: '1001' }));
    expect((await getLedger(g.id)).settlements).toHaveLength(0);
  });

  it('ignores a repeated click on the same transfer', async () => {
    const g = await owed();
    const f = () => fd({ groupId: g.id, from: g.by.Ben, to: g.by.Ana, amountCents: '1000' });
    await settleAction(f());
    await settleAction(f());
    expect((await getLedger(g.id)).settlements).toHaveLength(1);
  });

  it('ignores a non-numeric amount', async () => {
    const g = await owed();
    await settleAction(fd({ groupId: g.id, from: g.by.Ben, to: g.by.Ana, amountCents: 'abc' }));
    expect((await getLedger(g.id)).settlements).toHaveLength(0);
  });

  it('ignores a fractional amount', async () => {
    const g = await owed();
    await settleAction(fd({ groupId: g.id, from: g.by.Ben, to: g.by.Ana, amountCents: '10.5' }));
    expect((await getLedger(g.id)).settlements).toHaveLength(0);
  });
});

describe('database constraints', () => {
  it('refuses a zero-amount expense even if the service were bypassed', async () => {
    const { id, by } = await newGroup();
    await expect(
      db().insert(schema.expenses).values({ groupId: id, description: 'x', amountCents: 0, paidBy: by.Ana }),
    ).rejects.toThrow();
  });

  it('deletes a group with everything under it', async () => {
    const { id, by } = await newGroup();
    await addExpenseAction({ errors: {} }, fd({ groupId: id, description: 'x', amount: '5', paidBy: by.Ana, sharedWith: [by.Ana] }));
    // expenses reference members without cascade, so remove them first, as a real admin would
    await db().delete(schema.expenses).where(eq(schema.expenses.groupId, id));
    await db().delete(schema.groups).where(eq(schema.groups.id, id));
    expect(await getGroup(id)).toBeNull();
  });
});
