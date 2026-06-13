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

export const bootstrapDefaultGroup = createServerFn({ method: "POST" })
  .handler(async () => {
    const user = await requireAuth();

    const existing = await prisma.group.findFirst({
      where: { ownerId: user.id },
    });

    if (existing) return { groupId: existing.id, created: false };

    const group = await prisma.group.create({
      data: {
        name: "The House",
        description: "Default shared-expenses group for the assignment.",
        baseCurrency: "INR",
        ownerId: user.id,
      },
    });

    const memberData = DEFAULT_MEMBERS.map((m) => ({
      groupId: group.id,
      displayName: m.name,
      normalizedName: m.name.toLowerCase(),
      joinedAt: m.joinDate ? new Date(m.joinDate) : new Date(),
      leftAt: m.leaveDate ? new Date(m.leaveDate) : null,
      isGuest: !!m.isGuest,
    }));

    await prisma.groupMember.createMany({
      data: memberData,
    });

    await prisma.auditLog.create({
      data: {
        userId: user.id,
        entityType: "group",
        entityId: group.id,
        action: "create",
        afterData: { name: "The House", members: DEFAULT_MEMBERS.map((m) => m.name) },
      },
    });

    return { groupId: group.id, created: true };
  });

export const getDashboard = createServerFn({ method: "GET" })
  .handler(async () => {
    const user = await requireAuth();

    const group = await prisma.group.findFirst({
      where: { ownerId: user.id },
      select: { id: true, name: true, baseCurrency: true },
    });

    if (!group) return { hasGroup: false as const };

    const members = await prisma.groupMember.findMany({ where: { groupId: group.id }, select: { id: true, displayName: true, leftAt: true } });
    const expenses = await prisma.expense.findMany({ where: { groupId: group.id } });
    const settlements = await prisma.settlement.findMany({ 
      where: { 
        OR: [
          { payer: { groupId: group.id } },
          { receiver: { groupId: group.id } }
        ]
      } 
    });
    const batches = await prisma.importBatch.findMany({ where: { importedBy: user.id }, take: 5, orderBy: { createdAt: 'desc' } });

    const totalSpend = expenses.reduce((a: any, e: any) => a + Number(e.amount), 0);
    const totalSettled = settlements.reduce((a: any, s: any) => a + Number(s.amount), 0);

    const byMonth: Record<string, number> = {};
    for (const e of expenses) {
      const m = e.expenseDate.toISOString().slice(0, 7);
      byMonth[m] = (byMonth[m] ?? 0) + Number(e.amount);
    }
    const trend = Object.entries(byMonth)
      .sort()
      .map(([month, amount]) => ({ month, amount: Math.round(amount) }));

    const byCcy: Record<string, number> = {};
    for (const e of expenses) {
      byCcy[e.currency] = (byCcy[e.currency] ?? 0) + Number(e.amount);
    }
    const currencyDist = Object.entries(byCcy).map(([currency, amount]) => ({
      currency, amount: Math.round(amount * 100) / 100,
    }));

    return {
      hasGroup: true as const,
      group: {
        id: group.id,
        name: group.name,
        base_currency: group.baseCurrency
      },
      members: members.map((m: any) => ({ id: m.id, display_name: m.displayName, leave_date: m.leftAt })),
      stats: {
        totalSpend: Math.round(totalSpend),
        totalSettled: Math.round(totalSettled),
        expenseCount: expenses.length,
        activeMembers: members.filter((m: any) => !m.leftAt).length,
      },
      trend,
      currencyDist,
      batches: batches.map((b: any) => ({
        id: b.id,
        filename: b.filename,
        created_at: b.createdAt.toISOString(),
        status: b.status,
        total_rows: 0,
        imported_rows: 0,
        anomaly_count: 0
      })),
    };
  });

export const listExpenses = createServerFn({ method: "GET" })
  .handler(async () => {
    const user = await requireAuth();

    const group = await prisma.group.findFirst({
      where: { ownerId: user.id },
    });

    if (!group) return { expenses: [], members: [] };

    const expenses = await prisma.expense.findMany({ 
      where: { groupId: group.id },
      include: {
        participants: true,
        paidBy: {
          select: { displayName: true }
        }
      },
      orderBy: { expenseDate: 'desc' } 
    });

    const members = await prisma.groupMember.findMany({ where: { groupId: group.id } });
    
    const settlements = await prisma.settlement.findMany({ 
      where: { 
        OR: [
          { payer: { groupId: group.id } },
          { receiver: { groupId: group.id } }
        ]
      },
      include: {
        payer: { select: { displayName: true } },
        receiver: { select: { displayName: true } }
      },
      orderBy: { date: 'desc' }
    });

    return {
      expenses: expenses.map((e: any) => ({
        id: e.id,
        amount_base: Number(e.amount),
        currency: e.currency,
        amount_original: Number(e.amount),
        date: e.expenseDate.toISOString(),
        category: e.title,
        description: e.description,
        paid_by_member_id: e.paidById,
        paid_by_name: e.paidBy.displayName,
        splits: e.participants.map((p: any) => ({
          member: "Member " + p.memberId, // Simplified
          amount: Number(p.shareAmount)
        }))
      })),
      settlements: settlements.map((s: any) => ({
        id: s.id,
        amount_base: Number(s.amount),
        date: s.date.toISOString(),
        from_name: s.payer.displayName,
        to_name: s.receiver.displayName,
      })),
      members,
    };
  });

export const getBalances = createServerFn({ method: "GET" })
  .handler(async () => {
    const user = await requireAuth();
    const group = await prisma.group.findFirst({
      where: { ownerId: user.id },
    });
    if (!group) return { net: [], transfers: [] };

    const members = await prisma.groupMember.findMany({ where: { groupId: group.id } });
    const expenses = await prisma.expense.findMany({
      where: { groupId: group.id },
      include: { participants: true },
    });
    const settlements = await prisma.settlement.findMany({
      where: {
        OR: [
          { payer: { groupId: group.id } },
          { receiver: { groupId: group.id } }
        ]
      }
    });

    const memberIds = members.map((m: any) => String(m.userId ?? m.id));

    const exps = expenses.map((e: any) => ({
      id: e.id,
      paidByMemberId: String(e.paidById),
      amountBase: Number(e.amount),
      shares: e.participants.map((p: any) => ({
        memberId: String(p.memberId),
        share: Number(p.shareAmount)
      }))
    }));

    const setls = settlements.map((s: any) => ({
      id: s.id,
      fromMemberId: String(s.payerId),
      toMemberId: String(s.receiverId),
      amountBase: Number(s.amount)
    }));

    const { net, transfers } = computeBalances(memberIds, exps, setls);

    const nameMap = new Map<string, string>();
    for (const m of members) {
      nameMap.set(String(m.id), m.displayName);
    }

    return {
      currency: group.baseCurrency,
      net: Object.entries(net).map(([id, amount]) => ({ id, name: nameMap.get(id) ?? "Unknown", amount })),
      transfers: transfers.map((t: any) => ({ from: nameMap.get(t.from) ?? "Unknown", to: nameMap.get(t.to) ?? "Unknown", amount: t.amount })),
    };
  });

export const listAuditLogs = createServerFn({ method: "GET" })
  .handler(async () => {
    const user = await requireAuth();
    const logs = await prisma.auditLog.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      take: 200
    });
    return { logs: logs.map((l: any) => ({
      id: l.id,
      created_at: l.createdAt.toISOString(),
      entity_type: l.entityType,
      action: l.action,
      new_value: l.afterData
    })) };
  });


