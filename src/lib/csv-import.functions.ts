import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAuth } from "./auth.functions";
import { prisma } from "./db";
import { parseCSV } from "./csv-parser";
import { detectAnomalies, type MemberConfig, type ParsedExpense } from "./anomaly-detector";
import { computeBalances, computeSplits } from "./balance-engine";

const DEFAULT_MEMBERS: MemberConfig[] = [
  { name: "Aisha" },
  { name: "Rohan" },
  { name: "Priya" },
  { name: "Meera", leaveDate: "2026-03-31" },
  { name: "Dev", isGuest: true, joinDate: "2026-03-08", leaveDate: "2026-03-15" },
  { name: "Sam", joinDate: "2026-04-08" },
];

const validateInput = z.object({ csvText: z.string().min(1).max(2_000_000), filename: z.string().min(1).max(255) });

export const validateCsv = createServerFn({ method: "POST" })
  .inputValidator((d) => validateInput.parse(d))
  .handler(async ({ data }) => {
    const user = await requireAuth();
    const group = await prisma.group.findFirst({ where: { ownerId: user.id } });
    if (!group) throw new Error("No group exists. Bootstrap the default group first.");

    const { rows } = parseCSV(data.csvText);
    const { parsed, anomalies } = detectAnomalies(rows, {
      members: DEFAULT_MEMBERS, defaultCurrency: group.baseCurrency,
    });

    const summary = {
      by_severity: anomalies.reduce<Record<string, number>>((a, x) => ({ ...a, [x.severity]: (a[x.severity] ?? 0) + 1 }), {}),
      by_type: anomalies.reduce<Record<string, number>>((a, x) => ({ ...a, [x.type]: (a[x.type] ?? 0) + 1 }), {}),
    };

    const batch = await prisma.importBatch.create({
      data: {
        importedBy: user.id,
        filename: data.filename,
        status: "PENDING",
      }
    });

    await prisma.importRow.createMany({
      data: rows.map((r) => ({
        batchId: batch.id,
        rawData: r.raw as any,
        status: "PENDING",
      })),
    });

    if (anomalies.length > 0) {
      await prisma.anomaly.createMany({
        data: anomalies.map((a) => ({
          batchId: batch.id,
          anomalyType: a.type,
          severity: a.severity === "error" ? "HIGH" : a.severity === "warning" ? "MEDIUM" : "LOW",
          message: a.message,
          suggestedAction: a.recommendation,
        })),
      });
    }

    await prisma.auditLog.create({
      data: {
        userId: user.id,
        entityType: "import_batch",
        entityId: batch.id,
        action: "import",
        afterData: { filename: data.filename, rows: rows.length, anomalies: anomalies.length } as any,
      }
    });

    return { batchId: batch.id, parsed, anomalies, totalRows: rows.length };
  });

const commitInput = z.object({
  batchId: z.string().uuid(),
  approvedActions: z.record(z.string(), z.enum(["import", "skip"])).optional(),
});

export const commitImport = createServerFn({ method: "POST" })
  .inputValidator((d) => commitInput.parse(d))
  .handler(async ({ data }) => {
    const user = await requireAuth();
    const batch = await prisma.importBatch.findFirst({ where: { id: data.batchId, importedBy: user.id } });
    if (!batch) throw new Error("batch not found");
    if (batch.status === "COMPLETED") throw new Error("batch already committed");

    const group = await prisma.group.findFirst({ where: { ownerId: user.id } });
    if (!group) throw new Error("group not found");

    const members = await prisma.groupMember.findMany({ where: { groupId: group.id } });
    const rows = await prisma.importRow.findMany({ where: { batchId: data.batchId } });

    const memberByName = new Map<string, string>();
    for (const m of members) memberByName.set(m.displayName, m.id);

    const memberConfigs: MemberConfig[] = members.map((m: any) => ({
      name: m.displayName, joinDate: m.joinedAt?.toISOString(), leaveDate: m.leftAt?.toISOString(),
      isGuest: m.isGuest,
    }));

    const { parsed } = detectAnomalies(
      rows.map((r: any, i: number) => ({ rowNumber: i + 1, raw: r.rawData as Record<string, string> })),
      { members: memberConfigs, defaultCurrency: "INR" },
    );

    let imported = 0;
    let skipped = 0;
    let settlementsCreated = 0;

    for (const p of parsed) {
      const action = data.approvedActions?.[String(p.rowNumber)];
      if (action === "skip") { skipped++; continue; }
      if (p.classification === "skip" && action !== "import") { skipped++; continue; }

      if (p.classification === "settlement" && p.paidBy && p.settlementCounterparty && p.amount !== null && p.date) {
        const fromId = memberByName.get(p.paidBy);
        const toId = memberByName.get(p.settlementCounterparty);
        if (!fromId || !toId) { skipped++; continue; }
        
        await prisma.settlement.create({
          data: {
            payerId: fromId,
            receiverId: toId,
            amount: p.amount,
            date: new Date(p.date),
          }
        });
        settlementsCreated++;
        continue;
      }

      if (!p.date || !p.paidBy || p.amount === null || !p.currency || !p.splitType) { skipped++; continue; }
      const paidById = memberByName.get(p.paidBy);
      if (!paidById) { skipped++; continue; }

      const memberIds = p.splitWith.map((n) => memberByName.get(n)!).filter(Boolean);
      if (memberIds.length === 0) { skipped++; continue; }

      const detailsById: Record<string, number> = {};
      for (const [name, v] of Object.entries(p.splitDetails)) {
        const id = memberByName.get(name) ?? memberByName.get(p.splitWith.find((s) => s.toLowerCase() === name.toLowerCase()) ?? "");
        if (id) detailsById[id] = v;
      }
      const shares = computeSplits({
        amountBase: p.amount, splitType: p.splitType, members: memberIds, details: detailsById,
      });

      const e = await prisma.expense.create({
        data: {
          title: p.description || "Expense",
          amount: Math.abs(p.amount),
          currency: p.currency,
          paidById: paidById,
          groupId: group.id,
          expenseDate: new Date(p.date),
          splitType: p.splitType === "equal" ? "EQUAL" : p.splitType === "unequal" ? "EXACT" : p.splitType === "percentage" ? "PERCENTAGE" : "SHARES",
        }
      });

      await prisma.expenseParticipant.createMany({
        data: shares.map(s => ({
          expenseId: e.id,
          memberId: s.memberId,
          shareAmount: s.share,
        }))
      });
      imported++;
    }

    await prisma.importBatch.update({
      where: { id: batch.id },
      data: { status: "COMPLETED" },
    });

    return { imported, skipped, settlementsCreated };
  });

const reportInput = z.object({ batchId: z.string().uuid() });
export const getBatchReport = createServerFn({ method: "GET" })
  .inputValidator((d) => reportInput.parse(d))
  .handler(async ({ data }) => {
    const user = await requireAuth();
    const batch = await prisma.importBatch.findFirst({ where: { id: data.batchId, importedBy: user.id } });
    const anomalies = await prisma.anomaly.findMany({ where: { batchId: data.batchId } });
    const rows = await prisma.importRow.findMany({ where: { batchId: data.batchId } });
    return { batch, anomalies, rows };
  });
