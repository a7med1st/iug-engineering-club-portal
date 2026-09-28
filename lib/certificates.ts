import crypto from "node:crypto";

import {
  prisma,
} from "@/lib/prisma";
import { hasPermission, PERMISSIONS, type PermissionUser } from "@/lib/permissions";

export function canViewCertificate(viewer: Pick<PermissionUser, "id" | "role" | "memberPermissions" | "position">, ownerId: string | null) {
  return ownerId === viewer.id || hasPermission(viewer.role, PERMISSIONS.ADMIN_DASHBOARD, viewer.memberPermissions, viewer.position);
}

export function isCertificateValid(certificate: {
  revokedAt: Date | null;
  artifactPathname: string | null;
  submission: { status: string; checkedInAt: Date | null };
}) {
  return !certificate.revokedAt && Boolean(certificate.artifactPathname) &&
    certificate.submission.status === "APPROVED" && Boolean(certificate.submission.checkedInAt);
}

export function isIssuedCertificate(certificate: { revokedAt: Date | null; artifactPathname: string | null } | null) {
  return Boolean(certificate && !certificate.revokedAt && certificate.artifactPathname);
}

export function normalizeCertificateCode(
  value: string,
) {
  return value
    .trim()
    .toUpperCase()
    .replace(
      /\s+/g,
      "",
    );
}

export function createVerificationCode() {
  const year =
    new Date()
      .getFullYear();

  const token =
    crypto
      .randomBytes(6)
      .toString("hex")
      .toUpperCase();

  return `EC-${year}-${token}`;
}

export async function getCertificateByCode(
  rawCode: string,
) {
  const code =
    normalizeCertificateCode(
      rawCode,
    );

  if (!code) {
    return null;
  }

  return prisma.certificate.findUnique({
    where: {
      verificationCode:
        code,
    },

    include: {
      submission: {
        select: {
          id: true,
          userId: true,
          studentName:
            true,
          studentEmail:
            true,
          studentDepartment:
            true,
          status: true,
          checkedInAt:
            true,

          form: {
            select: {
              activity: {
                select: {
                  id: true,
                  title: true,
                  location: true,
                  startsAt: true,

                  departments: {
                    select: {
                      department: {
                        select: {
                          nameAr:
                            true,
                        },
                      },
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

export async function getCertificateAdminRows({
  activityId,
  issued,
}: {
  activityId:
    | string
    | null;

  issued:
    | "ALL"
    | "ISSUED"
    | "NOT_ISSUED";
}) {
  const activities =
    await prisma.activity.findMany({
      where: {
        registrationForm: {
          isNot: null,
        },
      },

      select: {
        id: true,
        title: true,
        startsAt: true,
        status: true,
      },

      orderBy: {
        startsAt:
          "desc",
      },
    });

  const selectedActivity =
    activityId
      ? activities.find(
          (activity) =>
            activity.id ===
            activityId,
        ) ?? null
      : null;

  const submissions =
    await prisma.activityFormSubmission.findMany({
      where: {
        status:
          "APPROVED",

        checkedInAt: {
          not: null,
        },

        ...(selectedActivity
          ? {
              form: {
                activityId:
                  selectedActivity.id,
              },
            }
          : {}),
      },

      select: {
        id: true,
        userId: true,
        studentName: true,
        studentEmail: true,
        studentDepartment:
          true,
        checkedInAt: true,

        certificate: {
          select: {
            id: true,
            verificationCode:
              true,
            issuedAt: true,
            revokedAt: true,
            artifactPathname: true,
          },
        },

        form: {
          select: {
            activity: {
              select: {
                id: true,
                title: true,
                startsAt: true,
              },
            },
          },
        },
      },

      orderBy: {
        checkedInAt:
          "desc",
      },
    });

  const filtered =
    submissions.filter(
      (submission) => {
        if (
          issued ===
            "ISSUED"
        ) {
          return isIssuedCertificate(submission.certificate);
        }

        if (
          issued ===
            "NOT_ISSUED"
        ) {
          return !isIssuedCertificate(submission.certificate);
        }

        return true;
      },
    );

  return {
    activities,
    selectedActivity,
    rows: filtered,

    summary: {
      eligibleCount:
        submissions.length,

      issuedCount:
        submissions.filter(
          (submission) => isIssuedCertificate(submission.certificate),
        ).length,

      notIssuedCount:
        submissions.filter(
          (submission) => !isIssuedCertificate(submission.certificate),
        ).length,
    },
  };
}
