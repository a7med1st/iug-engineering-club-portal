import Image from "next/image";
import {
  notFound,
} from "next/navigation";

import PrintButton from "@/components/admin/PrintButton";

import {
  PERMISSIONS,
  requirePermission,
} from "@/lib/permissions";

import { prisma } from "@/lib/prisma";

type Props = {
  params: Promise<{
    type: string;
    id: string;
  }>;
};

export default async function ContactPrintPage({
  params,
}: Props) {
  await requirePermission(
    PERMISSIONS.CONTACT_MANAGE,
  );

  const {
    type,
    id,
  } = await params;

  let title = "";

  let rows: {
    label: string;
    value: string;
  }[] = [];

  /* =========================================================
     COMPLAINT
  ========================================================= */

  if (
    type === "complaint"
  ) {
    const item =
      await prisma.complaint.findUnique({
        where: {
          id,
        },

        include: {
          department: true,
        },
      });

    if (!item) {
      notFound();
    }

    title =
      "شكوى / ملاحظة";

    rows = [
      {
        label: "اسم الطالب",

        value:
          item.studentName ||
          "غير مذكور",
      },
      {
        label:
          "وسيلة التواصل",

        value:
          item.contact ||
          "غير مذكورة",
      },
      {
        label: "التخصص",

        value:
          item.department.nameAr,
      },
      {
        label:
          "يرغب بالحصول على رد",

        value:
          item.wantsReply
            ? "نعم"
            : "لا",
      },
      {
        label:
          "تفاصيل الشكوى",

        value:
          item.details,
      },
      {
        label:
          "تاريخ الإرسال",

        value:
          item.createdAt.toLocaleString(
            "ar-EG",
          ),
      },
    ];
  }

  /* =========================================================
     SUGGESTION
  ========================================================= */

  else if (
    type === "suggestion"
  ) {
    const item =
      await prisma.suggestion.findUnique({
        where: {
          id,
        },

        include: {
          department: true,
        },
      });

    if (!item) {
      notFound();
    }

    title =
      "اقتراح طالب";

    rows = [
      {
        label: "اسم الطالب",
        value:
          item.studentName,
      },
      {
        label: "رقم الواتساب",
        value:
          item.whatsapp,
      },
      {
        label: "التخصص",

        value:
          item.department.nameAr,
      },
      {
        label:
          "المواضيع المقترحة",

        value:
          item.topics ||
          "غير مذكورة",
      },
      {
        label:
          "فكرة الفعالية أو المشروع",

        value:
          item.projectIdea,
      },
      {
        label:
          "تاريخ الإرسال",

        value:
          item.createdAt.toLocaleString(
            "ar-EG",
          ),
      },
    ];
  }

  /* =========================================================
     COLLABORATION
  ========================================================= */

  else if (
    type === "collaboration"
  ) {
    const item =
      await prisma.collaborationRequest.findUnique({
        where: {
          id,
        },
      });

    if (!item) {
      notFound();
    }

    title =
      "طلب تعاون";

    rows = [
      {
        label:
          "اسم الشخص / المؤسسة / الجهة",

        value:
          item.entityName,
      },
      {
        label:
          "مسؤول التواصل",

        value:
          item.contactPerson,
      },
      {
        label:
          "رقم الهاتف",

        value:
          item.phone,
      },
      {
        label:
          "البريد الإلكتروني",

        value:
          item.email,
      },
      {
        label:
          "الموقع / التواصل الاجتماعي",

        value:
          item.socialUrl,
      },
      {
        label:
          "المجال",

        value:
          item.field,
      },
      {
        label:
          "وصف التعاون",

        value:
          item.description,
      },
      {
        label:
          "ملاحظات إضافية",

        value:
          item.additionalNotes ||
          "لا يوجد",
      },
      {
        label:
          "تاريخ الإرسال",

        value:
          item.createdAt.toLocaleString(
            "ar-EG",
          ),
      },
    ];
  }

  /* =========================================================
     INVALID TYPE
  ========================================================= */

  else {
    notFound();
  }

  return (
    <main className="official-print-page">
      <div className="print-actions">
        <PrintButton />
      </div>

      <article className="official-print-sheet">
        <header className="official-print-header">
          <Image
            src="/images/engineering-club-letterhead-header.png"
            alt="ترويسة النادي الهندسي الرسمية"
            width={2481}
            height={550}
            className="official-letterhead"
            priority
          />
        </header>

        <div className="official-print-body">
          <div className="official-print-title">
            <span>
              نموذج رسمي
            </span>

            <h2>
              {title}
            </h2>
          </div>

          <div className="official-print-data">
            {rows.map(
              (row) => (
                <div
                  className="official-print-row"
                  key={row.label}
                >
                  <strong>
                    {row.label}
                  </strong>

                  <p>
                    {row.value}
                  </p>
                </div>
              ),
            )}
          </div>

          <footer className="official-print-footer">
            <span>
              النادي الهندسي للطلاب
            </span>

            <span>
              تم استخراج هذا المستند
              من النظام الإلكتروني
            </span>
          </footer>
        </div>
      </article>
    </main>
  );
}