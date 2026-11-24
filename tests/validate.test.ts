import { describe, expect, it } from 'vitest';
import { cleanName, parseMemberList, validateExpense, validateGroup } from '@/lib/validate';

describe('parseMemberList', () => {
  it('splits on commas and new lines', () => {
    expect(parseMemberList('Ana, Ben\nCal')).toEqual(['Ana', 'Ben', 'Cal']);
  });
  it('drops blanks and collapses inner spaces', () => {
    expect(parseMemberList(' Ana  Lee ,, \n  ')).toEqual(['Ana Lee']);
  });
});

describe('cleanName', () => {
  it('trims and collapses whitespace', () => {
    expect(cleanName('  Flat   12 ')).toBe('Flat 12');
  });
  it('returns an empty string for a missing field', () => {
    expect(cleanName(null)).toBe('');
  });
});

describe('validateGroup', () => {
  it('accepts a normal group', () => {
    expect(validateGroup('Flat', ['Ana', 'Ben'])).toEqual({});
  });
  it('wants a name', () => {
    expect(validateGroup('', ['Ana', 'Ben']).name).toBeDefined();
  });
  it('wants two people', () => {
    expect(validateGroup('Flat', ['Ana']).members).toMatch(/at least two/);
  });
  it('refuses duplicates ignoring case', () => {
    expect(validateGroup('Flat', ['Ana', 'ana']).members).toMatch(/only be listed once/);
  });
  it('limits the group size', () => {
    const many = Array.from({ length: 21 }, (_, i) => `P${i}`);
    expect(validateGroup('Flat', many).members).toMatch(/20/);
  });
  it('limits the name length', () => {
    expect(validateGroup('x'.repeat(61), ['Ana', 'Ben']).name).toMatch(/60/);
  });
});

describe('validateExpense', () => {
  const memberIds = ['m1', 'm2'];
  const good = { description: 'Dinner', amount: '24.50', paidBy: 'm1', sharedWith: ['m1', 'm2'], memberIds };

  it('accepts a good expense and returns cents', () => {
    expect(validateExpense(good)).toEqual({ errors: {}, cents: 2450 });
  });
  it('reports every problem at once', () => {
    const { errors } = validateExpense({ ...good, description: '', amount: 'x', paidBy: '', sharedWith: [] });
    expect(Object.keys(errors).sort()).toEqual(['amount', 'description', 'paidBy', 'sharedWith']);
  });
  it('refuses a payer from another group', () => {
    expect(validateExpense({ ...good, paidBy: 'zz' }).errors.paidBy).toBeDefined();
  });
  it('refuses a sharer from another group', () => {
    expect(validateExpense({ ...good, sharedWith: ['m1', 'zz'] }).errors.sharedWith).toBeDefined();
  });
});
