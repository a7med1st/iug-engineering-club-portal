"use server";

import type {
  ContactRequestKind,
  ContactRequestStatus,
  Prisma,
} from "@prisma/client";
import { revalidatePath } from "next/cache";

import { CONTACT_STATUS_LABELS } from "@/lib/contact-options";
import {
  findInitialContactAssignee,
  findParentContactAssignee,
} from "@/lib/contact-routing";
import {
  hasGlobalContactAccess,
  requireContactAccess,
} from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

type ContactKind =
  | "complaint"
  | "suggestion"
  | "collaboration";

export type ComplaintReplyState = {
  success: boolean;
  message: string;
};

export type ContactEscalationState = {
  success: boolean;
  message: string;
};

function canManageAssignedRequest(
  user: {
    id: string;
    role: "STUDENT" | "MEMBER" | "ADMIN";
    position?: string | null;
  },
  assignedToId: string | null,
) {
  return (
    hasGlobalContactAccess(user) ||
    assignedToId === user.id
  );
}

const complaintStatuses:
  readonly ContactRequestStatus[] = [
    "NEW",
    "IN_REVIEW",
    "IN_PROGRESS",
    "RESOLVED",
  ];

const suggestionStatuses:
  readonly ContactRequestStatus[] = [
    "NEW",
    "IN_REVIEW",
    "IN_PROGRESS",
    "RESOLVED",
  ];

const collaborationStatuses:
  readonly ContactRequestStatus[] = [
    "NEW",
    "IN_REVIEW",
    "IN_PROGRESS",
    "CONTACTED",
    "ACCEPTED",
    "RESOLVED",
    "REJECTED",
  ];

function isContactKind(
  value: string,
): value is ContactKind {
  return [
    "complaint",
    "suggestion",
    "collaboration",
  ].includes(value);
}

function isAllowedStatus(
  kind: ContactKind,
  status: ContactRequestStatus,
) {
  if (kind === "complaint") {
    return complaintStatuses.includes(status);
  }

  if (kind === "suggestion") {
    return suggestionStatuses.includes(status);
  }

  return collaborationStatuses.includes(status);
}

function kindLabel(kind: ContactKind) {
  if (kind === "complaint") return "الشكوى";
  if (kind === "suggestion") return "الاقتراح";
  return "طلب التعاون";
}

async function notifyStatusChange(
  transaction: Prisma.TransactionClient,
  userId: string | null,
  kind: ContactKind,
  status: ContactRequestStatus,
) {
  if (!userId) return;

  await transaction.notification.create({
    data: {
      userId,
      type: "SYSTEM",
      title: `تحديث حالة ${kindLabel(kind)}`,
      body: `أصبحت حالة ${kindLabel(kind)}: ${CONTACT_STATUS_LABELS[status]}.`,
      href: "/contact#my-contact-requests",
    },
  });
}

export async function updateContactStatus(
  formData: FormData,
) {
  const { user } = await requireContactAccess();

  const id = String(
    formData.get("id") ?? "",
  ).trim();
  const kindValue = String(
    formData.get("kind") ?? "",
  ).trim();
  const status = String(
    formData.get("status") ?? "",
  ).trim() as ContactRequestStatus;

  if (
    !id ||
    !isContactKind(kindValue) ||
    !isAllowedStatus(kindValue, status)
  ) {
    return;
  }

  await prisma.$transaction(
    async (transaction) => {
      if (kindValue === "complaint") {
        const request =
          await transaction.complaint.findUnique({
            where: { id },
            select: {
              status: true,
              submittedById: true,
              assignedToId: true,
            },
          });

        if (
          !request ||
          request.status === status ||
          !canManageAssignedRequest(
            user,
            request.assignedToId,
          )
        ) {
          return;
        }

        await transaction.complaint.update({
          where: { id },
          data: { status },
        });
        await notifyStatusChange(
          transaction,
          request.submittedById,
          kindValue,
          status,
        );
        return;
      }

      if (kindValue === "suggestion") {
        const request =
          await transaction.suggestion.findUnique({
            where: { id },
            select: {
              status: true,
              submittedById: true,
              assignedToId: true,
            },
          });

        if (
          !request ||
          request.status === status ||
          !canManageAssignedRequest(
            user,
            request.assignedToId,
          )
        ) {
          return;
        }

        await transaction.suggestion.update({
          where: { id },
          data: { status },
        });
        await notifyStatusChange(
          transaction,
          request.submittedById,
          kindValue,
          status,
        );
        return;
      }

      const request =
        await transaction.collaborationRequest.findUnique(
          {
            where: { id },
            select: {
              status: true,
              submittedById: true,
              assignedToId: true,
            },
          },
        );

      if (
        !request ||
        request.status === status ||
        !canManageAssignedRequest(
          user,
          request.assignedToId,
        )
      ) {
        return;
      }

      await transaction.collaborationRequest.update({
        where: { id },
        data: { status },
      });
      await notifyStatusChange(
        transaction,
        request.submittedById,
        kindValue,
        status,
      );
    },
  );

  revalidatePath("/admin/contact");
  revalidatePath("/contact");
  revalidatePath("/notifications");
}

