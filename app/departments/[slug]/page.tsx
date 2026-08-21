import Image from "next/image";
import { notFound } from "next/navigation";

import { prisma } from "@/lib/prisma";
import { departmentFontClass } from "@/lib/departments";

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
                                src={d.detailImage || d.coverImage}
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
                                            لم تتم إضافة محتوى معتمد لهذا الجزء بعد.
                                            يمكن للإدارة إضافته من لوحة التحكم.
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