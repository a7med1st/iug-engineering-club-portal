import type { Prisma } from "@prisma/client";
import Link from "next/link";
import { notFound } from "next/navigation";

import AdminFeedback from "@/components/admin/AdminFeedback";
import {
    PERMISSIONS,
    requirePermission,
} from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

import {
    updateActivityArchiveState,
    updateRegistrationAttendance,
    updateRegistrationSettings,
    updateRegistrationStatus,
} from "./actions";
import {
    Archive,
    BarChart3,
    CalendarDays,
    Download,
    MapPin,
    QrCode,
    RotateCcw,
} from "lucide-react";
import attendanceStyles from "./attendance.module.css";
export const dynamic = "force-dynamic";

type Props = {
    params: Promise<{
        id: string;
    }>;

    searchParams: Promise<{
        q?: string;
        status?: string;
        attendance?: string;
        error?: string;
        success?: string;
    }>;
};

const statusLabels = {
    SUBMITTED: "قيد المراجعة",
    APPROVED: "مقبول",
    REJECTED: "مرفوض",
} as const;

const allowedFilters = [
    "ALL",
    "SUBMITTED",
    "APPROVED",
    "REJECTED",
] as const;

const allowedAttendanceFilters = [
    "ALL",
    "PRESENT",
    "ABSENT",
] as const;

function formatAnswer(
    value: Prisma.JsonValue,
) {
    if (Array.isArray(value)) {
        return value
            .map((item) => String(item))
            .join("، ");
    }

    if (
        value === null ||
        value === undefined
    ) {
        return "—";
    }

    if (typeof value === "object") {
        return JSON.stringify(value);
    }

    return String(value);
}

