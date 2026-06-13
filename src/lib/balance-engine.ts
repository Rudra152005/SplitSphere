// Balance engine. Pure, deterministic, fully unit-testable.
//
// Given a list of expenses (with computed per-member share in base currency),
// settlements (also in base currency), and a roster of members, computes:
//   • each member's net balance (positive = owed money, negative = owes)
//   • the minimum-transaction settlement plan that clears those balances.
//
// Currency conversion is done upstream by the importer using exchange_rates.
// This module only sees base-currency numbers.

export interface ShareInput {
  memberId: string;
  share: number; // base currency
}
export interface ExpenseInput {
  id: string;
  paidByMemberId: string | null;
  amountBase: number;
  shares: ShareInput[];
}
export interface SettlementInput {
  id: string;
  fromMemberId: string;
  toMemberId: string;
  amountBase: number;
}

export interface BalanceResult {
  net: Record<string, number>; // memberId -> base currency net (positive: owed)
  transfers: Array<{ from: string; to: string; amount: number }>;
}

export function computeBalances(
  members: string[],
  expenses: ExpenseInput[],
  settlements: SettlementInput[],
): BalanceResult {
  const net: Record<string, number> = {};
  for (const m of members) net[m] = 0;

  for (const e of expenses) {
    if (e.paidByMemberId) {
      net[e.paidByMemberId] = (net[e.paidByMemberId] ?? 0) + e.amountBase;
    }
    for (const s of e.shares) {
      net[s.memberId] = (net[s.memberId] ?? 0) - s.share;
    }
  }
  for (const s of settlements) {
    net[s.fromMemberId] = (net[s.fromMemberId] ?? 0) + s.amountBase;
    net[s.toMemberId] = (net[s.toMemberId] ?? 0) - s.amountBase;
  }

  // round to 2 decimals for stable comparison
  for (const k of Object.keys(net)) net[k] = Math.round(net[k] * 100) / 100;

  const transfers = minimizeTransfers(net);
  return { net, transfers };
}

// Greedy debt minimization: repeatedly match the largest debtor with the
// largest creditor. Produces at most n-1 transfers for n members and is
// optimal for typical small groups.
export function minimizeTransfers(
  net: Record<string, number>,
): Array<{ from: string; to: string; amount: number }> {
  const debtors: Array<{ id: string; amt: number }> = [];
  const creditors: Array<{ id: string; amt: number }> = [];
  for (const [id, v] of Object.entries(net)) {
    if (v < -0.01) debtors.push({ id, amt: -v });
    else if (v > 0.01) creditors.push({ id, amt: v });
  }
  debtors.sort((a, b) => b.amt - a.amt);
  creditors.sort((a, b) => b.amt - a.amt);

  const transfers: Array<{ from: string; to: string; amount: number }> = [];
  let i = 0, j = 0;
  while (i < debtors.length && j < creditors.length) {
    const pay = Math.min(debtors[i].amt, creditors[j].amt);
    transfers.push({
      from: debtors[i].id,
      to: creditors[j].id,
      amount: Math.round(pay * 100) / 100,
    });
    debtors[i].amt -= pay;
    creditors[j].amt -= pay;
    if (debtors[i].amt < 0.01) i++;
    if (creditors[j].amt < 0.01) j++;
  }
  return transfers;
}

// Compute per-member shares for a single expense given split type/inputs.
// Used by the importer to materialize expense_splits rows.
export interface SplitComputeInput {
  amountBase: number;
  splitType: "equal" | "unequal" | "percentage" | "share";
  members: string[]; // participating member ids
  details?: Record<string, number>; // memberId -> percent | share | exact amount (base ccy)
}

export function computeSplits(input: SplitComputeInput): ShareInput[] {
  const { amountBase, splitType, members, details = {} } = input;
  if (members.length === 0) return [];

  if (splitType === "equal") {
    return distributeEvenly(amountBase, members);
  }
  if (splitType === "percentage") {
    const sum = members.reduce((a, m) => a + (details[m] ?? 0), 0);
    if (sum <= 0) return distributeEvenly(amountBase, members);
    return roundShares(
      members.map((m) => ({ memberId: m, share: (amountBase * (details[m] ?? 0)) / sum })),
      amountBase,
    );
  }
  if (splitType === "share") {
    const sum = members.reduce((a, m) => a + (details[m] ?? 1), 0);
    return roundShares(
      members.map((m) => ({ memberId: m, share: (amountBase * (details[m] ?? 1)) / sum })),
      amountBase,
    );
  }
  // unequal: details are exact base-currency amounts; rescale if they don't match total
  const sum = members.reduce((a, m) => a + (details[m] ?? 0), 0);
  if (sum === 0) return distributeEvenly(amountBase, members);
  const scale = amountBase / sum;
  return roundShares(
    members.map((m) => ({ memberId: m, share: (details[m] ?? 0) * scale })),
    amountBase,
  );
}

function distributeEvenly(amount: number, members: string[]): ShareInput[] {
  const base = Math.floor((amount / members.length) * 100) / 100;
  const shares = members.map((m) => ({ memberId: m, share: base }));
  // distribute the rounding remainder to the first members (1 paisa each)
  const total = base * members.length;
  let remainder = Math.round((amount - total) * 100); // in paise
  let i = 0;
  while (remainder !== 0 && shares.length > 0) {
    shares[i % shares.length].share = Math.round((shares[i % shares.length].share + Math.sign(remainder) * 0.01) * 100) / 100;
    remainder -= Math.sign(remainder);
    i++;
  }
  return shares;
}

function roundShares(shares: ShareInput[], total: number): ShareInput[] {
  const out = shares.map((s) => ({ ...s, share: Math.round(s.share * 100) / 100 }));
  const diff = Math.round((total - out.reduce((a, s) => a + s.share, 0)) * 100);
  if (diff !== 0 && out.length > 0) {
    out[0].share = Math.round((out[0].share + diff / 100) * 100) / 100;
  }
  return out;
}
