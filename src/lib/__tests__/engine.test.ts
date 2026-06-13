import { describe, it, expect } from "bun:test";
import { detectAnomalies } from "../anomaly-detector";
import { parseCSV } from "../csv-parser";
import { computeBalances, computeSplits, minimizeTransfers } from "../balance-engine";

const MEMBERS = [
  { name: "Aisha" },
  { name: "Rohan" },
  { name: "Priya" },
  { name: "Meera", leaveDate: "2026-03-31" },
  { name: "Dev", isGuest: true, joinDate: "2026-03-08", leaveDate: "2026-03-15" },
  { name: "Sam", joinDate: "2026-04-08" },
];

describe("csv-parser", () => {
  it("parses quoted fields with commas", () => {
    const { headers, rows } = parseCSV(`a,b\n"1,200","hi"\n`);
    expect(headers).toEqual(["a", "b"]);
    expect(rows[0].raw.a).toBe("1,200");
  });
  it("skips empty trailing line", () => {
    const { rows } = parseCSV("a\n1\n\n");
    expect(rows.length).toBe(1);
  });
});

describe("anomaly-detector", () => {
  function detect(csv: string) {
    const { rows } = parseCSV(csv);
    return detectAnomalies(rows, { members: MEMBERS, defaultCurrency: "INR" });
  }

  it("flags missing payer as error", () => {
    const { anomalies } = detect("date,description,paid_by,amount,currency,split_type,split_with,split_details,notes\n2026-02-22,Supplies,,780,INR,equal,Aisha;Rohan,,");
    expect(anomalies.some((a) => a.type === "missing_payer")).toBe(true);
  });

  it("detects duplicate rows", () => {
    const csv = `date,description,paid_by,amount,currency,split_type,split_with,split_details,notes
2026-02-08,Dinner,Dev,3200,INR,equal,Aisha;Rohan,,
2026-02-08,dinner,Dev,3200,INR,equal,Aisha;Rohan,,`;
    const { anomalies } = detect(csv);
    expect(anomalies.some((a) => a.type === "duplicate_expense")).toBe(true);
  });

  it("parses 1,200 amount with comma", () => {
    const { parsed, anomalies } = detect("date,description,paid_by,amount,currency,split_type,split_with,split_details,notes\n2026-02-10,Power,Aisha,\"1,200\",INR,equal,Aisha;Rohan,,");
    expect(parsed[0].amount).toBe(1200);
    expect(anomalies.some((a) => a.type === "amount_formatting")).toBe(true);
  });

  it("classifies settlement transfer", () => {
    const { parsed } = detect("date,description,paid_by,amount,currency,split_type,split_with,split_details,notes\n2026-02-25,Rohan paid Aisha back,Rohan,5000,INR,,Aisha,,");
    expect(parsed[0].classification).toBe("settlement");
    expect(parsed[0].settlementCounterparty).toBe("Aisha");
  });

  it("flags member-inactive when Sam appears before joining", () => {
    const { anomalies } = detect("date,description,paid_by,amount,currency,split_type,split_with,split_details,notes\n2026-02-10,Coffee,Aisha,400,INR,equal,Aisha;Sam,,");
    expect(anomalies.some((a) => a.type === "member_inactive" && a.message.includes("Sam"))).toBe(true);
  });

  it("flags guest member (Kabir)", () => {
    const { anomalies } = detect(`date,description,paid_by,amount,currency,split_type,split_with,split_details,notes\n2026-03-11,Para,Dev,150,USD,equal,Aisha;Rohan;Priya;Dev;Kabir,,`);
    expect(anomalies.some((a) => a.type === "guest_member")).toBe(true);
  });

  it("defaults missing currency to INR", () => {
    const { parsed, anomalies } = detect("date,description,paid_by,amount,currency,split_type,split_with,split_details,notes\n2026-03-15,Groceries,Priya,2105,,equal,Aisha;Priya,,");
    expect(parsed[0].currency).toBe("INR");
    expect(anomalies.some((a) => a.type === "missing_currency")).toBe(true);
  });

  it("flags percentages that don't sum to 100", () => {
    const { anomalies } = detect("date,description,paid_by,amount,currency,split_type,split_with,split_details,notes\n2026-02-28,Pizza,Aisha,1440,INR,percentage,Aisha;Rohan;Priya;Meera,Aisha 30%;Rohan 30%;Priya 30%;Meera 20%,");
    expect(anomalies.some((a) => a.type === "split_sum_mismatch")).toBe(true);
  });

  it("recognises negative refund", () => {
    const { parsed, anomalies } = detect("date,description,paid_by,amount,currency,split_type,split_with,split_details,notes\n2026-03-12,Refund,Dev,-30,USD,equal,Aisha;Rohan,,");
    expect(parsed[0].amount).toBeLessThan(0);
    expect(anomalies.some((a) => a.type === "negative_amount")).toBe(true);
  });
});

describe("balance-engine", () => {
  it("computeSplits equal distributes remainder", () => {
    const s = computeSplits({ amountBase: 100, splitType: "equal", members: ["a", "b", "c"] });
    const sum = s.reduce((a, x) => a + x.share, 0);
    expect(Math.round(sum * 100)).toBe(10000);
  });

  it("computeSplits percentage", () => {
    const s = computeSplits({
      amountBase: 1000, splitType: "percentage", members: ["a", "b"],
      details: { a: 70, b: 30 },
    });
    expect(s.find((x) => x.memberId === "a")!.share).toBeCloseTo(700);
    expect(s.find((x) => x.memberId === "b")!.share).toBeCloseTo(300);
  });

  it("computeSplits share", () => {
    const s = computeSplits({
      amountBase: 600, splitType: "share", members: ["a", "b", "c"],
      details: { a: 1, b: 2, c: 3 },
    });
    expect(s.find((x) => x.memberId === "c")!.share).toBeCloseTo(300);
  });

  it("minimizeTransfers nets out a 3-way debt to a single transfer", () => {
    // A paid 1500, owed by B & C; C paid 500 owed by B → A->B 1500 collapses
    const t = minimizeTransfers({ A: 1500, B: -1500, C: 0 });
    expect(t.length).toBe(1);
    expect(t[0]).toEqual({ from: "B", to: "A", amount: 1500 });
  });

  it("end-to-end balances", () => {
    const r = computeBalances(
      ["A", "B"],
      [{ id: "e1", paidByMemberId: "A", amountBase: 100, shares: [{ memberId: "A", share: 50 }, { memberId: "B", share: 50 }] }],
      [],
    );
    expect(r.net.A).toBe(50);
    expect(r.net.B).toBe(-50);
    expect(r.transfers).toEqual([{ from: "B", to: "A", amount: 50 }]);
  });

  it("settlement clears balance", () => {
    const r = computeBalances(
      ["A", "B"],
      [{ id: "e1", paidByMemberId: "A", amountBase: 100, shares: [{ memberId: "A", share: 50 }, { memberId: "B", share: 50 }] }],
      [{ id: "s1", fromMemberId: "B", toMemberId: "A", amountBase: 50 }],
    );
    expect(r.transfers).toEqual([]);
  });
});
