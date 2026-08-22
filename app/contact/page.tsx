import ContactPortal from "@/components/ContactPortal";
import Link from "next/link";

import ContactRequestTracker from "./ContactRequestTracker";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "بوابة التواصل | النادي الهندسي",
  description:
    "بوابة التواصل الرسمية للنادي الهندسي للشكاوى والاقتراحات وطلبات التعاون.",
};

export default async function ContactPage() {
  const [departments, session] =
    await Promise.all([
      prisma.department.findMany({
      select: {
        id: true,
        nameAr: true,
      },
      orderBy: {
        sortOrder: "asc",
      },
      }),
      getSession(),
    ]);

  return (
    <>
      {/* =========================================
          HERO
      ========================================= */}

      <section className="page-hero contact-page-hero">
        <div className="shell">

        
          <h1>
            بوابة التواصل
          </h1>

          <p>
            صوتك يهمنا، وفكرتك قد تصنع الفرق.
            اختر القناة المناسبة وتواصل معنا من خلال
            الشكاوى أو الاقتراحات أو طلبات التعاون.
          </p>

        </div>
      </section>


      {/* =========================================
          CONTACT PORTAL
      ========================================= */}

      <section className="section contact-page">
        <div className="shell">

          {!session && (
            <div className="contact-tracking-notice">
              <strong>هل تريد متابعة حالة طلبك داخل الموقع؟</strong>
              <span>
                سجّل الدخول قبل الإرسال لتصلك إشعارات عند المراجعة أو
                التنفيذ، ولتستقبل رد الإدارة على الشكوى.
              </span>
              <Link href="/login">تسجيل الدخول</Link>
            </div>
          )}

          <ContactPortal
            departments={departments}
            isSignedIn={Boolean(session)}
          />

          {session && (
            <ContactRequestTracker userId={session.sub} />
          )}

        </div>
      </section>
    </>
  );
}
