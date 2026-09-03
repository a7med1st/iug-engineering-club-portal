import ExcelJS from "exceljs";

import {
  hasGlobalContactAccess,
  requireContactAccess,
} from "@/lib/permissions";

import { prisma } from "@/lib/prisma";

export const runtime =
  "nodejs";

export async function GET() {
  const { user } = await requireContactAccess();

  const collaborations =
    await prisma.collaborationRequest.findMany({
where:
  hasGlobalContactAccess(user)
    ? undefined
    : { assignedToId: user.id },
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
      "طلبات التعاون",
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
      header: "اسم الجهة",
      key: "entityName",
      width: 30,
    },
    {
      header: "مسؤول التواصل",
      key: "contactPerson",
      width: 24,
    },
    {
      header: "رقم الهاتف",
      key: "phone",
      width: 20,
    },
    {
      header: "البريد الإلكتروني",
      key: "email",
      width: 30,
    },
    {
      header: "الموقع / التواصل الاجتماعي",
      key: "socialUrl",
      width: 35,
    },
    {
      header: "المجال",
      key: "field",
      width: 24,
    },
    {
      header: "وصف التعاون",
      key: "description",
      width: 55,
    },
    {
      header: "ملاحظات إضافية",
      key: "additionalNotes",
      width: 40,
    },
    {
      header: "يوجد ملف مرفق",
      key: "hasAttachment",
      width: 18,
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
    const item of collaborations
  ) {
    sheet.addRow({
      entityName:
        item.entityName,

      contactPerson:
        item.contactPerson,

      phone:
        item.phone,

      email:
        item.email,

      socialUrl:
        item.socialUrl,

      field:
        item.field,

      description:
        item.description,

      additionalNotes:
        item.additionalNotes ||
        "لا يوجد",

      hasAttachment:
        item.attachmentStoredName
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
          'attachment; filename="collaborations.xlsx"',

        "Cache-Control":
          "private, no-store",
      },
    },
  );
}
