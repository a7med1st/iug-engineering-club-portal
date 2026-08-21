import Image from "next/image";

import PrintButton from "@/components/admin/PrintButton";

import {
  PERMISSIONS,
  requirePermission,
} from "@/lib/permissions";

import {
  getAdminReportsData,
  normalizeReportActivityStatus,
  normalizeReportRange,
} from "@/lib/admin-reports";

import styles from "./print.module.css";

export const dynamic = "force-dynamic";

type Props = {
  searchParams: Promise<{
    department?: string | string[];
    range?: string | string[];
    status?: string | string[];
  }>;
};

function one(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("ar-PS", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(value);
}

function statusLabel(
  value: "DRAFT" | "PUBLISHED" | "ARCHIVED",
) {
  if (value === "DRAFT") return "مسودة";
  if (value === "ARCHIVED") return "مؤرشف";
  return "منشور";
}

function reportStatusLabel(value: string) {
  if (value === "DRAFT") return "المسودات";
  if (value === "PUBLISHED") return "المنشورة";
  if (value === "ARCHIVED") return "المؤرشفة";
  return "جميع الحالات";
}

function rangeLabel(value: string) {
  if (value === "7") return "آخر 7 أيام";
  if (value === "30") return "آخر 30 يومًا";
  if (value === "90") return "آخر 90 يومًا";
  return "كل الفترات";
}

export default async function PrintReportsPage({
  searchParams,
}: Props) {
  const { user } = await requirePermission(
    PERMISSIONS.REGISTRATION_EXPORT,
  );

  const params = await searchParams;

  const range = normalizeReportRange(one(params.range));

  const activityStatus =
    normalizeReportActivityStatus(one(params.status));

  const data = await getAdminReportsData({
    user,
    departmentId: one(params.department)?.trim() || null,
    range,
    activityStatus,
  });

  const generatedAt = new Date();

  const summaryItems = [
    {
      label: "الأنشطة",
      value: data.summary.activityCount,
      tone: "blue",
    },
    {
      label: "التسجيلات",
      value: data.summary.registrationCount,
      tone: "cyan",
    },
    {
      label: "المقبولون",
      value: data.summary.approvedCount,
      tone: "green",
    },
    {
      label: "الحضور",
      value: data.summary.attendedCount,
      tone: "teal",
    },
    {
      label: "نسبة الحضور",
      value: `${data.summary.attendanceRate}%`,
      tone: "orange",
    },
    {
      label: "نسبة القبول",
      value: `${data.summary.approvalRate}%`,
      tone: "violet",
    },
  ] as const;

  return (
    <main className={styles.page} dir="rtl" data-report-print-root>
      <style>{`
        @media print {
          html,
          body {
            margin: 0 !important;
            padding: 0 !important;
            background: #fff !important;
            print-color-adjust: exact;
            -webkit-print-color-adjust: exact;
          }

          body * {
            visibility: hidden !important;
          }

          [data-report-print-root],
          [data-report-print-root] * {
            visibility: visible !important;
          }

          [data-report-print-root] {
            position: absolute !important;
            inset: 0 !important;
            width: 100% !important;
          }
        }
      `}</style>

      <div className={styles.toolbar}>
        <PrintButton />
      </div>

      <article className={styles.sheet}>
        <header className={styles.letterhead}>
          <Image
            src="/images/engineering-club-letterhead-header.png"
            alt="ترويسة النادي الهندسي الرسمية"
            width={2481}
            height={550}
            className={styles.letterheadImage}
            priority
          />
        </header>

        <div className={styles.content}>
          <section className={styles.reportHero}>
            <div className={styles.reportHeroCopy}>
              <h1>التقرير الإحصائي للأنشطة</h1>

              <p>
                ملخص أداء الأنشطة والتسجيلات والحضور وفق
                الفلاتر المحددة في لوحة التقارير.
              </p>
            </div>

            <div className={styles.reportMeta}>
              <div>
                <span>القسم</span>
                <strong>
                  {data.selectedDepartment?.nameAr ??
                    "جميع الأقسام"}
                </strong>
              </div>

              <div>
                <span>الفترة</span>
                <strong>{rangeLabel(range)}</strong>
              </div>

              <div>
                <span>حالة النشاط</span>
                <strong>
                  {reportStatusLabel(activityStatus)}
                </strong>
              </div>

              <div>
                <span>تاريخ الإنشاء</span>
                <strong>{formatDate(generatedAt)}</strong>
              </div>
            </div>
          </section>

          <div className={styles.clubStripe} aria-hidden="true" />

          <section
            className={styles.summarySection}
            aria-label="ملخص التقرير"
          >
            <div className={styles.sectionHeading}>
              <div>
                <h2>نظرة سريعة على النتائج</h2>
              </div>
            </div>

            <div className={styles.summary}>
              {summaryItems.map((item) => (
                <article
                  key={item.label}
                  className={styles.summaryCard}
                  data-tone={item.tone}
                >
                  <span>{item.label}</span>
                  <strong>{item.value}</strong>
                </article>
              ))}
            </div>
          </section>

          <section className={styles.activitiesSection}>
            <div className={styles.sectionHeading}>
              <div>
                <h2>تفاصيل الأنشطة</h2>
              </div>
            </div>

            <div className={styles.tableWrap}>
              <table>
                <thead>
                  <tr>
                    <th>النشاط</th>
                    <th>التاريخ</th>
                    <th>الحالة</th>
                    <th>التسجيلات</th>
                    <th>المقبول</th>
                    <th>الحضور</th>
                    <th>الغياب</th>
                    <th>نسبة الحضور</th>
                  </tr>
                </thead>

                <tbody>
                  {data.activityRows.length ? (
                    data.activityRows.map((activity) => (
                      <tr key={activity.id}>
                        <td className={styles.activityName}>
                          {activity.title}
                        </td>

                        <td className={styles.dateCell}>
                          {formatDate(activity.startsAt)}
                        </td>

                        <td>
                          <span
                            className={styles.statusBadge}
                            data-status={activity.status}
                          >
                            {statusLabel(activity.status)}
                          </span>
                        </td>

                        <td>
                          <span className={styles.numberPill}>
                            {activity.registrations}
                          </span>
                        </td>

                        <td>
                          <span className={styles.numberPill}>
                            {activity.approved}
                          </span>
                        </td>

                        <td>
                          <span className={styles.numberPill}>
                            {activity.attended}
                          </span>
                        </td>

                        <td>
                          <span className={styles.numberPill}>
                            {activity.absent}
                          </span>
                        </td>

                        <td>
                          <strong className={styles.rate}>
                            {activity.attendanceRate}%
                          </strong>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td
                        className={styles.empty}
                        colSpan={8}
                      >
                        لا توجد أنشطة مطابقة للفلاتر الحالية.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <footer className={styles.footer}>
            <div>
              <strong>النادي الهندسي للطلاب</strong>
              <span>الجامعة الإسلامية بغزة</span>
            </div>

            <p>
              تم إنشاء هذا التقرير إلكترونيًا من بوابة النادي
              الهندسي، ويعكس البيانات المتاحة لحظة إنشاء التقرير.
            </p>
          </footer>
        </div>
      </article>
    </main>
  );
}