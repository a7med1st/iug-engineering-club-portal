import Link from "next/link";
import { BookOpen, Folder, Search, BrainCircuit, Building2, HardHat, Factory, Cog, Zap, Bot, Monitor, ArrowLeft } from "lucide-react";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getStudentLibraryDepartment } from "@/lib/library/student";
import { levelNames, semesterNames } from "@/lib/library/levels";
import styles from "./library.module.css";
import LibrarySubmissionForm from "@/components/library/LibrarySubmissionForm";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";
const departmentIcons: Record<string, typeof Monitor> = {
  "computer-engineering": Monitor, "ai-engineering": BrainCircuit, architecture: Building2,
  "civil-engineering": HardHat, "industrial-engineering": Factory, "mechanical-engineering": Cog,
  "electrical-engineering": Zap, "intelligent-systems": Bot, "information-technology": Monitor,
};

export default async function LibraryPage({ searchParams }: { searchParams: Promise<{ level?: string; q?: string; department?: string }> }) {
  const params = await searchParams;
  const departments = await prisma.department.findMany({ where: { slug: { not: "information-technology" } }, select: { id: true, nameAr: true, slug: true }, orderBy: [{ sortOrder: "asc" }, { nameAr: "asc" }] });
  if (!params.department) return <main className={styles.page}>
    <header className={styles.intro}><BookOpen size={25} aria-hidden="true"/><h1>المكتبة الهندسية</h1><p>اختر التخصص لاستكشاف مساقاته ومواده الدراسية.</p></header>
    <div className={styles.departmentGrid}>{departments.map(item => {
      const Icon = departmentIcons[item.slug] ?? BookOpen;
      return <Link key={item.id} href={`/library?department=${encodeURIComponent(item.id)}`} className={styles.departmentCard}>
        <span className={styles.departmentIcon}><Icon size={36} strokeWidth={1.6} aria-hidden="true"/></span>
        <h2>{item.nameAr}</h2><span className={styles.departmentExplore}>استكشف المكتبة <ArrowLeft size={16} aria-hidden="true"/></span>
      </Link>;
    })}</div>
    {!departments.length && <div className={styles.empty}><p>لم تتم إضافة تخصصات إلى المكتبة بعد.</p></div>}
  </main>;
  const preferred = await getStudentLibraryDepartment(params.department);
  const department = preferred ?? departments[0];
  const auth = await getCurrentUser();
  const requestedLevel = Number(params.level);
  const level = Number.isInteger(requestedLevel) && requestedLevel >= 1 && requestedLevel <= 5 ? requestedLevel : 1;
  const query = (params.q ?? "").trim().slice(0, 100);

  if (!department) return <main className={styles.page}>
    <header className={styles.intro}><BookOpen size={25} /><h1>مكتبة التخصص</h1></header>
    <div className={styles.empty}><h2>المكتبة غير متاحة بعد</h2><p>لم تتم إضافة تخصصات إلى المكتبة بعد.</p></div>
  </main>;

  const courseWhere: Prisma.LibraryCourseWhereInput = {
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
  const [counts, placements] = await Promise.all([
    prisma.libraryCourseDepartment.groupBy({ by: ["level"], where: { departmentId: department.id }, _count: { _all: true } }),
    prisma.libraryCourseDepartment.findMany({
      where: { departmentId: department.id, level, course: courseWhere },
      orderBy: [{ semester: "asc" }, { sortOrder: "asc" }, { course: { name: "asc" } }],
      select: { semester: true, course: { select: { id: true, name: true, code: true, description: true, _count: { select: { folders: { where: { isVisible: true } } } } } } },
    }),
  ]);
  const courses = placements.map(({ course, semester }) => ({ ...course, semester }));
  const mySubmissions = auth?.user.role === "STUDENT" ? await prisma.librarySubmission.findMany({
    where: { studentId: auth.user.id, departmentId: department.id },
    select: { id: true, title: true, status: true, createdAt: true },
    orderBy: { createdAt: "desc" },
    take: 5,
  }) : [];

  return <main className={styles.page}>
    <header className={styles.intro}>
      <BookOpen size={25} aria-hidden="true" />
      <h1>مكتبة {department.nameAr}</h1>
      <p>مساقات ومواد هندسية مرتبة حسب التخصص والمستوى الدراسي.</p>
    </header>

    <Link href="/library" className={styles.back}>كل التخصصات</Link>
    {auth?.user.role === "STUDENT" && auth.user.departmentId === department.id && <LibrarySubmissionForm />}
    {mySubmissions.length > 0 && <section className={styles.mySubmissions}><h2>آخر ملفاتي المرسلة</h2><ul>{mySubmissions.map((item) => <li key={item.id}><span>{item.title}</span><strong>{item.status === "PENDING" ? "قيد المراجعة" : item.status === "APPROVED" ? "منشور" : "مرفوض"}</strong></li>)}</ul></section>}

    <form action="/library" className={styles.searchForm} role="search">
      <input type="hidden" name="level" value={level} />
      <input type="hidden" name="department" value={department.id} />
      <Search size={19} aria-hidden="true" />
      <input type="search" name="q" defaultValue={query} placeholder="ابحث عن مساق أو ملف..." aria-label="ابحث في مكتبة التخصص" maxLength={100} />
      <button type="submit">بحث</button>
    </form>

    <nav className={styles.levels} aria-label="المستويات الدراسية">
      {levelNames.map((name, index) => {
        const number = index + 1;
        const count = counts.find((item) => item.level === number)?._count._all ?? 0;
        return <Link key={number} href={`/library?department=${encodeURIComponent(department.id)}&level=${number}${query ? `&q=${encodeURIComponent(query)}` : ""}`} className={`${styles.levelTab} ${level === number ? styles.active : ""}`} aria-current={level === number ? "page" : undefined}>
          <strong>المستوى {name}</strong><span>{count} مساق</span>
        </Link>;
      })}
    </nav>

    <div className={styles.sectionHeading}><h2>مساقات المستوى {levelNames[level - 1]}</h2><p>المساقات المتاحة حاليًا في مكتبة {department.nameAr}.</p></div>
    {semesterNames.map((semesterName, semesterIndex) => <section className={styles.section} key={semesterName}>
      <div className={styles.sectionHeading}><h3>{semesterName}</h3></div>
      {courses.some((course) => course.semester === semesterIndex + 1) ? <div className={styles.courseGrid}>{courses.filter((course) => course.semester === semesterIndex + 1).map((course) => <Link href={`/library/courses/${course.id}?department=${encodeURIComponent(department.id)}`} className={styles.courseCard} key={course.id}>
        <h3>{course.name}</h3>
        {course.code && <span className={styles.code}>{course.code}</span>}
        {course.description && <p>{course.description}</p>}
        <span className={styles.cardFoot}><span><Folder size={16} aria-hidden="true" /> {course._count.folders} مجلد</span><span>استكشاف المساق</span></span>
      </Link>)}</div> : <div className={styles.empty}><p>{query ? "لا توجد نتائج مطابقة للبحث في هذا الفصل." : "لا توجد مساقات في هذا الفصل بعد."}</p></div>}
    </section>)}
  </main>;
}
