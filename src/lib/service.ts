import { desc, eq, inArray } from 'drizzle-orm';
import { db, schema } from '@/db';
import { computeBalances, equalShares, settleUp, type Transfer } from './settle';
import { validateExpense, validateGroup, type FieldErrors } from './validate';

const { groups, members, expenses, expenseShares, settlements } = schema;

export type Result<T> = { ok: true; value: T } | { ok: false; errors: FieldErrors };

const fail = (errors: FieldErrors): { ok: false; errors: FieldErrors } => ({ ok: false, errors });

export async function createGroup(name: string, memberNames: string[]): Promise<Result<{ id: string }>> {
  const errors = validateGroup(name, memberNames);
  if (Object.keys(errors).length) return fail(errors);
  const id = await db().transaction(async (tx) => {
    const [g] = await tx.insert(groups).values({ name }).returning({ id: groups.id });
    await tx.insert(members).values(memberNames.map((n) => ({ groupId: g.id, name: n })));
    return g.id;
  });
  return { ok: true, value: { id } };
}

export async function listGroups() {
  return db().select().from(groups).orderBy(desc(groups.createdAt));
}

export async function getGroup(id: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const [g] = await db().select().from(groups).where(eq(groups.id, id));
  if (!g) return null;
  const people = await db().select().from(members).where(eq(members.groupId, id)).orderBy(members.name);
  return { ...g, members: people };
}

export async function addExpense(
  groupId: string,
  input: { description: string; amount: string; paidBy: string; sharedWith: string[] },
): Promise<Result<{ id: string }>> {
  const group = await getGroup(groupId);
  if (!group) return fail({ form: 'That group does not exist.' });
  const memberIds = group.members.map((m) => m.id);
  const { errors, cents } = validateExpense({ ...input, memberIds });
  if (Object.keys(errors).length || cents === undefined) return fail(errors);

  const shares = equalShares(cents, [...new Set(input.sharedWith)]);
  const id = await db().transaction(async (tx) => {
    const [e] = await tx
      .insert(expenses)
      .values({ groupId, description: input.description, amountCents: cents, paidBy: input.paidBy })
      .returning({ id: expenses.id });
    await tx
      .insert(expenseShares)
      .values(Object.entries(shares).map(([memberId, shareCents]) => ({ expenseId: e.id, memberId, shareCents })));
    return e.id;
  });
  return { ok: true, value: { id } };
}

export async function recordSettlement(
  groupId: string,
  from: string,
  to: string,
  amountCents: number,
): Promise<Result<{ id: string }>> {
  const group = await getGroup(groupId);
  if (!group) return fail({ form: 'That group does not exist.' });
  const ids = group.members.map((m) => m.id);
  if (!ids.includes(from) || !ids.includes(to)) return fail({ form: 'Both people must be in this group.' });
  if (from === to) return fail({ form: 'Nobody can pay themselves.' });
  if (!Number.isSafeInteger(amountCents) || amountCents <= 0) return fail({ form: 'The amount must be more than zero.' });

  // Only accept a payment that moves the group towards zero: the payer must
  // owe, the receiver must be owed, and neither amount may be overshot.
  const { balances } = await getLedger(groupId);
  if (balances[from] >= 0 || balances[to] <= 0) return fail({ form: 'That payment is not owed.' });
  if (amountCents > -balances[from] || amountCents > balances[to]) {
    return fail({ form: 'That is more than is owed.' });
  }
  const [s] = await db()
    .insert(settlements)
    .values({ groupId, fromMember: from, toMember: to, amountCents })
    .returning({ id: settlements.id });
  return { ok: true, value: { id: s.id } };
}

export async function getLedger(groupId: string) {
  const people = await db().select().from(members).where(eq(members.groupId, groupId));
  const exps = await db().select().from(expenses).where(eq(expenses.groupId, groupId)).orderBy(desc(expenses.createdAt));
  const shareRows = exps.length
    ? await db()
        .select()
        .from(expenseShares)
        .where(
          inArray(
            expenseShares.expenseId,
            exps.map((e) => e.id),
          ),
        )
    : [];
  const paid = await db().select().from(settlements).where(eq(settlements.groupId, groupId)).orderBy(desc(settlements.createdAt));

  const byExpense = new Map<string, Record<string, number>>();
  for (const r of shareRows) {
    const m = byExpense.get(r.expenseId) ?? {};
    m[r.memberId] = r.shareCents;
    byExpense.set(r.expenseId, m);
  }
  const balances = computeBalances(
    people.map((p) => p.id),
    exps.map((e) => ({ paidBy: e.paidBy, amountCents: e.amountCents, shares: byExpense.get(e.id) ?? {} })),
    paid.map((s) => ({ from: s.fromMember, to: s.toMember, amountCents: s.amountCents })),
  );
  const transfers: Transfer[] = settleUp(balances);
  return { members: people, expenses: exps, settlements: paid, balances, transfers };
}
