import { prisma } from "@/lib/prisma";

export type AdminDashboardRange =
  | "ALL"
  | "30"
  | "90"
  | "365";

export function normalizeDashboardRange(
  value: string | undefined,
): AdminDashboardRange {
  if (
    value === "30" ||
    value === "90" ||
    value === "365"
  ) {
    return value;
  }

  return "ALL";
}

function periodStart(
  range: AdminDashboardRange,
  now: Date,
) {
  if (range === "ALL") {
    return null;
  }

  const days = Number(range);

  return new Date(
    now.getTime() -
      days * 24 * 60 * 60 * 1000,
  );
}

function percent(
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

export async function getAdminDashboardData({
  departmentId,
  range,
}: {
  departmentId:
    | string
    | null;

  range:
    AdminDashboardRange;
}) {
  const now =
    new Date();

  const from =
    periodStart(
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
        sortOrder: "asc",
      },
    });

  const selectedDepartment =
    departmentId
      ? departments.find(
          (item) =>
            item.id ===
            departmentId,
        ) ?? null
      : null;

  const effectiveDepartmentId =
    selectedDepartment?.id ??
    null;

  const contactDateWhere =
    from
      ? {
          createdAt: {
            gte: from,
            lte: now,
          },
        }
      : {};

  const [
    users,
    activities,
    complaintCount,
    suggestionCount,
    collaborationCount,
  ] =
    await Promise.all([
      prisma.user.findMany({
        select: {
          id: true,
          role: true,
          departmentId: true,
          createdAt: true,
        },
      }),

      prisma.activity.findMany({
        select: {
          id: true,
          title: true,
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
              isOpen: true,

              submissions: {
                select: {
                  id: true,
                  userId: true,
                  studentName:
                    true,
                  studentEmail:
                    true,
                  studentDepartment:
                    true,
                  status: true,
                  checkedInAt:
                    true,
                  submittedAt:
                    true,
                },
              },
            },
          },
        },

        orderBy: {
          startsAt: "desc",
        },
      }),

      prisma.complaint.count({
        where: {
          ...contactDateWhere,

          ...(effectiveDepartmentId
            ? {
                departmentId:
                  effectiveDepartmentId,
              }
            : {}),
        },
      }),

      prisma.suggestion.count({
        where: {
          ...contactDateWhere,

          ...(effectiveDepartmentId
            ? {
                departmentId:
                  effectiveDepartmentId,
              }
            : {}),
        },
      }),

      prisma.collaborationRequest.count({
        where:
          contactDateWhere,
      }),
    ]);

  function activityMatchesDepartment(
    activity: (typeof activities)[number],
  ) {
    if (
      !effectiveDepartmentId
    ) {
      return true;
    }

    if (
      activity.departments
        .length === 0
    ) {
      return true;
    }

    return activity.departments.some(
      (link) =>
        link.departmentId ===
        effectiveDepartmentId,
    );
  }

  const scopedUsers =
    effectiveDepartmentId
      ? users.filter(
          (user) =>
            user.departmentId ===
            effectiveDepartmentId,
        )
      : users;

  const scopedActivities =
    activities.filter(
      activityMatchesDepartment,
    );

  const periodActivities =
    scopedActivities.filter(
      (activity) => {
        if (!from) {
          return true;
        }

        return (
          activity.startsAt >=
            from &&
          activity.startsAt <=
            now
        );
      },
    );

  const upcomingActivities =
    scopedActivities
      .filter(
        (activity) =>
          activity.status ===
            "PUBLISHED" &&
          activity.startsAt >
            now,
      )
      .sort(
        (a, b) =>
          a.startsAt.getTime() -
          b.startsAt.getTime(),
      );

  const submissions =
    scopedActivities.flatMap(
      (activity) =>
        (
          activity.registrationForm
            ?.submissions ??
          []
        ).map(
          (submission) => ({
            ...submission,

            activity: {
              id:
                activity.id,
              title:
                activity.title,
              startsAt:
                activity.startsAt,
              status:
                activity.status,
              capacity:
                activity.capacity,
            },
          }),
        ),
    );

  const periodSubmissions =
    submissions.filter(
      (submission) =>
        !from ||
        (
          submission.submittedAt >=
            from &&
          submission.submittedAt <=
            now
        ),
    );

  const studentCount =
    scopedUsers.filter(
      (user) =>
        user.role ===
        "STUDENT",
    ).length;

  const memberCount =
    scopedUsers.filter(
      (user) =>
        user.role ===
        "MEMBER",
    ).length;

  const adminCount =
    effectiveDepartmentId
      ? 0
      : scopedUsers.filter(
          (user) =>
            user.role ===
            "ADMIN",
        ).length;

  const publishedCount =
    periodActivities.filter(
      (activity) =>
        activity.status ===
        "PUBLISHED",
    ).length;

  const archivedCount =
    periodActivities.filter(
      (activity) =>
        activity.status ===
        "ARCHIVED",
    ).length;

  const draftCount =
    periodActivities.filter(
      (activity) =>
        activity.status ===
        "DRAFT",
    ).length;

  const pendingCount =
    periodSubmissions.filter(
      (submission) =>
        submission.status ===
        "SUBMITTED",
    ).length;

  const approvedCount =
    periodSubmissions.filter(
      (submission) =>
        submission.status ===
        "APPROVED",
    ).length;

  const rejectedCount =
    periodSubmissions.filter(
      (submission) =>
        submission.status ===
        "REJECTED",
    ).length;

  const attendanceEligible =
    periodSubmissions.filter(
      (submission) =>
        submission.status ===
          "APPROVED" &&
        submission.activity
          .startsAt <= now,
    );

  const attendedCount =
    attendanceEligible.filter(
      (submission) =>
        Boolean(
          submission.checkedInAt,
        ),
    ).length;

  const attendanceRate =
    percent(
      attendedCount,
      attendanceEligible.length,
    );

  const decisionCount =
    approvedCount +
    rejectedCount;

  const approvalRate =
    percent(
      approvedCount,
      decisionCount,
    );

  const upcomingCapacity =
    upcomingActivities.reduce(
      (sum, activity) =>
        sum +
        Math.max(
          0,
          activity.capacity,
        ),
      0,
    );

  const upcomingOccupied =
    upcomingActivities.reduce(
      (sum, activity) =>
        sum +
        (
          activity.registrationForm
            ?.submissions ??
          []
        ).filter(
          (submission) =>
            submission.status !==
            "REJECTED",
        ).length,
      0,
    );

  const capacityRate =
    percent(
      upcomingOccupied,
      upcomingCapacity,
    );

  const recentRegistrations =
    [...periodSubmissions]
      .sort(
        (a, b) =>
          b.submittedAt.getTime() -
          a.submittedAt.getTime(),
      )
      .slice(
        0,
        8,
      );

  const activityRows =
    scopedActivities
      .map(
        (activity) => {
          const activitySubmissions =
            (
              activity
                .registrationForm
                ?.submissions ??
              []
            ).filter(
              (submission) =>
                !from ||
                (
                  submission.submittedAt >=
                    from &&
                  submission.submittedAt <=
                    now
                ),
            );

          const registrations =
            activitySubmissions.length;

          const approved =
            activitySubmissions.filter(
              (submission) =>
                submission.status ===
                "APPROVED",
            ).length;

          const attended =
            activitySubmissions.filter(
              (submission) =>
                submission.status ===
                  "APPROVED" &&
                Boolean(
                  submission.checkedInAt,
                ),
            ).length;

          return {
            id:
              activity.id,

            title:
              activity.title,

            startsAt:
              activity.startsAt,

            registrations,
            approved,
            attended,
          };
        },
      )
      .filter(
        (activity) =>
          activity.registrations >
          0,
      )
      .sort(
        (a, b) =>
          b.registrations -
          a.registrations,
      );

  const maxActivityRegistrations =
    activityRows[0]
      ?.registrations ??
    0;

  const topActivities =
    activityRows
      .slice(
        0,
        6,
      )
      .map(
        (activity) => ({
          ...activity,

          share:
            percent(
              activity.registrations,
              maxActivityRegistrations,
            ),
        }),
      );

  const departmentBreakdown =
    departments.map(
      (department) => {
        const usersInDepartment =
          users.filter(
            (user) =>
              user.departmentId ===
              department.id,
          );

        const students =
          usersInDepartment.filter(
            (user) =>
              user.role ===
              "STUDENT",
          ).length;

        const members =
          usersInDepartment.filter(
            (user) =>
              user.role ===
              "MEMBER",
          ).length;

        const departmentSubmissions =
          periodSubmissions.filter(
            (submission) =>
              submission.studentDepartment ===
              department.nameAr,
          );

        const registrations =
          departmentSubmissions.length;

        const attended =
          departmentSubmissions.filter(
            (submission) =>
              submission.status ===
                "APPROVED" &&
              Boolean(
                submission.checkedInAt,
              ),
          ).length;

        return {
          id:
            department.id,
          nameAr:
            department.nameAr,
          students,
          members,
          registrations,
          attended,
        };
      },
    );

  const maxDepartmentStudents =
    Math.max(
      1,
      ...departmentBreakdown.map(
        (item) =>
          item.students,
      ),
    );

  const departmentRows =
    departmentBreakdown.map(
      (item) => ({
        ...item,

        studentShare:
          percent(
            item.students,
            maxDepartmentStudents,
          ),
      }),
    );

  const upcomingRows =
    upcomingActivities
      .slice(
        0,
        6,
      )
      .map(
        (activity) => {
          const allSubmissions =
            activity
              .registrationForm
              ?.submissions ??
            [];

          const occupied =
            allSubmissions.filter(
              (submission) =>
                submission.status !==
                "REJECTED",
            ).length;

          const approved =
            allSubmissions.filter(
              (submission) =>
                submission.status ===
                "APPROVED",
            ).length;

          return {
            id:
              activity.id,
            title:
              activity.title,
            location:
              activity.location,
            startsAt:
              activity.startsAt,
            capacity:
              activity.capacity,
            occupied,
            approved,
            fillRate:
              percent(
                occupied,
                activity.capacity,
              ),
          };
        },
      );

  return {
    filters: {
      departmentId:
        effectiveDepartmentId,
      range,
      from,
      now,
    },

    selectedDepartment,

    departments,

    summary: {
      studentCount,
      memberCount,
      adminCount,

      activityCount:
        periodActivities.length,

      publishedCount,
      archivedCount,
      draftCount,

      upcomingCount:
        upcomingActivities.length,

      registrationCount:
        periodSubmissions.length,

      pendingCount,
      approvedCount,
      rejectedCount,

      attendedCount,
      attendanceEligibleCount:
        attendanceEligible.length,

      attendanceRate,
      approvalRate,

      upcomingOccupied,
      upcomingCapacity,
      capacityRate,

      contactCount:
        complaintCount +
        suggestionCount +
        collaborationCount,

      complaintCount,
      suggestionCount,
      collaborationCount,
    },

    recentRegistrations,
    topActivities,
    departmentRows,
    upcomingRows,
  };
}
