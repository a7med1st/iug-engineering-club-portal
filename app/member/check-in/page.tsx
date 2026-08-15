import Link from "next/link";

import {
  CalendarDays,
  CheckCircle2,
  MapPin,
  QrCode,
  Users,
} from "lucide-react";

import { requireAttendanceStaff } from "@/lib/attendance-staff";
import {
  canAccessActivityDepartments,
} from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

import styles from "./member-checkin.module.css";

export const dynamic =
  "force-dynamic";

function formatDate(
  date: Date,
) {
  return new Intl.DateTimeFormat(
    "ar-PS",
    {
      dateStyle: "medium",
      timeStyle: "short",
    },
  ).format(date);
}

export default async function MemberCheckInActivitiesPage() {
  const { user } =
    await requireAttendanceStaff();

  const rawActivities =
    await prisma.activity.findMany({
      where: {
        status: "PUBLISHED",

        registrationForm: {
          isNot: null,
        },
      },

      select: {
        id: true,
        title: true,
        description: true,
        location: true,
        startsAt: true,

        departments: {
          select: {
            departmentId: true,
          },
        },

        registrationForm: {
          select: {
            id: true,
          },
        },
      },

      orderBy: {
        startsAt: "asc",
      },
    });

  const activities =
    rawActivities.filter(
      (activity) =>
        canAccessActivityDepartments(
          user,
          activity.departments.map(
            (item) =>
              item.departmentId,
          ),
        ),
    );

  const rows =
    await Promise.all(
      activities.map(
        async (activity) => {
          const formId =
            activity.registrationForm
              ?.id;

          if (!formId) {
            return {
              ...activity,
              approvedCount: 0,
              checkedInCount: 0,
            };
          }

          const [
            approvedCount,
            checkedInCount,
          ] = await Promise.all([
            prisma.activityFormSubmission.count({
              where: {
                formId,
                status:
                  "APPROVED",
              },
            }),

            prisma.activityFormSubmission.count({
              where: {
                formId,
                status:
                  "APPROVED",

                checkedInAt: {
                  not: null,
                },
              },
            }),
          ]);

          return {
            ...activity,
            approvedCount,
            checkedInCount,
          };
        },
      ),
    );

  return (
    <main
      className={
        styles.page
      }
    >
      <section
        className={
          styles.hero
        }
      >
        <div>
          <span
            className={
              styles.eyebrow
            }
          >
            بوابة العضو
          </span>

          <h1>
            تسجيل حضور الأنشطة
          </h1>

          <p>
            أهلًا {user.name}،
            اختر النشاط ثم ابدأ مسح
            بطاقات قبول الطلاب.
          </p>
        </div>

        <div
          className={
            styles.heroIcon
          }
        >
          <QrCode size={32} />
        </div>
      </section>

      <div
        className={
          styles.sectionHead
        }
      >
        <div>
          <span>
            الأنشطة المتاحة
          </span>

          <h2>
            اختر النشاط
          </h2>
        </div>

        <small>
          {rows.length} نشاط
        </small>
      </div>

      {rows.length ? (
        <div
          className={
            styles.activityGrid
          }
        >
          {rows.map(
            (activity) => {
              const remaining =
                Math.max(
                  activity.approvedCount -
                    activity.checkedInCount,
                  0,
                );

              return (
                <article
                  key={
                    activity.id
                  }
                  className={
                    styles.activityCard
                  }
                >
                  <div
                    className={
                      styles.activityCardTop
                    }
                  >
                    <span
                      className={
                        styles.activityIcon
                      }
                    >
                      <QrCode
                        size={22}
                      />
                    </span>

                    <div>
                      <h3>
                        {
                          activity.title
                        }
                      </h3>

                      <p>
                        {
                          activity.description
                        }
                      </p>
                    </div>
                  </div>

                  <div
                    className={
                      styles.activityMeta
                    }
                  >
                    <div>
                      <CalendarDays
                        size={17}
                      />

                      <span>
                        {formatDate(
                          activity.startsAt,
                        )}
                      </span>
                    </div>

                    <div>
                      <MapPin
                        size={17}
                      />

                      <span>
                        {
                          activity.location
                        }
                      </span>
                    </div>
                  </div>

                  <div
                    className={
                      styles.activityStats
                    }
                  >
                    <div>
                      <Users
                        size={18}
                      />

                      <span>
                        المقبولون
                      </span>

                      <strong>
                        {
                          activity.approvedCount
                        }
                      </strong>
                    </div>

                    <div>
                      <CheckCircle2
                        size={18}
                      />

                      <span>
                        حضروا
                      </span>

                      <strong>
                        {
                          activity.checkedInCount
                        }
                      </strong>
                    </div>

                    <div>
                      <QrCode
                        size={18}
                      />

                      <span>
                        بانتظار الحضور
                      </span>

                      <strong>
                        {remaining}
                      </strong>
                    </div>
                  </div>

                  <Link
                    href={`/member/check-in/${activity.id}`}
                    className={
                      styles.openScannerButton
                    }
                  >
                    <QrCode
                      size={18}
                    />

                    فتح ماسح الحضور
                  </Link>
                </article>
              );
            },
          )}
        </div>
      ) : (
        <div
          className={
            styles.emptyState
          }
        >
          <QrCode size={34} />

          <h3>
            لا توجد أنشطة متاحة
          </h3>

          <p>
            لا يوجد نشاط منشور مع
            نموذج تسجيل داخلي حاليًا.
          </p>
        </div>
      )}
    </main>
  );
}
