import Image from "next/image";
import Link from "next/link";

import {
  CalendarCheck2,
  GraduationCap,
  UsersRound,
  Compass,
  ArrowLeft,
} from "lucide-react";

import { prisma } from "@/lib/prisma";
import { departmentFontClass } from "@/lib/departments";
import { currentActivityWhere, pastActivityWhere } from "@/lib/activities";
import PastActivityCard from "@/components/PastActivityCard";

export default async function HomePage() {
  const now = new Date();
  const [departments, upcoming, pastActivities, departmentCount] =
    await Promise.all([
      prisma.department.findMany({
        orderBy: { sortOrder: "asc" },
      }),
      prisma.activity.count({
        where: currentActivityWhere(now),
      }),
      prisma.activity.findMany({
        where: pastActivityWhere(now),
        select: {
          id: true,
          title: true,
          description: true,
          location: true,
          startsAt: true,
          coverImageUrl: true,
          departments: {
            select: {
              department: {
                select: { nameAr: true, sortOrder: true },
              },
            },
          },
        },
        orderBy: { startsAt: "desc" },
        take: 3,
      }),
      prisma.department.count(),
    ]);

  return (
    <>
      <section className="hero">
        <div className="shell hero-grid">
          <div className="hero-copy">
            <h1>
              هندسة تبدأ من <span>الطالب</span>
              <br />
              وتصل إلى الأثر.
            </h1>

            <p>
              بوابة النادي الهندسي للطلاب: أنشطة، أدلة للتخصصات، هيكلية
              النادي، وفرص تساعدك تبني مسارك داخل الجامعة وخارجها.
            </p>

            <div className="hero-actions">
              <Link
                className="primary-btn fancy-primary-btn"
                href="/activities"
              >
                <span>استكشف الأنشطة</span>
                <ArrowLeft size={18} />
              </Link>

              <Link
                className="ghost-btn fancy-outline-btn"
                href="/departments"
              >
                <span>دليل الأقسام</span>
                <ArrowLeft size={16} />
              </Link>
            </div>
          </div>

          <div className="campus-mosaic">
            <Image
              className="main"
              src="/images/campus/campus-1.webp"
              width={640}
              height={430}
              alt="الجامعة الإسلامية بغزة"
              priority
            />

            <Image
              src="/images/campus/campus-2.webp"
              width={547}
              height={365}
              alt="حرم الجامعة الإسلامية بغزة"
            />

            <Image
              src="/images/campus/campus-3.webp"
              width={640}
              height={362}
              alt="مدخل الجامعة الإسلامية بغزة"
            />
          </div>
        </div>
      </section>

      <div className="shell stats">
        <div className="stats-grid">
          <div className="stat">
            <strong>8</strong>
            <span>أقسام هندسية</span>
          </div>

          <div className="stat">
            <strong>{upcoming}</strong>
            <span>أنشطة متاحة الآن</span>
          </div>

          <div className="stat">
            <strong>1</strong>
            <span>مجتمع هندسي واحد</span>
          </div>
        </div>
      </div>

      <section className="section">
        <div className="shell">
          <div className="section-head">
            <div>
              <h2>كل ما يحتاجه الطالب في مكان واحد</h2>
            </div>
          </div>

          <div className="feature-grid">
            <div className="feature-card">
              <div className="feature-icon">
                <CalendarCheck2 />
              </div>

              <h3>أنشطة النادي</h3>

              <p>
                عرض الأنشطة الجارية والمنتهية، مع تفاصيل القسم، الموعد،
                المكان، السعة ورابط التسجيل.
              </p>
            </div>

            <div className="feature-card">
              <div className="feature-icon">
                <GraduationCap />
              </div>

              <h3>دليل الأقسام</h3>

              <p>
                محتوى قابل للإدارة يغطي طبيعة التخصص، مجالات العمل،
                المهارات، الفروقات والأسئلة الشائعة.
              </p>
            </div>

            <div className="feature-card">
              <div className="feature-icon">
                <UsersRound />
              </div>

              <h3>هيكلية النادي</h3>

              <p>
                صفحة واضحة تعرف الطالب بالمناديب والهيكلية العامة للنادي
                الهندسي.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="section" style={{ paddingTop: 0 }}>
        <div className="shell">
          <div className="section-head">
            <div>
              <h2>اكتشف أقسام كلية الهندسة</h2>
            </div>

            <Link
              className="ghost-btn fancy-outline-btn"
              href="/departments"
            >
              <span>عرض جميع الأقسام</span>
              <ArrowLeft size={16} />
            </Link>
          </div>

          <div className="dept-grid">
            {departments.map((d) => (
              <Link
                key={d.id}
                href={`/departments/${d.slug}`}
                className="dept-card"
              >
                <Image
                  src={d.coverImage}
                  alt={d.nameAr}
                  fill
                  sizes="(max-width: 700px) 100vw, 50vw"
                />

                <div className="dept-card-content">
                  <h3>{d.nameAr}</h3>

                  <div className={`en ${departmentFontClass(d.slug)}`}>
                    {d.nameEn}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {pastActivities.length > 0 && (
        <section className="section past-activities-home">
          <div className="shell">
            <div className="section-head past-activities-section-head">
              <div>
                <h2>من أنشطتنا السابقة</h2>
                <p>
                  محطات أنجزها طلبة الهندسة، وتجارب صنعت أثرًا يستمر بعد انتهاء
                  النشاط.
                </p>
              </div>

              <Link
                className="primary-btn fancy-primary-btn past-activities-all-btn"
                href="/activities?view=past"
              >
                <span>عرض جميع الأنشطة السابقة</span>
                <ArrowLeft size={18} />
              </Link>
            </div>

            <div className="past-activities-grid">
              {pastActivities.map((activity) => (
                <PastActivityCard
                  key={activity.id}
                  activity={activity}
                  departmentCount={departmentCount}
                />
              ))}
            </div>
          </div>
        </section>
      )}
    </>
  );
}
