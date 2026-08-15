"use server";

import type {
  ContactRequestStatus,
} from "@prisma/client";

import { revalidatePath } from "next/cache";

import {
  PERMISSIONS,
  requirePermission,
} from "@/lib/permissions";

import { prisma } from "@/lib/prisma";

type ContactKind =
  | "complaint"
  | "suggestion"
  | "collaboration";

const complaintStatuses:
  readonly ContactRequestStatus[] = [
    "NEW",
    "IN_REVIEW",
    "RESOLVED",
  ];

const suggestionStatuses:
  readonly ContactRequestStatus[] = [
    "NEW",
    "IN_REVIEW",
    "RESOLVED",
  ];

const collaborationStatuses:
  readonly ContactRequestStatus[] = [
    "NEW",
    "IN_REVIEW",
    "CONTACTED",
    "ACCEPTED",
    "REJECTED",
  ];

function isAllowedStatus(
  kind: ContactKind,
  status: ContactRequestStatus,
) {
  if (kind === "complaint") {
    return complaintStatuses.includes(
      status,
    );
  }

  if (kind === "suggestion") {
    return suggestionStatuses.includes(
      status,
    );
  }

  return collaborationStatuses.includes(
    status,
  );
}

export async function updateContactStatus(
  formData: FormData,
) {
  await requirePermission(
    PERMISSIONS.CONTACT_MANAGE,
  );

  const id = String(
    formData.get("id") ?? "",
  ).trim();

  const kind = String(
    formData.get("kind") ?? "",
  ).trim() as ContactKind;

  const status = String(
    formData.get("status") ?? "",
  ).trim() as ContactRequestStatus;

  if (
    !id ||
    ![
      "complaint",
      "suggestion",
      "collaboration",
    ].includes(kind) ||
    !isAllowedStatus(
      kind,
      status,
    )
  ) {
    return;
  }

  if (kind === "complaint") {
    await prisma.complaint.updateMany({
      where: {
        id,
      },

      data: {
        status,
      },
    });
  } else if (
    kind === "suggestion"
  ) {
    await prisma.suggestion.updateMany({
      where: {
        id,
      },

      data: {
        status,
      },
    });
  } else {
    await prisma.collaborationRequest.updateMany({
      where: {
        id,
      },

      data: {
        status,
      },
    });
  }

  revalidatePath(
    "/admin/contact",
  );
}