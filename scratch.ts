import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany();
  const groups = await prisma.group.findMany();
  const members = await prisma.groupMember.findMany();
  const batches = await prisma.importBatch.findMany();
  const expenses = await prisma.expense.findMany();
  const participants = await prisma.expenseParticipant.findMany();
  const settlements = await prisma.settlement.findMany();

  console.log("Users:", users.length);
  console.log("Groups:", groups.length);
  console.log("Members:", members.length);
  console.log("Batches:", batches.map(b => ({ id: b.id, status: b.status })));
  console.log("Expenses:", expenses.length);
  console.log("Participants:", participants.length);
  console.log("Settlements:", settlements.length);
}

main().catch(console.error).finally(() => prisma.$disconnect());
