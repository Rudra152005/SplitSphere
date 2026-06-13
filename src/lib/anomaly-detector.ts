// Anomaly detector + row normalizer for the CSV importer.
// Pure functions, fully unit-testable.
//
// For every input row we produce a `ParsedExpense` (best-effort normalized
// shape) and a list of `Anomaly` entries describing every issue we found,
// each with a severity, recommendation, and the action the importer will
// take by default. NOTHING is silently dropped — the caller decides which
// actions to commit.

import type { ParsedRow } from "./csv-parser";

export type Severity = "info" | "warning" | "error";

export type AnomalyType =
  | "duplicate_expense"
  | "invalid_date"
  | "ambiguous_date"
  | "missing_payer"
  | "missing_participants"
  | "missing_currency"
  | "missing_amount"
  | "zero_amount"
  | "negative_amount"
  | "amount_formatting"
  | "fractional_paise"
  | "currency_mismatch"
  | "settlement_misclassified"
  | "unknown_member"
  | "guest_member"
  | "member_inactive"
  | "split_sum_mismatch"
  | "split_type_conflict"
  | "missing_split_type"
  | "case_or_whitespace_in_name"
  | "empty_row";

export interface Anomaly {
  rowNumber: number;
  type: AnomalyType;
  severity: Severity;
  message: string;
  recommendation: string;
  actionTaken: string;
  context?: Record<string, string | number | boolean | null>;
}

export interface ParsedExpense {
  rowNumber: number;
  date: string | null; // ISO YYYY-MM-DD
  description: string;
  paidBy: string | null; // normalized member name
  amount: number | null; // original currency
  currency: string | null;
  splitType: "equal" | "unequal" | "percentage" | "share" | null;
  splitWith: string[]; // normalized member names
  splitDetails: Record<string, number>; // member -> raw weight/amount/percent
  notes: string;
  // Importer classification
  classification: "expense" | "settlement" | "skip";
  settlementCounterparty?: string | null;
  duplicateOf?: number; // row number this duplicates
  warnings: Anomaly[];
}

export interface MemberConfig {
  name: string;
  joinDate?: string; // ISO
  leaveDate?: string; // ISO
  isGuest?: boolean;
}

export interface DetectorConfig {
  members: MemberConfig[];
  defaultCurrency: string; // "INR"
}

// ------------ helpers ------------

const SETTLEMENT_KEYWORDS = [
  /paid\s+\w+\s+back/i,
  /settle/i,
  /repay/i,
  /reimburse/i,
];

function normalizeName(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, " ");
}

export function canonicalName(s: string, members: MemberConfig[]): string | null {
  const n = normalizeName(s);
  if (!n) return null;
  // exact normalized match
  for (const m of members) if (normalizeName(m.name) === n) return m.name;
  // prefix match (handles "Priya S" -> "Priya")
  for (const m of members) {
    const mn = normalizeName(m.name);
    if (n.startsWith(mn + " ") || n === mn) return m.name;
  }
  // "Dev's friend Kabir" -> last token
  const tokens = n.split(" ");
  const last = tokens[tokens.length - 1];
  for (const m of members) if (normalizeName(m.name) === last) return m.name;
  return null;
}

function parseAmount(raw: string): { value: number | null; reformatted: boolean } {
  if (!raw) return { value: null, reformatted: false };
  const trimmed = raw.trim();
  const cleaned = trimmed.replace(/,/g, "").replace(/\s+/g, "");
  if (cleaned === "") return { value: null, reformatted: false };
  const n = Number(cleaned);
  if (!Number.isFinite(n)) return { value: null, reformatted: false };
  return { value: n, reformatted: trimmed !== cleaned };
}

