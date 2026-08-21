import Link from "next/link";

import {
  Award,
  Compass,
} from "lucide-react";
import StudentCancelRegistrationButton from "@/components/student/StudentCancelRegistrationButton";
import StudentAvatarUploader from "@/components/student/StudentAvatarUploader";
import StudentProfileEditor from "@/components/student/StudentProfileEditor";
import {
  PERMISSIONS,
  requirePermission,
} from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import StudentAcceptanceCard from "@/components/student/StudentAcceptanceCard";
import styles from "./student.module.css";
export const dynamic = "force-dynamic";

const statusLabels = {
  SUBMITTED: "قيد المراجعة",
  APPROVED: "مقبول",
  REJECTED: "مرفوض",
} as const;

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("ar-PS", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function formatAnswer(value: unknown) {
  if (value === null || value === undefined) {
    return "لم تتم الإجابة";
  }

  if (Array.isArray(value)) {
    return value.length
      ? value.map(String).join("، ")
      : "لم تتم الإجابة";
  }

  if (typeof value === "boolean") {
    return value ? "نعم" : "لا";
  }

  if (typeof value === "object") {
    return JSON.stringify(value);
  }

  const text = String(value).trim();

  return text || "لم تتم الإجابة";
}

type ActivityTab =
  | "all"
  | "upcoming"
  | "past"
  | "rejected";

type StudentDashboardPageProps = {
  searchParams?: Promise<{
    activityTab?: string | string[];
  }>;
};

function resolveActivityTab(
  value: string | string[] | undefined,
): ActivityTab {
  const normalized = Array.isArray(value)
    ? value[0]
    : value;

  if (
    normalized === "upcoming" ||
    normalized === "past" ||
    normalized === "rejected"
  ) {
    return normalized;
  }

  return "all";
}

export default async function StudentDashboardPage({
  searchParams,
}: StudentDashboardPageProps) {
  const params = await searchParams;
  const activityTab = resolveActivityTab(
    params?.activityTab,
  );

  const { user: sessionUser } =
    await requirePermission(
      PERMISSIONS.STUDENT_DASHBOARD,
    );

  const user =
    await prisma.user.findUnique({
      where: {
        id: sessionUser.id,
      },

      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        createdAt: true,

        studentNumber: true,
        phone: true,
        studyLevel: true,

        avatarStoredName: true,
        avatarUpdatedAt: true,

        department: {
          select: {
            id: true,
            nameAr: true,
            nameEn: true,
          },
        },

        activityFormSubmissions: {
          select: {
            id: true,
            status: true,
            submittedAt: true,
            checkInToken: true,
            checkedInAt: true,

            answers: {
              select: {
                id: true,
                value: true,

                question: {
                  select: {
                    id: true,
                    label: true,
                    sortOrder: true,
                  },
                },
              },
            },

            form: {
              select: {
                title: true,

                activity: {
                  select: {
                    id: true,
                    title: true,
                    description: true,
                    location: true,
                    startsAt: true,
                    capacity: true,
                    status: true,
                  },
                },
              },
            },
          },

          orderBy: {
            submittedAt: "desc",
          },
        },
      },
    });

  if (!user) {
    return null;
  }

  const submissions =
    user.activityFormSubmissions;

  const pendingCount =
    submissions.filter(
      (item) =>
        item.status === "SUBMITTED",
    ).length;

  const approvedCount =
    submissions.filter(
      (item) =>
        item.status === "APPROVED",
    ).length;

  const now = new Date();

  const activeCount =
    submissions.filter(
      (item) =>
        item.status !== "REJECTED" &&
        item.form.activity.startsAt >=
        now,
    ).length;

  const upcomingSubmissions =
    submissions.filter(
      (item) =>
        item.status !== "REJECTED" &&
        item.form.activity.startsAt >=
        now,
    );

  const pastSubmissions =
    submissions.filter(
      (item) =>
        item.status !== "REJECTED" &&
        item.form.activity.startsAt <
        now,
    );

  const rejectedSubmissions =
    submissions.filter(
      (item) =>
        item.status === "REJECTED",
    );

  const filteredSubmissions =
    activityTab === "upcoming"
      ? upcomingSubmissions
      : activityTab === "past"
        ? pastSubmissions
        : activityTab === "rejected"
          ? rejectedSubmissions
          : submissions;

  const initials =
    user.name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) =>
        part.charAt(0),
      )
      .join("")
      .toUpperCase() || "ST";

  const createdAtLabel =
    new Intl.DateTimeFormat(
      "ar-PS",
      {
        dateStyle: "medium",
      },
    ).format(user.createdAt);

  return (
    <main className={styles.page}>
      {/* ==================================================
          HERO
      ================================================== */}

      <section className={styles.hero}>
        <div className={styles.heroContent}>
          <h1 className={styles.heroTitle}>
            <span className={styles.heroWelcome}>
              مرحبًا،
            </span>

            <span className={styles.heroStudentName}>
              {user.name}
            </span>
          </h1>

          <p className={styles.heroDescription}>
            تابع أنشطتك، واطّلع على معلومات حسابك وكل ما تحتاجه
            في مكان واحد.
          </p>

          <div className={styles.heroActions}>
            <Link
              href="/activities"
              className={styles.activitiesLink}
            >
              <Compass
                size={19}
                strokeWidth={2}
              />

              <span>
                استكشف الأنشطة
              </span>
            </Link>

            <Link
              href="/student/certificates"
              className={styles.certificatesLink}
            >
              <Award
                size={19}
                strokeWidth={2}
              />

              <span>
                شهاداتي
              </span>
            </Link>
          </div>
        </div>

        <div
          className={styles.heroVisual}
          aria-hidden="true"
        >
          <img
            src="/images/student/hero/engineering-1.png"
            alt=""
            className={`${styles.heroFloatingImage} ${styles.heroImageOne}`}
          />

          <img
            src="/images/student/hero/engineering-2.png"
            alt=""
            className={`${styles.heroFloatingImage} ${styles.heroImageTwo}`}
          />

          <img
            src="/images/student/hero/engineering-3.png"
            alt=""
            className={`${styles.heroFloatingImage} ${styles.heroImageThree}`}
          />

          <img
            src="/images/student/hero/engineering-4.png"
            alt=""
            className={`${styles.heroFloatingImage} ${styles.heroImageFour}`}
          />
        </div>
      </section>

      {/* ==================================================
          DASHBOARD
      ================================================== */}

      <section
        className={
          styles.dashboardGrid
        }
      >
        {/* PROFILE */}

        <aside
          className={
            styles.profileCard
          }
        >
          <StudentAvatarUploader
            key={`${Boolean(
              user.avatarStoredName,
            )}-${user.avatarUpdatedAt
              ?.getTime()
              .toString() ?? "0"}`}
            name={user.name}
            initials={initials}
            hasAvatar={Boolean(
              user.avatarStoredName,
            )}
            initialVersion={
              user.avatarUpdatedAt
                ?.getTime()
                .toString() ?? "0"
            }
          />

          <StudentProfileEditor
            name={user.name}
            email={user.email}
            studentNumber={
              user.studentNumber
            }
            phone={user.phone}
            studyLevel={
              user.studyLevel
            }
            departmentName={
              user.department
                ?.nameAr ??
              "غير محدد"
            }
            createdAtLabel={
              createdAtLabel
            }
            initials={initials}
            hasAvatar={Boolean(
              user.avatarStoredName,
            )}
            avatarVersion={
              user.avatarUpdatedAt
                ?.getTime()
                .toString() ?? "0"
            }
          />
        </aside>

        {/* MAIN CONTENT */}

        <div
          className={
            styles.mainContent
          }
        >
          {/* ==============================================
              STATS
          ============================================== */}

          <section
            className={
              styles.statsGrid
            }
          >
            <article
              className={
                styles.statCard
              }
            >
              <span>
                إجمالي تسجيلاتي
              </span>

              <strong>
                {submissions.length}
              </strong>

              <small>
                كل الأنشطة التي سجلت
                فيها
              </small>
            </article>

            <article
              className={
                styles.statCard
              }
            >
              <span>
                قيد المراجعة
              </span>

              <strong>
                {pendingCount}
              </strong>

              <small>
                بانتظار قرار الإدارة
              </small>
            </article>

            <article
              className={
                styles.statCard
              }
            >
              <span>مقبول</span>

              <strong>
                {approvedCount}
              </strong>

              <small>
                تسجيلات تم قبولها
              </small>
            </article>

            <article
              className={
                styles.statCard
              }
            >
              <span>
                أنشطة قادمة
              </span>

              <strong>
                {activeCount}
              </strong>

              <small>
                تسجيلات فعالة لم تبدأ
                بعد
              </small>
            </article>
          </section>

          {/* ==============================================
              MY ACTIVITIES
          ============================================== */}

          <section
            id="my-activities"
            className={
              styles.activitiesSection
            }
          >
            <div
              className={
                styles.sectionHead
              }
            >
              <div>

                <h2>
                  الأنشطة المسجل فيها
                </h2>
              </div>

              <small>
                تابع حالة تسجيلك
                وتفاصيل مشاركتك
              </small>
            </div>

            <div
              className={
                styles.activityTabs
              }
              aria-label="تصفية الأنشطة المسجل فيها"
            >
              <Link
                href="/student?activityTab=all#my-activities"
                className={`${styles.activityTab} ${activityTab === "all"
                  ? styles.activityTabActive
                  : ""
                  }`}
              >
                <span>الكل</span>
                <strong>
                  {submissions.length}
                </strong>
              </Link>

              <Link
                href="/student?activityTab=upcoming#my-activities"
                className={`${styles.activityTab} ${activityTab === "upcoming"
                  ? styles.activityTabActive
                  : ""
                  }`}
              >
                <span>القادمة</span>
                <strong>
                  {upcomingSubmissions.length}
                </strong>
              </Link>

              <Link
                href="/student?activityTab=past#my-activities"
                className={`${styles.activityTab} ${activityTab === "past"
                  ? styles.activityTabActive
                  : ""
                  }`}
              >
                <span>السابقة</span>
                <strong>
                  {pastSubmissions.length}
                </strong>
              </Link>

              <Link
                href="/student?activityTab=rejected#my-activities"
                className={`${styles.activityTab} ${activityTab === "rejected"
                  ? styles.activityTabActive
                  : ""
                  }`}
              >
                <span>المرفوضة</span>
                <strong>
                  {rejectedSubmissions.length}
                </strong>
              </Link>
            </div>

            {filteredSubmissions.length ? (
              <div
                className={
                  styles.activityList
                }
              >
                {filteredSubmissions.map(
                  (submission) => {
                    const activity =
                      submission.form
                        .activity;

                    const isUpcoming =
                      activity.startsAt >=
                      now;

                    const answers = [
                      ...submission.answers,
                    ].sort(
                      (a, b) =>
                        a.question
                          .sortOrder -
                        b.question
                          .sortOrder,
                    );

                    return (
                      <article
                        key={
                          submission.id
                        }
                        className={
                          styles.registrationCard
                        }
                      >
                        {/* TOP */}

                        <div
                          className={
                            styles.registrationCardHeader
                          }
                        >
                          <div
                            className={
                              styles.registrationTitleArea
                            }
                          >
                            <div
                              className={
                                styles.registrationBadges
                              }
                            >
                              <span
                                className={`${styles.statusBadge} ${submission.status ===
                                  "APPROVED"
                                  ? styles.approved
                                  : submission.status ===
                                    "REJECTED"
                                    ? styles.rejected
                                    : styles.pending
                                  }`}
                              >
                                {
                                  statusLabels[
                                  submission
                                    .status
                                  ]
                                }
                              </span>

                              <span
                                className={
                                  isUpcoming
                                    ? styles.upcomingBadge
                                    : styles.finishedBadge
                                }
                              >
                                {isUpcoming
                                  ? "نشاط قادم"
                                  : "نشاط سابق"}
                              </span>
                            </div>

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

                          <div
                            className={
                              styles.registrationDateBox
                            }
                          >
                            <span>
                              موعد النشاط
                            </span>

                            <strong>
                              {formatDate(
                                activity.startsAt,
                              )}
                            </strong>
                          </div>
                        </div>

                        {/* META */}

                        <div
                          className={
                            styles.registrationMetaGrid
                          }
                        >
                          <div>
                            <span>
                              المكان
                            </span>

                            <strong>
                              {
                                activity.location
                              }
                            </strong>
                          </div>

                          <div>
                            <span>
                              تاريخ التسجيل
                            </span>

                            <strong>
                              {formatDate(
                                submission.submittedAt,
                              )}
                            </strong>
                          </div>

                          <div>
                            <span>
                              حالة الطلب
                            </span>

                            <strong>
                              {
                                statusLabels[
                                submission
                                  .status
                                ]
                              }
                            </strong>
                          </div>
                        </div>

                        {/* REGISTRATION DETAILS */}

                        <details
                          className={
                            styles.registrationDetails
                          }
                        >
                          <summary>
                            <span>
                              تفاصيل تسجيلي
                            </span>

                            <small>
                              عرض الإجابات
                              التي قدمتها
                            </small>
                          </summary>

                          <div
                            className={
                              styles.registrationAnswers
                            }
                          >
                            <div
                              className={
                                styles.registrationAnswersHeader
                              }
                            >
                              <div>
                                <span>
                                  نموذج التسجيل
                                </span>

                                <h4>
                                  {
                                    submission
                                      .form
                                      .title
                                  }
                                </h4>
                              </div>

                              <small>
                                {
                                  answers.length
                                }{" "}
                                إجابة
                              </small>
                            </div>

                            {answers.length ? (
                              <div
                                className={
                                  styles.answerList
                                }
                              >
                                {answers.map(
                                  (
                                    answer,
                                    index,
                                  ) => (
                                    <div
                                      key={
                                        answer.id
                                      }
                                      className={
                                        styles.answerItem
                                      }
                                    >
                                      <span
                                        className={
                                          styles.answerNumber
                                        }
                                      >
                                        {index +
                                          1}
                                      </span>

                                      <div>
                                        <span
                                          className={
                                            styles.answerQuestion
                                          }
                                        >
                                          {
                                            answer
                                              .question
                                              .label
                                          }
                                        </span>

                                        <strong
                                          className={
                                            styles.answerValue
                                          }
                                        >
                                          {formatAnswer(
                                            answer.value,
                                          )}
                                        </strong>
                                      </div>
                                    </div>
                                  ),
                                )}
                              </div>
                            ) : (
                              <div
                                className={
                                  styles.noAnswers
                                }
                              >
                                لا توجد
                                إجابات محفوظة
                                لهذا التسجيل.
                              </div>
                            )}
                          </div>
                        </details>

                        {/* ACTIONS */}

                        <div
                          className={
                            styles.registrationActions
                          }
                        >
                          <Link
                            href={`/activities/${activity.id}/register`}
                            className={
                              styles.secondaryButton
                            }
                          >
                            فتح صفحة النشاط
                          </Link>

                          {submission.status ===
                            "APPROVED" && (
                              <StudentAcceptanceCard
                                studentName={user.name}
                                studentNumber={
                                  user.studentNumber
                                }
                                departmentName={
                                  user.department?.nameAr ??
                                  "غير محدد"
                                }
                                activityTitle={
                                  activity.title
                                }
                                activityLocation={
                                  activity.location
                                }
                                activityDate={formatDate(
                                  activity.startsAt,
                                )}
                                checkInToken={
                                  submission.checkInToken
                                }
                                checkedInAt={
                                  submission.checkedInAt
                                    ? formatDate(
                                      submission.checkedInAt,
                                    )
                                    : null
                                }
                              />
                            )}

                          {isUpcoming &&
                            submission.status !==
                            "REJECTED" && (
                              <StudentCancelRegistrationButton
                                submissionId={
                                  submission.id
                                }
                                activityTitle={
                                  activity.title
                                }
                              />
                            )}
                        </div>                      </article>
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
                <div
                  className={
                    styles.emptyIcon
                  }
                >
                  +
                </div>

                <h3>
                  {activityTab ===
                    "upcoming"
                    ? "ما عندك أنشطة قادمة"
                    : activityTab ===
                      "past"
                      ? "ما عندك أنشطة سابقة"
                      : activityTab ===
                        "rejected"
                        ? "ما عندك تسجيلات مرفوضة"
                        : "لسا ما سجلت بأي نشاط"}
                </h3>

                <p>
                  {activityTab === "all"
                    ? "استكشف الأنشطة المنشورة وسجّل في النشاط المناسب لك."
                    : "لا توجد تسجيلات ضمن هذا التصنيف حاليًا."}
                </p>

                <Link
                  href="/activities"
                  className={
                    styles.primaryButton
                  }
                >
                  تصفح الأنشطة
                </Link>
              </div>
            )}
          </section>
        </div>
      </section>
    </main>
  );
}