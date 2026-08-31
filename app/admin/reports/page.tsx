import Link from "next/link";

import {
  Activity,
  BarChart3,
  CheckCircle2,
  ClipboardList,
  Download,
  FileText,
  Printer,
  UserRoundCheck,
} from "lucide-react";

import ReportsFilters from "@/components/admin/ReportsFilters";

import {
  PERMISSIONS,
  requirePermission,
} from "@/lib/permissions";

import {
  getAdminReportsData,
  normalizeReportActivityStatus,
  normalizeReportRange,
} from "@/lib/admin-reports";

import styles from "./reports.module.css";

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

function statusLabel(
  value: "DRAFT" | "PUBLISHED" | "ARCHIVED",
) {
  if (value === "DRAFT") return "مسودة";
  if (value === "ARCHIVED") return "مؤرشف";
  return "منشور";
}

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("ar-PS", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(value);
}

export default async function AdminReportsPage({
  searchParams,
}: Props) {
  const { user } = await requirePermission(
    PERMISSIONS.REGISTRATION_EXPORT,
  );

  const params = await searchParams;

  const range = normalizeReportRange(one(params.range));
  const activityStatus =
    normalizeReportActivityStatus(one(params.status));

  const requestedDepartmentId =
    one(params.department)?.trim() || null;

  const data = await getAdminReportsData({
    user,
    departmentId: requestedDepartmentId,
    range,
    activityStatus,
  });

  const query = new URLSearchParams();

  if (data.filters.departmentId) {
    query.set("department", data.filters.departmentId);
  }

  if (range !== "ALL") {
    query.set("range", range);
  }

  if (activityStatus !== "ALL") {
    query.set("status", activityStatus);
  }

  const suffix = query.toString()
    ? `?${query.toString()}`
    : "";

  const summaryItems = [
    {
      label: "الأنشطة",
      value: data.summary.activityCount,
      hint: "ضمن الفلاتر الحالية",
      icon: Activity,
      tone: "blue",
    },
    {
      label: "التسجيلات",
      value: data.summary.registrationCount,
      hint: "إجمالي الطلبات",
      icon: ClipboardList,
      tone: "cyan",
    },
    {
      label: "المقبولون",
      value: data.summary.approvedCount,
      hint: "طلبات تم قبولها",
      icon: UserRoundCheck,
      tone: "green",
    },
    {
      label: "الحضور",
      value: data.summary.attendedCount,
      hint: "حضور فعلي مسجل",
      icon: CheckCircle2,
      tone: "teal",
    },
    {
      label: "نسبة الحضور",
      value: `${data.summary.attendanceRate}%`,
      hint: "من المقبولين المؤهلين",
      icon: BarChart3,
      tone: "orange",
    },
    {
      label: "نسبة القبول",
      value: `${data.summary.approvalRate}%`,
      hint: "من إجمالي التسجيلات",
      icon: BarChart3,
      tone: "violet",
    },
  ] as const;

  return (
    <section className={styles.page}>
      <header className={styles.hero} data-reveal="up">
        <div className={styles.heroCopy}>
          <h1>التقارير</h1>
          <p>
            راقب أداء الأنشطة والتسجيلات والحضور، وصدّر النتائج
            مباشرة حسب القسم والفترة والحالة.
          </p>
        </div>

        <div className={styles.actions}>
          <Link
            href={`/admin/reports/export${suffix}`}
            className={styles.exportButton}
            data-no-page-transition
          >
            <Download size={18} />
            <span>تصدير Excel</span>
          </Link>

          <Link
            href={`/admin/reports/print${suffix}`}
            target="_blank"
            rel="noreferrer"
            className={styles.printButton}
          >
            <Printer size={18} />
            <span>طباعة / PDF</span>
          </Link>
        </div>
      </header>

      <ReportsFilters
        departments={data.departments.map((department) => ({
          id: department.id,
          nameAr: department.nameAr,
        }))}
        selectedDepartmentId={
          data.filters.departmentId ?? ""
        }
        selectedRange={range}
        selectedStatus={activityStatus}
        memberDepartmentLocked={user.role === "MEMBER"}
        showReset={
          user.role === "ADMIN" &&
          Boolean(
            data.filters.departmentId ||
              range !== "ALL" ||
              activityStatus !== "ALL",
          )
        }
      />

      <div className={styles.summary} data-reveal-group="scale">
        {summaryItems.map((item) => {
          const Icon = item.icon;

          return (
            <article
              key={item.label}
              className={styles.summaryCard}
              data-tone={item.tone}
            >
              <div className={styles.summaryIcon}>
                <Icon size={20} aria-hidden="true" />
              </div>

              <div className={styles.summaryCopy}>
                <span>{item.label}</span>
                <strong>{item.value}</strong>
                <small>{item.hint}</small>
              </div>
            </article>
          );
        })}
      </div>

      <section className={styles.panel} data-reveal="up">
        <div className={styles.panelHead}>
          <div>
            <h2>تقرير الأنشطة</h2>
            <p>
              تفاصيل السعة والتسجيل والحضور لكل نشاط مطابق للفلاتر.
            </p>
          </div>

          <div className={styles.panelIcon}>
            <FileText size={22} aria-hidden="true" />
          </div>
        </div>

        <div className={styles.tableWrap}>
          <table>
            <thead>
              <tr>
                <th>النشاط</th>
                <th>التاريخ</th>
                <th>الحالة</th>
                <th>السعة</th>
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
                    <td>
                      <Link
                        href={`/admin/activities/${activity.id}/registrations`}
                        className={styles.activityLink}
                      >
                        {activity.title}
                      </Link>

                      <small>
                        {activity.departments.length
                          ? activity.departments.join("، ")
                          : "نشاط عام"}
                      </small>
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
                        {activity.capacity}
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
                      <span className={styles.rateBadge}>
                        {activity.attendanceRate}%
                      </span>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={9} className={styles.empty}>
                    لا توجد بيانات مطابقة للفلاتر.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </section>
  );
}
