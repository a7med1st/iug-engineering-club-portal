import Link from "next/link";

import {
  Activity,
  Building2,
  CalendarClock,
  CheckCircle2,
  ClipboardList,
  Inbox,
  MapPin,
  TrendingUp,
  UserRoundCheck,
  Users,
} from "lucide-react";

import DashboardFilters from "@/components/admin/DashboardFilters";

import {
  PERMISSIONS,
  requirePermission,
} from "@/lib/permissions";

import {
  getAdminDashboardData,
  normalizeDashboardRange,
} from "@/lib/admin-dashboard";

import styles from "./dashboard.module.css";

export const dynamic = "force-dynamic";

type Props = {
  searchParams: Promise<{
    department?: string | string[];
    range?: string | string[];
  }>;
};

function single(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("ar-PS", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(value);
}

function statusLabel(status: "SUBMITTED" | "APPROVED" | "REJECTED") {
  if (status === "APPROVED") return "مقبول";
  if (status === "REJECTED") return "مرفوض";
  return "قيد المراجعة";
}

function Metric({
  title,
  value,
  hint,
  icon: Icon,
  accent,
}: {
  title: string;
  value: string | number;
  hint: string;
  icon: typeof Users;
  accent: "blue" | "cyan" | "green" | "orange";
}) {
  return (
    <article className={styles.metricCard} data-accent={accent}>
      <div className={styles.metricGlow} aria-hidden="true" />
      <div className={styles.metricIcon}>
        <Icon aria-hidden="true" size={20} />
      </div>
      <div className={styles.metricBody}>
        <span>{title}</span>
        <strong>{value}</strong>
        <small>{hint}</small>
      </div>
    </article>
  );
}

export default async function AdminDashboardPage({ searchParams }: Props) {
  await requirePermission(PERMISSIONS.ADMIN_DASHBOARD);

  const params = await searchParams;
  const range = normalizeDashboardRange(single(params.range));
  const requestedDepartment = single(params.department)?.trim() || null;

  const data = await getAdminDashboardData({
    departmentId: requestedDepartment,
    range,
  });

  const summary = data.summary;

  const rangeLabel =
    range === "30"
      ? "آخر 30 يومًا"
      : range === "90"
        ? "آخر 90 يومًا"
        : range === "365"
          ? "آخر سنة"
          : "كل الفترات";

  return (
    <section className={styles.page}>
      <header className={styles.hero}>
        <div className={styles.heroDecoration} aria-hidden="true" />
        <div className={styles.heroCopy}>
          <h1>لوحة الإحصائيات</h1>
          <p>
            تابع الطلاب والأنشطة والتسجيلات والحضور وطلبات التواصل من مكان واحد،
            مع إمكانية تخصيص العرض حسب القسم والفترة.
          </p>
        </div>

        <div className={styles.heroMeta}>
          <div>
            <span>الفترة الحالية</span>
            <strong>{rangeLabel}</strong>
          </div>
          <div>
            <span>نطاق العرض</span>
            <strong>{data.selectedDepartment?.nameAr ?? "جميع الأقسام"}</strong>
          </div>
        </div>
      </header>

      <DashboardFilters
        departments={data.departments.map(({ id, nameAr }) => ({ id, nameAr }))}
        selectedDepartmentId={data.filters.departmentId ?? null}
        range={range}
      />

      <div className={styles.metrics}>
        <Metric
          title="الطلاب"
          value={summary.studentCount}
          hint="حسابات الطلاب الحالية"
          icon={Users}
          accent="blue"
        />
        <Metric
          title="الأعضاء"
          value={summary.memberCount}
          hint={
            summary.adminCount
              ? `بالإضافة إلى ${summary.adminCount} أدمن`
              : "ضمن القسم المحدد"
          }
          icon={UserRoundCheck}
          accent="cyan"
        />
        <Metric
          title="الأنشطة"
          value={summary.activityCount}
          hint={`${summary.publishedCount} منشور · ${summary.archivedCount} مؤرشف`}
          icon={Activity}
          accent="orange"
        />
        <Metric
          title="التسجيلات"
          value={summary.registrationCount}
          hint={`${summary.pendingCount} قيد المراجعة`}
          icon={ClipboardList}
          accent="blue"
        />
        <Metric
          title="نسبة القبول"
          value={`${summary.approvalRate}%`}
          hint={`${summary.approvedCount} مقبول · ${summary.rejectedCount} مرفوض`}
          icon={TrendingUp}
          accent="green"
        />
        <Metric
          title="نسبة الحضور"
          value={`${summary.attendanceRate}%`}
          hint={`${summary.attendedCount} من ${summary.attendanceEligibleCount} مؤهل للحضور`}
          icon={CheckCircle2}
          accent="green"
        />
        <Metric
          title="أنشطة قادمة"
          value={summary.upcomingCount}
          hint={`إشغال المقاعد ${summary.capacityRate}%`}
          icon={CalendarClock}
          accent="cyan"
        />
        <Metric
          title="طلبات التواصل"
          value={summary.contactCount}
          hint={`${summary.complaintCount} شكوى · ${summary.suggestionCount} اقتراح · ${summary.collaborationCount} تعاون`}
          icon={Inbox}
          accent="orange"
        />
      </div>

      <div className={styles.twoColumns}>
        <section className={styles.panel}>
          <div className={styles.panelHead}>
            <div>
              <h2>حالات التسجيل</h2>
            </div>
            <strong className={styles.panelCount}>{summary.registrationCount}</strong>
          </div>

          <div className={styles.statusRows}>
            {[
              { label: "مقبول", value: summary.approvedCount, tone: "approved" },
              { label: "قيد المراجعة", value: summary.pendingCount, tone: "pending" },
              { label: "مرفوض", value: summary.rejectedCount, tone: "rejected" },
            ].map((row) => {
              const share = summary.registrationCount
                ? Math.round((row.value / summary.registrationCount) * 100)
                : 0;

              return (
                <div className={styles.statusRow} data-tone={row.tone} key={row.label}>
                  <div className={styles.statusRowHead}>
                    <span>{row.label}</span>
                    <strong>{row.value}</strong>
                  </div>
                  <div className={styles.bar}>
                    <span style={{ width: `${share}%` }} />
                  </div>
                  <small>{share}%</small>
                </div>
              );
            })}
          </div>
        </section>

        <section className={styles.panel}>
          <div className={styles.panelHead}>
            <div>
              <h2>أكثر الأنشطة تسجيلًا</h2>
            </div>
            <span className={styles.panelIcon}>
              <Activity aria-hidden="true" size={20} />
            </span>
          </div>

          {data.topActivities.length ? (
            <div className={styles.ranking}>
              {data.topActivities.map((activity, index) => (
                <Link
                  key={activity.id}
                  href={`/admin/activities/${activity.id}/registrations`}
                  className={styles.rankRow}
                >
                  <span className={styles.rankNumber}>{index + 1}</span>
                  <div className={styles.rankMain}>
                    <div className={styles.rankCopy}>
                      <strong>{activity.title}</strong>
                      <small>
                        {activity.registrations} تسجيل · {activity.approved} مقبول
                      </small>
                    </div>
                    <div className={styles.bar}>
                      <span style={{ width: `${activity.share}%` }} />
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <p className={styles.empty}>لا توجد تسجيلات ضمن الفترة المحددة.</p>
          )}
        </section>
      </div>

      <div className={styles.twoColumns}>
        <section className={styles.panel}>
          <div className={styles.panelHead}>
            <div>
              <h2>الأنشطة القادمة</h2>
            </div>
            <Link href="/admin/activities" className={styles.panelAction}>
              إدارة الأنشطة
            </Link>
          </div>

          {data.upcomingRows.length ? (
            <div className={styles.activityList}>
              {data.upcomingRows.map((activity) => (
                <article key={activity.id} className={styles.upcomingCard}>
                  <div className={styles.upcomingMain}>
                    <strong>{activity.title}</strong>
                    <span>
                      <CalendarClock size={15} />
                      {formatDate(activity.startsAt)}
                    </span>
                    <span>
                      <MapPin size={15} />
                      {activity.location}
                    </span>
                  </div>

                  <div className={styles.capacityBox}>
                    <strong>
                      {activity.occupied}/{activity.capacity}
                    </strong>
                    <small>إشغال {activity.fillRate}%</small>
                    <div className={styles.capacityBar}>
                      <span style={{ width: `${Math.min(activity.fillRate, 100)}%` }} />
                    </div>
                    <Link href={`/admin/activities/${activity.id}/registrations`}>
                      المسجلون
                    </Link>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <p className={styles.empty}>لا توجد أنشطة منشورة قادمة حاليًا.</p>
          )}
        </section>

        <section className={styles.panel}>
          <div className={styles.panelHead}>
            <div>
              <h2>أحدث التسجيلات</h2>
            </div>
            <span className={styles.panelIcon}>
              <ClipboardList aria-hidden="true" size={20} />
            </span>
          </div>

          {data.recentRegistrations.length ? (
            <div className={styles.registrationList}>
              {data.recentRegistrations.map((registration) => (
                <Link
                  href={`/admin/activities/${registration.activity.id}/registrations`}
                  key={registration.id}
                  className={styles.registrationRow}
                >
                  <div>
                    <strong>{registration.studentName}</strong>
                    <span>{registration.activity.title}</span>
                    <small>{formatDate(registration.submittedAt)}</small>
                  </div>
                  <span
                    data-status={registration.status}
                    className={styles.statusBadge}
                  >
                    {statusLabel(registration.status)}
                  </span>
                </Link>
              ))}
            </div>
          ) : (
            <p className={styles.empty}>لا توجد تسجيلات ضمن الفترة المحددة.</p>
          )}
        </section>
      </div>

      <section className={`${styles.panel} ${styles.departmentPanel}`}>
        <div className={styles.panelHead}>
          <div>
            <h2>إحصائيات الأقسام</h2>
          </div>
          <span className={styles.panelIcon}>
            <Building2 aria-hidden="true" size={20} />
          </span>
        </div>

        <div className={styles.departmentTable}>
          <div className={styles.departmentHeader}>
            <span>القسم</span>
            <span>الطلاب</span>
            <span>الأعضاء</span>
            <span>التسجيلات</span>
            <span>الحضور</span>
          </div>

          {data.departmentRows.map((department) => (
            <div key={department.id} className={styles.departmentRow}>
              <div>
                <strong>{department.nameAr}</strong>
                <div className={styles.bar}>
                  <span style={{ width: `${department.studentShare}%` }} />
                </div>
              </div>
              <span>{department.students}</span>
              <span>{department.members}</span>
              <span>{department.registrations}</span>
              <span>{department.attended}</span>
            </div>
          ))}
        </div>
      </section>
    </section>
  );
}