export async function sendComplaintReply(
  _previousState: ComplaintReplyState,
  formData: FormData,
): Promise<ComplaintReplyState> {
  const { user } = await requireContactAccess();

  const complaintId = String(
    formData.get("complaintId") ?? "",
  ).trim();
  const message = String(
    formData.get("message") ?? "",
  ).trim();

  if (!complaintId) {
    return {
      success: false,
      message: "تعذر تحديد الشكوى المطلوبة.",
    };
  }

  if (message.length < 2 || message.length > 2000) {
    return {
      success: false,
      message:
        "اكتب ردًا واضحًا لا يزيد على 2000 حرف.",
    };
  }

  const result = await prisma.$transaction(
    async (transaction) => {
      const complaint =
        await transaction.complaint.findUnique({
          where: { id: complaintId },
          select: {
            id: true,
            wantsReply: true,
            submittedById: true,
            assignedToId: true,
          },
        });

      if (!complaint) {
        return "NOT_FOUND" as const;
      }

      if (
        !canManageAssignedRequest(
          user,
          complaint.assignedToId,
        )
      ) {
        return "FORBIDDEN" as const;
      }

      if (!complaint.wantsReply) {
        return "REPLY_NOT_REQUESTED" as const;
      }

      if (!complaint.submittedById) {
        return "NO_RECIPIENT" as const;
      }

      await transaction.complaintReply.create({
        data: {
          complaintId,
          authorId: user.id,
          message,
        },
      });

      await transaction.notification.create({
        data: {
          userId: complaint.submittedById,
          type: "SYSTEM",
          title: "وصلك رد على شكواك",
          body:
            message.length > 160
              ? `${message.slice(0, 157)}...`
              : message,
          href:
            "/contact#my-contact-requests",
        },
      });

      return "SENT" as const;
    },
  );

  if (result === "NOT_FOUND") {
    return {
      success: false,
      message: "الشكوى غير موجودة.",
    };
  }

  if (result === "REPLY_NOT_REQUESTED") {
    return {
      success: false,
      message:
        "صاحب الشكوى لم يطلب الحصول على رد.",
    };
  }

  if (result === "FORBIDDEN") {
    return {
      success: false,
      message:
        "هذا الطلب ليس محالًا إليك حاليًا.",
    };
  }

  if (result === "NO_RECIPIENT") {
    return {
      success: false,
      message:
        "لا يوجد حساب مرتبط بهذه الشكوى لإرسال الرد داخله.",
    };
  }

  revalidatePath("/admin/contact");
  revalidatePath("/contact");
  revalidatePath("/notifications");

  return {
    success: true,
    message: "تم إرسال الرد لصاحب الشكوى بنجاح.",
  };
}

type RoutingTarget = {
  id: string;
  departmentId: string | null;
  submittedById: string | null;
  assignedToId: string | null;
  assignedStructureItemId: string | null;
  assignedTo: {
    name: string;
  } | null;
};

async function getRoutingTarget(
  kind: ContactKind,
  id: string,
): Promise<RoutingTarget | null> {
  const select = {
    id: true,
    submittedById: true,
    assignedToId: true,
    assignedStructureItemId: true,
    assignedTo: {
      select: { name: true },
    },
  } as const;

  if (kind === "complaint") {
    return prisma.complaint.findUnique({
      where: { id },
      select: {
        ...select,
        departmentId: true,
      },
    });
  }

  if (kind === "suggestion") {
    return prisma.suggestion.findUnique({
      where: { id },
      select: {
        ...select,
        departmentId: true,
      },
    });
  }

  const request =
    await prisma.collaborationRequest.findUnique({
      where: { id },
      select,
    });

  return request
    ? { ...request, departmentId: null }
    : null;
}

function requestKindValue(
  kind: ContactKind,
): ContactRequestKind {
  if (kind === "complaint") return "COMPLAINT";
  if (kind === "suggestion") return "SUGGESTION";
  return "COLLABORATION";
}

