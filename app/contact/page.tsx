import ContactPortal from "@/components/ContactPortal";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "بوابة التواصل | النادي الهندسي",
  description:
    "بوابة التواصل الرسمية للنادي الهندسي للشكاوى والاقتراحات وطلبات التعاون.",
};

export default async function ContactPage() {
  const departments =
    await prisma.department.findMany({
      select: {
        id: true,
        nameAr: true,
      },
      orderBy: {
        sortOrder: "asc",
      },
    });

  return (
    <>
      {/* =========================================
          HERO
      ========================================= */}

      <section className="page-hero contact-page-hero">
        <div className="shell">

          <div className="eyebrow">
            CONTACT PORTAL
          </div>

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

          <ContactPortal
            departments={departments}
          />

        </div>
      </section>
    </>
  );
}