export default async function ActivityRegistrationsPage({
    params,
    searchParams,
}: Props) {
    await requirePermission(
        PERMISSIONS.REGISTRATION_REVIEW,
    );

    const { id } = await params;

    const filters = await searchParams;

    const query =
        filters.q?.trim() ?? "";

    const requestedStatus =
        filters.status?.trim() ??
        "ALL";

    const status = allowedFilters.includes(
        requestedStatus as
        (typeof allowedFilters)[number],
    )
        ? requestedStatus
        : "ALL";

    const requestedAttendance =
        filters.attendance?.trim() ??
        "ALL";

    const attendance =
        allowedAttendanceFilters.includes(
            requestedAttendance as
            (typeof allowedAttendanceFilters)[number],
        )
            ? requestedAttendance
            : "ALL";

    const activity =
        await prisma.activity.findUnique({
            where: {
                id,
            },

            include: {
                registrationForm: {
                    include: {
                        questions: {
                            orderBy: {
                                sortOrder: "asc",
                            },
                        },

                        submissions: {
                            where: {
                                ...(status !== "ALL"
                                    ? {
                                        status: status as
                                            | "SUBMITTED"
                                            | "APPROVED"
                                            | "REJECTED",
                                    }
                                    : {}),

                                ...(attendance === "PRESENT"
                                    ? {
                                        status: "APPROVED",
                                        checkedInAt: {
                                            not: null,
                                        },
                                    }
                                    : attendance === "ABSENT"
                                        ? {
                                            status: "APPROVED",
                                            checkedInAt: null,
                                        }
                                        : {}),

                                ...(query
                                    ? {
                                        OR: [
                                            {
                                                studentName: {
                                                    contains:
                                                        query,
                                                    mode: "insensitive",
                                                },
                                            },

                                            {
                                                studentEmail: {
                                                    contains:
                                                        query,
                                                    mode: "insensitive",
                                                },
                                            },

                                            {
                                                studentDepartment:
                                                {
                                                    contains:
                                                        query,
                                                    mode: "insensitive",
                                                },
                                            },
                                        ],
                                    }
                                    : {}),
                            },

                            include: {
                                answers: {
                                    include: {
                                        question: true,
                                    },
                                },
                            },

                            orderBy: {
                                submittedAt: "desc",
                            },
                        },
                    },
                },
            },
        });

    if (!activity) {
        notFound();
    }

    const form =
        activity.registrationForm;

    if (!form) {
        return (
            <section className="admin-page">

                <div className="admin-page-head">

                    <div>
                        <h1>
                            إدارة المسجلين
                        </h1>

                        <p className="muted">
                            {activity.title}
                        </p>
                    </div>

                </div>


                <div className="admin-card">

                    <div className="activity-registration-admin-empty">

                        <h2>
                            لا يوجد نموذج تسجيل
                        </h2>

                        <p>
                            هذا النشاط لا يحتوي على
                            نموذج تسجيل داخلي.
                        </p>

                        <Link
                            href="/admin/activities"
                            className="ghost-btn"
                        >
                            العودة إلى الأنشطة
                        </Link>

                    </div>

                </div>

            </section>
        );
    }

    /*
     * نحتاج إحصائيات جميع التسجيلات
     * بدون التأثر بالبحث والفلترة.
     */
    const statusCounts =
        await prisma.activityFormSubmission.groupBy({
            by: ["status"],

            where: {
                formId: form.id,
            },

            _count: {
                _all: true,
            },
        });

    const totalCount =
        statusCounts.reduce(
            (
                sum,
                item,
            ) =>
                sum +
                item._count._all,
            0,
        );

    const submittedCount =
        statusCounts.find(
            (item) =>
                item.status ===
                "SUBMITTED",
        )?._count._all ?? 0;

    const approvedCount =
        statusCounts.find(
            (item) =>
                item.status ===
                "APPROVED",
        )?._count._all ?? 0;

    const rejectedCount =
        statusCounts.find(
            (item) =>
                item.status ===
                "REJECTED",
        )?._count._all ?? 0;

    const checkedInCount =
        await prisma.activityFormSubmission.count({
            where: {
                formId: form.id,
                status: "APPROVED",
                checkedInAt: {
                    not: null,
                },
            },
        });

    const absentApprovedCount =
        Math.max(
            approvedCount -
            checkedInCount,
            0,
        );

    const occupiedSeats =
        submittedCount +
        approvedCount;

    const remaining =
        Math.max(
            activity.capacity -
            occupiedSeats,
            0,
        );

    const attendanceRate =
        approvedCount > 0
            ? Math.round(
                (checkedInCount /
                    approvedCount) *
                    100,
            )
            : 0;

    const isArchived =
        activity.status ===
        "ARCHIVED";

    return (
        <section className="admin-page activity-registrations-admin">

            {/* ===================================================
          HEADER
      =================================================== */}

            <div className="admin-page-head">

                <div>

                    <Link
                        href="/admin/activities"
                        className="activity-admin-back"
                    >
                        ← العودة إلى الأنشطة
                    </Link>

                    <h1>
                        إدارة المسجلين
                    </h1>

                    <p className="muted">
                        {activity.title}
                    </p>

                </div>

                <div
                    className={
                        attendanceStyles.headerActions
                    }
                >
                    {!isArchived && (
                        <Link
                            href={`/admin/activities/${activity.id}/check-in`}
                            className="primary-btn"
                        >
                            <QrCode size={18} />
                            تسجيل الحضور
                        </Link>
                    )}

                    <Link
                        href={`/admin/activities/${activity.id}/registrations/export`}
                        className="ghost-btn activity-registration-export"
                    >
                        <Download size={17} />
                        تصدير Excel
                    </Link>

                    <form
                        action={
                            updateActivityArchiveState
                        }
                    >
                        <input
                            type="hidden"
                            name="activityId"
                            value={activity.id}
                        />

                        <input
                            type="hidden"
                            name="activityState"
                            value={
                                isArchived
                                    ? "PUBLISHED"
                                    : "ARCHIVED"
                            }
                        />

                        <button
                            type="submit"
                            className={
                                isArchived
                                    ? attendanceStyles.restoreActivityButton
                                    : attendanceStyles.archiveActivityButton
                            }
                        >
                            {isArchived ? (
                                <RotateCcw
                                    size={17}
                                />
                            ) : (
                                <Archive
                                    size={17}
                                />
                            )}

                            {isArchived
                                ? "إعادة النشاط"
                                : "أرشفة النشاط"}
                        </button>
                    </form>
                </div>

            </div>


            <AdminFeedback
                error={filters.error}
                success={filters.success}
            />

            {/* ===================================================
                ACTIVITY RESULTS SUMMARY
            =================================================== */}

            <section
                className={
                    attendanceStyles.activitySummary
                }
            >
                <div
                    className={
                        attendanceStyles.activitySummaryHead
                    }
                >
                    <div>
                        <span
                            className={
                                attendanceStyles.activitySummaryEyebrow
                            }
                        >
                            <BarChart3
                                size={16}
                            />
                            ملخص النشاط
                        </span>

                        <h2>
                            نتائج التسجيل والحضور
                        </h2>

                        <p>
                            ملخص سريع لأهم أرقام النشاط وحالة الحضور.
                        </p>
                    </div>

                    <span
                        className={`${attendanceStyles.activityStatusBadge} ${
                            isArchived
                                ? attendanceStyles.activityArchived
                                : attendanceStyles.activityPublished
                        }`}
                    >
                        {isArchived
                            ? "مؤرشف"
                            : "منشور"}
                    </span>
                </div>

                <div
                    className={
                        attendanceStyles.activityMetaRow
                    }
                >
                    <div>
                        <CalendarDays
                            size={18}
                        />

                        <span>
                            {new Intl.DateTimeFormat(
                                "ar-PS",
                                {
                                    dateStyle:
                                        "medium",
                                    timeStyle:
                                        "short",
                                },
                            ).format(
                                activity.startsAt,
                            )}
                        </span>
                    </div>

                    <div>
                        <MapPin size={18} />

                        <span>
                            {activity.location}
                        </span>
                    </div>
                </div>

                <div
                    className={
                        attendanceStyles.activityResultsGrid
                    }
                >
                    <div>
                        <span>
                            إجمالي التسجيلات
                        </span>

                        <strong>
                            {totalCount}
                        </strong>
                    </div>

                    <div>
                        <span>
                            المقبولون
                        </span>

                        <strong>
                            {approvedCount}
                        </strong>
                    </div>

                    <div>
                        <span>
                            الحضور الفعلي
                        </span>

                        <strong>
                            {checkedInCount}
                        </strong>
                    </div>

                    <div>
                        <span>
                            لم يحضروا
                        </span>

                        <strong>
                            {absentApprovedCount}
                        </strong>
                    </div>
                </div>

                <div
                    className={
                        attendanceStyles.attendanceRateBlock
                    }
                >
                    <div
                        className={
                            attendanceStyles.attendanceRateHead
                        }
                    >
                        <div>
                            <strong>
                                نسبة الحضور
                            </strong>

                            <span>
                                من إجمالي الطلاب المقبولين
                            </span>
                        </div>

                        <strong>
                            {attendanceRate}%
                        </strong>
                    </div>

                    <div
                        className={
                            attendanceStyles.attendanceProgress
                        }
                    >
                        <span
                            style={{
                                width:
                                    `${attendanceRate}%`,
                            }}
                        />
                    </div>
                </div>

                {isArchived && (
                    <div
                        className={
                            attendanceStyles.archivedNotice
                        }
                    >
                        تم أرشفة هذا النشاط وإغلاق التسجيل. يمكنك الاحتفاظ بالنتائج وتصديرها إلى Excel، أو إعادة النشاط إلى حالة منشور عند الحاجة.
                    </div>
                )}
            </section>

{/* ===================================================
    REGISTRATION SETTINGS
=================================================== */}

<div className="admin-card activity-registration-settings">

    <div className="activity-registration-settings-head">

        <div>
            <span className="activity-registration-settings-eyebrow">
                إعدادات التسجيل
            </span>

            <h2>
                التحكم بالتسجيل
            </h2>

            <p>
                تحكم في عدد المقاعد المتاحة وفتح أو إغلاق التسجيل للطلاب.
            </p>
        </div>

        <span
            className={`activity-registration-open-state ${
                form.isOpen
                    ? "is-open"
                    : "is-closed"
            }`}
        >
            <span className="registration-state-dot" />

            {form.isOpen
                ? "التسجيل مفتوح"
                : "التسجيل مغلق"}
        </span>

    </div>


    <form
        action={updateRegistrationSettings}
        className="activity-registration-settings-form"
    >
        <input
            type="hidden"
            name="activityId"
            value={activity.id}
        />


        {/* السعة */}

        <div className="registration-setting-box">

            <div className="registration-setting-box-head">
                <div>
                    <strong>
                        السعة الطلابية
                    </strong>

                    <span>
                        العدد الأقصى للمقاعد الفعلية
                    </span>
                </div>
            </div>

            <div className="registration-capacity-control">

                <input
                    type="number"
                    name="capacity"
                    min={Math.max(
                        1,
                        occupiedSeats,
                    )}
                    max="100000"
                    defaultValue={
                        activity.capacity
                    }
                    required
                    disabled={isArchived}
                />

                <span>
                    مقعد
                </span>

            </div>

            <small>
                المشغول حاليًا:
                {" "}
                <strong>
                    {occupiedSeats}
                </strong>
                {" "}
                مقعد
            </small>

        </div>


        {/* فتح / إغلاق */}

        <div className="registration-setting-box">

            <div className="registration-setting-box-head">

                <div>
                    <strong>
                        حالة التسجيل
                    </strong>

                    <span>
                        تحكم بإمكانية تسجيل الطلاب
                    </span>
                </div>

            </div>


            <label className="registration-switch-row">

                <div className="registration-switch-text">

                    <strong>
                        السماح بالتسجيل
                    </strong>

                    <span>
                        {form.isOpen
                            ? "يمكن للطلاب التسجيل في النشاط حاليًا"
                            : "التسجيل متوقف أمام الطلاب حاليًا"}
                    </span>

                </div>


                <span className="registration-switch">

                    <input
                        type="checkbox"
                        name="isOpen"
                        defaultChecked={
                            form.isOpen
                        }
                        disabled={isArchived}
                    />

                    <span className="registration-switch-track">
                        <span className="registration-switch-thumb" />
                    </span>

                </span>

            </label>

        </div>


        {/* زر الحفظ */}

        <div className="registration-settings-save">

            <div>
                <strong>
                    المقاعد المتبقية
                </strong>

                <span>
                    {remaining} من أصل{" "}
                    {activity.capacity}
                </span>
            </div>

            <button
                type="submit"
                className="primary-btn registration-settings-save-btn"
                disabled={isArchived}
            >
                {isArchived
                    ? "النشاط مؤرشف"
                    : "حفظ التغييرات"}
            </button>

        </div>

    </form>

</div>


            {/* ===================================================
          STATS
      =================================================== */}

            <div className="activity-registration-stats">

                <div className="activity-registration-stat">
                    <span>
                        إجمالي التسجيلات
                    </span>

                    <strong>
                        {totalCount}
                    </strong>

                    <small>
                        يشمل المقبولين والمرفوضين وقيد المراجعة
                    </small>
                </div>


                <div className="activity-registration-stat">
                    <span>
                        قيد المراجعة
                    </span>

                    <strong>
                        {submittedCount}
                    </strong>
                </div>


                <div className="activity-registration-stat">
                    <span>
                        المقبولون
                    </span>

                    <strong>
                        {approvedCount}
                    </strong>
                </div>


                <div className={`activity-registration-stat ${attendanceStyles.attendanceStatPresent}`}>
                    <span>
                        حضروا
                    </span>

                    <strong>
                        {checkedInCount}
                    </strong>

                    <small>
                        تم تسجيل دخولهم بالـ QR
                    </small>
                </div>


                <div className={`activity-registration-stat ${attendanceStyles.attendanceStatAbsent}`}>
                    <span>
                        لم يحضروا
                    </span>

                    <strong>
                        {absentApprovedCount}
                    </strong>

                    <small>
                        من الطلاب المقبولين
                    </small>
                </div>


                <div className="activity-registration-stat">
                    <span>
                        المرفوضون
                    </span>

                    <strong>
                        {rejectedCount}
                    </strong>
                </div>


                <div className="activity-registration-stat">
                    <span>
                        المقاعد المتبقية
                    </span>

                    <strong>
                        {remaining}
                    </strong>
                    <small>
                        من أصل {activity.capacity} مقعد
                    </small>

                </div>

            </div>


            {/* ===================================================
          FILTERS
      =================================================== */}

            <div className="admin-card activity-registration-filters">

                <form
                    method="get"
                    className="activity-registration-filter-form"
                >

                    <label>
                        البحث

                        <input
                            type="search"
                            name="q"
                            defaultValue={query}
                            placeholder="الاسم، البريد أو التخصص..."
                        />
                    </label>


                    <label>
                        الحالة

                        <select
                            name="status"
                            defaultValue={status}
                        >
                            <option value="ALL">
                                جميع الحالات
                            </option>

                            <option value="SUBMITTED">
                                قيد المراجعة
                            </option>

                            <option value="APPROVED">
                                المقبولون
                            </option>

                            <option value="REJECTED">
                                المرفوضون
                            </option>
                        </select>
                    </label>


                    <label>
                        الحضور

                        <select
                            name="attendance"
                            defaultValue={attendance}
                        >
                            <option value="ALL">
                                الكل
                            </option>

                            <option value="PRESENT">
                                حضر
                            </option>

                            <option value="ABSENT">
                                لم يحضر
                            </option>
                        </select>
                    </label>


                    <button
                        type="submit"
                        className="primary-btn"
                    >
                        تطبيق
                    </button>


                    {(query ||
                        status !== "ALL" ||
                        attendance !== "ALL") && (
                            <Link
                                href={`/admin/activities/${activity.id}/registrations`}
                                className="ghost-btn"
                            >
                                مسح الفلاتر
                            </Link>
                        )}

                </form>

            </div>


            {/* ===================================================
          REGISTRATIONS
      =================================================== */}

            <div className="activity-registration-admin-list">

                {form.submissions.length ? (
                    form.submissions.map(
                        (submission) => {

                            const answerMap =
                                new Map(
                                    submission.answers.map(
                                        (answer) => [
                                            answer.questionId,
                                            answer.value,
                                        ],
                                    ),
                                );

                            return (
                                <article
                                    className="activity-registration-admin-card"
                                    key={submission.id}
                                >

                                    {/* =======================================
                      STUDENT HEADER
                  ======================================= */}

                                    <div className="activity-registration-admin-card-head">

                                        <div className="activity-registration-student">

                                            <div className="activity-registration-avatar">
                                                {submission.studentName
                                                    .trim()
                                                    .charAt(0)
                                                    .toUpperCase()}
                                            </div>


                                            <div>

                                                <h2>
                                                    {
                                                        submission.studentName
                                                    }
                                                </h2>

                                                <div className="activity-registration-student-meta">

                                                    <span>
                                                        {
                                                            submission.studentEmail
                                                        }
                                                    </span>

                                                    {submission.studentDepartment && (
                                                        <span>
                                                            {
                                                                submission.studentDepartment
                                                            }
                                                        </span>
                                                    )}

                                                    <span>
                                                        {new Intl.DateTimeFormat(
                                                            "ar-PS",
                                                            {
                                                                dateStyle:
                                                                    "medium",

                                                                timeStyle:
                                                                    "short",
                                                            },
                                                        ).format(
                                                            submission.submittedAt,
                                                        )}
                                                    </span>

                                                </div>

                                            </div>

                                        </div>


                                        <div className={attendanceStyles.statusStack}>
                                            <span
                                                className={`activity-registration-status status-${submission.status.toLowerCase()}`}
                                            >
                                                {
                                                    statusLabels[
                                                    submission.status
                                                    ]
                                                }
                                            </span>

                                            {submission.status === "APPROVED" && (
                                                <div className={attendanceStyles.attendanceStateWrap}>
                                                    <span
                                                        className={`${attendanceStyles.attendanceBadge} ${
                                                            submission.checkedInAt
                                                                ? attendanceStyles.attendancePresent
                                                                : attendanceStyles.attendanceAbsent
                                                        }`}
                                                    >
                                                        <span className={attendanceStyles.attendanceDot} />

                                                        {submission.checkedInAt
                                                            ? "حضر"
                                                            : "لم يحضر"}
                                                    </span>

                                                    {submission.checkedInAt && (
                                                        <small className={attendanceStyles.attendanceTime}>
                                                            وقت الحضور:{" "}
                                                            {new Intl.DateTimeFormat(
                                                                "ar-PS",
                                                                {
                                                                    dateStyle: "medium",
                                                                    timeStyle: "short",
                                                                },
                                                            ).format(
                                                                submission.checkedInAt,
                                                            )}
                                                        </small>
                                                    )}
                                                </div>
                                            )}
                                        </div>

                                    </div>


                                    {/* =======================================
                      ANSWERS
                  ======================================= */}

                                    <details className="activity-registration-answers">

                                        <summary>
                                            عرض إجابات الطالب
                                        </summary>


                                        <div className="activity-registration-answers-grid">

                                            {form.questions.map(
                                                (question) => {

                                                    const answer =
                                                        answerMap.get(
                                                            question.id,
                                                        );

                                                    return (
                                                        <div
                                                            className="activity-registration-answer"
                                                            key={
                                                                question.id
                                                            }
                                                        >

                                                            <strong>
                                                                {
                                                                    question.label
                                                                }
                                                            </strong>

                                                            <p>
                                                                {answer !==
                                                                    undefined
                                                                    ? formatAnswer(
                                                                        answer,
                                                                    )
                                                                    : "لم تتم الإجابة"}
                                                            </p>

                                                        </div>
                                                    );
                                                },
                                            )}

                                        </div>

                                    </details>


                                    {/* =======================================
                      ACTIONS
                  ======================================= */}

                                    <div className="activity-registration-review-actions">

                                        {!isArchived &&
                                            submission.status === "APPROVED" && (
                                            <form
                                                action={
                                                    updateRegistrationAttendance
                                                }
                                            >
                                                <input
                                                    type="hidden"
                                                    name="activityId"
                                                    value={
                                                        activity.id
                                                    }
                                                />

                                                <input
                                                    type="hidden"
                                                    name="submissionId"
                                                    value={
                                                        submission.id
                                                    }
                                                />

                                                <input
                                                    type="hidden"
                                                    name="attendanceAction"
                                                    value={
                                                        submission.checkedInAt
                                                            ? "CHECK_OUT"
                                                            : "CHECK_IN"
                                                    }
                                                />

                                                <button
                                                    type="submit"
                                                    className={
                                                        submission.checkedInAt
                                                            ? attendanceStyles.manualCheckoutButton
                                                            : attendanceStyles.manualCheckinButton
                                                    }
                                                >
                                                    {submission.checkedInAt
                                                        ? "إلغاء الحضور"
                                                        : "تسجيل حضور"}
                                                </button>
                                            </form>
                                        )}


                                        {submission.status !==
                                            "APPROVED" && (
                                                <form
                                                    action={
                                                        updateRegistrationStatus
                                                    }
                                                >
                                                    <input
                                                        type="hidden"
                                                        name="activityId"
                                                        value={
                                                            activity.id
                                                        }
                                                    />

                                                    <input
                                                        type="hidden"
                                                        name="submissionId"
                                                        value={
                                                            submission.id
                                                        }
                                                    />

                                                    <input
                                                        type="hidden"
                                                        name="status"
                                                        value="APPROVED"
                                                    />

                                                    <button
                                                        type="submit"
                                                        className="activity-registration-approve"
                                                    >
                                                        قبول
                                                    </button>
                                                </form>
                                            )}


                                        {submission.status !==
                                            "REJECTED" && (
                                                <form
                                                    action={
                                                        updateRegistrationStatus
                                                    }
                                                >
                                                    <input
                                                        type="hidden"
                                                        name="activityId"
                                                        value={
                                                            activity.id
                                                        }
                                                    />

                                                    <input
                                                        type="hidden"
                                                        name="submissionId"
                                                        value={
                                                            submission.id
                                                        }
                                                    />

                                                    <input
                                                        type="hidden"
                                                        name="status"
                                                        value="REJECTED"
                                                    />

                                                    <button
                                                        type="submit"
                                                        className="activity-registration-reject"
                                                    >
                                                        رفض
                                                    </button>
                                                </form>
                                            )}


                                        {submission.status !==
                                            "SUBMITTED" && (
                                                <form
                                                    action={
                                                        updateRegistrationStatus
                                                    }
                                                >
                                                    <input
                                                        type="hidden"
                                                        name="activityId"
                                                        value={
                                                            activity.id
                                                        }
                                                    />

                                                    <input
                                                        type="hidden"
                                                        name="submissionId"
                                                        value={
                                                            submission.id
                                                        }
                                                    />

                                                    <input
                                                        type="hidden"
                                                        name="status"
                                                        value="SUBMITTED"
                                                    />

                                                    <button
                                                        type="submit"
                                                        className="activity-registration-pending"
                                                    >
                                                        إعادة للمراجعة
                                                    </button>
                                                </form>
                                            )}

                                    </div>

                                </article>
                            );
                        },
                    )
                ) : (
                    <div className="admin-card">

                        <p className="empty-state">
                            {query ||
                                status !== "ALL" ||
                                attendance !== "ALL"
                                ? "لا توجد تسجيلات تطابق البحث أو الفلترة."
                                : "لا يوجد طلاب مسجلون في هذا النشاط بعد."}
                        </p>

                    </div>
                )}

            </div>

        </section>
    );
}