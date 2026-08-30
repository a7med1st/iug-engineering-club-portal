import { prisma } from "../lib/prisma";
import { syncSystemChatGroups } from "../lib/chat-groups";

async function main() {
  await syncSystemChatGroups();
  const groups = await prisma.chatConversation.findMany({
    where: { type: "GROUP", directKey: { startsWith: "group:" } },
    select: { name: true, _count: { select: { participants: true } } },
    orderBy: { name: "asc" },
  });
  console.log("System chat groups synced:");
  for (const g of groups) console.log(`- ${g.name}: ${g._count.participants} participant(s)`);
}

main().catch((e) => { console.error(e); process.exitCode = 1; }).finally(async () => { await prisma.$disconnect(); });
