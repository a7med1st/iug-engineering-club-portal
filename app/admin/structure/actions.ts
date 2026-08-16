"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  PERMISSIONS,
  canAccessDepartment,
  requirePermission,
} from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

function text(formData: FormData, field: string) {
  return String(formData.get(field) ?? "").trim();
}

function optionalId(formData: FormData, field: string) {
  return text(formData, field) || null;
}

function fail(message: string): never {
  redirect(
    `/admin/structure?error=${encodeURIComponent(message)}`,
  );
}

function success(message: string): never {
  redirect(
    `/admin/structure?success=${encodeURIComponent(message)}`,
  );
}

async function assertManagedUser(
  currentUser: {
    role: "STUDENT" | "MEMBER" | "ADMIN";
    departmentId: string | null;
  },
  targetUserId: string,
) {
  const targetUser = await prisma.user.findUnique({
    where: { id: targetUserId },
    select: {
      id: true,
      name: true,
      role: true,
      departmentId: true,
      structureItem: {
        select: { id: true },
      },
    },
  });

  if (
    !targetUser ||
    (targetUser.role !== "MEMBER" &&
      targetUser.role !== "ADMIN")
  ) {
    fail("الحساب المحدد ليس حساب عضو أو إدارة صالحًا للهيكلية.");
  }

  if (
    currentUser.role !== "ADMIN" &&
    (!targetUser.departmentId ||
      !canAccessDepartment(
        currentUser,
        targetUser.departmentId,
      ))
  ) {
    fail("لا يمكنك إضافة عضو من قسم آخر إلى الهيكلية.");
  }

  return targetUser;
}

async function assertParentAllowed(
  currentUser: {
    role: "STUDENT" | "MEMBER" | "ADMIN";
    departmentId: string | null;
  },
  parentId: string | null,
) {
  if (!parentId) {
    if (currentUser.role !== "ADMIN") {
      fail("إضافة عنصر رئيسي بدون مسؤول أعلى متاحة للإدارة فقط.");
    }

    return null;
  }

  const parent = await prisma.clubStructureItem.findUnique({
    where: { id: parentId },
    select: {
      id: true,
      departmentId: true,
    },
  });

  if (!parent) {
    fail("العنصر الأعلى المحدد غير موجود.");
  }

  if (currentUser.role !== "ADMIN") {
    if (
      !parent.departmentId ||
      !canAccessDepartment(
        currentUser,
        parent.departmentId,
      )
    ) {
      fail("لا يمكنك ربط العضو بعنصر خارج قسمك.");
    }
  }

  return parent;
}

function revalidateStructure(userId?: string) {
  revalidatePath("/admin/structure");
  revalidatePath("/delegates");

  if (userId) {
    revalidatePath(`/members/${userId}`);
  }
}

async function getDescendantIds(itemId: string) {
  const items = await prisma.clubStructureItem.findMany({
    select: {
      id: true,
      parentId: true,
    },
  });

  const childrenByParent = new Map<string, string[]>();

  for (const item of items) {
    if (!item.parentId) continue;

    const list =
      childrenByParent.get(item.parentId) ?? [];

    list.push(item.id);
    childrenByParent.set(item.parentId, list);
  }

  const descendants = new Set<string>();
  const queue = [...(childrenByParent.get(itemId) ?? [])];

  while (queue.length) {
    const current = queue.shift()!;

    if (descendants.has(current)) continue;

    descendants.add(current);

    queue.push(
      ...(childrenByParent.get(current) ?? []),
    );
  }

  return descendants;
}

export async function addStructureMember(
  formData: FormData,
) {
  const { user } = await requirePermission(
    PERMISSIONS.STRUCTURE_MANAGE,
  );

  const userId = text(formData, "userId");
  const title = text(formData, "title");
  const parentId = optionalId(formData, "parentId");

  if (!userId) {
    fail("اختر حساب العضو.");
  }

  if (!title || title.length > 160) {
    fail("اكتب مسمى تنظيمي صالحًا لا يتجاوز 160 حرفًا.");
  }

  const targetUser = await assertManagedUser(
    user,
    userId,
  );

  if (targetUser.structureItem) {
    fail("هذا العضو موجود بالفعل داخل الهيكلية.");
  }

  await assertParentAllowed(user, parentId);

  const maxSort = await prisma.clubStructureItem.aggregate({
    where: {
      parentId,
    },
    _max: {
      sortOrder: true,
    },
  });

  const level = parentId
    ? (
        await prisma.clubStructureItem.findUnique({
          where: { id: parentId },
          select: { level: true },
        })
      )?.level ?? 0
    : 0;

  await prisma.clubStructureItem.create({
    data: {
      name: targetUser.name,
      title,
      userId: targetUser.id,
      departmentId: targetUser.departmentId,
      parentId,
      level: level + 1,
      sortOrder: (maxSort._max.sortOrder ?? -1) + 1,
    },
  });

  revalidateStructure(targetUser.id);
  success("تمت إضافة العضو إلى الهيكلية بنجاح.");
}