export async function escalateContactRequest(
  _previousState: ContactEscalationState,
  formData: FormData,
): Promise<ContactEscalationState> {
  const { user } = await requireContactAccess();

  const id = String(
    formData.get("id") ?? "",
  ).trim();
  const kindValue = String(
    formData.get("kind") ?? "",
  ).trim();
  const note = String(
    formData.get("note") ?? "",
  ).trim();

  if (!id || !isContactKind(kindValue)) {
    return {
      success: false,
      message: "بيانات الطلب غير مكتملة.",
    };
  }

  if (note.length > 500) {
    return {
      success: false,
      message:
        "ملاحظة التصعيد يجب ألا تتجاوز 500 حرف.",
    };
  }

  const request = await getRoutingTarget(
    kindValue,
    id,
  );

  if (!request) {
    return {
      success: false,
      message: "الطلب غير موجود.",
    };
  }

  if (
    !canManageAssignedRequest(
      user,
      request.assignedToId,
    )
  ) {
    return {
      success: false,
      message:
        "هذا الطلب ليس محالًا إليك حاليًا.",
    };
  }

  const assignment = request.assignedToId
    ? await findParentContactAssignee(
        request.assignedStructureItemId,
        request.assignedToId,
      )
    : await findInitialContactAssignee(
        request.departmentId,
      );

  if (
    !assignment ||
    assignment.userId === request.assignedToId
  ) {
    return {
      success: false,
      message:
        "لا يوجد مسؤول أعلى مؤهل في الهيكلية لرفع الطلب إليه.",
    };
  }

  const enumKind = requestKindValue(kindValue);
  const routedAt = new Date();

  const routed = await prisma.$transaction(
    async (transaction) => {
      const assignmentData = {
        assignedToId: assignment.userId,
        assignedStructureItemId:
          assignment.structureItemId,
        assignedAt: routedAt,
      };

      let updatedCount = 0;

      if (kindValue === "complaint") {
        const result = await transaction.complaint.updateMany({
          where: {
            id,
            assignedToId: request.assignedToId,
          },
          data: assignmentData,
        });
        updatedCount = result.count;
      } else if (kindValue === "suggestion") {
        const result = await transaction.suggestion.updateMany({
          where: {
            id,
            assignedToId: request.assignedToId,
          },
          data: assignmentData,
        });
        updatedCount = result.count;
      } else {
        const result =
          await transaction.collaborationRequest.updateMany({
            where: {
              id,
              assignedToId: request.assignedToId,
            },
            data: assignmentData,
          });
        updatedCount = result.count;
      }

      if (updatedCount !== 1) {
        return false;
      }

      await transaction.contactRoutingEvent.create({
        data: {
          requestKind: enumKind,
          requestId: id,
          fromUserId:
            request.assignedToId ?? user.id,
          fromName:
            request.assignedTo?.name ?? user.name,
          toUserId: assignment.userId,
          toName: assignment.userName,
          note: note
            ? `${note} — رُفع بواسطة ${user.name}`
            : `رُفع للمسؤول الأعلى بواسطة ${user.name}`,
        },
      });

      await transaction.notification.create({
        data: {
          userId: assignment.userId,
          type: "SYSTEM",
          title: "تم تصعيد طلب تواصل إليك",
          body: `${kindLabel(kindValue)} تحتاج إلى متابعتك بصفتك المسؤول الأعلى${
            assignment.structureTitle
              ? ` (${assignment.structureTitle})`
              : ""
          }.`,
          href: `/admin/contact?focus=${kindValue}-${id}`,
        },
      });

      if (
        request.submittedById &&
        request.submittedById !== assignment.userId
      ) {
        await transaction.notification.create({
          data: {
            userId: request.submittedById,
            type: "SYSTEM",
            title: `تحديث متابعة ${kindLabel(kindValue)}`,
            body:
              "تم رفع طلبك إلى المسؤول الأعلى لاستكمال معالجته.",
            href:
              "/contact#my-contact-requests",
          },
        });
      }

      return true;
    },
  );

  if (!routed) {
    return {
      success: false,
      message:
        "تم تحويل الطلب مسبقًا بواسطة مسؤول آخر. حدّث الصفحة للاطلاع على المسؤول الحالي.",
    };
  }

  revalidatePath("/admin/contact");
  revalidatePath("/contact");
  revalidatePath("/notifications");

  return {
    success: true,
    message: `تم تحويل الطلب إلى ${assignment.userName} بنجاح.`,
  };
}
