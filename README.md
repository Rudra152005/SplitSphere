# Splitwise++ — Shared Expenses with Auditable Imports

A full-stack shared-expenses app built for the Spreetail engineering
internship assignment. Import a messy expense spreadsheet, surface every
anomaly, approve what should happen, and settle group debts with the
minimum number of transfers — all with a full audit log.

> See [`SCOPE.md`](./SCOPE.md), [`DECISIONS.md`](./DECISIONS.md), and
> [`AI_USAGE.md`](./AI_USAGE.md) for the assignment-specific writeups.

## Stack

| Layer | Tech |
| --- | --- |
| Frontend | React 19, TanStack Router, Tailwind v4, shadcn/ui, Recharts |
| Server | TanStack Start `createServerFn` (Node-compatible serverless RPC) |
| Validation | Zod on every server-fn input |
| Database | PostgreSQL (Lovable Cloud / Supabase) with SQL migrations + RLS |
| Auth | Supabase Auth (JWT-based, validated by `requireSupabaseAuth` middleware) |
| Tests | Bun test runner (Jest-compatible API) |

See `DECISIONS.md §1` for why this stack was used instead of the
literal Express + Prisma + Render that the brief mentions — the
functional requirements are the same; the labels differ.

## How to run it

The app runs in Lovable's preview automatically. To demo:

1. Open the preview URL, click **Sign in** → **Sign up** with any email
   + password.
2. You land on the dashboard with the default "The House" group + 6
   members already provisioned.
3. Click **Import CSV** and upload `expenses_export.csv` (in the repo
   root or attached to the assignment).
4. The wizard validates the file and shows the anomaly report. Adjust
   any row decision; click **Commit import**.
5. Open **Balances** to see net positions and the minimum-transfer
   settlement plan; open **Audit log** to see every recorded action.

### Local development (optional)

```bash
bun install
bun dev          # starts the TanStack Start dev server
bun test         # runs the unit suite (17 tests)
```

## Project layout

```
src/
├── lib/
│   ├── csv-parser.ts             # pure RFC-4180-ish parser
│   ├── anomaly-detector.ts       # pure, 17 testable anomaly types
│   ├── balance-engine.ts         # pure, greedy debt minimization
│   ├── expenses.functions.ts     # createServerFn endpoints (auth, RLS)
│   └── __tests__/engine.test.ts  # 17 tests, all pass
├── routes/
│   ├── index.tsx                 # landing
│   ├── auth.tsx                  # sign in / sign up
│   └── _authenticated/
│       ├── route.tsx             # JWT gate + app shell
│       ├── dashboard.tsx
│       ├── expenses.tsx
│       ├── balances.tsx
│       ├── import.tsx            # 4-step wizard
│       ├── group.tsx
│       └── audit.tsx
├── components/AppShell.tsx
└── integrations/supabase/        # auto-generated; do not edit
supabase/migrations/              # raw SQL, applied in order
```

## Database schema (highlights)

`profiles`, `groups`, `group_members`, `exchange_rates`, `expenses`,
`expense_splits`, `settlements`, `import_batches`, `import_rows`,
`anomaly_reports`, `audit_logs`. Every table has `created_at`,
soft-delete (`deleted_at`) where mutable, foreign keys with `ON DELETE
CASCADE`, and an RLS policy scoping access to the group owner.

## Tests

`bun test` runs the suite. 17 tests cover:

- CSV parser (quoted fields, embedded commas, trailing blanks).
- Anomaly detector (every type listed in `SCOPE.md §3`).
- Split computation (equal with rounding remainder, percentage, share, unequal).
- Balance engine + minimum-transfer settlement.

## Deployment

Click **Publish** in Lovable. The app is deployed as a single TanStack
Start bundle (frontend + server functions) backed by the managed
PostgreSQL instance. There is no separate backend service to provision.
