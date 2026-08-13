import Image from "next/image";
import Link from "next/link";
import { CalendarCheck2, GraduationCap, UsersRound, Compass, ArrowLeft } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { departmentFontClass } from "@/lib/departments";

export default async function HomePage() {
  const departments = await prisma.department.findMany({ orderBy: { sortOrder: "asc" } });
  const upcoming = await prisma.activity.count({ where: { status: "PUBLISHED", startsAt: { gte: new Date() } } });
  return <>
    <section className="hero"><div className="shell hero-grid"><div className="hero-copy"><h1>هندسة تبدأ من <span>الطالب</span><br />وتصل إلى الأثر.</h1><p>بوابة النادي الهندسي للطلاب: أنشطة، أدلة للتخصصات، هيكلية النادي، وفرص تساعدك تبني مسارك داخل الجامعة وخارجها.</p><div className="hero-actions"><Link className="primary-btn" href="/activities">استكشف الأنشطة <ArrowLeft size={18} /></Link><Link className="ghost-btn" href="/departments">دليل الأقسام</Link></div></div><div className="campus-mosaic"><Image className="main" src="/images/campus/campus-1.webp" width={640} height={430} alt="الجامعة الإسلامية بغزة" priority /><Image src="/images/campus/campus-2.webp" width={547} height={365} alt="حرم الجامعة الإسلامية بغزة" /><Image src="/images/campus/campus-3.webp" width={640} height={362} alt="مدخل الجامعة الإسلامية بغزة" /></div></div></section>
    <div className="shell stats"><div className="stats-grid"><div className="stat"><strong>8</strong><span>أقسام هندسية</span></div><div className="stat"><strong>{upcoming}</strong><span>أنشطة متاحة الآن</span></div><div className="stat"><strong>2</strong><span>بوابات دخول منفصلة</span></div><div className="stat"><strong>1</strong><span>مجتمع هندسي واحد</span></div></div></div>
    <section className="section"><div className="shell"><div className="section-head"><div><h2>كل ما يحتاجه الطالب في مكان واحد</h2></div></div><div className="feature-grid"><div className="feature-card"><div className="feature-icon"><CalendarCheck2 /></div><h3>أنشطة النادي</h3><p>عرض الأنشطة الجارية والمنتهية، مع تفاصيل القسم، الموعد، المكان، السعة ورابط التسجيل.</p></div><div className="feature-card"><div className="feature-icon"><GraduationCap /></div><h3>دليل الأقسام</h3><p>محتوى قابل للإدارة يغطي طبيعة التخصص، مجالات العمل، المهارات، الفروقات والأسئلة الشائعة.</p></div><div className="feature-card"><div className="feature-icon"><UsersRound /></div><h3>هيكلية النادي</h3><p>صفحة واضحة تعرف الطالب بالمناديب والهيكلية العامة للنادي الهندسي.</p></div></div></div></section>
    <section className="section" style={{ paddingTop: 0 }}><div className="shell"><div className="section-head"><div><h2>اكتشف أقسام كلية الهندسة</h2></div><Link className="ghost-btn" href="/departments">عرض جميع الأقسام</Link></div><div className="dept-grid">{departments.map(d => <Link key={d.id} href={`/departments/${d.slug}`} className="dept-card"><Image src={d.coverImage} alt={d.nameAr} fill sizes="(max-width: 700px) 100vw, 50vw" /><div className="dept-card-content"><h3>{d.nameAr}</h3><div className={`en ${departmentFontClass(d.slug)}`}>{d.nameEn}</div></div></Link>)}</div></div></section>
  </>;
}
