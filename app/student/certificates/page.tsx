import Link from "next/link";

import {
  Award,
  BadgeCheck,
  Download,
  Eye,
} from "lucide-react";

import {
  PERMISSIONS,
  requirePermission,
} from "@/lib/permissions";

import {
  prisma,
} from "@/lib/prisma";

import styles from "./certificates.module.css";

export const dynamic =
  "force-dynamic";

function formatDate(
  value: Date | null,
) {
  if (!value) return "الموعد غير محدد";
  return new Intl.DateTimeFormat(
    "ar-PS",
    {
      dateStyle:
        "medium",
    },
  ).format(value);
}

export default async function StudentCertificatesPage() {
  const {
    user,
  } =
    await requirePermission(
      PERMISSIONS.STUDENT_DASHBOARD,
    );

  const certificates =
    await prisma.certificate.findMany({
      where: {
        revokedAt:
          null,

        artifactPathname: { not: null },

        submission: {
          userId:
            user.id,
          status: "APPROVED",
          checkedInAt: { not: null },
        },
      },

      select: {
        id: true,
        verificationCode:
          true,
        issuedAt: true,

        submission: {
          select: {
            form: {
              select: {
                activity: {
                  select: {
                    title:
                      true,
                    startsAt:
                      true,
                  },
                },
              },
            },
          },
        },
      },

      orderBy: {
        issuedAt:
          "desc",
      },
    });

  return (
    <section
      className={
        styles.page
      }
    >
      <header data-reveal="up">
        <span>
          My Certificates
        </span>

        <h1>
          شهاداتي
        </h1>

        <p>
          الشهادات الصادرة لك من
          النادي الهندسي.
        </p>
      </header>

      {certificates.length ? (
        <div
          className={
            styles.grid
          }
          data-reveal-group="scale"
        >
          {certificates.map(
            (certificate) => (
              <article
                key={
                  certificate.id
                }
              >
                <div
                  className={
                    styles.icon
                  }
                >
                  <Award
                    size={24}
                  />
                </div>

                <div>
                  <span>
                    شهادة مشاركة
                  </span>

                  <h2>
                    {
                      certificate
                        .submission
                        .form
                        .activity
                        .title
                    }
                  </h2>

                  <small>
                    النشاط:
                    {" "}
                    {formatDate(
                      certificate
                        .submission
                        .form
                        .activity
                        .startsAt,
                    )}
                  </small>

                  <small>
                    الإصدار:
                    {" "}
                    {formatDate(
                      certificate.issuedAt,
                    )}
                  </small>

                  <p>
                    <BadgeCheck
                      size={14}
                    />

                    {
                      certificate.verificationCode
                    }
                  </p>
                </div>

                <div className={styles.actions}>
                  <Link
                    href={`/certificates/${certificate.verificationCode}`}
                    target="_blank"
                  >
                    <Eye size={16} aria-hidden="true" />
                    عرض الشهادة
                  </Link>
                  <Link
                    href={`/certificates/${certificate.verificationCode}/download`}
                    className={styles.downloadLink}
                  >
                    <Download size={16} aria-hidden="true" />
                    تنزيل الشهادة
                  </Link>
                </div>
              </article>
            ),
          )}
        </div>
      ) : (
        <div
          className={
            styles.empty
          }
          data-reveal="up"
        >
          لا توجد شهادات صادرة لك
          حتى الآن.
        </div>
      )}
    </section>
  );
}
