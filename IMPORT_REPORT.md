# CSV Import Report

**Status:** Completed  
**File:** `expenses_export.csv`  
**Base Currency:** INR (Indian Rupee)

## Summary

The import engine detected 20 distinct anomaly patterns within the provided CSV file. No data was silently mutated. Each anomaly was surfaced for review before the final commit.

| Severity | Count |
|----------|-------|
| 🛑 Error | 4 |
| ⚠️ Warning | 10 |
| ℹ️ Info | 6 |

---

## Detailed Anomaly Log

Below is the complete log of data problems detected during the ingestion of the CSV file, and the precise action taken to resolve each issue.

### 🛑 Critical & High Severity Errors
*These issues prevented the immediate parsing of the row and required user intervention or explicit skipping.*

1. **Missing Payer (`missing_payer`)**
   - **Found in:** Row 13 ("House cleaning supplies")
   - **Problem:** The 'Paid By' field was completely blank.
   - **Action Taken:** Row was flagged and **skipped** by default. Awaits manual assignment of a payer.

2. **Missing Participants (`missing_participants`)**
   - **Problem:** Expense declared a split but listed zero participants.
   - **Action Taken:** Row **skipped**.

3. **Missing Amount (`missing_amount`)**
   - **Problem:** The amount field was completely empty.
   - **Action Taken:** Row **skipped**.

4. **Unknown Member (`unknown_member`)**
   - **Problem:** The name in the split did not match any canonical member names or known typos.
   - **Action Taken:** Row **skipped**.

### ⚠️ Warnings (Medium Severity)
*These issues required the engine to make a non-destructive assumption or explicitly flag a mathematical discrepancy.*

5. **Ambiguous Date Format (`ambiguous_date`)**
   - **Found in:** `01/03/2026`
   - **Problem:** Could be interpreted as Jan 3 or Mar 1 depending on locale.
   - **Action Taken:** Interpreted as DD/MM/YYYY based on default group locale; **flagged for review**.

6. **Missing Currency (`missing_currency`)**
   - **Found in:** Row 28 ("Groceries DMart")
   - **Problem:** No currency specified.
   - **Action Taken:** **Defaulted** to group base currency (INR).

7. **Zero Amount (`zero_amount`)**
   - **Found in:** Row 30 ("Swiggy 0")
   - **Problem:** Expense logged with a value of 0.
   - **Action Taken:** **Skipped** (has no economic effect on balances).

8. **Negative Amount (`negative_amount`)**
   - **Found in:** Row 26 ("Parasailing refund -30 USD")
   - **Problem:** Expense amount is negative.
   - **Action Taken:** **Imported as a refund** (reverses the flow of the split).

9. **Missing Split Type (`missing_split_type`)**
   - **Found in:** Row 14 ("Rohan paid Aisha back")
   - **Problem:** Split type was left blank.
   - **Action Taken:** Engine detected it as a settlement and **defaulted to equal split** for processing.

10. **Split Sum Mismatch (`split_sum_mismatch`)**
    - **Found in:** Row 15 ("Pizza")
    - **Problem:** Percentages supplied (e.g., 60% and 50%) sum to 110% instead of 100%.
    - **Action Taken:** Mathematical **re-normalization** applied proportionally so shares total exactly 100%.

11. **Duplicate Expense (`duplicate_expense`)**
    - **Found in:** Rows 5 & 6 ("Marina Bites"), Rows 24 & 25 ("Thalassa")
    - **Problem:** Exact match on Date and Amount with identical/similar descriptions.
    - **Action Taken:** First instance **kept**, subsequent duplicate instances **flagged and skipped** by default.

12. **Misclassified Settlement (`settlement_misclassified`)**
    - **Found in:** Row 14 ("Rohan paid Aisha back")
    - **Problem:** Logged as a standard group expense rather than a direct repayment.
    - **Action Taken:** Automatically **converted** from an expense to a direct `settlement` record.

13. **Guest Member Encountered (`guest_member`)**
    - **Found in:** Row 23 ("Dev's friend Kabir")
    - **Problem:** Split included a guest who does not have an active persistent balance.
    - **Action Taken:** Guest share was calculated but **kept off-book** for the host (Dev) to manage.

14. **Inactive Member (`member_inactive`)**
    - **Found in:** April rows (Meera), Pre-April 8 rows (Sam)
    - **Problem:** Participant included in a split outside of their active membership window.
    - **Action Taken:** Participant was **dropped from the split** and shares were recalculated among active members.

### ℹ️ Info (Low Severity / Formatting fixes)
*These issues were automatically corrected by the parser during ingestion.*

15. **Invalid Date Format (`invalid_date`)**
    - **Found in:** "Mar 14"
    - **Problem:** Missing year.
    - **Action Taken:** **Parsed** by automatically inferring the year from the group's default ledger year (2026).

16. **Amount Formatting (`amount_formatting`)**
    - **Found in:** `"1,200"`, ` 1450 `
    - **Problem:** Contains commas or surrounding whitespace.
    - **Action Taken:** **Normalized** to plain decimals (`1200.00`).

17. **Fractional Paise (`fractional_paise`)**
    - **Found in:** `899.995`
    - **Problem:** Currency precision exceeded 2 decimal places.
    - **Action Taken:** **Rounded** safely to 2 decimal places using standard banking rounding.

18. **Split Type Conflict (`split_type_conflict`)**
    - **Found in:** Row 40 ("Furniture")
    - **Problem:** Row declared `equal` split but explicit shares/amounts were also supplied.
    - **Action Taken:** Declared type `equal` was **honored**; explicit shares were ignored.

19. **Case or Whitespace in Name (`case_or_whitespace_in_name`)**
    - **Found in:** "priya", "Priya S", "rohan "
    - **Problem:** Names were inconsistently cased or spaced.
    - **Action Taken:** **Mapped** seamlessly to canonical member records ("Priya", "Rohan").

20. **Empty Row (`empty_row`)**
    - **Found in:** Trailing blank lines at the end of the CSV.
    - **Problem:** No data.
    - **Action Taken:** Safely **ignored/skipped**.
