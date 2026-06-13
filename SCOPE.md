# SCOPE.md

## 1. Application scope

A shared-expenses tracker for a small group ("The House") with **six members**:
Aisha, Rohan, Priya, Meera, Dev, and Sam — each with their own membership
window.

The headline feature is an **anomaly-aware CSV importer**: it ingests
`expenses_export.csv` (or any spreadsheet with the same headers), surfaces
every issue it finds, and only writes to the database after a human approves
the proposed actions.

## 2. Members & their rules

| Member | Status | Active window | Notes |
| --- | --- | --- | --- |
| Aisha | Full | always | — |
| Rohan | Full | always | — |
| Priya | Full | always | — |
| Meera | Full | until 2026-03-31 | Moves out end of March |
| Dev | Guest | 2026-03-08 → 2026-03-15 | Only on the Goa trip |
| Sam | Full | from 2026-04-08 | Joins mid-April |

The importer **enforces these windows** — any participant outside their window
is dropped from the split with an explanatory anomaly.

## 3. Anomalies the importer detects

Every anomaly carries a `severity`, a `message`, a `recommendation`, and the
`action taken` by the importer. Nothing is silently mutated.

| # | Type | Severity | Example in the CSV | Default action |
|---|---|---|---|---|
| 1 | `invalid_date` | error | "Mar 14" (no year) | parse with year inferred from group year; if unparseable, skip |
| 2 | `ambiguous_date` | warn | `01/03/2026` | interpret as DD/MM/YYYY; flag for review |
| 3 | `missing_payer` | error | row 13 "House cleaning supplies" | row skipped, awaits decision |
| 4 | `missing_participants` | error | — | row skipped |
| 5 | `missing_currency` | warn | row 28 Groceries DMart | default to group base (INR) |
| 6 | `missing_amount` | error | — | row skipped |
| 7 | `zero_amount` | warn | row 30 Swiggy 0 | skipped (no economic effect) |
| 8 | `negative_amount` | warn | row 26 Parasailing refund -30 USD | imported as refund (negative split) |
| 9 | `amount_formatting` | info | `"1,200"`, ` 1450 ` | normalized to plain decimal |
| 10 | `fractional_paise` | info | 899.995 | rounded to 2 decimals |
| 11 | `missing_split_type` | warn | row 14 "Rohan paid Aisha back" | defaulted to `equal` (or settlement, see below) |
| 12 | `split_type_conflict` | info | row 40 Furniture: `equal` but shares supplied | honored declared type; shares ignored |
| 13 | `split_sum_mismatch` | warn | row 15 Pizza percentages sum to 110 | re-normalized proportionally |
| 14 | `duplicate_expense` | warn | rows 5+6 Marina Bites; rows 24+25 Thalassa | first kept, second flagged for approval |
| 15 | `settlement_misclassified` | warn | row 14 "Rohan paid Aisha back" | imported into `settlements`, not `expenses` |
| 16 | `unknown_member` | error | typo of a member name | row skipped |
| 17 | `guest_member` | warn | "Dev's friend Kabir" (row 23) | guest share kept off-book |
| 18 | `member_inactive` | warn | Meera in April rows; Sam before 2026-04-08 | participant dropped from split |
| 19 | `case_or_whitespace_in_name` | info | "priya", "Priya S", "rohan " | mapped to canonical "Priya"/"Rohan" |
| 20 | `empty_row` | info | trailing blank lines | skipped |

## 4. Import policy

1. **Detect & report** every anomaly into `anomaly_reports`.
2. **Persist** raw rows in `import_rows` so the original CSV is reconstructable.
3. **Propose actions** — every row gets a default decision (`import`/`skip`/`convert_to_settlement`).
4. **Human approves** via the wizard (`/import`) — they can override any row.
5. **Commit** writes to `expenses`, `expense_splits`, `settlements`, and an
   `audit_logs` entry. The batch transitions to `committed`.
6. **Currency conversion** uses the `exchange_rates` table (seeded with
   USD→INR at 83.00 for 2026). All balances are computed in the group's
   base currency.

## 5. Out of scope

- Sub-groups, recurring expenses, expense categories beyond a free-text field,
  receipt OCR, push notifications, multi-tenant invites. All would be
  straightforward extensions on top of the schema below.
