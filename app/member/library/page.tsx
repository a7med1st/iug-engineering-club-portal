import Link from "next/link";
import { ArrowRight, Download, ExternalLink, FileText, Folder, Link2, Plus } from "lucide-react";
import LibraryUploader from "@/components/admin/library/LibraryUploader";
import { levelNames, semesterNames } from "@/lib/library/levels";
import { requireMemberLibraryAccess } from "@/lib/library/member";
import { prisma } from "@/lib/prisma";
import { addMemberLibraryFolder, addMemberLibraryLink } from "./actions";
import styles from "./library.module.css";

export const dynamic = "force-dynamic";

type Params = { department?: string; course?: string; folder?: string; success?: string; error?: string };

export default async function MemberLibraryPage({ searchParams }: { searchParams: Promise<Params> }) {
  const { departmentIds } = await requireMemberLibraryAccess();
  const params = await searchParams;
  const departments = departmentIds.length ? await prisma.department.findMany({
    where: { id: { in: departmentIds } },
    select: { id: true, nameAr: true },
    orderBy: [{ sortOrder: "asc" }, { nameAr: "asc" }],
  }) : [];
  const department = departments.find((item) => item.id === params.department) ?? departments[0] ?? null;
  const courses = department ? await prisma.libraryCourse.findMany({
    where: { departmentId: department.id },
    select: { id: true, name: true, code: true, level: true, semester: true },
    orderBy: [{ level: "asc" }, { semester: "asc" }, { sortOrder: "asc" }, { name: "asc" }],
  }) : [];
  const course = courses.find((item) => item.id === params.course) ?? courses[0] ?? null;
  const folders = course ? await prisma.libraryFolder.findMany({
    where: { courseId: course.id, isVisible: true },
    select: { id: true, name: true, _count: { select: { files: true, links: true } } },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  }) : [];
  const folder = folders.find((item) => item.id === params.folder) ?? folders[0] ?? null;
  const [links, files] = folder ? await Promise.all([
    prisma.libraryLink.findMany({ where: { folderId: folder.id }, select: { id: true, title: true, url: true }, orderBy: [{ createdAt: "desc" }, { title: "asc" }] }),
    prisma.libraryFile.findMany({ where: { folderId: folder.id }, select: { id: true, title: true, mimeType: true }, orderBy: [{ createdAt: "desc" }, { title: "asc" }], take: 30 }),
  ]) : [[], []];
  const href = (courseId?: string, folderId?: string) => {
    const values = new URLSearchParams();
    if (department) values.set("department", department.id);
    if (courseId) values.set("course", courseId);
    if (folderId) values.set("folder", folderId);
    return `/member/library?${values}`;
  };

  return <main className={styles.page}>
    <header className={styles.head}>
      <Link href="/member" className={styles.back}><ArrowRight size={17} /> لوحتي</Link>
      <h1>مكتبة قسمك</h1>
      {department && <p>{department.nameAr}</p>}
    </header>
    {params.success && <p className={styles.success} role="status">{params.success}</p>}
    {params.error && <p className={styles.error} role="alert">{params.error}</p>}
    {!department ? <p className={styles.empty}>لا يوجد قسم مرتبط بحسابك. اطلب من الإدارة ربط القسم بحسابك.</p> : <>
      {departments.length > 1 && <form className={styles.departmentForm} action="/member/library">
        <label htmlFor="member-library-department">القسم</label>
        <select id="member-library-department" name="department" defaultValue={department.id}>{departments.map((item) => <option value={item.id} key={item.id}>{item.nameAr}</option>)}</select>
        <button type="submit">عرض</button>
      </form>}
      <div className={styles.layout}>
        <nav className={styles.courseNav} aria-label="مساقات القسم">
          <h2>المساقات</h2>
          {levelNames.map((name, index) => {
            const levelCourses = courses.filter((item) => item.level === index + 1);
            if (!levelCourses.length) return null;
            return <div className={styles.level} key={name}><h3>المستوى {name}</h3>{semesterNames.map((semesterName, semesterIndex) => <div key={semesterName}><h4 className={styles.semesterHeading}>{semesterName}</h4>{levelCourses.filter((item) => item.semester === semesterIndex + 1).map((item) => <Link href={href(item.id)} className={item.id === course?.id ? styles.selected : ""} key={item.id} aria-current={item.id === course?.id ? "page" : undefined}>
              <span>{item.name}</span>{item.code && <small>{item.code}</small>}
            </Link>)}</div>)}</div>;
          })}
          {!courses.length && <p className={styles.empty}>لا توجد مساقات في هذا القسم بعد.</p>}
        </nav>
        <div className={styles.content}>
          {course && <>
            <div className={styles.courseHead}><div><h2>{course.name}</h2>{course.code && <p>{course.code}</p>}</div>
              <details className={styles.addControl}><summary><Plus size={17} /> مجلد</summary><form action={addMemberLibraryFolder} className={styles.form}>
                <input type="hidden" name="courseId" value={course.id} />
                <input name="name" required maxLength={120} placeholder="اسم المجلد" aria-label="اسم المجلد" />
                <button type="submit">إضافة المجلد</button>
              </form></details>
            </div>
            <nav className={styles.folders} aria-label="مجلدات المساق">{folders.map((item) => <Link href={href(course.id, item.id)} className={item.id === folder?.id ? styles.selected : ""} key={item.id} aria-current={item.id === folder?.id ? "page" : undefined}>
              <Folder size={18} /><span>{item.name}<small>{item._count.links} رابط · {item._count.files} ملف</small></span>
            </Link>)}{!folders.length && <p className={styles.empty}>لا توجد مجلدات بعد.</p>}</nav>
            {folder && <section className={styles.folderContent}>
              <div className={styles.folderHead}><h3>{folder.name}</h3>
                <details className={styles.addControl}><summary><Plus size={17} /> رابط</summary><form action={addMemberLibraryLink} className={styles.form}>
                  <input type="hidden" name="folderId" value={folder.id} />
                  <input name="title" required maxLength={180} placeholder="عنوان المحاضرة" aria-label="عنوان المحاضرة" />
                  <input name="url" type="url" required maxLength={2048} dir="ltr" placeholder="https://" aria-label="رابط المحاضرة" />
                  <button type="submit">إضافة الرابط</button>
                </form></details>
              </div>
              {links.length > 0 && <div className={styles.items}>{links.map((item) => <a href={item.url} target="_blank" rel="noopener noreferrer" key={item.id}><Link2 size={17} /><span>{item.title}</span><ExternalLink size={16} /></a>)}</div>}
              {files.length > 0 && <div className={styles.items}>{files.map((item) => <a href={`/member/library/files/${item.id}?download=1`} key={item.id}><FileText size={17} /><span>{item.title}</span><Download size={16} /></a>)}</div>}
              <LibraryUploader folderId={folder.id} uploadUrl="/member/library/upload" />
            </section>}
          </>}
        </div>
      </div>
    </>}
  </main>;
}
