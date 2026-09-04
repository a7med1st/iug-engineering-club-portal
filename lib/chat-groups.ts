import { isClubLeadership } from "./permissions";
import { prisma } from "./prisma.ts";

const GENERAL_KEY = "group:general";
const CLUB_EXECUTIVE_KEY = "group:club-executive";
const deptKey = (id: string) => `group:department:${id}`;

function normalizeStructureTitle(value: string | null | undefined) {
  return (value ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function isVicePresidentTitle(value: string | null | undefined) {
  const title = normalizeStructureTitle(value);

  return (
    title.includes("نائب رئيس النادي") ||
    title.includes("vice president")
  );
}

function isPresidentTitle(value: string | null | undefined) {
  const title = normalizeStructureTitle(value);

  return (
    !isVicePresidentTitle(title) &&
    (
      title.includes("رئيس النادي") ||
      title.includes("club president") ||
      title === "president"
    )
  );
}

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
        data: ids.map((userId) => ({
          conversationId,
          userId,
        })),
        skipDuplicates: true,
      });
    }
  });
}

export async function syncSystemChatGroups() {
  const [departments, users, structureItems] = await Promise.all([
    prisma.department.findMany({
      select: {
        id: true,
        nameAr: true,
        sortOrder: true,
      },
      orderBy: {
        sortOrder: "asc",
      },
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

    prisma.clubStructureItem.findMany({
      select: {
        id: true,
        title: true,
        userId: true,
        parentId: true,
      },
    }),
  ]);

  const allIds =
    users.map((user) => user.id);

  const adminIds =
    users
      .filter(
        (user) =>
          user.role === "ADMIN",
      )
      .map(
        (user) => user.id,
      );

  const leadershipIds =
    users
      .filter(
        (user) =>
          user.role === "MEMBER" &&
          isClubLeadership(
            user.position,
          ),
      )
      .map(
        (user) => user.id,
      );

  /* =========================================================
     GENERAL GROUP
  ========================================================= */

  const general =
    await prisma.chatConversation.upsert({
      where: {
        directKey: GENERAL_KEY,
      },
      create: {
        type: "GROUP",
        name: "النادي الهندسي - عام",
        directKey: GENERAL_KEY,
      },
      update: {
        type: "GROUP",
        name: "النادي الهندسي - عام",
      },
      select: {
        id: true,
      },
    });

  await syncParticipants(
    general.id,
    allIds,
  );

  /* =========================================================
     CLUB EXECUTIVE GROUP

     Members:
     1. Club President
     2. Club Vice President
     3. DIRECT children of the Vice President only

     Grandchildren / deeper descendants are NOT included.
  ========================================================= */

  const presidentItem =
    structureItems.find(
      (item) =>
        isPresidentTitle(
          item.title,
        ),
    );

  const vicePresidentItem =
    structureItems.find(
      (item) =>
        isVicePresidentTitle(
          item.title,
        ),
    );

  const vicePresidentDirectChildIds =
    vicePresidentItem
      ? structureItems
          .filter(
            (item) =>
              item.parentId ===
                vicePresidentItem.id &&
              Boolean(item.userId),
          )
          .map(
            (item) => item.userId!,
          )
      : [];

  const clubExecutiveIds = [
    ...(presidentItem?.userId
      ? [presidentItem.userId]
      : []),

    ...(vicePresidentItem?.userId
      ? [vicePresidentItem.userId]
      : []),

    ...vicePresidentDirectChildIds,
  ];

  const clubExecutive =
    await prisma.chatConversation.upsert({
      where: {
        directKey:
          CLUB_EXECUTIVE_KEY,
      },
      create: {
        type: "GROUP",
        name: "إدارة النادي الهندسي",
        directKey:
          CLUB_EXECUTIVE_KEY,
      },
      update: {
        type: "GROUP",
        name: "إدارة النادي الهندسي",
      },
      select: {
        id: true,
      },
    });

  await syncParticipants(
    clubExecutive.id,
    clubExecutiveIds,
  );

  /* =========================================================
     DEPARTMENT GROUPS
  ========================================================= */

  for (
    const department
    of departments
  ) {
    const memberIds =
      users
        .filter(
          (user) =>
            user.role ===
              "MEMBER" &&
            user.departmentId ===
              department.id,
        )
        .map(
          (user) => user.id,
        );

    const group =
      await prisma.chatConversation.upsert({
        where: {
          directKey:
            deptKey(
              department.id,
            ),
        },
        create: {
          type: "GROUP",
          name:
            `قسم ${department.nameAr}`,
          directKey:
            deptKey(
              department.id,
            ),
        },
        update: {
          type: "GROUP",
          name:
            `قسم ${department.nameAr}`,
        },
        select: {
          id: true,
        },
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

  const memberships =
    await prisma.chatParticipant.findMany({
      where: {
        userId,
        conversation: {
          type: "GROUP",
          directKey: {
            startsWith: "group:",
          },
        },
      },
      select: {
        lastReadAt: true,
        conversation: {
          select: {
            id: true,
            name: true,
            directKey: true,
            lastMessageAt: true,
            _count: {
              select: {
                participants: true,
              },
            },
            messages: {
              take: 1,
              orderBy: {
                createdAt: "desc",
              },
              select: {
                body: true,
                createdAt: true,
                sender: {
                  select: {
                    name: true,
                  },
                },
              },
            },
          },
        },
      },
    });

  const rows =
    await Promise.all(
      memberships.map(
        async (membership) => ({
          id:
            membership
              .conversation.id,

          name:
            membership
              .conversation.name ??
            "مجموعة",

          directKey:
            membership
              .conversation
              .directKey,

          participantCount:
            membership
              .conversation
              ._count
              .participants,

          lastMessage:
            membership
              .conversation
              .messages[0] ??
            null,

          lastMessageAt:
            membership
              .conversation
              .lastMessageAt,

          unreadCount:
            await prisma.chatMessage.count({
              where: {
                conversationId:
                  membership
                    .conversation.id,

                senderId: {
                  not: userId,
                },

                ...(membership.lastReadAt
                  ? {
                      createdAt: {
                        gt:
                          membership
                            .lastReadAt,
                      },
                    }
                  : {}),
              },
            }),
        }),
      ),
    );

  return rows.sort(
    (a, b) => {
      if (
        a.directKey ===
        GENERAL_KEY
      ) {
        return -1;
      }

      if (
        b.directKey ===
        GENERAL_KEY
      ) {
        return 1;
      }

      return (
        (b.lastMessageAt?.getTime() ??
          0) -
        (a.lastMessageAt?.getTime() ??
          0)
      );
    },
  );
}

export async function getSystemGroupMembership(
  userId: string,
  conversationId: string,
) {
  await syncSystemChatGroups();

  return prisma.chatParticipant.findFirst({
    where: {
      userId,
      conversationId,
      conversation: {
        type: "GROUP",
        directKey: {
          startsWith: "group:",
        },
      },
    },
    include: {
      conversation: {
        include: {
          participants: {
            include: {
              user: {
                select: {
                  id: true,
                  name: true,
                  chatLastSeenAt: true,
                },
              },
            },
          },

          messages: {
            take: 121,
            orderBy: [
              {
                createdAt: "desc",
              },
              {
                id: "desc",
              },
            ],
            include: {
              sender: {
                select: {
                  id: true,
                  name: true,
                  avatarStoredName: true,
                  avatarUpdatedAt: true,
                },
              },

              receipts: {
                select: {
                  userId: true,
                  deliveredAt: true,
                  readAt: true,
                },
              },

              attachments: {
                select: {
                  id: true,
                  originalName: true,
                  mime: true,
                  size: true,
                },
              },

              pollVotes: {
                select: {
                  userId: true,
                  optionIndex: true,
                },
              },

              replyTo: {
                select: {
                  id: true,
                  body: true,
                  sender: {
                    select: {
                      name: true,
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  });
}
