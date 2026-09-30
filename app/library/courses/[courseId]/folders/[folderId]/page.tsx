import Link from "next/link";
import { ArrowRight, Download, ExternalLink, Eye, FileText, Folder, Link2, Search } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { levelNames } from "@/lib/library/levels";
import { getStudentLibraryFolder } from "@/lib/library/student";
import { directLibraryChildren } from "@/lib/library/tree";
import { isPreviewableLibraryMime } from "@/lib/library/file-response";
import styles from "../../../../library.module.css";

export const dynamic = "force-dynamic";
const pageSize = 20;

export default async function LibraryFolderPage({ params, searchParams }: {
  params: Promise<{ courseId: string; folderId: string }>;
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const { courseId, folderId } = await params;
  const { course, folder, allFolders, folderBreadcrumb } = await getStudentLibraryFolder(courseId, folderId);
  const childFolders = directLibraryChildren(allFolders, folder.id).filter((item) => item.isVisible);
  const paramsQuery = await searchParams;
  const query = (paramsQuery.q ?? "").trim().slice(0, 100);
  const requestedPage = Number(paramsQuery.page);
  const page = Number.isInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1;
  const fileWhere = { folderId: folder.id, ...(query ? { title: { contains: query, mode: "insensitive" as const } } : {}) };
  const linkWhere = { folderId: folder.id, ...(query ? { title: { contains: query, mode: "insensitive" as const } } : {}) };
  const [totalFiles, links] = await Promise.all([
    prisma.libraryFile.count({ where: fileWhere }),
    prisma.libraryLink.findMany({ where: linkWhere, orderBy: [{ createdAt: "desc" }, { title: "asc" }], select: { id: true, title: true, url: true } }),
  ]);
  const pageCount = Math.max(1, Math.ceil(totalFiles / pageSize));
  const currentPage = Math.min(page, pageCount);
  const files = await prisma.libraryFile.findMany({
    where: fileWhere,
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }, { title: "asc" }],
    skip: (currentPage - 1) * pageSize,
    take: pageSize,
    select: { id: true, title: true, mimeType: true, size: true, createdAt: true },
  });
  const base = `/library/courses/${course.id}/folders/${folder.id}`;
  const pageHref = (number: number) => `${base}?page=${number}${query ? `&q=${encodeURIComponent(query)}` : ""}`;

  return <main className={styles.page}>
    <nav className={styles.breadcrumb} aria-label="مسار المكتبة">
      <Link href="/library">مكتبتي</Link><span>›</span>
      <Link href={`/library?level=${course.level}`}>المستوى {levelNames[course.level - 1]}</Link><span>›</span>
      <Link href={`/library/courses/${course.id}`}>{course.name}</Link><span>›</span>
      {folderBreadcrumb.map((item, index) => index === folderBreadcrumb.length - 1
        ? <span aria-current="page" key={item.id}>{item.name}</span>
        : <span className={styles.breadcrumbPart} key={item.id}><Link href={`/library/courses/${course.id}/folders/${item.id}`}>{item.name}</Link><span>›</span></span>)}
    </nav>
    <Link href={folder.parentId ? `/library/courses/${course.id}/folders/${folder.parentId}` : `/library/courses/${course.id}`} className={styles.back}><ArrowRight size={17} /> رجوع</Link>
    <header className={styles.detailHead}><h1>{folder.name}</h1><p>{totalFiles} ملف · {links.length} رابط</p></header>

    <form action={base} className={styles.searchForm} role="search">
      <Search size={19} aria-hidden="true" /><input type="search" name="q" defaultValue={query} placeholder="ابحث داخل المجلد..." aria-label="ابحث داخل المجلد" maxLength={100} /><button type="submit">بحث</button>
    </form>

    {childFolders.length > 0 && <section className={styles.section}><div className={styles.sectionHeading}><h2>المجلدات الفرعية</h2></div>
      <div className={styles.folderGrid}>{childFolders.map((child) => <Link className={styles.folderCard} href={`/library/courses/${course.id}/folders/${child.id}`} key={child.id}>
        <Folder size={22} aria-hidden="true" /><span><strong>{child.name}</strong></span><span className={styles.explore}>فتح المجلد</span>
      </Link>)}</div>
    </section>}

    {links.length > 0 && <section className={styles.section}><div className={styles.sectionHeading}><h2>روابط المحاضرات</h2></div>
      <div className={styles.resourceList}>{links.map((link) => <a className={styles.resourceRow} href={link.url} target="_blank" rel="noopener noreferrer" key={link.id}>
        <Link2 size={20} aria-hidden="true" /><strong>{link.title}</strong><span className={styles.openLink}>فتح الرابط <ExternalLink size={16} aria-hidden="true" /></span>
      </a>)}</div>
    </section>}

    <section className={styles.section}><div className={styles.sectionHeading}><h2>الملفات</h2><p>{totalFiles} ملف</p></div>
      {files.length ? <div className={styles.resourceList}>{files.map((file) => {
        const previewable = isPreviewableLibraryMime(file.mimeType);
        const type = file.mimeType === "application/pdf" ? "PDF" : file.mimeType.split("/").pop()?.toUpperCase() ?? "ملف";
        return <div className={styles.resourceRow} key={file.id}>
          <FileText size={20} aria-hidden="true" />
          <div className={styles.fileInfo}><strong>{file.title}</strong><small>{type} · {(file.size / 1024 / 1024).toFixed(2)} MB · {new Intl.DateTimeFormat("ar-PS").format(file.createdAt)}</small></div>
          <div className={styles.fileActions}>
            {previewable && <a href={`/library/files/${file.id}`} target="_blank" rel="noopener noreferrer" aria-label={`عرض ${file.title}`} title="عرض"><Eye size={17} /><span>عرض</span></a>}
            <a href={`/library/files/${file.id}?download=1`} aria-label={`تحميل ${file.title}`} title="تحميل"><Download size={17} /><span>تحميل</span></a>
          </div>
        </div>;
      })}</div> : <div className={styles.empty}><p>{query ? "لا توجد ملفات مطابقة للبحث." : "لا توجد ملفات في هذا المجلد بعد."}</p></div>}
      {pageCount > 1 && <nav className={styles.pagination} aria-label="صفحات الملفات">
        {currentPage > 1 && <Link href={pageHref(currentPage - 1)}>السابق</Link>}
        <span>صفحة {currentPage} من {pageCount}</span>
        {currentPage < pageCount && <Link href={pageHref(currentPage + 1)}>التالي</Link>}
      </nav>}
    </section>
  </main>;
}
