import { prisma } from "@/lib/prisma";
import { isClubLeadership } from "@/lib/permissions";

export type ReportRange =
  | "ALL"
  | "30"
  | "90"
  | "365";

export type ReportActivityStatus =
  | "ALL"
  | "DRAFT"
  | "PUBLISHED"
  | "ARCHIVED";

export function normalizeReportRange(
  value: string | undefined,
): ReportRange {
  if (
    value === "30" ||
    value === "90" ||
    value === "365"
  ) {
    return value;
  }

  return "ALL";
}

export function normalizeReportActivityStatus(
  value: string | undefined,
): ReportActivityStatus {
  if (
    value === "DRAFT" ||
    value === "PUBLISHED" ||
    value === "ARCHIVED"
  ) {
    return value;
  }

  return "ALL";
}

function startForRange(
  range: ReportRange,
  now: Date,
) {
  if (range === "ALL") {
    return null;
  }

  return new Date(
    now.getTime() -
      Number(range) *
        24 *
        60 *
        60 *
        1000,
  );
}

function percentage(
  value: number,
  total: number,
) {
  if (total <= 0) {
    return 0;
  }

  return Math.round(
    (value / total) * 100,
  );
}

export async function getAdminReportsData({
  user,
  departmentId,
  range,
  activityStatus,
}: {
  user: {
    id: string;
    role:
      | "STUDENT"
      | "MEMBER"
      | "ADMIN";
    departmentId:
      | string
      | null;
    position?:
      | string
      | null;
  };

  departmentId:
    | string
    | null;

  range: ReportRange;

  activityStatus:
    ReportActivityStatus;
}) {
  const now =
    new Date();

  const from =
    startForRange(
      range,
      now,
    );

  const departments =
    await prisma.department.findMany({
      select: {
        id: true,
        nameAr: true,
        nameEn: true,
        sortOrder: true,
      },

      orderBy: {
        sortOrder:
          "asc",
      },
    });

  const requestedDepartment =
    departmentId
      ? departments.find(
          (department) =>
            department.id ===
            departmentId,
        ) ?? null
      : null;

  const isAdmin = user.role === "ADMIN" || isClubLeadership(user.position);

  const effectiveDepartmentId =
    isAdmin
      ? requestedDepartment?.id ??
        null
      : user.departmentId;

  const activities =
    await prisma.activity.findMany({
      select: {
        id: true,
        title: true,
        description: true,
        location: true,
        startsAt: true,
        capacity: true,
        status: true,

        departments: {
          select: {
            departmentId:
              true,

            department: {
              select: {
                nameAr:
                  true,
              },
            },
          },
        },

        registrationForm: {
          select: {
            id: true,

            submissions: {
              select: {
                id: true,
                studentName:
                  true,
                studentEmail:
                  true,
                studentDepartment:
                  true,
                status: true,
                submittedAt:
                  true,
                checkedInAt:
                  true,
              },
            },
          },
        },
      },

      orderBy: {
        startsAt:
          "desc",
      },
    });

  const scopedActivities =
    activities.filter(
      (activity) => {
        const departmentIds =
          activity.departments.map(
            (item) =>
              item.departmentId,
          );

        if (
          user.role === "MEMBER"
        ) {
          return (
            Boolean(
              user.departmentId,
            ) &&
            departmentIds.length ===
              1 &&
            departmentIds[0] ===
              user.departmentId
          );
        }

        if (
          effectiveDepartmentId
        ) {
          return (
            departmentIds.length ===
              0 ||
            departmentIds.includes(
              effectiveDepartmentId,
            )
          );
        }

        return true;
      },
    );

  const filteredActivities =
    scopedActivities.filter(
      (activity) => {
        if (
          activityStatus !==
            "ALL" &&
          activity.status !==
            activityStatus
        ) {
          return false;
        }

        if (
          from &&
          activity.startsAt <
            from
        ) {
          return false;
        }

        return true;
      },
    );

  const activityRows =
    filteredActivities.map(
      (activity) => {
        const allSubmissions =
          activity
            .registrationForm
            ?.submissions ??
          [];

        const submissions =
          effectiveDepartmentId
            ? allSubmissions.filter(
                (submission) =>
                  submission.studentDepartment ===
                  requestedDepartment?.nameAr ||
                  (
                    user.role === "MEMBER" &&
                    submission.studentDepartment ===
                      departments.find(
                        (department) =>
                          department.id ===
                          user.departmentId,
                      )?.nameAr
                  ),
              )
            : allSubmissions;

        const pending =
          submissions.filter(
            (submission) =>
              submission.status ===
              "SUBMITTED",
          ).length;

        const approved =
          submissions.filter(
            (submission) =>
              submission.status ===
              "APPROVED",
          ).length;

        const rejected =
          submissions.filter(
            (submission) =>
              submission.status ===
              "REJECTED",
          ).length;

        const attended =
          submissions.filter(
            (submission) =>
              submission.status ===
                "APPROVED" &&
              Boolean(
                submission.checkedInAt,
              ),
          ).length;

        const absent =
          submissions.filter(
            (submission) =>
              submission.status ===
                "APPROVED" &&
              !submission.checkedInAt &&
              activity.startsAt <=
                now,
          ).length;

        const occupied =
          submissions.filter(
            (submission) =>
              submission.status !==
              "REJECTED",
          ).length;

        return {
          id:
            activity.id,

          title:
            activity.title,

          description:
            activity.description,

          location:
            activity.location,

          startsAt:
            activity.startsAt,

          capacity:
            activity.capacity,

          status:
            activity.status,

          departments:
            activity.departments.map(
              (item) =>
                item.department.nameAr,
            ),

          registrations:
            submissions.length,

          pending,
          approved,
          rejected,
          attended,
          absent,

          attendanceRate:
            percentage(
              attended,
              attended + absent,
            ),

          fillRate:
            percentage(
              occupied,
              activity.capacity,
            ),

          submissions,
        };
      },
    );

  const registrationRows =
    activityRows.flatMap(
      (activity) =>
        activity.submissions.map(
          (submission) => ({
            id:
              submission.id,

            activityId:
              activity.id,

            activityTitle:
              activity.title,

            activityStartsAt:
              activity.startsAt,

            studentName:
              submission.studentName,

            studentEmail:
              submission.studentEmail,

            studentDepartment:
              submission.studentDepartment,

            status:
              submission.status,

            submittedAt:
              submission.submittedAt,

            checkedInAt:
              submission.checkedInAt,
          }),
        ),
    );

  const totals =
    activityRows.reduce(
      (
        result,
        activity,
      ) => {
        result.capacity +=
          activity.capacity;

        result.registrations +=
          activity.registrations;

        result.pending +=
          activity.pending;

        result.approved +=
          activity.approved;

        result.rejected +=
          activity.rejected;

        result.attended +=
          activity.attended;

        result.absent +=
          activity.absent;

        return result;
      },
      {
        capacity: 0,
        registrations: 0,
        pending: 0,
        approved: 0,
        rejected: 0,
        attended: 0,
        absent: 0,
      },
    );

  return {
    filters: {
      departmentId:
        effectiveDepartmentId,
      range,
      activityStatus,
      from,
      now,
    },

    departments:
      isAdmin
        ? departments
        : departments.filter(
            (department) =>
              department.id ===
              user.departmentId,
          ),

    selectedDepartment:
      effectiveDepartmentId
        ? departments.find(
            (department) =>
              department.id ===
              effectiveDepartmentId,
          ) ?? null
        : null,

    activityRows,

    registrationRows,

    summary: {
      activityCount:
        activityRows.length,

      capacity:
        totals.capacity,

      registrationCount:
        totals.registrations,

      pendingCount:
        totals.pending,

      approvedCount:
        totals.approved,

      rejectedCount:
        totals.rejected,

      attendedCount:
        totals.attended,

      absentCount:
        totals.absent,

      attendanceRate:
        percentage(
          totals.attended,
          totals.attended +
            totals.absent,
        ),

      approvalRate:
        percentage(
          totals.approved,
          totals.approved +
            totals.rejected,
        ),
    },
  };
}
