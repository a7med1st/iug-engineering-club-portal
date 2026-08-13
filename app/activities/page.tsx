import Link from "next/link";
import { prisma } from "@/lib/prisma";
import ActivityCard from "@/components/ActivityCard";

export const dynamic = "force-dynamic";

export default async function Activities({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>;
}) {
  const sp = await searchParams;
  const past = sp.view === "past";
  const now = new Date();
  const [activities, departmentCount] = await Promise.all([
    prisma.activity.findMany({
      where: past
        ? {
            status: { in: ["PUBLISHED", "ARCHIVED"] },
            OR: [{ startsAt: { lt: now } }, { status: "ARCHIVED" }],
          }
        : { status: "PUBLISHED", startsAt: { gte: now } },
      include: {
        departments: {
          include: { department: true },
        },
      },
      orderBy: { startsAt: past ? "desc" : "asc" },
    }),
    prisma.department.count(),
  ]);

  return (
    <>
      <section className="page-hero">
        <div className="shell">
          <h1>أنشطة النادي الهندسي</h1>
          <p>
            تابع الأنشطة المتاحة للتسجيل الآن أو استعرض الأنشطة السابقة. كل نشاط
            يوضح الفئة المستهدفة، المكان، الموعد والسعة.
          </p>
        </div>
      </section>
      <section className="section">
        <div className="shell">
          <div className="activity-tabs">
            <Link className={!past ? "active" : ""} href="/activities">
              الجارية والمتاحة
            </Link>
            <Link
              className={past ? "active" : ""}
              href="/activities?view=past"
            >
              النشاطات الفائتة
            </Link>
          </div>
          <div className="activities-list">
            {activities.length ? (
              activities.map((activity) => (
                <ActivityCard
                  key={activity.id}
                  activity={activity}
                  departmentCount={departmentCount}
                  past={past || activity.startsAt < now}
                />
              ))
            ) : (
              <div className="guide-section">
                <h3>لا توجد أنشطة في هذه الخانة حاليًا</h3>
                <p>سيتم تحديثها من لوحة الإدارة عند إضافة أنشطة جديدة.</p>
              </div>
            )}
          </div>
        </div>
      </section>
    </>
  );
}
