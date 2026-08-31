import Link from "next/link";

import {
  CalendarDays,
  CheckCircle2,
  MapPin,
  QrCode,
  Sparkles,
  Users,
} from "lucide-react";

import { requireAttendanceStaff } from "@/lib/attendance-staff";
import {
  canAccessActivityDepartments,
} from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

import styles from "./member-checkin.module.css";

export const dynamic = "force-dynamic";

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("ar-PS", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export default async function MemberCheckInActivitiesPage() {
  const { user } = await requireAttendanceStaff();

  const rawActivities = await prisma.activity.findMany({
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

  const activities = rawActivities.filter((activity) =>
    canAccessActivityDepartments(
      user,
      activity.departments.map((item) => item.departmentId),
    ),
  );

  const rows = await Promise.all(
    activities.map(async (activity) => {
      const formId = activity.registrationForm?.id;

      if (!formId) {
        return {
          ...activity,
          approvedCount: 0,
          checkedInCount: 0,
        };
      }

      const [approvedCount, checkedInCount] = await Promise.all([
        prisma.activityFormSubmission.count({
          where: {
            formId,
            status: "APPROVED",
          },
        }),

        prisma.activityFormSubmission.count({
          where: {
            formId,
            status: "APPROVED",
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
    }),
  );

  const totalApproved = rows.reduce(
    (sum, activity) => sum + activity.approvedCount,
    0,
  );

  const totalCheckedIn = rows.reduce(
    (sum, activity) => sum + activity.checkedInCount,
    0,
  );

  return (
    <main className={styles.page}>
<section className={styles.hero} data-reveal="up">
  <div className={styles.heroDecoration} aria-hidden="true" />

  <div className={styles.heroCopy}>
    <h1>تسجيل حضور الأنشطة</h1>

    <p>
      أهلًا {user.name}، اختر النشاط المطلوب ثم افتح ماسح QR
      لتسجيل دخول الطلاب بسرعة ووضوح.
    </p>
  </div>

  <div className={styles.heroIcon}>
    <span className={styles.heroIconRing} aria-hidden="true" />
    <QrCode size={34} />
  </div>
</section>

<div className={styles.sectionHead} data-reveal="up">
  <div>
    <h2>اختر النشاط</h2>
    <p>
      افتح النشاط المطلوب وابدأ تسجيل الحضور مباشرة من الكاميرا.
    </p>
  </div>

  <small className={styles.activityCount}>
    <strong>{rows.length}</strong>
    نشاط
  </small>
</div>

      {rows.length ? (
        <div className={styles.activityGrid} data-reveal-group="scale">
          {rows.map((activity, index) => {
            const remaining = Math.max(
              activity.approvedCount - activity.checkedInCount,
              0,
            );

            const completion =
              activity.approvedCount > 0
                ? Math.round(
                    (activity.checkedInCount / activity.approvedCount) * 100,
                  )
                : 0;

            return (
              <article
                key={activity.id}
                className={styles.activityCard}
                data-tone={index % 3 === 0 ? "blue" : index % 3 === 1 ? "cyan" : "green"}
              >
                <div className={styles.cardGlow} aria-hidden="true" />

                <div className={styles.activityCardTop}>
                  <span className={styles.activityIcon}>
                    <QrCode size={22} />
                  </span>

                  <div className={styles.activityTitleWrap}>
                    <h3>{activity.title}</h3>

                    <p title={activity.description}>
                      {activity.description}
                    </p>
                  </div>
                </div>

                <div className={styles.activityMeta}>
                  <div>
                    <CalendarDays size={17} />
                    <span>{formatDate(activity.startsAt)}</span>
                  </div>

                  <div>
                    <MapPin size={17} />
                    <span>{activity.location}</span>
                  </div>
                </div>

                <div className={styles.activityStats}>
                  <div className={styles.statBlue}>
                    <Users size={18} />
                    <span>المقبولون</span>
                    <strong>{activity.approvedCount}</strong>
                  </div>

                  <div className={styles.statGreen}>
                    <CheckCircle2 size={18} />
                    <span>حضروا</span>
                    <strong>{activity.checkedInCount}</strong>
                  </div>

                  <div className={styles.statOrange}>
                    <QrCode size={18} />
                    <span>بانتظار الحضور</span>
                    <strong>{remaining}</strong>
                  </div>
                </div>

                <div className={styles.progressBlock}>
                  <div className={styles.progressHead}>
                    <span>نسبة الحضور</span>
                    <strong>{completion}%</strong>
                  </div>

                  <div className={styles.progressTrack}>
                    <span style={{ width: `${completion}%` }} />
                  </div>
                </div>

                <Link
                  href={`/member/check-in/${activity.id}`}
                  className={styles.openScannerButton}
                >
                  <QrCode size={18} />
                  <span>فتح ماسح الحضور</span>
                </Link>
              </article>
            );
          })}
        </div>
      ) : (
        <div className={styles.emptyState}>
          <span className={styles.emptyIcon}>
            <QrCode size={34} />
          </span>

          <h3>لا توجد أنشطة متاحة</h3>

          <p>
            لا يوجد نشاط منشور مع نموذج تسجيل داخلي حاليًا.
          </p>
        </div>
      )}
    </main>
  );
}
