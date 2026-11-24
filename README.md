# ledger-next

_Built with AI assistance._

A small shared-expense ledger. Make a group, add who paid for what, see who owes
whom, and settle up with as few payments as the greedy rule can find. Every amount
is an integer number of cents from the form field to the database column.

Next.js 15 App Router, React Server Components, server actions, TypeScript (strict),
Tailwind 4, Postgres through Drizzle. Vitest for the maths and for the server actions
against a real database, Cypress for the browser.

```
src/lib/money.ts       parse "12.5" to 1250, format, split a total across n people
src/lib/settle.ts      balances from expenses and payments, and the settle-up
src/lib/validate.ts    form rules, shared by actions and tests
src/lib/service.ts     every database read and write
src/app/actions.ts     server actions: create group, add expense, mark paid
src/db/schema.ts       Drizzle tables
db/migrations/         plain SQL, applied by scripts/migrate.mjs
cypress/e2e/           the browser specs
scripts/e2e.mjs        boots next start on a free port, runs Cypress, stops it
```

## Money

Amounts are read as digits. `19.99 * 100` is `1998.9999999999998` in JavaScript, so
`parseAmount` never multiplies a float. Three decimal places are refused rather than
rounded, because rounding on input is how a ledger starts to disagree with itself.

An equal split gives each person `floor(total / n)` and hands the leftover cents, one
each, to the first people in member-id order. 10 cents between three people is 4, 3, 3,
and the shares always add up to the expense. Sorting by id keeps the same expense
splitting the same way every time it is recomputed.

Balances are computed from the rows on every read. Nothing stores a running total, so
there is no total to drift. A payment recorded in settle-up is a row that moves two
balances towards zero.

## Settle-up

The biggest debtor pays the biggest creditor as much as either can, repeat. Each payment
clears at least one person, so n people need at most n - 1 payments. Ties break on member
id so the list does not reshuffle between page loads.

`recordSettlement` re-reads the ledger before it writes and refuses a payment that goes
the wrong way or is bigger than the debt. A stale tab, or a double click on "Mark paid",
cannot push someone into credit.

## Tests

| Where                    | What                                                    | Count |
| ------------------------ | ------------------------------------------------------- | ----- |
| `tests/money.test.ts`    | parsing, formatting, equal split, float traps           | 39    |
| `tests/settle.test.ts`   | balances, settle-up, 300 seeded random ledgers          | 22    |
| `tests/validate.test.ts` | form rules                                              | 14    |
| `tests/actions.test.ts`  | server actions against Postgres, constraints            | 24    |
| `cypress/e2e/`           | add expense, settle up, validation errors, reload       | 14    |

Vitest reports 99 for the first four files, and Cypress reports 14, so 113 in all. The
action tests call the real action functions with `next/cache` and `next/navigation`
mocked, and write to a real database, so they exercise the SQL and the constraints.

## Run it

```
createdb ledger_next_test            # or let npm test create it
npm ci
npm test                             # creates the scratch DB if missing, migrates, runs vitest
npm run build
npm run test:e2e                     # next start on a free port, Cypress headless
DATABASE_URL=postgres://localhost:5432/ledger npm run migrate && npm run dev
```

Set `TEST_DATABASE_URL` to point the tests at another server. CI does this with a
Postgres 17 service container.

## What ran

Lint, typecheck, `next build`, the 99 Vitest tests and the 14 Cypress specs all passed on
one Mac, against a local Postgres. `.github/workflows/ci.yml` has not run on GitHub, since
this repo has no remote yet.

## Where it stops

- There are no accounts. Anyone with a group's URL can read and change it. The UUID is the
  only secret, which is fine for a demo and wrong for money.
- The settle-up is greedy. The true minimum number of payments is the partition problem and
  is NP-hard; greedy is exact when no subset of people nets to zero between themselves and
  can use one payment too many when one does. It never exceeds n - 1.
- Splits are equal only. Percentages and exact amounts per person would change what
  `expense_shares` holds, not how balances are computed.
- One currency, whole cents, up to 1,000,000.00 per expense.
- No edit or delete for an expense. A mistake is fixed by adding the opposite expense.
- The migration runner applies every file each run and relies on `IF NOT EXISTS`. It has no
  version table, so it cannot express a column change.
- Cypress runs on its bundled Electron, which Cypress marks as deprecated.
