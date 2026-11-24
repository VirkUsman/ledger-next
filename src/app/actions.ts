'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { addExpense, createGroup, recordSettlement } from '@/lib/service';
import { cleanName, parseMemberList, type FieldErrors } from '@/lib/validate';

export type FormState = { errors: FieldErrors; ok?: boolean };

const str = (v: FormDataEntryValue | null) => (typeof v === 'string' ? v : '');

export async function createGroupAction(_prev: FormState, form: FormData): Promise<FormState> {
  const result = await createGroup(cleanName(form.get('name')), parseMemberList(str(form.get('members'))));
  if (!result.ok) return { errors: result.errors };
  revalidatePath('/');
  redirect(`/groups/${result.value.id}`);
}

export async function addExpenseAction(_prev: FormState, form: FormData): Promise<FormState> {
  const groupId = str(form.get('groupId'));
  const result = await addExpense(groupId, {
    description: cleanName(form.get('description')),
    amount: str(form.get('amount')),
    paidBy: str(form.get('paidBy')),
    sharedWith: form.getAll('sharedWith').map(str),
  });
  if (!result.ok) return { errors: result.errors };
  revalidatePath(`/groups/${groupId}`);
  return { errors: {}, ok: true };
}

export async function settleAction(form: FormData): Promise<void> {
  const groupId = str(form.get('groupId'));
  const result = await recordSettlement(groupId, str(form.get('from')), str(form.get('to')), Number(form.get('amountCents')));
  // A stale page can offer a payment that was already made. Reloading shows the truth.
  if (!result.ok) console.warn('settlement refused:', Object.values(result.errors).join(' '));
  revalidatePath(`/groups/${groupId}`);
}
