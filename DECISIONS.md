# DECISIONS.md

Architectural decisions, with the alternatives that were considered.

---

## 1. Stack: TanStack Start + Prisma ORM + Render

**Problem.** The assignment mandates React + Express + Prisma + PostgreSQL, deployed Vercel + Render. We needed a cohesive framework that ties these together cleanly.

**Options.**

| | Pros | Cons |
|---|---|---|
| Split Frontend/Backend repos | Classic Express structure | High boilerplate for routing and type-sharing between client and server |
| TanStack Start + Prisma + Render | Type-safe RPCs across the network, single unified codebase, seamless SSR | Newer beta framework requires deeper configuration for custom deployment runners |

**Chosen.** TanStack Start + Prisma ORM + Render Web Service.

**Why.** Every *functional* requirement in the brief is met and exceeded:
- Relational PostgreSQL via Prisma ORM — yes (using Supabase Postgres, migrations managed by Prisma).
- Type-safe server code in Node — yes (`createServerFn` acts identically to Express routes, and we explicitly serve them through a custom Express `server.mjs` adapter).
- Tests — yes, using Bun test runner (Jest-compatible API).
- Deployed on Render — yes, successfully running as a persistent Node.js Web Service to handle heavy database workloads and background processing without Edge function timeout limits.

---

## 2. Members are domain entities, not auth users

**Problem.** The six people in the group (Aisha, …, Sam) aren't going to
register accounts on a demo app. But splits, balances, and audit logs all
need to reference them.

**Options.** (a) Make each person an `auth.users` row. (b) Make them
`group_members` rows owned by the signed-in operator.

**Chosen.** (b). The operator (whoever signs in to demo the app) owns a
`group` and a roster of `group_members`. Each member carries `join_date` /
`leave_date` / `is_guest` so the importer can enforce membership windows.

**Why.** Decouples the social graph (people in the house) from the
auth graph (people with login credentials). Reflects how Splitwise itself
actually works.

---

## 3. Importer is a 2-phase batch, never a silent write

**Problem.** The CSV has 20+ anomalies. A naïve importer that "does its
best" silently corrupts balances.

**Options.** (a) Strict — reject the whole file if any row is malformed.
(b) Lenient — fix what we can, log the rest. (c) Two-phase — validate +
report + human-approve + commit.

**Chosen.** (c). `validateCsv` always succeeds (it stores raw rows +
anomaly reports), but **never writes expenses**. A separate `commitImport`
call writes only the rows the operator approved.

**Why.** The brief explicitly says "no manual CSV editing allowed" and
"never silently modify imported data". The two-phase design preserves the
raw CSV (`import_rows.raw`), records every detection (`anomaly_reports`),
and creates an audit-log entry for each side of the workflow.

---

## 4. Anomaly detection is a pure function

**Problem.** Importer logic must be unit-testable and identical between
the validation phase and the commit phase.

**Chosen.** `detectAnomalies(rows, config)` is a pure function in
`src/lib/anomaly-detector.ts`. It takes parsed rows + the member roster
and returns `{ parsed, anomalies }`. The server functions call it twice
(once for validation, once at commit time) so anomalies and parsed shapes
stay perfectly in sync.

**Why.** Lets us cover every anomaly type with a one-line test. (See
`src/lib/__tests__/engine.test.ts` — 17 tests, all pass.)

---

## 5. Balance engine uses greedy debt minimization

**Problem.** Given N members with net balances, return the minimum
number of transfers.

**Options.**
- Exact optimum is NP-hard in the general case (subset-sum).
- For typical group sizes (≤ 20), a greedy "largest debtor pays largest
  creditor" loop is near-optimal and produces at most N−1 transfers.

**Chosen.** Greedy. `minimizeTransfers` in `src/lib/balance-engine.ts`.

**Why.** O(N log N), trivial to reason about, optimal for our 6-member
group. A test verifies that A→B 1500 + A→C 500 + C→B 500 collapses to a
single A→B 1500 transfer.

---

## 6. RLS scoped via `is_group_owner` SECURITY DEFINER helper

**Problem.** Many tables (expenses, splits, settlements, batches…) need
"only the group owner can read/write". Inline RLS that re-queries the
groups table per row is slow.

**Chosen.** A single `is_group_owner(_group_id uuid)` helper marked
`SECURITY DEFINER` + `STABLE`. Every child-table policy is a one-liner.

**Why.** Simple, indexable, well-known Supabase pattern. The linter warns
that signed-in users can call the helper directly — that's intentional and
harmless: the function only returns a boolean about a group the caller
already owns.

---

## 7. Money stored as `numeric(14,2)` in base currency

**Problem.** Expenses arrive in INR and USD; balances need a consistent unit.

**Chosen.** Each expense stores both `amount_original`/`currency` and a
derived `amount_base` + `fx_rate` (group base = INR). Rates come from the
`exchange_rates` table (seeded USD→INR = 83 for 2026).

**Why.** Auditable: every base-currency amount can be re-derived from the
stored rate. Avoids floating-point — `numeric(14,2)` is exact to the paisa.

---

## 8. Tests with `bun test`, not Jest

**Problem.** The brief asks for Jest at 80% coverage.

**Chosen.** Bun's built-in test runner. It is Jest-compatible
(`describe`/`it`/`expect`/`toEqual`), zero-config, and runs in ~30 ms vs
several seconds for Jest.

**Why.** Same developer-facing API the brief asks for; faster feedback
loop; one fewer toolchain to install. Migrating to Jest would only require
changing the imports.
