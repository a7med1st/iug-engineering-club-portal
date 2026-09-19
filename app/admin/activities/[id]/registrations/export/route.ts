import type { Prisma } from "@prisma/client";
import ExcelJS from "exceljs";

import {
  PERMISSIONS,
  requireActivityPermission,
} from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

const statusLabels = {
  SUBMITTED: "قيد المراجعة",
  APPROVED: "مقبول",
  REJECTED: "مرفوض",
} as const;

const allowedStatuses = new Set([
  "SUBMITTED",
  "APPROVED",
  "REJECTED",
]);

const allowedAttendanceFilters = new Set([
  "PRESENT",
  "ABSENT",
]);

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
    return "";
  }

  if (typeof value === "object") {
    return JSON.stringify(value);
  }

  return String(value);
}

function formatDate(
  date: Date | null,
) {
  if (!date) {
    return "";
  }

  return new Intl.DateTimeFormat(
    "ar-PS",
    {
      dateStyle: "medium",
      timeStyle: "short",
    },
  ).format(date);
}

function safeFileName(
  value: string,
) {
  return value
    .replace(/[\\/:*?"<>|]/g, "-")
    .replace(/\s+/g, "-")
    .slice(0, 80);
}

export async function GET(
  request: Request,
  { params }: RouteContext,
) {
  const { id } = await params;

  const searchParams = new URL(request.url).searchParams;
  const query = (searchParams.get("q") ?? "")
    .trim()
    .slice(0, 200);
  const requestedStatus = searchParams.get("status") ?? "ALL";
  const status = allowedStatuses.has(requestedStatus)
    ? requestedStatus
    : "ALL";
  const requestedAttendance = searchParams.get("attendance") ?? "ALL";
  const attendance = allowedAttendanceFilters.has(requestedAttendance)
    ? requestedAttendance
    : "ALL";

  const submissionWhere: Prisma.ActivityFormSubmissionWhereInput = {
    ...(status !== "ALL"
      ? {
          status: status as "SUBMITTED" | "APPROVED" | "REJECTED",
        }
      : {}),
    ...(attendance === "PRESENT"
      ? {
          status: "APPROVED",
          checkedInAt: { not: null },
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
                contains: query,
                mode: "insensitive",
              },
            },
            {
              studentEmail: {
                contains: query,
                mode: "insensitive",
              },
            },
            {
              studentDepartment: {
                contains: query,
                mode: "insensitive",
              },
            },
          ],
        }
      : {}),
  };

  await requireActivityPermission(
    PERMISSIONS.REGISTRATION_EXPORT,
    id,
  );

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
              where: submissionWhere,

              include: {
                answers: true,
              },

              orderBy: {
                submittedAt: "asc",
              },
            },
          },
        },
      },
    });

  if (
    !activity ||
    !activity.registrationForm
  ) {
    return new Response(
      "Activity registration form not found",
      {
        status: 404,
      },
    );
  }

  const form =
    activity.registrationForm;

  const workbook =
    new ExcelJS.Workbook();

  workbook.creator =
    "IUG Engineering Club";

  workbook.created =
    new Date();

  const worksheet =
    workbook.addWorksheet(
      "المسجلون",
      {
        views: [
          {
            rightToLeft: true,
            state: "frozen",
            ySplit: 1,
          },
        ],
      },
    );

  const dynamicQuestionColumns =
    form.questions.map(
      (question) => ({
        header: question.label,
        key: `question_${question.id}`,
        width: 24,
      }),
    );

  worksheet.columns = [
    {
      header: "#",
      key: "number",
      width: 8,
    },
    {
      header: "اسم الطالب",
      key: "studentName",
      width: 24,
    },
    {
      header: "البريد الإلكتروني",
      key: "studentEmail",
      width: 30,
    },
    {
      header: "التخصص",
      key: "studentDepartment",
      width: 22,
    },
    {
      header: "حالة التسجيل",
      key: "registrationStatus",
      width: 18,
    },
    {
      header: "حالة الحضور",
      key: "attendanceStatus",
      width: 18,
    },
    {
      header: "وقت الحضور",
      key: "checkedInAt",
      width: 24,
    },
    {
      header: "وقت التسجيل",
      key: "submittedAt",
      width: 24,
    },
    ...dynamicQuestionColumns,
  ];

  form.submissions.forEach(
    (submission, index) => {
      const answerMap =
        new Map(
          submission.answers.map(
            (answer) => [
              answer.questionId,
              answer.value,
            ],
          ),
        );

      const attendanceStatus =
        submission.status ===
        "APPROVED"
          ? submission.checkedInAt
            ? "حضر"
            : "لم يحضر"
          : "غير مطبق";

      const rowData: Record<
        string,
        string | number
      > = {
        number: index + 1,
        studentName:
          submission.studentName,
        studentEmail:
          submission.studentEmail,
        studentDepartment:
          submission.studentDepartment ??
          "",
        registrationStatus:
          statusLabels[
            submission.status
          ],
        attendanceStatus,
        checkedInAt:
          formatDate(
            submission.checkedInAt,
          ),
        submittedAt:
          formatDate(
            submission.submittedAt,
          ),
      };

      for (
        const question of
        form.questions
      ) {
        rowData[
          `question_${question.id}`
        ] = formatAnswer(
          answerMap.get(
            question.id,
          ) ?? null,
        );
      }

      const row =
        worksheet.addRow(
          rowData,
        );

      row.alignment = {
        vertical: "middle",
        horizontal: "right",
        wrapText: true,
      };

      row.eachCell(
        (cell, colNumber) => {
          /*
           * لا نغيّر تنسيق خلية حالة التسجيل هنا
           * حتى تبقى قابلة للقراءة مثل باقي البيانات.
           */
          if (
            colNumber !== 5
          ) {
            cell.alignment = {
              vertical: "middle",
              horizontal: "right",
              wrapText: true,
            };
          }
        },
      );

      const registrationStatusCell = row.getCell(5);
      const registrationStatusColor =
        submission.status === "APPROVED"
          ? "FFDDF6E8"
          : submission.status === "REJECTED"
            ? "FFFFE2E2"
            : "FFFFF2CC";

      registrationStatusCell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: registrationStatusColor },
      };
      registrationStatusCell.font = { bold: true };

      const attendanceCell = row.getCell(6);
      if (attendanceStatus === "حضر") {
        attendanceCell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FFDDF6E8" },
        };
      } else if (attendanceStatus === "لم يحضر") {
        attendanceCell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FFFFE2E2" },
        };
      }
    },
  );

  const header =
    worksheet.getRow(1);

  header.height = 28;

  header.font = {
    bold: true,
  };

  header.alignment = {
    vertical: "middle",
    horizontal: "center",
    wrapText: true,
  };

  header.eachCell((cell) => {
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: {
        argb: "FFEAF2F8",
      },
    };

    cell.border = {
      bottom: {
        style: "thin",
        color: {
          argb: "FFCBD5E1",
        },
      },
    };
  });

  worksheet.autoFilter = {
    from: {
      row: 1,
      column: 1,
    },
    to: {
      row: 1,
      column:
        worksheet.columnCount,
    },
  };

  worksheet.pageSetup = {
    orientation: "landscape",
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 0,
    paperSize: 9,
  };

  worksheet.headerFooter.oddHeader =
    `&C&"Arial,Bold"${activity.title}`;
  worksheet.headerFooter.oddFooter =
    "&Rصفحة &P من &N";

  const buffer =
    await workbook.xlsx.writeBuffer();

  const filename =
    `${safeFileName(
      activity.title,
    )}-${
      query || status !== "ALL" || attendance !== "ALL"
        ? "filtered-"
        : ""
    }registrations.xlsx`;

  return new Response(
    Buffer.from(buffer),
    {
      status: 200,

      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",

        "Content-Disposition":
          `attachment; filename*=UTF-8''${encodeURIComponent(
            filename,
          )}`,

        "Cache-Control":
          "no-store",
      },
    },
  );
}
