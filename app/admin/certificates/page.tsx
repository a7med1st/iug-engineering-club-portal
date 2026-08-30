import Link from "next/link";

import {
  Award,
  BadgeCheck,
  Ban,
  ExternalLink,
  ShieldCheck,
  UsersRound,
} from "lucide-react";

import AdminFeedback from "@/components/admin/AdminFeedback";
import CertificatesFilters from "@/components/admin/CertificatesFilters";

import {
  getCertificateAdminRows,
} from "@/lib/certificates";

import {
  PERMISSIONS,
  requirePermission,
} from "@/lib/permissions";

import {
  issueActivityCertificates,
  issueCertificate,
  revokeCertificate,
} from "./actions";

import styles from "./certificates.module.css";

export const dynamic = "force-dynamic";

type Props = {
  searchParams: Promise<{
    activity?: string | string[];
    issued?: string | string[];
    success?: string | string[];
    error?: string | string[];
  }>;
};

function one(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function issuedFilter(
  value: string | undefined,
): "ALL" | "ISSUED" | "NOT_ISSUED" {
  if (value === "ISSUED" || value === "NOT_ISSUED") {
    return value;
  }

  return "ALL";
}

function formatDate(value: Date | null) {
  if (!value) {
    return "—";
  }

  return new Intl.DateTimeFormat("ar-PS", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(value);
}

export default async function AdminCertificatesPage({
  searchParams,
}: Props) {
  await requirePermission(
    PERMISSIONS.ADMIN_DASHBOARD,
  );

  const params = await searchParams;

  const activityId =
    one(params.activity)?.trim() || null;

  const issued = issuedFilter(
    one(params.issued),
  );

  const data =
    await getCertificateAdminRows({
      activityId,
      issued,
    });

  const success = one(params.success);
  const error = one(params.error);

  const summary = [
    {
      label: "المؤهلون",
      value: data.summary.eligibleCount,
      hint: "حاضرون يستوفون شروط الإصدار",
      icon: UsersRound,
      tone: "blue",
    },
    {
      label: "شهادات فعالة",
      value: data.summary.issuedCount,
      hint: "شهادات صادرة وغير ملغاة",
      icon: BadgeCheck,
      tone: "green",
    },
    {
      label: "لم تصدر بعد",
      value: data.summary.notIssuedCount,
      hint: "مؤهلون بانتظار إصدار الشهادة",
      icon: Award,
      tone: "orange",
    },
  ] as const;

  return (
    <section className={styles.page}>
      <header className={styles.hero}>
        <div className={styles.heroCopy}>
          <h1>الشهادات</h1>

          <p>
            إصدار شهادات الحضور للمشاركين المقبولين والمسجل حضورهم،
            مع رمز تحقق فريد لكل شهادة وإدارة الإصدار والإلغاء من مكان واحد.
          </p>
        </div>

        <div className={styles.heroIcon}>
          <Award size={30} aria-hidden="true" />
        </div>
      </header>

      <AdminFeedback
        success={success}
        error={error}
      />

      <div className={styles.summary}>
        {summary.map((item) => {
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

              <div>
                <span>{item.label}</span>
                <strong>{item.value}</strong>
                <small>{item.hint}</small>
              </div>
            </article>
          );
        })}
      </div>

      <div className={styles.controls}>
        <CertificatesFilters
          activities={data.activities.map((activity) => ({
            id: activity.id,
            title: activity.title,
          }))}
          selectedActivityId={
            data.selectedActivity?.id ?? ""
          }
          selectedIssued={issued}
          showReset={Boolean(
            activityId || issued !== "ALL",
          )}
        />

        {data.selectedActivity && (
          <form
            action={issueActivityCertificates}
            className={styles.bulkForm}
          >
            <input
              type="hidden"
              name="activityId"
              value={data.selectedActivity.id}
            />

            <button
              type="submit"
              className={styles.bulkButton}
            >
              <Award size={18} />

              <span>
                إصدار شهادات جميع الحاضرين
              </span>
            </button>
          </form>
        )}
      </div>

      <section className={styles.panel}>
        <div className={styles.panelHead}>
          <div>
            <h2>الحاضرون المؤهلون</h2>

            <p>
              راجع الشهادات الصادرة، افتحها للتحقق، أو أصدر وألغِ
              الشهادات من نفس الجدول.
            </p>
          </div>

          <div className={styles.panelCount}>
            <ShieldCheck size={18} />
            <strong>{data.rows.length}</strong>
            <span>مشارك</span>
          </div>
        </div>

        <div className={styles.tableWrap}>
          <table>
            <thead>
              <tr>
                <th>المشارك</th>
                <th>القسم</th>
                <th>النشاط</th>
                <th>وقت الحضور</th>
                <th>الشهادة</th>
                <th>الإجراء</th>
              </tr>
            </thead>

            <tbody>
              {data.rows.length ? (
                data.rows.map((row) => {
                  const active = Boolean(
                    row.certificate &&
                      !row.certificate.revokedAt,
                  );

                  return (
                    <tr key={row.id}>
                      <td>
                        <strong className={styles.studentName}>
                          {row.studentName}
                        </strong>

                        <small dir="ltr">
                          {row.studentEmail}
                        </small>
                      </td>

                      <td>
                        <span className={styles.departmentBadge}>
                          {row.studentDepartment ?? "—"}
                        </span>
                      </td>

                      <td>
                        <span className={styles.activityName}>
                          {row.form.activity.title}
                        </span>
                      </td>

                      <td className={styles.dateCell}>
                        {formatDate(row.checkedInAt)}
                      </td>

                      <td>
                        {active ? (
                          <div className={styles.code}>
                            <BadgeCheck size={15} />

                            <span>
                              {
                                row.certificate
                                  ?.verificationCode
                              }
                            </span>
                          </div>
                        ) : row.certificate?.revokedAt ? (
                          <span className={styles.revoked}>
                            ملغاة
                          </span>
                        ) : (
                          <span className={styles.pending}>
                            لم تصدر
                          </span>
                        )}
                      </td>

                      <td>
                        <div className={styles.rowActions}>
                          {active && row.certificate && (
                            <>
                              <Link
                                href={`/certificates/${row.certificate.verificationCode}`}
                                target="_blank"
                                title="فتح الشهادة"
                                className={styles.openButton}
                              >
                                <ExternalLink size={16} />
                              </Link>

                              <form
                                action={revokeCertificate}
                              >
                                <input
                                  type="hidden"
                                  name="certificateId"
                                  value={row.certificate.id}
                                />

                                <button
                                  type="submit"
                                  title="إلغاء الشهادة"
                                  className={styles.revokeButton}
                                >
                                  <Ban size={16} />
                                </button>
                              </form>
                            </>
                          )}

                          {!active && (
                            <form
                              action={issueCertificate}
                            >
                              <input
                                type="hidden"
                                name="submissionId"
                                value={row.id}
                              />

                              <button
                                type="submit"
                                className={styles.issueButton}
                              >
                                <Award size={15} />
                                إصدار
                              </button>
                            </form>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td
                    colSpan={6}
                    className={styles.empty}
                  >
                    لا يوجد مشاركون مطابقون للفلاتر.
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