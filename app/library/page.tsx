import Link from "next/link";
import { BookOpen, Folder, Search } from "lucide-react";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getStudentLibraryDepartment } from "@/lib/library/student";
import { levelNames, semesterNames } from "@/lib/library/levels";
import styles from "./library.module.css";

export const dynamic = "force-dynamic";

export default async function LibraryPage({ searchParams }: { searchParams: Promise<{ level?: string; q?: string }> }) {
  const department = await getStudentLibraryDepartment();
  const params = await searchParams;
  const requestedLevel = Number(params.level);
  const level = Number.isInteger(requestedLevel) && requestedLevel >= 1 && requestedLevel <= 5 ? requestedLevel : 1;
  const query = (params.q ?? "").trim().slice(0, 100);

  if (!department) return <main className={styles.page}>
    <header className={styles.intro}><BookOpen size={25} /><h1>مكتبة التخصص</h1></header>
    <div className={styles.empty}><h2>المكتبة غير متاحة بعد</h2><p>لا يوجد تخصص مرتبط بحسابك. أضف تخصصك من بيانات الحساب ثم عُد إلى المكتبة.</p><Link href="/student" className={styles.primaryLink}>العودة إلى حسابي</Link></div>
  </main>;

  const where: Prisma.LibraryCourseWhereInput = {
    departmentId: department.id,
    level,
    ...(query ? { OR: [
      { name: { contains: query, mode: "insensitive" } },
      { code: { contains: query, mode: "insensitive" } },
      { folders: { some: { isVisible: true, OR: [
        { name: { contains: query, mode: "insensitive" } },
        { files: { some: { title: { contains: query, mode: "insensitive" } } } },
        { links: { some: { title: { contains: query, mode: "insensitive" } } } },
      ] } } },
    ] } : {}),
  };
  const [counts, courses] = await Promise.all([
    prisma.libraryCourse.groupBy({ by: ["level"], where: { departmentId: department.id }, _count: { _all: true } }),
    prisma.libraryCourse.findMany({
      where,
      orderBy: [{ semester: "asc" }, { sortOrder: "asc" }, { name: "asc" }],
      select: { id: true, name: true, code: true, description: true, semester: true, _count: { select: { folders: { where: { isVisible: true } } } } },
    }),
  ]);

  return <main className={styles.page}>
    <header className={styles.intro}>
      <BookOpen size={25} aria-hidden="true" />
      <h1>مكتبة {department.nameAr}</h1>
      <p>مساقات ومواد تخصصك مرتبة حسب المستوى الدراسي.</p>
    </header>

    <form action="/library" className={styles.searchForm} role="search">
      <input type="hidden" name="level" value={level} />
      <Search size={19} aria-hidden="true" />
      <input type="search" name="q" defaultValue={query} placeholder="ابحث عن مساق أو ملف..." aria-label="ابحث في مكتبة التخصص" maxLength={100} />
      <button type="submit">بحث</button>
    </form>

    <nav className={styles.levels} aria-label="المستويات الدراسية">
      {levelNames.map((name, index) => {
        const number = index + 1;
        const count = counts.find((item) => item.level === number)?._count._all ?? 0;
        return <Link key={number} href={`/library?level=${number}${query ? `&q=${encodeURIComponent(query)}` : ""}`} className={`${styles.levelTab} ${level === number ? styles.active : ""}`} aria-current={level === number ? "page" : undefined}>
          <strong>المستوى {name}</strong><span>{count} مساق</span>
        </Link>;
      })}
    </nav>

    <div className={styles.sectionHeading}><h2>مساقات المستوى {levelNames[level - 1]}</h2><p>المساقات المتاحة حاليًا في مكتبة {department.nameAr}.</p></div>
    {semesterNames.map((semesterName, semesterIndex) => <section className={styles.section} key={semesterName}>
      <div className={styles.sectionHeading}><h3>{semesterName}</h3></div>
      {courses.some((course) => course.semester === semesterIndex + 1) ? <div className={styles.courseGrid}>{courses.filter((course) => course.semester === semesterIndex + 1).map((course) => <Link href={`/library/courses/${course.id}`} className={styles.courseCard} key={course.id}>
        <h3>{course.name}</h3>
        {course.code && <span className={styles.code}>{course.code}</span>}
        {course.description && <p>{course.description}</p>}
        <span className={styles.cardFoot}><span><Folder size={16} aria-hidden="true" /> {course._count.folders} مجلد</span><span>استكشاف المساق</span></span>
      </Link>)}</div> : <div className={styles.empty}><p>{query ? "لا توجد نتائج مطابقة للبحث في هذا الفصل." : "لا توجد مساقات في هذا الفصل بعد."}</p></div>}
    </section>)}
  </main>;
}
