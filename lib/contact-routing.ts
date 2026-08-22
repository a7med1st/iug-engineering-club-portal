import type {
  ContactRequestKind,
  Prisma,
  Role,
} from "@prisma/client";

import { prisma } from "@/lib/prisma";

export type ContactAssignment = {
  userId: string;
  userName: string;
  structureItemId: string | null;
  structureTitle: string | null;
};

type RoutingCandidate = {
  id: string;
  title: string;
  level: number;
  sortOrder: number;
  user: {
    id: string;
    name: string;
    role: Role;
    memberPermissions: string[];
  } | null;
};

function canHandleContact(
  candidate: RoutingCandidate,
) {
  return Boolean(
    candidate.user &&
      candidate.user.role !== "STUDENT",
  );
}

function candidateToAssignment(
  candidate: RoutingCandidate,
): ContactAssignment | null {
  if (!candidate.user) return null;

  return {
    userId: candidate.user.id,
    userName: candidate.user.name,
    structureItemId: candidate.id,
    structureTitle: candidate.title,
  };
}

function isDelegateTitle(title: string) {
  const normalized = title.trim().toLowerCase();

  return (
    normalized.includes("مندوب") ||
    normalized.includes("delegate")
  );
}

async function fallbackAdmin(
  excludeUserId?: string,
): Promise<ContactAssignment | null> {
  const admin = await prisma.user.findFirst({
    where: {
      role: "ADMIN",
      ...(excludeUserId
        ? { id: { not: excludeUserId } }
        : {}),
    },
    select: {
      id: true,
      name: true,
      structureItem: {
        select: {
          id: true,
          title: true,
        },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  if (!admin) return null;

  return {
    userId: admin.id,
    userName: admin.name,
    structureItemId:
      admin.structureItem?.id ?? null,
    structureTitle:
      admin.structureItem?.title ?? "الإدارة",
  };
}

export async function findInitialContactAssignee(
  departmentId: string | null,
): Promise<ContactAssignment | null> {
  const candidates =
    await prisma.clubStructureItem.findMany({
      where: departmentId
        ? {
            departmentId,
            userId: { not: null },
          }
        : {
            parentId: null,
            userId: { not: null },
          },
      select: {
        id: true,
        title: true,
        level: true,
        sortOrder: true,
        user: {
          select: {
            id: true,
            name: true,
            role: true,
            memberPermissions: true,
          },
        },
      },
    });

  const eligible = candidates
    .filter(canHandleContact)
    .sort((first, second) => {
      const delegateDifference =
        Number(isDelegateTitle(second.title)) -
        Number(isDelegateTitle(first.title));

      if (delegateDifference !== 0) {
        return delegateDifference;
      }

      if (departmentId) {
        return (
          second.level - first.level ||
          first.sortOrder - second.sortOrder
        );
      }

      return (
        first.level - second.level ||
        first.sortOrder - second.sortOrder
      );
    });

  if (eligible[0]) {
    return candidateToAssignment(eligible[0]);
  }

  if (departmentId) {
    const departmentMembers = await prisma.user.findMany({
      where: {
        departmentId,
        role: { in: ["MEMBER", "ADMIN"] },
      },
      select: {
        id: true,
        name: true,
        position: true,
      },
      orderBy: { createdAt: "asc" },
    });
    const departmentHandler = departmentMembers.sort(
      (first, second) =>
        Number(isDelegateTitle(second.position ?? "")) -
        Number(isDelegateTitle(first.position ?? "")),
    )[0];

    if (departmentHandler) {
      return {
        userId: departmentHandler.id,
        userName: departmentHandler.name,
        structureItemId: null,
        structureTitle:
          departmentHandler.position ?? "مندوب القسم",
      };
    }
  }

  return fallbackAdmin();
}

export async function findParentContactAssignee(
  structureItemId: string | null,
  currentUserId: string,
): Promise<ContactAssignment | null> {
  if (!structureItemId) {
    return fallbackAdmin(currentUserId);
  }

  let currentId: string | null =
    structureItemId;
  const visited = new Set<string>();

  while (currentId && visited.size < 50) {
    if (visited.has(currentId)) break;
    visited.add(currentId);

    const item:
      | {
          parent: RoutingCandidate | null;
        }
      | null =
      await prisma.clubStructureItem.findUnique({
        where: { id: currentId },
        select: {
          parent: {
            select: {
              id: true,
              title: true,
              level: true,
              sortOrder: true,
              user: {
                select: {
                  id: true,
                  name: true,
                  role: true,
                  memberPermissions: true,
                },
              },
            },
          },
        },
      });

    const parent: RoutingCandidate | null =
      item?.parent ?? null;

    if (!parent) break;

    if (
      parent.user?.id !== currentUserId &&
      canHandleContact(parent)
    ) {
      return candidateToAssignment(parent);
    }

    currentId = parent.id;
  }

  return fallbackAdmin(currentUserId);
}

export async function createInitialRoutingRecords(
  transaction: Prisma.TransactionClient,
  assignment: ContactAssignment | null,
  requestKind: ContactRequestKind,
  requestId: string,
  notificationBody: string,
) {
  if (!assignment) return;

  await transaction.notification.create({
    data: {
      userId: assignment.userId,
      type: "SYSTEM",
      title: "طلب تواصل جديد بانتظارك",
      body: notificationBody,
      href: `/admin/contact?focus=${requestKind.toLowerCase()}-${requestId}`,
    },
  });

  await transaction.contactRoutingEvent.create({
    data: {
      requestKind,
      requestId,
      toUserId: assignment.userId,
      toName: assignment.userName,
      note: "توجيه تلقائي عند استلام الطلب",
    },
  });
}
