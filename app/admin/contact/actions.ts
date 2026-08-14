"use server";

import { ContactRequestStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";

import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const complaintStatuses = [
  "NEW",
  "IN_REVIEW",
  "RESOLVED",
];

const suggestionStatuses = [
  "NEW",
  "IN_REVIEW",
  "RESOLVED",
];

const collaborationStatuses = [
  "NEW",
  "IN_REVIEW",
  "CONTACTED",
  "ACCEPTED",
  "REJECTED",
];

export async function updateContactStatus(
  formData: FormData
) {
  await requireAdmin();

  const id = String(formData.get("id") || "");
  const kind = String(formData.get("kind") || "");
  const status = String(formData.get("status") || "");

  if (!id || !kind || !status) {
    throw new Error("بيانات الطلب غير مكتملة.");
  }

  if (
    kind === "complaint" &&
    complaintStatuses.includes(status)
  ) {
    await prisma.complaint.update({
      where: { id },
      data: {
        status: status as ContactRequestStatus,
      },
    });
  } else if (
    kind === "suggestion" &&
    suggestionStatuses.includes(status)
  ) {
    await prisma.suggestion.update({
      where: { id },
      data: {
        status: status as ContactRequestStatus,
      },
    });
  } else if (
    kind === "collaboration" &&
    collaborationStatuses.includes(status)
  ) {
    await prisma.collaborationRequest.update({
      where: { id },
      data: {
        status: status as ContactRequestStatus,
      },
    });
  } else {
    throw new Error("الحالة غير صالحة.");
  }

  revalidatePath("/admin/contact");
}