function parseDate(raw: string): { iso: string | null; ambiguous: boolean } {
  const s = raw.trim();
  if (!s) return { iso: null, ambiguous: false };
  // ISO YYYY-MM-DD
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (m) return { iso: iso(m[1], m[2], m[3]), ambiguous: false };
  // DD/MM/YYYY
  m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) {
    const d = Number(m[1]),
      mo = Number(m[2]);
    const ambiguous = d <= 12 && mo <= 12 && d !== mo;
    return { iso: iso(m[3], m[2], m[1]), ambiguous };
  }
  // "Mar 14" (assume 2026 — assignment year)
  m = s.match(/^([A-Za-z]{3})\s+(\d{1,2})(?:\s+(\d{4}))?$/);
  if (m) {
    const months: Record<string, string> = {
      jan: "01", feb: "02", mar: "03", apr: "04", may: "05", jun: "06",
      jul: "07", aug: "08", sep: "09", oct: "10", nov: "11", dec: "12",
    };
    const mm = months[m[1].toLowerCase()];
    if (mm) return { iso: iso(m[3] ?? "2026", mm, m[2]), ambiguous: false };
  }
  return { iso: null, ambiguous: false };
}
function iso(y: string, m: string, d: string) {
  return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
}

function splitList(raw: string): string[] {
  if (!raw) return [];
  return raw
    .split(";")
    .map((s) => s.trim())
    .filter(Boolean);
}

function parseSplitDetails(raw: string): Record<string, number> {
  const out: Record<string, number> = {};
  if (!raw) return out;
  for (const chunk of raw.split(";")) {
    const m = chunk.trim().match(/^(.+?)\s+(-?\d+(?:\.\d+)?)\s*%?$/);
    if (m) out[m[1].trim()] = Number(m[2]);
  }
  return out;
}

// ------------ main ------------