export async function updateStructureMember(
  formData: FormData,
) {
  const { user } = await requirePermission(
    PERMISSIONS.STRUCTURE_MANAGE,
  );

  const itemId = text(formData, "itemId");
  const targetUserId = text(formData, "userId");
  const title = text(formData, "title");
  const parentId = optionalId(formData, "parentId");

  if (!itemId || !targetUserId) {
    fail("بيانات عنصر الهيكلية غير مكتملة.");
  }

  if (!title || title.length > 160) {
    fail("اكتب مسمى تنظيمي صالحًا لا يتجاوز 160 حرفًا.");
  }

  const item = await prisma.clubStructureItem.findUnique({
    where: { id: itemId },
    select: {
      id: true,
      userId: true,
      departmentId: true,
    },
  });

  if (!item) {
    fail("عنصر الهيكلية غير موجود.");
  }

  if (
    user.role !== "ADMIN" &&
    (!item.departmentId ||
      !canAccessDepartment(user, item.departmentId))
  ) {
    fail("لا يمكنك تعديل عنصر خارج قسمك.");
  }

  const targetUser = await assertManagedUser(
    user,
    targetUserId,
  );

  if (
    targetUser.structureItem &&
    targetUser.structureItem.id !== itemId
  ) {
    fail("الحساب المحدد مرتبط بعنصر آخر في الهيكلية.");
  }

  if (parentId === itemId) {
    fail("لا يمكن أن يكون العنصر مسؤولًا عن نفسه.");
  }

  await assertParentAllowed(user, parentId);

  if (parentId) {
    const descendants = await getDescendantIds(itemId);

    if (descendants.has(parentId)) {
      fail("لا يمكن نقل العنصر تحت أحد العناصر التابعة له.");
    }
  }

  const parent = parentId
    ? await prisma.clubStructureItem.findUnique({
        where: { id: parentId },
        select: { level: true },
      })
    : null;

  const nextLevel = parent ? parent.level + 1 : 1;

  await prisma.$transaction(async (tx) => {
    await tx.clubStructureItem.update({
      where: { id: itemId },
      data: {
        name: targetUser.name,
        title,
        userId: targetUser.id,
        departmentId: targetUser.departmentId,
        parentId,
        level: nextLevel,
      },
    });

    const allItems =
      await tx.clubStructureItem.findMany({
        select: {
          id: true,
          parentId: true,
          level: true,
        },
      });

    const childrenByParent = new Map<string, string[]>();

    for (const row of allItems) {
      if (!row.parentId) continue;
      const list =
        childrenByParent.get(row.parentId) ?? [];
      list.push(row.id);
      childrenByParent.set(row.parentId, list);
    }

    const queue = [
      {
        id: itemId,
        level: nextLevel,
      },
    ];

    while (queue.length) {
      const current = queue.shift()!;

      for (const childId of
        childrenByParent.get(current.id) ?? []) {
        const childLevel = current.level + 1;

        await tx.clubStructureItem.update({
          where: { id: childId },
          data: { level: childLevel },
        });

        queue.push({
          id: childId,
          level: childLevel,
        });
      }
    }
  });

  revalidateStructure(targetUser.id);

  if (
    item.userId &&
    item.userId !== targetUser.id
  ) {
    revalidateStructure(item.userId);
  }

  success("تم تحديث موقع العضو داخل الهيكلية.");
}

export async function deleteStructureMember(
  formData: FormData,
) {
  const { user } = await requirePermission(
    PERMISSIONS.STRUCTURE_MANAGE,
  );

  const itemId = text(formData, "itemId");

  if (!itemId) {
    fail("معرّف العنصر غير صالح.");
  }

  const item = await prisma.clubStructureItem.findUnique({
    where: { id: itemId },
    select: {
      id: true,
      userId: true,
      departmentId: true,
      children: {
        select: { id: true },
      },
    },
  });

  if (!item) {
    fail("عنصر الهيكلية غير موجود.");
  }

  if (
    user.role !== "ADMIN" &&
    (!item.departmentId ||
      !canAccessDepartment(user, item.departmentId))
  ) {
    fail("لا يمكنك حذف عنصر خارج قسمك.");
  }

  if (item.children.length > 0) {
    fail("انقل العناصر التابعة أولًا قبل حذف هذا العنصر.");
  }

  await prisma.clubStructureItem.delete({
    where: { id: itemId },
  });

  revalidateStructure(item.userId ?? undefined);
  success("تم حذف العضو من الهيكلية.");
}
