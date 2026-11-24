'use client';

import { useActionState } from 'react';
import { addExpenseAction, createGroupAction, type FormState } from './actions';

const initial: FormState = { errors: {} };
const input = 'mt-1 w-full rounded border border-stone-400 bg-white px-3 py-2';

function Err({ id, msg }: { id: string; msg?: string }) {
  return msg ? (
    <p id={id} role="alert" data-testid={id} className="mt-1 text-sm text-red-700">
      {msg}
    </p>
  ) : null;
}

export function CreateGroupForm() {
  const [state, action, pending] = useActionState(createGroupAction, initial);
  const e = state.errors;
  return (
    <form action={action} className="space-y-4" noValidate>
      <label className="block">
        <span className="text-sm font-medium">Group name</span>
        <input name="name" className={input} aria-invalid={!!e.name} aria-describedby="err-name" />
        <Err id="err-name" msg={e.name} />
      </label>
      <label className="block">
        <span className="text-sm font-medium">People, one per line or comma separated</span>
        <textarea name="members" rows={3} className={input} aria-invalid={!!e.members} aria-describedby="err-members" />
        <Err id="err-members" msg={e.members} />
      </label>
      <button disabled={pending} className="rounded bg-stone-900 px-4 py-2 text-white disabled:opacity-60">
        {pending ? 'Creating' : 'Create group'}
      </button>
    </form>
  );
}

export function AddExpenseForm({ groupId, members }: { groupId: string; members: { id: string; name: string }[] }) {
  const [state, action, pending] = useActionState(addExpenseAction, initial);
  const e = state.errors;
  return (
    <form action={action} className="space-y-4" noValidate>
      <input type="hidden" name="groupId" value={groupId} />
      <label className="block">
        <span className="text-sm font-medium">What for</span>
        <input name="description" className={input} aria-invalid={!!e.description} aria-describedby="err-description" />
        <Err id="err-description" msg={e.description} />
      </label>
      <label className="block">
        <span className="text-sm font-medium">Amount</span>
        <input name="amount" inputMode="decimal" className={input} aria-invalid={!!e.amount} aria-describedby="err-amount" />
        <Err id="err-amount" msg={e.amount} />
      </label>
      <label className="block">
        <span className="text-sm font-medium">Paid by</span>
        <select name="paidBy" className={input} defaultValue="" aria-describedby="err-paidBy">
          <option value="" disabled>
            Choose
          </option>
          {members.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </select>
        <Err id="err-paidBy" msg={e.paidBy} />
      </label>
      <fieldset>
        <legend className="text-sm font-medium">Split equally between</legend>
        <div className="mt-1 flex flex-wrap gap-3">
          {members.map((m) => (
            <label key={m.id} className="flex items-center gap-1">
              <input type="checkbox" name="sharedWith" value={m.id} defaultChecked />
              {m.name}
            </label>
          ))}
        </div>
        <Err id="err-sharedWith" msg={e.sharedWith} />
      </fieldset>
      <Err id="err-form" msg={e.form} />
      {state.ok && (
        <p role="status" data-testid="expense-saved" className="text-sm text-green-800">
          Expense saved.
        </p>
      )}
      <button disabled={pending} className="rounded bg-stone-900 px-4 py-2 text-white disabled:opacity-60">
        {pending ? 'Saving' : 'Add expense'}
      </button>
    </form>
  );
}