export function detectAnomalies(
  rows: ParsedRow[],
  config: DetectorConfig,
): { parsed: ParsedExpense[]; anomalies: Anomaly[] } {
  const anomalies: Anomaly[] = [];
  const parsed: ParsedExpense[] = [];

  // signature -> first row index for duplicate detection
  const seen = new Map<string, number>();

  for (const row of rows) {
    const r = row.raw;
    const rn = row.rowNumber;
    const warns: Anomaly[] = [];

    // empty row
    if (Object.values(r).every((v) => !v || !v.trim())) {
      const a: Anomaly = {
        rowNumber: rn, type: "empty_row", severity: "info",
        message: "Row is empty.", recommendation: "Skip.", actionTaken: "skipped",
      };
      anomalies.push(a);
      continue;
    }

    // date
    const { iso, ambiguous } = parseDate(r.date ?? "");
    if (!iso) {
      warns.push({
        rowNumber: rn, type: "invalid_date", severity: "error",
        message: `Unparseable date "${r.date}".`,
        recommendation: "Reject row until date is fixed by an operator.",
        actionTaken: "row marked for review",
      });
    } else if (ambiguous) {
      warns.push({
        rowNumber: rn, type: "ambiguous_date", severity: "warning",
        message: `Date "${r.date}" is ambiguous (DD/MM vs MM/DD).`,
        recommendation: "Confirm the intended calendar date with the user.",
        actionTaken: "interpreted as DD/MM/YYYY",
        context: { interpretedAs: iso },
      });
    }

    // amount
    const { value: amount, reformatted } = parseAmount(r.amount ?? "");
    if (amount === null) {
      warns.push({
        rowNumber: rn, type: "missing_amount", severity: "error",
        message: "Amount is missing or unreadable.",
        recommendation: "Reject row until a numeric amount is supplied.",
        actionTaken: "row marked for review",
      });
    } else {
      if (reformatted) {
        warns.push({
          rowNumber: rn, type: "amount_formatting", severity: "info",
          message: `Amount "${r.amount}" had locale/whitespace formatting.`,
          recommendation: "Normalize to a plain decimal.",
          actionTaken: `normalized to ${amount}`,
        });
      }
      if (amount === 0) {
        warns.push({
          rowNumber: rn, type: "zero_amount", severity: "warning",
          message: "Amount is zero.",
          recommendation: "Skip — has no economic effect.",
          actionTaken: "skipped",
        });
      } else if (amount < 0) {
        warns.push({
          rowNumber: rn, type: "negative_amount", severity: "warning",
          message: "Negative amount — likely a refund.",
          recommendation: "Import as a refund (negative split).",
          actionTaken: "imported as refund",
        });
      }
      // fractional paise (3+ decimals)
      if (/\.\d{3,}/.test(String(amount))) {
        warns.push({
          rowNumber: rn, type: "fractional_paise", severity: "info",
          message: `Amount ${amount} has sub-paise precision.`,
          recommendation: "Round to 2 decimals.",
          actionTaken: "rounded to 2 decimals",
        });
      }
    }

    // currency
    let currency = (r.currency ?? "").trim().toUpperCase();
    if (!currency) {
      warns.push({
        rowNumber: rn, type: "missing_currency", severity: "warning",
        message: "Currency was not specified.",
        recommendation: `Default to group base currency (${config.defaultCurrency}).`,
        actionTaken: `defaulted to ${config.defaultCurrency}`,
      });
      currency = config.defaultCurrency;
    }

    // paid_by
    const paidByRaw = (r.paid_by ?? "").trim();
    let paidBy: string | null = null;
    if (!paidByRaw) {
      warns.push({
        rowNumber: rn, type: "missing_payer", severity: "error",
        message: "Payer is missing.",
        recommendation: "Ask the group to identify who paid before importing.",
        actionTaken: "row marked for review",
      });
    } else {
      paidBy = canonicalName(paidByRaw, config.members);
      if (!paidBy) {
        warns.push({
          rowNumber: rn, type: "unknown_member", severity: "error",
          message: `Payer "${paidByRaw}" does not match any known member.`,
          recommendation: "Add the member or fix the spelling.",
          actionTaken: "row marked for review",
        });
      } else if (normalizeName(paidByRaw) !== normalizeName(paidBy)) {
        warns.push({
          rowNumber: rn, type: "case_or_whitespace_in_name", severity: "info",
          message: `Payer "${paidByRaw}" normalized to "${paidBy}".`,
          recommendation: "Trim and case-normalize names on entry.",
          actionTaken: `mapped to ${paidBy}`,
        });
      }
    }

    // split_with
    const splitWithRaw = splitList(r.split_with ?? "");
    const splitWith: string[] = [];
    const guestNames: string[] = [];
    for (const name of splitWithRaw) {
      const canon = canonicalName(name, config.members);
      if (!canon) {
        warns.push({
          rowNumber: rn, type: "guest_member", severity: "warning",
          message: `Participant "${name}" is not a group member (guest).`,
          recommendation: "Treat as guest or add to the group.",
          actionTaken: "guest share kept off-book (excluded from balance)",
        });
        guestNames.push(name);
        continue;
      }
      // membership-date check
      if (iso) {
        const cfg = config.members.find((m) => m.name === canon);
        if (cfg) {
          if (cfg.joinDate && iso < cfg.joinDate) {
            warns.push({
              rowNumber: rn, type: "member_inactive", severity: "warning",
              message: `${canon} had not joined yet on ${iso} (joined ${cfg.joinDate}).`,
              recommendation: "Exclude from this expense's split.",
              actionTaken: `${canon} dropped from split`,
            });
            continue;
          }
          if (cfg.leaveDate && iso > cfg.leaveDate) {
            warns.push({
              rowNumber: rn, type: "member_inactive", severity: "warning",
              message: `${canon} had already left on ${iso} (left ${cfg.leaveDate}).`,
              recommendation: "Exclude from this expense's split.",
              actionTaken: `${canon} dropped from split`,
            });
            continue;
          }
        }
      }
      splitWith.push(canon);
    }

    // split_type
    let splitType = ((r.split_type ?? "").trim().toLowerCase() || null) as
      | "equal" | "unequal" | "percentage" | "share" | null;
    const splitDetails = parseSplitDetails(r.split_details ?? "");

    // settlement classification (split_type empty AND split_with single member AND description hints)
    let classification: ParsedExpense["classification"] = "expense";
    let settlementCounterparty: string | null = null;
    const looksLikeSettlement =
      splitType === null &&
      splitWith.length === 1 &&
      SETTLEMENT_KEYWORDS.some((re) => re.test(r.description ?? ""));
    if (looksLikeSettlement && paidBy) {
      classification = "settlement";
      settlementCounterparty = splitWith[0];
      warns.push({
        rowNumber: rn, type: "settlement_misclassified", severity: "warning",
        message: "Row looks like a settlement transfer, not a shared expense.",
        recommendation: "Record as a settlement from payer to counterparty.",
        actionTaken: "imported as settlement",
      });
    }

    if (!splitType && classification === "expense") {
      warns.push({
        rowNumber: rn, type: "missing_split_type", severity: "warning",
        message: "split_type was empty.",
        recommendation: "Default to equal split across participants.",
        actionTaken: "defaulted to equal",
      });
      splitType = "equal";
    }

    if (
      classification === "expense" &&
      splitWith.length === 0
    ) {
      warns.push({
        rowNumber: rn, type: "missing_participants", severity: "error",
        message: "No participants listed.",
        recommendation: "Add participants before importing.",
        actionTaken: "row marked for review",
      });
    }

    // split_type vs split_details conflicts
    if (splitType === "equal" && Object.keys(splitDetails).length > 0) {
      warns.push({
        rowNumber: rn, type: "split_type_conflict", severity: "info",
        message: "split_type is 'equal' but custom shares were supplied.",
        recommendation: "Either change split_type or drop the shares.",
        actionTaken: "honored split_type=equal; ignored shares",
      });
    }

    // split sum mismatch checks
    if (classification === "expense" && amount !== null) {
      if (splitType === "percentage") {
        const sum = Object.values(splitDetails).reduce((a, b) => a + b, 0);
        if (Math.abs(sum - 100) > 0.01) {
          warns.push({
            rowNumber: rn, type: "split_sum_mismatch", severity: "warning",
            message: `Percentages sum to ${sum}, not 100.`,
            recommendation: "Re-normalize percentages proportionally.",
            actionTaken: "re-normalized to total 100%",
          });
        }
      }
      if (splitType === "unequal") {
        const sum = Object.values(splitDetails).reduce((a, b) => a + b, 0);
        if (Math.abs(sum - (amount ?? 0)) > 0.5) {
          warns.push({
            rowNumber: rn, type: "split_sum_mismatch", severity: "warning",
            message: `Unequal shares sum to ${sum} but expense is ${amount}.`,
            recommendation: "Adjust the shares so they total the expense.",
            actionTaken: "scaled shares proportionally to match total",
          });
        }
      }
    }

    // currency mismatch (USD amount with INR-looking magnitude or vice-versa)
    if (currency === "USD" && amount !== null && amount > 1000 && !/\$/.test(r.amount ?? "")) {
      // heuristic — not raised here; leave to operator
    }

    // duplicate detection: same date + payer + amount + currency
    const sig =
      classification === "expense" && iso && paidBy && amount !== null
        ? `${iso}|${paidBy}|${amount}|${currency}|${(r.description ?? "").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 30)}`
        : null;
    let duplicateOf: number | undefined;
    if (sig) {
      if (seen.has(sig)) {
        duplicateOf = seen.get(sig);
        warns.push({
          rowNumber: rn, type: "duplicate_expense", severity: "warning",
          message: `Looks like a duplicate of row ${duplicateOf}.`,
          recommendation: "Confirm and either keep one or merge.",
          actionTaken: "kept first, marked second for approval",
          context: { duplicateOf: duplicateOf ?? 0 },
        });
      } else {
        seen.set(sig, rn);
      }
    }

    // skip-classification: any error means we don't auto-commit it as an expense
    const hasError = warns.some((w) => w.severity === "error");
    if (hasError) classification = "skip";
    if (amount === 0) classification = "skip";

    anomalies.push(...warns);
    parsed.push({
      rowNumber: rn,
      date: iso,
      description: (r.description ?? "").trim(),
      paidBy,
      amount,
      currency,
      splitType,
      splitWith,
      splitDetails,
      notes: (r.notes ?? "").trim(),
      classification,
      settlementCounterparty,
      duplicateOf,
      warnings: warns,
    });
  }

  return { parsed, anomalies };
}
