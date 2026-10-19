import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";

import { prisma } from "@/lib/prisma";
import { departmentFontClass } from "@/lib/departments";
import { getDepartmentDisplayImage } from "@/lib/department-images";
import { currentActivityWhere, formatActivitySchedule } from "@/lib/activities";

export const dynamic = "force-dynamic";

const labels = [
    ["overview", "نبذة عن القسم"],
    ["fitFor", "لمن يناسب التخصص"],
    ["careersIncome", "مجالات العمل والعائد المادي التقريبي"],
    ["skillsCourses", "الدورات والمهارات المساندة"],
    ["comparisons", "الفروقات مع تخصصات قريبة"],
    ["faq", "الأسئلة الشائعة"],
] as const;

export default async function DepartmentDetail({
    params,
}: {
    params: Promise<{ slug: string }>;
}) {
    const { slug } = await params;

    const d = await prisma.department.findUnique({
        where: { slug },
        include: { guide: true },
    });

    if (!d) {
        notFound();
    }

    const [representatives, courses, activities] = await Promise.all([
        prisma.clubStructureItem.findMany({
            where: { departmentId: d.id, OR: [{ title: { contains: "مندوب" } }, { title: { contains: "delegate", mode: "insensitive" } }] },
            select: { id: true, name: true, title: true, user: { select: { id: true, name: true, role: true } } },
            orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
        }),
        prisma.libraryCourseDepartment.findMany({
            where: { departmentId: d.id }, take: 6,
            distinct: ["courseId"],
            orderBy: [{ level: "asc" }, { semester: "asc" }, { sortOrder: "asc" }],
            select: { level: true, course: { select: { id: true, name: true, code: true } } },
        }),
        prisma.activity.findMany({
            where: { AND: [currentActivityWhere(), { deletedAt: null, departments: { some: { departmentId: d.id } } }] },
            select: { id: true, title: true, location: true, startsAt: true, endsAt: true },
            orderBy: { startsAt: "asc" }, take: 4,
        }),
    ]);

    // Get the best available image
    const detailImage = await getDepartmentDisplayImage(
        d.detailImageStoredName
            ? {
                  storedName: d.detailImageStoredName,
                  originalName: d.detailImageOriginalName,
                  mime: d.detailImageMime,
                  size: d.detailImageSize,
                  updatedAt: d.detailImageUpdatedAt,
              }
            : d.profileImageStoredName
              ? {
                    storedName: d.profileImageStoredName,
                    originalName: d.profileImageOriginalName,
                    mime: d.profileImageMime,
                    size: d.profileImageSize,
                    updatedAt: d.profileImageUpdatedAt,
                }
              : null,
        d.detailImage || d.coverImage
    );

    return (
        <>
            <section className="page-hero">
                <div className="shell">
                    <h1>{d.nameAr}</h1>

                    <p
                        className={departmentFontClass(d.slug)}
                        style={{ fontFamily: "inherit" }}
                    >
                        {d.nameEn}
                    </p>
                </div>
            </section>

            <section className="section">
                <div className="shell guide">
                    <aside className="guide-cover">
                        <div className="guide-cover-image-wrap">
                            <Image
                                src={detailImage}
                                alt={d.nameAr}
                                width={1000}
                                height={1000}
                                className="guide-cover-image"
                                priority
                            />
                        </div>

                        <div className="guide-cover-info">
                            <h2>{d.nameAr}</h2>

                            <p className={departmentFontClass(d.slug)}>
                                {d.nameEn}
                            </p>
                        </div>
                    </aside>

                    <div className="guide-sections">
                        <nav className="department-hub-nav" aria-label="محتويات صفحة القسم">
                            <a href="#department-guide">دليل التخصص</a><a href="#department-courses">المواد والموارد</a><a href="#department-representatives">مندوب القسم</a><a href="#department-activities">الأنشطة</a>
                        </nav>
                        <section className="guide-section" id="department-courses">
                            <h2>المواد والموارد الدراسية</h2>
                            <p>استكشف مساقات القسم وملفاته وروابطه حسب المستوى الدراسي.</p>
                            <div className="department-hub-list">{courses.map(({ course, level }) => <Link key={`${course.id}-${level}`} href={`/library/courses/${course.id}?department=${encodeURIComponent(d.id)}`}><strong>{course.name}</strong><span>المستوى {level}{course.code ? ` · ${course.code}` : ""}</span></Link>)}</div>
                            {!courses.length && <p className="muted">لم تُضف مواد للقسم بعد.</p>}
                            <Link className="ghost-btn" href={`/library?department=${encodeURIComponent(d.id)}`}>فتح مكتبة القسم</Link>
                        </section>
                        <section className="guide-section" id="department-representatives">
                            <h2>مندوب القسم</h2>
                            {representatives.length ? representatives.map(item => <div className="department-representative" key={item.id}><strong>{item.user?.name ?? item.name}</strong><p>{item.title}</p>{item.user && (item.user.role === "MEMBER" || item.user.role === "ADMIN") && <Link className="ghost-btn" href={`/members/${item.user.id}`}>عرض الملف وروابط التواصل</Link>}</div>) : <p>لم يُعلن عن مندوب للقسم بعد.</p>}
                            <Link href="/contact" className="ghost-btn">بوابة التواصل</Link>
                        </section>
                        <section className="guide-section" id="department-activities">
                            <h2>أنشطة القسم الحالية والقادمة</h2>
                            <div className="department-hub-list">{activities.map(activity => <Link key={activity.id} href={`/activities/${activity.id}`}><strong>{activity.title}</strong><span>{formatActivitySchedule(activity.startsAt, activity.endsAt)}</span><span>{activity.location || "سيُعلن عن المكان لاحقًا"}</span></Link>)}</div>
                            {!activities.length && <p>لا توجد أنشطة حالية أو قادمة للقسم الآن.</p>}
                            <Link className="ghost-btn" href={`/activities?view=past&department=${encodeURIComponent(d.id)}`}>أرشيف أنشطة القسم</Link>
                        </section>
                        <h2 id="department-guide">دليل التخصص</h2>
                        {labels.map(([key, label]) => {
                            const text = d.guide?.[key] || "";

                            return (
                                <section
                                    key={key}
                                    className="guide-section"
                                >
                                    <h3>{label}</h3>

                                    {text ? (
                                        <p>{text}</p>
                                    ) : (
                                        <div className="empty-guide">
                                            سيظهر المحتوى المعتمد هنا عند توفره.
                                        </div>
                                    )}
                                </section>
                            );
                        })}
                    </div>
                </div>
            </section>
        </>
    );
}
