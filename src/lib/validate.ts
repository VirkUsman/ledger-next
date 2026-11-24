import { parseAmount } from './money';

export type FieldErrors = Record<string, string>;

export function cleanName(v: FormDataEntryValue | null): string {
  return typeof v === 'string' ? v.trim().replace(/\s+/g, ' ') : '';
}

export function parseMemberList(raw: string): string[] {
  return raw
    .split(/[\n,]/)
    .map((s) => s.trim().replace(/\s+/g, ' '))
    .filter(Boolean);
}

export function validateGroup(name: string, memberNames: string[]): FieldErrors {
  const errors: FieldErrors = {};
  if (!name) errors.name = 'Give the group a name.';
  else if (name.length > 60) errors.name = 'The group name is limited to 60 characters.';
  if (memberNames.length < 2) errors.members = 'A group needs at least two people.';
  else if (memberNames.length > 20) errors.members = 'A group is limited to 20 people.';
  else if (memberNames.some((n) => n.length > 40)) errors.members = 'A name is limited to 40 characters.';
  else if (new Set(memberNames.map((n) => n.toLowerCase())).size !== memberNames.length) {
    errors.members = 'Each person can only be listed once.';
  }
  return errors;
}

export function validateExpense(input: {
  description: string;
  amount: string;
  paidBy: string;
  sharedWith: string[];
  memberIds: string[];
}): { errors: FieldErrors; cents?: number } {
  const errors: FieldErrors = {};
  if (!input.description) errors.description = 'Say what the expense was for.';
  else if (input.description.length > 80) errors.description = 'The description is limited to 80 characters.';
  const amount = parseAmount(input.amount);
  if (!amount.ok) errors.amount = amount.error;
  if (!input.memberIds.includes(input.paidBy)) errors.paidBy = 'Choose who paid.';
  if (input.sharedWith.length === 0) errors.sharedWith = 'Pick at least one person to split with.';
  else if (!input.sharedWith.every((id) => input.memberIds.includes(id))) {
    errors.sharedWith = 'Someone in the split is not in this group.';
  }
  return { errors, cents: amount.ok ? amount.cents : undefined };
}
