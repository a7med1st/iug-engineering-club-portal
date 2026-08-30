import type { Prisma } from "@prisma/client";
import Link from "next/link";
import { notFound } from "next/navigation";

import AdminFeedback from "@/components/admin/AdminFeedback";
import ActivityDateEditor from "@/components/admin/ActivityDateEditor";
import ActivityLocationEditor from "@/components/admin/ActivityLocationEditor";
import RegistrationFilterSelect from "@/components/admin/RegistrationFilterSelect";
import {
    ACTIVITY_TIME_ZONE,
    activityDateTimeInputValues,
} from "@/lib/activities";
import {
    PERMISSIONS,
    hasPermission,
    requireActivityPermission,
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
    ArrowRight,
    BadgeCheck,
    BarChart3,
    CalendarDays,
    CheckCircle2,
    ClipboardList,
    Clock3,
    Download,
    Inbox,
    MapPin,
    QrCode,
    RotateCcw,
    Save,
    Search,
    SlidersHorizontal,
    TrendingUp,
    Users,
    XCircle,
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
    const { id } = await params;

    const { user } =
        await requireActivityPermission(
            PERMISSIONS.REGISTRATION_REVIEW,
            id,
        );

    const canArchive =
        hasPermission(
            user.role,
            PERMISSIONS.ACTIVITY_ARCHIVE,
            user.memberPermissions,
        );

    const canChangeSettings =
        hasPermission(
            user.role,
            PERMISSIONS.REGISTRATION_SETTINGS,
            user.memberPermissions,
        );

    const canEditActivity =
        hasPermission(
            user.role,
            PERMISSIONS.ACTIVITY_MANAGE,
            user.memberPermissions,
        );

    const canManualAttendance =
        hasPermission(
            user.role,
            PERMISSIONS.ATTENDANCE_MANUAL,
            user.memberPermissions,
        );

    const canExport =
        hasPermission(
            user.role,
            PERMISSIONS.REGISTRATION_EXPORT,
            user.memberPermissions,
        );

    const canAdminScanner =
        hasPermission(
            user.role,
            PERMISSIONS.REGISTRATION_MANAGE,
            user.memberPermissions,
        );

    const canMemberScanner =
        hasPermission(
            user.role,
            PERMISSIONS.ATTENDANCE_SCAN,
            user.memberPermissions,
        );

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

    const activityDateTime =
        activityDateTimeInputValues(
            activity.startsAt,
        );

    const activityEndDateTime = activity.endsAt
        ? activityDateTimeInputValues(activity.endsAt)
        : null;

    return (
        <section
            className={`admin-page activity-registrations-admin ${attendanceStyles.page}`}
        >
            <div className={attendanceStyles.pageDecorations} aria-hidden="true">
                <span />
                <span />
            </div>

            {/* ===================================================
          HEADER
      =================================================== */}

            <header className={attendanceStyles.hero}>
                <div className={attendanceStyles.heroGlow} aria-hidden="true" />

                <div className={attendanceStyles.heroCopy}>
                    <Link
                        href="/admin/activities"
                        className={`activity-admin-back ${attendanceStyles.backLink}`}
                    >
                        <ArrowRight size={16} aria-hidden="true" />
                        <span>العودة إلى الأنشطة</span>
                    </Link>

                    <h1>
                        إدارة المسجلين
                    </h1>

                    <p>
                        {activity.title}
                    </p>

                    <div className={attendanceStyles.heroMeta}>
                        <span
                            className={`${attendanceStyles.heroStatus} ${
                                isArchived
                                    ? attendanceStyles.heroStatusArchived
                                    : attendanceStyles.heroStatusPublished
                            }`}
                        >
                            <span aria-hidden="true" />
                            {isArchived ? "مؤرشف" : "منشور"}
                        </span>

                        <span>
                            <CalendarDays size={16} aria-hidden="true" />
                            {new Intl.DateTimeFormat("ar-PS", {
                                dateStyle: "medium",
                                timeStyle: "short",
                                timeZone: ACTIVITY_TIME_ZONE,
                            }).format(activity.startsAt)}
                        </span>

                        <span>
                            <MapPin size={16} aria-hidden="true" />
                            {activity.location}
                        </span>
                    </div>
                </div>
            </header>

            <section className={attendanceStyles.actionToolbar}>
                <div className={attendanceStyles.toolbarHeading}>
                    <span aria-hidden="true">
                        <SlidersHorizontal size={19} />
                    </span>

                    <div>
                        <h2>إجراءات النشاط</h2>
                        <p>الوصول السريع لأهم أدوات إدارة النشاط.</p>
                    </div>
                </div>

                <div
                    className={
                        attendanceStyles.headerActions
                    }
                >
                    {!isArchived &&
                        (canAdminScanner ||
                            canMemberScanner) && (
                            <Link
                                href={
                                    canAdminScanner
                                        ? `/admin/activities/${activity.id}/check-in`
                                        : `/member/check-in/${activity.id}`
                                }
                                className={`primary-btn ${attendanceStyles.primaryAction}`}
                            >
                                <QrCode size={18} />
                                تسجيل الحضور
                            </Link>
                        )}

                    {canExport && (
                        <Link
                            href={`/admin/activities/${activity.id}/registrations/export`}
                            className={`ghost-btn activity-registration-export ${attendanceStyles.secondaryAction}`}
                            data-no-page-transition
                        >
                            <Download size={17} />
                            تصدير Excel
                        </Link>
                    )}

                    {canArchive && (
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
                    )}
                </div>
            </section>


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
                    <div className={attendanceStyles.summaryHeading}>
                        <span className={attendanceStyles.sectionIcon} aria-hidden="true">
                            <BarChart3 size={22} />
                        </span>

                        <div>
                            <h2>
                                نتائج التسجيل والحضور
                            </h2>

                            <p>
                                ملخص سريع لأهم أرقام النشاط وحالة الحضور.
                            </p>
                        </div>
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

                        <span className={attendanceStyles.activityMetaValue}>
                            <small>تاريخ البداية</small>
                            {new Intl.DateTimeFormat(
                                "ar-PS",
                                {
                                    dateStyle:
                                        "medium",
                                    timeZone:
                                        ACTIVITY_TIME_ZONE,
                                },
                            ).format(
                                activity.startsAt,
                            )}
                        </span>
                    </div>

                    <div>
                        <Clock3 size={18} />

                        <span className={attendanceStyles.activityMetaValue}>
                            <small>وقت البداية</small>
                            {new Intl.DateTimeFormat("ar-PS", {
                                timeStyle: "short",
                                timeZone: ACTIVITY_TIME_ZONE,
                            }).format(activity.startsAt)}
                        </span>
                    </div>

                    {activity.endsAt && (
                        <>
                            <div>
                                <CalendarDays size={18} />

                                <span className={attendanceStyles.activityMetaValue}>
                                    <small>تاريخ النهاية</small>
                                    {new Intl.DateTimeFormat("ar-PS", {
                                        dateStyle: "medium",
                                        timeZone: ACTIVITY_TIME_ZONE,
                                    }).format(activity.endsAt)}
                                </span>
                            </div>

                            <div>
                                <Clock3 size={18} />

                                <span className={attendanceStyles.activityMetaValue}>
                                    <small>وقت النهاية</small>
                                    {new Intl.DateTimeFormat("ar-PS", {
                                        timeStyle: "short",
                                        timeZone: ACTIVITY_TIME_ZONE,
                                    }).format(activity.endsAt)}
                                </span>
                            </div>
                        </>
                    )}

                    {canEditActivity && (
                        <ActivityDateEditor
                            activityId={activity.id}
                            currentStartDate={activityDateTime.date}
                            currentStartTime={activityDateTime.time}
                            currentEndDate={activityEndDateTime?.date}
                            currentEndTime={activityEndDateTime?.time}
                        />
                    )}

                    <div>
                        <MapPin size={18} />

                        <span>
                            {activity.location}
                        </span>

                        {canEditActivity && (
                            <ActivityLocationEditor
                                activityId={activity.id}
                                currentLocation={activity.location}
                            />
                        )}
                    </div>
                </div>

                <div
                    className={
                        attendanceStyles.activityResultsGrid
                    }
                >
                    <article className={`${attendanceStyles.overviewStat} ${attendanceStyles.overviewStatTotal}`}>
                        <span className={attendanceStyles.overviewStatIcon} aria-hidden="true">
                            <Users size={20} />
                        </span>
                        <div>
                            <span>إجمالي التسجيلات</span>
                            <strong>{totalCount}</strong>
                        </div>
                    </article>

                    <article className={`${attendanceStyles.overviewStat} ${attendanceStyles.overviewStatAccepted}`}>
                        <span className={attendanceStyles.overviewStatIcon} aria-hidden="true">
                            <BadgeCheck size={20} />
                        </span>
                        <div>
                            <span>المقبولون</span>
                            <strong>{approvedCount}</strong>
                        </div>
                    </article>

                    <article className={`${attendanceStyles.overviewStat} ${attendanceStyles.overviewStatPresent}`}>
                        <span className={attendanceStyles.overviewStatIcon} aria-hidden="true">
                            <CheckCircle2 size={20} />
                        </span>
                        <div>
                            <span>الحضور الفعلي</span>
                            <strong>{checkedInCount}</strong>
                        </div>
                    </article>

                    <article className={`${attendanceStyles.overviewStat} ${attendanceStyles.overviewStatAbsent}`}>
                        <span className={attendanceStyles.overviewStatIcon} aria-hidden="true">
                            <Clock3 size={20} />
                        </span>
                        <div>
                            <span>لم يحضروا</span>
                            <strong>{absentApprovedCount}</strong>
                        </div>
                    </article>
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

{canChangeSettings && (
<div className={`admin-card activity-registration-settings ${attendanceStyles.settingsPanel}`}>

    <div className="activity-registration-settings-head">

        <div className={attendanceStyles.settingsHeading}>
            <span className={attendanceStyles.sectionIcon} aria-hidden="true">
                <SlidersHorizontal size={22} />
            </span>

            <div>
                <h2>
                    التحكم بالتسجيل
                </h2>

                <p>
                    تحكم في عدد المقاعد المتاحة وفتح أو إغلاق التسجيل للطلاب.
                </p>
            </div>
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
                <span className={attendanceStyles.settingIcon} aria-hidden="true">
                    <Users size={19} />
                </span>

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
                <span className={attendanceStyles.settingIcon} aria-hidden="true">
                    <TrendingUp size={19} />
                </span>

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
                <Save size={17} aria-hidden="true" />
                {isArchived
                    ? "النشاط مؤرشف"
                    : "حفظ التغييرات"}
            </button>

        </div>

    </form>

</div>
)}


            {/* ===================================================
          STATS
      =================================================== */}

            <section className={attendanceStyles.statusSection}>
                <div className={attendanceStyles.sectionHeading}>
                    <span className={attendanceStyles.sectionIcon} aria-hidden="true">
                        <ClipboardList size={22} />
                    </span>

                    <div>
                        <h2>حالة الطلبات</h2>
                        <p>نظرة تفصيلية على التسجيلات والمقاعد والحضور.</p>
                    </div>
                </div>

            <div className="activity-registration-stats">

                <div className={`activity-registration-stat ${attendanceStyles.statusStatTotal}`}>
                    <span className={attendanceStyles.statusStatIcon} aria-hidden="true">
                        <Users size={19} />
                    </span>
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


                <div className={`activity-registration-stat ${attendanceStyles.statusStatPending}`}>
                    <span className={attendanceStyles.statusStatIcon} aria-hidden="true">
                        <Clock3 size={19} />
                    </span>
                    <span>
                        قيد المراجعة
                    </span>

                    <strong>
                        {submittedCount}
                    </strong>
                </div>


                <div className={`activity-registration-stat ${attendanceStyles.statusStatAccepted}`}>
                    <span className={attendanceStyles.statusStatIcon} aria-hidden="true">
                        <BadgeCheck size={19} />
                    </span>
                    <span>
                        المقبولون
                    </span>

                    <strong>
                        {approvedCount}
                    </strong>
                </div>


                <div className={`activity-registration-stat ${attendanceStyles.attendanceStatPresent}`}>
                    <span className={attendanceStyles.statusStatIcon} aria-hidden="true">
                        <CheckCircle2 size={19} />
                    </span>
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
                    <span className={attendanceStyles.statusStatIcon} aria-hidden="true">
                        <Clock3 size={19} />
                    </span>
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


                <div className={`activity-registration-stat ${attendanceStyles.statusStatRejected}`}>
                    <span className={attendanceStyles.statusStatIcon} aria-hidden="true">
                        <XCircle size={19} />
                    </span>
                    <span>
                        المرفوضون
                    </span>

                    <strong>
                        {rejectedCount}
                    </strong>
                </div>


                <div className={`activity-registration-stat ${attendanceStyles.statusStatSeats}`}>
                    <span className={attendanceStyles.statusStatIcon} aria-hidden="true">
                        <TrendingUp size={19} />
                    </span>
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
            </section>


            {/* ===================================================
          FILTERS
      =================================================== */}

            <section className={`admin-card activity-registration-filters ${attendanceStyles.filtersPanel}`}>

                <div className={attendanceStyles.sectionHeading}>
                    <span className={attendanceStyles.sectionIcon} aria-hidden="true">
                        <SlidersHorizontal size={22} />
                    </span>

                    <div>
                        <h2>البحث والتصفية</h2>
                        <p>اعثر على التسجيل المطلوب بالاسم أو البريد أو التخصص.</p>
                    </div>
                </div>

                <form
                    method="get"
                    className="activity-registration-filter-form"
                >

                    <label className={attendanceStyles.searchField}>
                        <span>البحث</span>

                        <span className={attendanceStyles.searchInputWrap}>
                            <Search size={18} aria-hidden="true" />
                            <input
                                type="search"
                                name="q"
                                defaultValue={query}
                                placeholder="ابحث بالاسم أو البريد أو التخصص"
                            />
                        </span>
                    </label>


                    <div className={attendanceStyles.filterField}>
                        <span>الحالة</span>
                        <RegistrationFilterSelect
                            name="status"
                            defaultValue={status}
                            ariaLabel="تصفية التسجيلات حسب الحالة"
                            options={[
                                { value: "ALL", label: "جميع الحالات", tone: "blue" },
                                { value: "SUBMITTED", label: "قيد المراجعة", tone: "orange" },
                                { value: "APPROVED", label: "المقبولون", tone: "green" },
                                { value: "REJECTED", label: "المرفوضون", tone: "red" },
                            ]}
                        />
                    </div>


                    <div className={attendanceStyles.filterField}>
                        <span>الحضور</span>
                        <RegistrationFilterSelect
                            name="attendance"
                            defaultValue={attendance}
                            ariaLabel="تصفية التسجيلات حسب الحضور"
                            options={[
                                { value: "ALL", label: "الكل", tone: "blue" },
                                { value: "PRESENT", label: "حضر", tone: "green" },
                                { value: "ABSENT", label: "لم يحضر", tone: "neutral" },
                            ]}
                        />
                    </div>


                    <button
                        type="submit"
                        className={`primary-btn ${attendanceStyles.filterApply}`}
                    >
                        <Search size={17} aria-hidden="true" />
                        تطبيق
                    </button>


                    {(query ||
                        status !== "ALL" ||
                        attendance !== "ALL") && (
                            <Link
                                href={`/admin/activities/${activity.id}/registrations`}
                                className={`ghost-btn ${attendanceStyles.filterClear}`}
                            >
                                مسح الفلاتر
                            </Link>
                        )}

                </form>

            </section>


            {/* ===================================================
          REGISTRATIONS
      =================================================== */}

            <section className={`activity-registration-admin-list ${attendanceStyles.registrationsList}`}>

                <div className={attendanceStyles.listHeading}>
                    <div className={attendanceStyles.sectionHeading}>
                        <span className={attendanceStyles.sectionIcon} aria-hidden="true">
                            <Users size={22} />
                        </span>

                        <div>
                            <h2>طلبات التسجيل</h2>
                            <p>راجع بيانات الطلاب وحدّث حالة كل طلب.</p>
                        </div>
                    </div>

                    <span className={attendanceStyles.resultsCount}>
                        {form.submissions.length} نتيجة
                    </span>
                </div>

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
                                    className={`activity-registration-admin-card ${attendanceStyles.registrationCard}`}
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

                                        {canManualAttendance &&
                                            !isArchived &&
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
                    <div className={attendanceStyles.emptyState}>
                        <span aria-hidden="true">
                            <Inbox size={28} />
                        </span>
                        <h2>
                            {query || status !== "ALL" || attendance !== "ALL"
                                ? "لا توجد نتائج مطابقة"
                                : "لا توجد تسجيلات حتى الآن"}
                        </h2>
                        <p>
                            {query || status !== "ALL" || attendance !== "ALL"
                                ? "جرّب تعديل كلمات البحث أو إزالة بعض الفلاتر."
                                : "ستظهر طلبات الطلاب هنا فور بدء التسجيل."}
                        </p>
                    </div>
                )}

            </section>

        </section>
    );
}
