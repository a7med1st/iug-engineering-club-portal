import ExcelJS from "exceljs";

import {
  PERMISSIONS,
  requirePermission,
} from "@/lib/permissions";

import { prisma } from "@/lib/prisma";

export const runtime =
  "nodejs";

export async function GET() {
  await requirePermission(
    PERMISSIONS.CONTACT_MANAGE,
  );

  const suggestions =
    await prisma.suggestion.findMany({
      include: {
        department: true,
      },

      orderBy: {
        createdAt: "desc",
      },
    });

  const workbook =
    new ExcelJS.Workbook();

  workbook.creator =
    "Engineering Club - IUG";

  const sheet =
    workbook.addWorksheet(
      "الاقتراحات",
      {
        views: [
          {
            rightToLeft: true,
          },
        ],
      },
    );

  sheet.columns = [
    {
      header: "اسم الطالب",
      key: "studentName",
      width: 24,
    },
    {
      header: "رقم الواتساب",
      key: "whatsapp",
      width: 22,
    },
    {
      header: "التخصص",
      key: "department",
      width: 24,
    },
    {
      header: "المواضيع المقترحة",
      key: "topics",
      width: 35,
    },
    {
      header: "فكرة الفعالية أو المشروع",
      key: "projectIdea",
      width: 55,
    },
    {
      header: "الحالة",
      key: "status",
      width: 18,
    },
    {
      header: "تاريخ الإرسال",
      key: "createdAt",
      width: 23,
    },
  ];

  for (
    const item of suggestions
  ) {
    sheet.addRow({
      studentName:
        item.studentName,

      whatsapp:
        item.whatsapp,

      department:
        item.department.nameAr,

      topics:
        item.topics ||
        "غير مذكورة",

      projectIdea:
        item.projectIdea,

      status:
        item.status,

      createdAt:
        item.createdAt.toLocaleString(
          "ar-EG",
        ),
    });
  }

  const headerRow =
    sheet.getRow(1);

  headerRow.font = {
    bold: true,
  };

  headerRow.alignment = {
    horizontal: "center",
    vertical: "middle",
  };

  sheet.eachRow(
    (row) => {
      row.alignment = {
        vertical: "top",
        wrapText: true,
      };
    },
  );

  const buffer =
    await workbook.xlsx.writeBuffer();

  return new Response(
    Buffer.from(buffer),
    {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",

        "Content-Disposition":
          'attachment; filename="suggestions.xlsx"',

        "Cache-Control":
          "private, no-store",
      },
    },
  );
}