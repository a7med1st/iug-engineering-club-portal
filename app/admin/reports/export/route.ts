import ExcelJS from "exceljs";

import {
  PERMISSIONS,
  requirePermission,
} from "@/lib/permissions";

import {
  getAdminReportsData,
  normalizeReportActivityStatus,
  normalizeReportRange,
} from "@/lib/admin-reports";

export const dynamic =
  "force-dynamic";

function statusLabel(
  value: string,
) {
  if (
    value === "APPROVED"
  ) {
    return "مقبول";
  }

  if (
    value === "REJECTED"
  ) {
    return "مرفوض";
  }

  if (
    value === "SUBMITTED"
  ) {
    return "قيد المراجعة";
  }

  if (
    value === "DRAFT"
  ) {
    return "مسودة";
  }

  if (
    value === "ARCHIVED"
  ) {
    return "مؤرشف";
  }

  if (
    value === "PUBLISHED"
  ) {
    return "منشور";
  }

  return value;
}

function dateText(
  value:
    | Date
    | null,
) {
  if (!value) {
    return "";
  }

  return new Intl.DateTimeFormat(
    "ar-PS",
    {
      dateStyle:
        "medium",
      timeStyle:
        "short",
    },
  ).format(value);
}

export async function GET(
  request: Request,
) {
  const {
    user,
  } =
    await requirePermission(
      PERMISSIONS.REGISTRATION_EXPORT,
    );

  const url =
    new URL(
      request.url,
    );

  const range =
    normalizeReportRange(
      url.searchParams.get(
        "range",
      ) ??
        undefined,
    );

  const activityStatus =
    normalizeReportActivityStatus(
      url.searchParams.get(
        "status",
      ) ??
        undefined,
    );

  const departmentId =
    url.searchParams.get(
      "department",
    );

  const data =
    await getAdminReportsData({
      user,
      departmentId,
      range,
      activityStatus,
    });

  const workbook =
    new ExcelJS.Workbook();

  workbook.creator =
    "IUG Engineering Club";

  workbook.created =
    new Date();

  const summary =
    workbook.addWorksheet(
      "الملخص",
      {
        views: [
          {
            rightToLeft:
              true,
          },
        ],
      },
    );

  summary.columns = [
    {
      header:
        "المؤشر",
      key:
        "metric",
      width: 30,
    },
    {
      header:
        "القيمة",
      key:
        "value",
      width: 22,
    },
  ];

  [
    [
      "القسم",
      data.selectedDepartment
        ?.nameAr ??
        "جميع الأقسام",
    ],
    [
      "عدد الأنشطة",
      data.summary
        .activityCount,
    ],
    [
      "إجمالي السعة",
      data.summary
        .capacity,
    ],
    [
      "إجمالي التسجيلات",
      data.summary
        .registrationCount,
    ],
    [
      "قيد المراجعة",
      data.summary
        .pendingCount,
    ],
    [
      "المقبولون",
      data.summary
        .approvedCount,
    ],
    [
      "المرفوضون",
      data.summary
        .rejectedCount,
    ],
    [
      "الحضور",
      data.summary
        .attendedCount,
    ],
    [
      "الغياب",
      data.summary
        .absentCount,
    ],
    [
      "نسبة الحضور",
      `${data.summary.attendanceRate}%`,
    ],
    [
      "نسبة القبول",
      `${data.summary.approvalRate}%`,
    ],
  ].forEach(
    (
      [
        metric,
        value,
      ],
    ) => {
      summary.addRow({
        metric,
        value,
      });
    },
  );

  const activities =
    workbook.addWorksheet(
      "الأنشطة",
      {
        views: [
          {
            rightToLeft:
              true,
          },
        ],
      },
    );

  activities.columns = [
    {
      header:
        "النشاط",
      key:
        "title",
      width: 35,
    },
    {
      header:
        "التاريخ",
      key:
        "startsAt",
      width: 24,
    },
    {
      header:
        "المكان",
      key:
        "location",
      width: 28,
    },
    {
      header:
        "الأقسام",
      key:
        "departments",
      width: 30,
    },
    {
      header:
        "الحالة",
      key:
        "status",
      width: 15,
    },
    {
      header:
        "السعة",
      key:
        "capacity",
      width: 12,
    },
    {
      header:
        "التسجيلات",
      key:
        "registrations",
      width: 14,
    },
    {
      header:
        "قيد المراجعة",
      key:
        "pending",
      width: 14,
    },
    {
      header:
        "المقبول",
      key:
        "approved",
      width: 12,
    },
    {
      header:
        "المرفوض",
      key:
        "rejected",
      width: 12,
    },
    {
      header:
        "الحضور",
      key:
        "attended",
      width: 12,
    },
    {
      header:
        "الغياب",
      key:
        "absent",
      width: 12,
    },
    {
      header:
        "نسبة الحضور",
      key:
        "attendanceRate",
      width: 16,
    },
  ];

  for (
    const activity
    of data.activityRows
  ) {
    activities.addRow({
      title:
        activity.title,

      startsAt:
        dateText(
          activity.startsAt,
        ),

      location:
        activity.location,

      departments:
        activity.departments
          .length
          ? activity.departments.join(
              "، ",
            )
          : "نشاط عام",

      status:
        statusLabel(
          activity.status,
        ),

      capacity:
        activity.capacity,

      registrations:
        activity.registrations,

      pending:
        activity.pending,

      approved:
        activity.approved,

      rejected:
        activity.rejected,

      attended:
        activity.attended,

      absent:
        activity.absent,

      attendanceRate:
        `${activity.attendanceRate}%`,
    });
  }

  const registrations =
    workbook.addWorksheet(
      "التسجيلات",
      {
        views: [
          {
            rightToLeft:
              true,
          },
        ],
      },
    );

  registrations.columns = [
    {
      header:
        "النشاط",
      key:
        "activity",
      width: 34,
    },
    {
      header:
        "اسم الطالب",
      key:
        "student",
      width: 28,
    },
    {
      header:
        "البريد",
      key:
        "email",
      width: 32,
    },
    {
      header:
        "القسم",
      key:
        "department",
      width: 25,
    },
    {
      header:
        "الحالة",
      key:
        "status",
      width: 16,
    },
    {
      header:
        "الحضور",
      key:
        "attendance",
      width: 15,
    },
    {
      header:
        "وقت التسجيل",
      key:
        "submittedAt",
      width: 24,
    },
    {
      header:
        "وقت الحضور",
      key:
        "checkedInAt",
      width: 24,
    },
  ];

  for (
    const row
    of data.registrationRows
  ) {
    registrations.addRow({
      activity:
        row.activityTitle,

      student:
        row.studentName,

      email:
        row.studentEmail,

      department:
        row.studentDepartment ??
        "",

      status:
        statusLabel(
          row.status,
        ),

      attendance:
        row.status !==
        "APPROVED"
          ? "—"
          : row.checkedInAt
            ? "حضر"
            : "لم يحضر",

      submittedAt:
        dateText(
          row.submittedAt,
        ),

      checkedInAt:
        dateText(
          row.checkedInAt,
        ),
    });
  }

  for (
    const sheet
    of workbook.worksheets
  ) {
    const header =
      sheet.getRow(1);

    header.font = {
      bold: true,
    };

    header.alignment = {
      horizontal:
        "right",
      vertical:
        "middle",
    };

    sheet.eachRow(
      {
        includeEmpty:
          true,
      },
      (row) => {
        row.alignment = {
          horizontal:
            "right",
          vertical:
            "middle",
        };
      },
    );

    sheet.autoFilter = {
      from: {
        row: 1,
        column: 1,
      },

      to: {
        row: 1,
        column:
          sheet.columnCount,
      },
    };
  }

  const buffer =
    await workbook.xlsx.writeBuffer();

  const date =
    new Date()
      .toISOString()
      .slice(0, 10);

  return new Response(
    Buffer.from(
      buffer,
    ),
    {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",

        "Content-Disposition":
          `attachment; filename="engineering-club-report-${date}.xlsx"`,

        "Cache-Control":
          "no-store",
      },
    },
  );
}
