import type { ActivityStatus, PrismaClient } from "@prisma/client";

type ActivityDatabase = Pick<PrismaClient, "activity">;

// Conditional writes keep repeated requests from overwriting the original status.
export async function moveActivityToTrash(
  db: ActivityDatabase,
  id: string,
  status: ActivityStatus,
) {
  return db.activity.updateMany({
    where: { id, deletedAt: null, status },
    data: { deletedAt: new Date(), statusBeforeDeletion: status, status: "DRAFT" },
  });
}

export async function restoreTrashedActivity(
  db: ActivityDatabase,
  id: string,
  statusBeforeDeletion: ActivityStatus | null,
) {
  return db.activity.updateMany({
    where: { id, deletedAt: { not: null }, statusBeforeDeletion },
    data: {
      deletedAt: null,
      statusBeforeDeletion: null,
      status: statusBeforeDeletion ?? "DRAFT",
    },
  });
}
