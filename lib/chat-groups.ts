import { isClubLeadership } from "./permissions";
import { prisma } from "./prisma.ts";

const GENERAL_KEY = "group:general";
const deptKey = (id: string) => `group:department:${id}`;

async function syncParticipants(conversationId: string, userIds: string[]) {
  const ids = [...new Set(userIds)];
  await prisma.$transaction(async (tx) => {
    await tx.chatParticipant.deleteMany({
      where: {
        conversationId,
        ...(ids.length ? { userId: { notIn: ids } } : {}),
      },
    });
    if (ids.length) {
      await tx.chatParticipant.createMany({
        data: ids.map((userId) => ({ conversationId, userId })),
        skipDuplicates: true,
      });
    }
  });
}

export async function syncSystemChatGroups() {
  const [departments, users] = await Promise.all([
    prisma.department.findMany({
      select: { id: true, nameAr: true, sortOrder: true },
      orderBy: { sortOrder: "asc" },
    }),
prisma.user.findMany({
  where: {
    role: {
      in: ["MEMBER", "ADMIN"],
    },
  },
  select: {
    id: true,
    role: true,
    departmentId: true,
    position: true,
  },
}),
  ]);

  const allIds = users.map((u) => u.id);
  const adminIds = users.filter((u) => u.role === "ADMIN").map((u) => u.id);
const leadershipIds = users
  .filter(
    (u) =>
      u.role === "MEMBER" &&
      isClubLeadership(u.position),
  )
  .map((u) => u.id);
  const general = await prisma.chatConversation.upsert({
    where: { directKey: GENERAL_KEY },
    create: { type: "GROUP", name: "النادي الهندسي - عام", directKey: GENERAL_KEY },
    update: { type: "GROUP", name: "النادي الهندسي - عام" },
    select: { id: true },
  });
  await syncParticipants(general.id, allIds);

  for (const department of departments) {
    const memberIds = users
      .filter((u) => u.role === "MEMBER" && u.departmentId === department.id)
      .map((u) => u.id);
    const group = await prisma.chatConversation.upsert({
      where: { directKey: deptKey(department.id) },
      create: {
        type: "GROUP",
        name: `قسم ${department.nameAr}`,
        directKey: deptKey(department.id),
      },
      update: { type: "GROUP", name: `قسم ${department.nameAr}` },
      select: { id: true },
    });
    await syncParticipants(
  group.id,
  [
    ...adminIds,
    ...leadershipIds,
    ...memberIds,
  ],
);
  }
}

export async function getSystemGroupsForUser(userId: string) {
  await syncSystemChatGroups();
  const memberships = await prisma.chatParticipant.findMany({
    where: {
      userId,
      conversation: { type: "GROUP", directKey: { startsWith: "group:" } },
    },
    select: {
      lastReadAt: true,
      conversation: {
        select: {
          id: true,
          name: true,
          directKey: true,
          lastMessageAt: true,
          _count: { select: { participants: true } },
          messages: {
            take: 1,
            orderBy: { createdAt: "desc" },
            select: {
              body: true,
              createdAt: true,
              sender: { select: { name: true } },
            },
          },
        },
      },
    },
  });

  const rows = await Promise.all(memberships.map(async (m) => ({
    id: m.conversation.id,
    name: m.conversation.name ?? "مجموعة",
    directKey: m.conversation.directKey,
    participantCount: m.conversation._count.participants,
    lastMessage: m.conversation.messages[0] ?? null,
    lastMessageAt: m.conversation.lastMessageAt,
    unreadCount: await prisma.chatMessage.count({
      where: {
        conversationId: m.conversation.id,
        senderId: { not: userId },
        ...(m.lastReadAt ? { createdAt: { gt: m.lastReadAt } } : {}),
      },
    }),
  })));

  return rows.sort((a, b) => {
    if (a.directKey === GENERAL_KEY) return -1;
    if (b.directKey === GENERAL_KEY) return 1;
    return (b.lastMessageAt?.getTime() ?? 0) - (a.lastMessageAt?.getTime() ?? 0);
  });
}

export async function getSystemGroupMembership(userId: string, conversationId: string) {
  await syncSystemChatGroups();
  return prisma.chatParticipant.findFirst({
    where: {
      userId,
      conversationId,
      conversation: { type: "GROUP", directKey: { startsWith: "group:" } },
    },
    include: {
      conversation: {
        include: {
          participants: {
            include: {
              user: { select: { id: true, name: true, chatLastSeenAt: true } },
            },
          },
          messages: {
            take: 150,
            orderBy: { createdAt: "asc" },
            include: {
              sender: { select: { id: true, name: true } },
              receipts: { select: { userId: true, deliveredAt: true, readAt: true } },
              attachments: {
                select: { id: true, originalName: true, mime: true, size: true },
              },
              pollVotes: { select: { userId: true, optionIndex: true } },
            },
          },
        },
      },
    },
  });
}
