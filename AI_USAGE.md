# AI_USAGE.md

## Tools used

- **Lovable** (Claude-family agent) — primary implementation pair-programmer.
  Generated the database schema, server functions, the CSV importer (parser
  + anomaly detector + balance engine), the React UI, and the test suite.
- **ChatGPT** — used twice for sanity-checking the debt-minimization
  algorithm and for confirming `numeric(14,2)` precision semantics in
  Postgres.

## Representative prompts

> *"Build a TanStack Start app on Lovable Cloud Postgres that imports the
> attached `expenses_export.csv`. The importer must surface every anomaly
> (duplicates, missing payer, USD vs INR, settlements masquerading as
> expenses, membership windows for Dev/Meera/Sam) and never silently
> mutate data. After import, show balances minimized to the fewest
> transfers. Include unit tests."*

> *"Re-check the `detectAnomalies` function: rows 5 and 6 of the CSV are
> the same dinner logged twice. Make sure the duplicate signature is
> case-insensitive on the description but exact on the amount + date."*

> *"For the percentage split on row 15 (sums to 110, not 100), the
> action_taken should say `re-normalized to total 100%`, not `kept as-is`."*

## Three cases where the AI got it wrong

### Case 1 — TypeScript serialization of `unknown` over the server-fn boundary

**What the AI did.** Declared `Anomaly.context?: Record<string, unknown>`.
**Why it broke.** TanStack Start enforces a `ValidateSerializableMapped`
type on server-function return values; `unknown` is rejected because the
runtime cannot guarantee JSON-serializability.
**How it was caught.** The build error was immediate and pointed at the
exact field.
**Fix.** Narrowed to `Record<string, string | number | boolean | null>`
and cast to `never` at the database insert site (the column is `jsonb`
anyway).

### Case 2 — Greedy debt minimization without rounding to paise

**What the AI did.** First version of `minimizeTransfers` compared
floating-point balances with `> 0`.
**Why it broke.** A balance of `-0.0000000001` after share distribution
made the algorithm emit a transfer of one millionth of a rupee.
**How it was caught.** Manual exercise of the function with the CSV
fixture; the "Goa" expenses produced a list of 11 transfers instead of 3.
**Fix.** Round all net balances to 2 decimals first, then ignore anything
with `|net| < 0.01` when picking debtors/creditors.

### Case 3 — RLS policies missed the `service_role` GRANT

**What the AI did.** First migration only granted privileges to
`authenticated`.
**Why it broke.** No client-facing query failed (signed-in users were
fine), but any background admin job (or the audit-log SELECT from a
SECURITY DEFINER context) would have hit a permission error.
**How it was caught.** Code review against the Lovable platform's
public-schema GRANT checklist.
**Fix.** Added `GRANT ALL ON public.<table> TO service_role` to every
table in the migration before committing.

## Verification protocol

Every AI-generated change was either:

1. Exercised by a Bun unit test (17 tests covering parser, anomaly
   detector, splits, and balance engine — all pass), **or**
2. Sanity-checked against the actual `expenses_export.csv` fixture by
   running the importer end-to-end in the live preview.
