import { notFound } from 'next/navigation';
import { formatCents } from '@/lib/money';
import { getGroup, getLedger } from '@/lib/service';
import { settleAction } from '../../actions';
import { AddExpenseForm } from '../../forms';

export const dynamic = 'force-dynamic';

export default async function GroupPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const group = await getGroup(id);
  if (!group) notFound();
  const ledger = await getLedger(id);
  const name = new Map(group.members.map((m) => [m.id, m.name]));

  return (
    <div className="space-y-10">
      <h1 className="text-2xl font-semibold" data-testid="group-name">
        {group.name}
      </h1>

      <section aria-labelledby="balances">
        <h2 id="balances" className="text-lg font-semibold">
          Balances
        </h2>
        <ul className="mt-2 divide-y divide-stone-300 rounded border border-stone-300 bg-white">
          {group.members.map((m) => {
            const b = ledger.balances[m.id];
            return (
              <li key={m.id} className="flex justify-between px-4 py-2" data-testid={`balance-${m.name}`}>
                <span>{m.name}</span>
                <span className={b < 0 ? 'text-red-700' : b > 0 ? 'text-green-800' : 'text-stone-500'}>
                  {b === 0 ? 'settled' : b > 0 ? `is owed ${formatCents(b)}` : `owes ${formatCents(-b)}`}
                </span>
              </li>
            );
          })}
        </ul>
      </section>

      <section aria-labelledby="settle">
        <h2 id="settle" className="text-lg font-semibold">
          Settle up
        </h2>
        {ledger.transfers.length === 0 ? (
          <p className="mt-2 text-stone-600" data-testid="all-settled">
            Everyone is square.
          </p>
        ) : (
          <ul className="mt-2 space-y-2">
            {ledger.transfers.map((t) => (
              <li
                key={`${t.from}-${t.to}`}
                className="flex items-center justify-between rounded border border-stone-300 bg-white px-4 py-2"
                data-testid="transfer"
              >
                <span>
                  {name.get(t.from)} pays {name.get(t.to)} {formatCents(t.amountCents)}
                </span>
                <form action={settleAction}>
                  <input type="hidden" name="groupId" value={id} />
                  <input type="hidden" name="from" value={t.from} />
                  <input type="hidden" name="to" value={t.to} />
                  <input type="hidden" name="amountCents" value={t.amountCents} />
                  <button className="rounded border border-stone-900 px-3 py-1 text-sm">Mark paid</button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="add">
        <h2 id="add" className="text-lg font-semibold">
          Add an expense
        </h2>
        <div className="mt-2">
          <AddExpenseForm groupId={id} members={group.members.map((m) => ({ id: m.id, name: m.name }))} />
        </div>
      </section>

      <section aria-labelledby="history">
        <h2 id="history" className="text-lg font-semibold">
          Expenses
        </h2>
        {ledger.expenses.length === 0 ? (
          <p className="mt-2 text-stone-600">Nothing spent yet.</p>
        ) : (
          <ul className="mt-2 divide-y divide-stone-300 rounded border border-stone-300 bg-white">
            {ledger.expenses.map((e) => (
              <li key={e.id} className="flex justify-between px-4 py-2" data-testid="expense">
                <span>
                  {e.description} <span className="text-stone-500">paid by {name.get(e.paidBy)}</span>
                </span>
                <span>{formatCents(e.amountCents)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
