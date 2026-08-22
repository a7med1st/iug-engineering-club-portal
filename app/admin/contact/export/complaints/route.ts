import ExcelJS from "exceljs";

import { requireContactAccess } from "@/lib/permissions";

import { prisma } from "@/lib/prisma";

export const runtime =
  "nodejs";

export async function GET() {
  const { user } = await requireContactAccess();

  const complaints =
    await prisma.complaint.findMany({
      where:
        user.role === "ADMIN"
          ? undefined
          : { assignedToId: user.id },
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
      "الشكاوى",
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
      header: "وسيلة التواصل",
      key: "contact",
      width: 25,
    },
    {
      header: "التخصص",
      key: "department",
      width: 24,
    },
    {
      header: "نوع الملاحظة",
      key: "type",
      width: 22,
    },
    {
      header: "التفاصيل",
      key: "details",
      width: 55,
    },
    {
      header: "يرغب برد",
      key: "wantsReply",
      width: 15,
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
    const item of complaints
  ) {
    sheet.addRow({
      studentName:
        item.studentName ||
        "غير مذكور",

      contact:
        item.contact ||
        "غير مذكور",

      department:
        item.department.nameAr,

      type:
        item.type,

      details:
        item.details,

      wantsReply:
        item.wantsReply
          ? "نعم"
          : "لا",

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
          'attachment; filename="complaints.xlsx"',

        "Cache-Control":
          "private, no-store",
      },
    },
  );
}
