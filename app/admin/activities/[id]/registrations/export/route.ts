import type { Prisma } from "@prisma/client";
import ExcelJS from "exceljs";

import {
  PERMISSIONS,
  requirePermission,
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
  _request: Request,
  { params }: RouteContext,
) {
  await requirePermission(
    PERMISSIONS.REGISTRATION_EXPORT,
  );

  const { id } = await params;

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

  const buffer =
    await workbook.xlsx.writeBuffer();

  const filename =
    `${safeFileName(
      activity.title,
    )}-registrations.xlsx`;

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