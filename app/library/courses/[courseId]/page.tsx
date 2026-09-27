import Link from "next/link";
import { ArrowRight, Folder } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { levelNames } from "@/lib/library/levels";
import { getStudentLibraryCourse } from "@/lib/library/student";
import styles from "../../library.module.css";

export const dynamic = "force-dynamic";

export default async function LibraryCoursePage({ params }: { params: Promise<{ courseId: string }> }) {
  const { courseId } = await params;
  const { course } = await getStudentLibraryCourse(courseId);
  const folders = await prisma.libraryFolder.findMany({
    where: { courseId: course.id, isVisible: true },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: { id: true, name: true, _count: { select: { files: true, links: true } } },
  });

  return <main className={styles.page}>
    <nav className={styles.breadcrumb} aria-label="مسار المكتبة">
      <Link href="/library">مكتبتي</Link><span>›</span>
      <Link href={`/library?level=${course.level}`}>المستوى {levelNames[course.level - 1]}</Link><span>›</span>
      <span aria-current="page">{course.name}</span>
    </nav>
    <Link href={`/library?level=${course.level}`} className={styles.back}><ArrowRight size={17} /> رجوع للمستوى</Link>
    <header className={styles.detailHead}><h1>{course.name}</h1>{course.code && <span className={styles.code}>{course.code}</span>}{course.description && <p>{course.description}</p>}</header>
    <section className={styles.section}><div className={styles.sectionHeading}><h2>محتويات المساق</h2></div>
      {folders.length ? <div className={styles.folderGrid}>{folders.map((folder) => <Link className={styles.folderCard} href={`/library/courses/${course.id}/folders/${folder.id}`} key={folder.id}>
        <Folder size={22} aria-hidden="true" /><span><strong>{folder.name}</strong><small>{folder._count.files} ملف · {folder._count.links} رابط</small></span><span className={styles.explore}>فتح المجلد</span>
      </Link>)}</div> : <div className={styles.empty}><p>لا توجد مجلدات متاحة لهذا المساق بعد.</p></div>}
    </section>
  </main>;
}
