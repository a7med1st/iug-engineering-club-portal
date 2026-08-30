import Link from "next/link";

import {
  Award,
  BadgeCheck,
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
  value: Date,
) {
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

        submission: {
          userId:
            user.id,
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
      <header>
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

                <Link
                  href={`/certificates/${certificate.verificationCode}`}
                  target="_blank"
                >
                  عرض الشهادة
                </Link>
              </article>
            ),
          )}
        </div>
      ) : (
        <div
          className={
            styles.empty
          }
        >
          لا توجد شهادات صادرة لك
          حتى الآن.
        </div>
      )}
    </section>
  );
}
