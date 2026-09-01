import Image from "next/image";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { departmentFontClass } from "@/lib/departments";
import { getDepartmentDisplayImage } from "@/lib/department-images";

export default async function DepartmentsPage() {
  const departments = await prisma.department.findMany({
    orderBy: { sortOrder: "asc" },
  });

  // Prepare image URLs
  const deptImages = await Promise.all(
    departments.map(async (d) => ({
      id: d.id,
      image: await getDepartmentDisplayImage(
        d.profileImageStoredName
          ? {
              storedName: d.profileImageStoredName,
              originalName: d.profileImageOriginalName,
              mime: d.profileImageMime,
              size: d.profileImageSize,
              updatedAt: d.profileImageUpdatedAt,
            }
          : null,
        d.coverImage
      ),
    }))
  );

  const imageMap = Object.fromEntries(deptImages.map((d) => [d.id, d.image]));

  return (
    <>
      <section className="page-hero">
        <div className="shell">
          <h1>دليل الأقسام الهندسية</h1>
          <p>
            كل قسم له صفحة مستقلة. المحتوى التفصيلي متروك للإدارة والمناديب
            ليتم إضافته عند الجاهزية بدل نشر معلومات غير معتمدة.
          </p>
        </div>
      </section>

      <section className="section">
        <div className="shell dept-grid">
          {departments.map((d) => (
            <Link
              key={d.id}
              href={`/departments/${d.slug}`}
              className="dept-card"
            >
              <Image
                src={imageMap[d.id]}
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
      </section>
    </>
  );
}
