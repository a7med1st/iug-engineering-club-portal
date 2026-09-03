import Image from "next/image";
import { notFound } from "next/navigation";

import PrintButton from "@/components/admin/PrintButton";
import { NonceStyle } from "@/components/security/CspNonce";

import {
  hasGlobalContactAccess,
  requireContactAccess,
} from "@/lib/permissions";

import { prisma } from "@/lib/prisma";

import styles from "./print.module.css";


type Props = {
  params: Promise<{
    type: string;
    id: string;
  }>;
};

type PrintRow = {
  label: string;
  value: string;
  wide?: boolean;
};

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("ar-PS", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(value);
}

export default async function ContactPrintPage({
  params,
}: Props) {
  const { user } = await requireContactAccess();

const assignmentScope =
  hasGlobalContactAccess(user)
    ? {}
    : { assignedToId: user.id };

  const { type, id } = await params;

  let title = "";
  let subtitle = "";
  let rows: PrintRow[] = [];
  let createdAt: Date | null = null;

  /* =========================================================
     COMPLAINT
  ========================================================= */

  if (type === "complaint") {
    const item =
      await prisma.complaint.findFirst({
        where: { id, ...assignmentScope },
        include: {
          department: true,
        },
      });

    if (!item) {
      notFound();
    }

    title = "شكوى / ملاحظة";
    subtitle =
      "بيانات الشكوى أو الملاحظة المقدمة عبر بوابة التواصل في النادي الهندسي.";
    createdAt = item.createdAt;

    rows = [
      {
        label: "اسم الطالب",
        value:
          item.studentName ||
          "غير مذكور",
      },
      {
        label: "وسيلة التواصل",
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
        label: "يرغب بالحصول على رد",
        value:
          item.wantsReply
            ? "نعم"
            : "لا",
      },
      {
        label: "تفاصيل الشكوى",
        value: item.details,
        wide: true,
      },
      {
        label: "تاريخ الإرسال",
        value: formatDate(item.createdAt),
      },
    ];
  }

  /* =========================================================
     SUGGESTION
  ========================================================= */

  else if (type === "suggestion") {
    const item =
      await prisma.suggestion.findFirst({
        where: { id, ...assignmentScope },
        include: {
          department: true,
        },
      });

    if (!item) {
      notFound();
    }

    title = "اقتراح طالب";
    subtitle =
      "تفاصيل الاقتراح المقدم من الطالب ومجالات الاهتمام والفكرة المقترحة.";
    createdAt = item.createdAt;

    rows = [
      {
        label: "اسم الطالب",
        value: item.studentName,
      },
      {
        label: "رقم الواتساب",
        value: item.whatsapp,
      },
      {
        label: "التخصص",
        value:
          item.department.nameAr,
      },
      {
        label: "المواضيع المقترحة",
        value:
          item.topics ||
          "غير مذكورة",
        wide: true,
      },
      {
        label: "فكرة الفعالية أو المشروع",
        value: item.projectIdea,
        wide: true,
      },
      {
        label: "تاريخ الإرسال",
        value: formatDate(item.createdAt),
      },
    ];
  }

  /* =========================================================
     COLLABORATION
  ========================================================= */

  else if (type === "collaboration") {
    const item =
      await prisma.collaborationRequest.findFirst({
        where: { id, ...assignmentScope },
      });

    if (!item) {
      notFound();
    }

    title = "طلب تعاون";
    subtitle =
      "بيانات طلب التعاون والجهة المتقدمة ومعلومات التواصل والتفاصيل المرفقة.";
    createdAt = item.createdAt;

    rows = [
      {
        label:
          "اسم الشخص / المؤسسة / الجهة",
        value: item.entityName,
      },
      {
        label: "مسؤول التواصل",
        value: item.contactPerson,
      },
      {
        label: "رقم الهاتف",
        value: item.phone,
      },
      {
        label: "البريد الإلكتروني",
        value: item.email,
      },
      {
        label:
          "الموقع / التواصل الاجتماعي",
        value: item.socialUrl,
        wide: true,
      },
      {
        label: "المجال",
        value: item.field,
      },
      {
        label: "وصف التعاون",
        value: item.description,
        wide: true,
      },
      {
        label: "ملاحظات إضافية",
        value:
          item.additionalNotes ||
          "لا يوجد",
        wide: true,
      },
      {
        label: "تاريخ الإرسال",
        value: formatDate(item.createdAt),
      },
    ];
  }

  /* =========================================================
     INVALID TYPE
  ========================================================= */

  else {
    notFound();
  }

  const generatedAt = new Date();

  return (
    <main
      className={styles.page}
      dir="rtl"
      data-contact-print-root
    >
      <NonceStyle>{`
        @media print {
          html,
          body {
            margin: 0 !important;
            padding: 0 !important;
            background: #fff !important;
            print-color-adjust: exact;
            -webkit-print-color-adjust: exact;
          }

          body * {
            visibility: hidden !important;
          }

          [data-contact-print-root],
          [data-contact-print-root] * {
            visibility: visible !important;
          }

          [data-contact-print-root] {
            position: absolute !important;
            inset: 0 !important;
            width: 100% !important;
          }
        }
      `}</NonceStyle>

      <div className={styles.toolbar}>
        <PrintButton />
      </div>

      <article className={styles.sheet}>
        <header className={styles.letterhead}>
          <Image
            src="/images/engineering-club-letterhead-header.png"
            alt="ترويسة النادي الهندسي الرسمية"
            width={2481}
            height={550}
            className={styles.letterheadImage}
            priority
          />
        </header>

        <div className={styles.content}>
          <section className={styles.documentHero}>
            <div className={styles.documentHeroCopy}>
              <h1>{title}</h1>
              <p>{subtitle}</p>
            </div>

            <div className={styles.metaCard}>
              <div>
                <span>نوع المستند</span>
                <strong>{title}</strong>
              </div>

              <div>
                <span>تاريخ الإرسال</span>
                <strong>
                  {createdAt
                    ? formatDate(createdAt)
                    : "—"}
                </strong>
              </div>

              <div>
                <span>تاريخ استخراج المستند</span>
                <strong>
                  {formatDate(generatedAt)}
                </strong>
              </div>
            </div>
          </section>

          <div
            className={styles.clubStripe}
            aria-hidden="true"
          />

          <section className={styles.dataSection}>
            <h2>بيانات الطلب</h2>

            <div className={styles.dataGrid}>
              {rows.map((row) => (
                <article
                  key={row.label}
                  className={`${styles.dataCard} ${
                    row.wide
                      ? styles.dataCardWide
                      : ""
                  }`}
                >
                  <span>{row.label}</span>
                  <p>{row.value}</p>
                </article>
              ))}
            </div>
          </section>

          <footer className={styles.footer}>
            <div>
              <strong>
                النادي الهندسي للطلاب
              </strong>
              <span>
                الجامعة الإسلامية بغزة
              </span>
            </div>

            <p>
              تم استخراج هذا المستند من النظام
              الإلكتروني للنادي الهندسي، ويعكس
              البيانات المسجلة وقت إنشاء النسخة.
            </p>
          </footer>
        </div>
      </article>
    </main>
  );
}
