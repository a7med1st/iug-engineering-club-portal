import Link from "next/link";
import { ArrowRight, Download, ExternalLink, FileText, Folder, Link2, Pencil, Plus, Trash2 } from "lucide-react";
import LibraryUploader from "@/components/admin/library/LibraryUploader";
import ConfirmDeleteButton from "@/components/admin/library/ConfirmDeleteButton";
import CourseCreateForm from "@/components/library/CourseCreateForm";
import OrderButtons from "@/components/library/OrderButtons";
import { levelNames, semesterNames } from "@/lib/library/levels";
import { requireMemberLibraryAccess } from "@/lib/library/member";
import { directLibraryChildren, isVisibleLibraryFolderPath, libraryFolderBreadcrumb } from "@/lib/library/tree";
import { prisma } from "@/lib/prisma";
import { addMemberLibraryFolder, addMemberLibraryLink, createMemberCourseAction, deleteMemberCourseAction, deleteMemberFileAction, deleteMemberFolderAction, deleteMemberLinkAction, moveMemberFileAction, moveMemberFolderAction, moveMemberLinkAction, updateMemberCourseAction, updateMemberFileAction, updateMemberFolderAction, updateMemberLinkAction } from "./actions";
import managerStyles from "@/components/admin/library/LibraryManager.module.css";
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
  const placements = department ? await prisma.libraryCourseDepartment.findMany({
    where: { departmentId: department.id },
    select: { level: true, semester: true, sortOrder: true, course: { select: { id: true, name: true, code: true, description: true, departments: { select: { department: { select: { nameAr: true } } } } } } },
    orderBy: [{ level: "asc" }, { semester: "asc" }, { sortOrder: "asc" }, { course: { name: "asc" } }],
  }) : [];
  const courses = placements.map(({ course, level, semester, sortOrder }) => ({ ...course, level, semester, sortOrder }));
  const course = courses.find((item) => item.id === params.course) ?? courses[0] ?? null;
  const allFolders = course ? await prisma.libraryFolder.findMany({
    where: { courseId: course.id },
    select: { id: true, courseId: true, parentId: true, name: true, sortOrder: true, isVisible: true, _count: { select: { files: true, links: true } } },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  }) : [];
  const requestedFolder = params.folder ? allFolders.find((item) => item.id === params.folder) ?? null : null;
  const folder = requestedFolder && isVisibleLibraryFolderPath(allFolders, requestedFolder.id) ? requestedFolder : null;
  const folderBreadcrumb = folder ? libraryFolderBreadcrumb(allFolders, folder.id) ?? [] : [];
  const folders = directLibraryChildren(allFolders, folder?.id ?? null).filter((item) => item.isVisible);
  const [links, files] = folder ? await Promise.all([
    prisma.libraryLink.findMany({ where: { folderId: folder.id }, select: { id: true, title: true, url: true, sortOrder: true }, orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }, { title: "asc" }] }),
    prisma.libraryFile.findMany({ where: { folderId: folder.id }, select: { id: true, title: true, mimeType: true, sortOrder: true }, orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }, { title: "asc" }], take: 30 }),
  ]) : [[], []];
  const href = (courseId?: string, folderId?: string) => {
    const values = new URLSearchParams();
    if (department) values.set("department", department.id);
    if (courseId) values.set("course", courseId);
    if (folderId) values.set("folder", folderId);
    return `/member/library?${values}`;
  };

  return <main className={styles.page}>
    <ConfirmDeleteButton />
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
          <details className={styles.addControl}><summary><Plus size={17}/> إضافة مساق</summary><CourseCreateForm action={createMemberCourseAction}/></details>
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
              <div className={styles.itemActions}><details><summary title="تعديل المساق" aria-label="تعديل المساق"><Pencil size={16}/></summary><form action={updateMemberCourseAction} className={styles.form}><input type="hidden" name="courseId" value={course.id}/><input name="name" required defaultValue={course.name} aria-label="اسم المساق"/><input name="code" defaultValue={course.code ?? ""} aria-label="رمز المساق"/><select name="level" defaultValue={course.level} aria-label="المستوى">{levelNames.map((name, i) => <option value={i + 1} key={name}>{name}</option>)}</select><select name="semester" defaultValue={course.semester} aria-label="الفصل">{semesterNames.map((name, i) => <option value={i + 1} key={name}>{name}</option>)}</select><textarea name="description" defaultValue={course.description ?? ""} aria-label="وصف المساق"/><input type="hidden" name="sortOrder" value={course.sortOrder}/><button type="submit">حفظ</button></form></details><form action={deleteMemberCourseAction}><input type="hidden" name="courseId" value={course.id}/><button className={managerStyles.danger} title="حذف المساق" aria-label="حذف المساق"><Trash2 size={16}/></button></form></div>
              <details className={styles.addControl}><summary><Plus size={17} /> {folder ? "مجلد فرعي" : "مجلد"}</summary><form action={addMemberLibraryFolder} className={styles.form}>
                <input type="hidden" name="courseId" value={course.id} />
                <input type="hidden" name="parentId" value={folder?.id ?? ""} />
                <input name="name" required maxLength={120} placeholder="اسم المجلد" aria-label="اسم المجلد" />
                <button type="submit">إضافة المجلد</button>
              </form></details>
            </div>
            <nav className={styles.breadcrumb} aria-label="مسار المجلد"><Link href={href(course.id)}>جذر المساق</Link>{folderBreadcrumb.map((item) => <span key={item.id}>/<Link href={href(course.id, item.id)}>{item.name}</Link></span>)}</nav>
            {course.departments.length > 1 && <p className={styles.success}>مساق مشترك مع {course.departments.map((item) => item.department.nameAr).join("، ")}. المحتوى متزامن بين الأقسام.</p>}
            <nav className={styles.folders} aria-label="مجلدات المساق">{folders.map((item, index) => <div key={item.id}><Link href={href(course.id, item.id)}><Folder size={18}/><span>{item.name}<small>{item._count.links} رابط · {item._count.files} ملف</small></span></Link><div className={styles.itemActions}><OrderButtons action={moveMemberFolderAction} itemId={item.id} itemName={item.name} itemField="folderId" first={index === 0} last={index === folders.length - 1} fields={{ course: course.id, folder: folder?.id ?? "" }}/><details><summary title="تعديل المجلد" aria-label={`تعديل ${item.name}`}><Pencil size={16}/></summary><form action={updateMemberFolderAction} className={styles.form}><input type="hidden" name="folderId" value={item.id}/><input name="name" required defaultValue={item.name} aria-label="اسم المجلد"/><input type="hidden" name="sortOrder" value={item.sortOrder}/><button type="submit">حفظ</button></form></details><form action={deleteMemberFolderAction}><input type="hidden" name="folderId" value={item.id}/><button className={managerStyles.danger} title="حذف المجلد" aria-label={`حذف ${item.name}`}><Trash2 size={16}/></button></form></div></div>)}{!folders.length && <p className={styles.empty}>{folder ? "لا توجد مجلدات فرعية هنا." : "لا توجد مجلدات بعد."}</p>}</nav>
            {folder && <section className={styles.folderContent}>
              <div className={styles.folderHead}><h3>{folder.name}</h3>
                <details className={styles.addControl}><summary><Plus size={17} /> رابط</summary><form action={addMemberLibraryLink} className={styles.form}>
                  <input type="hidden" name="folderId" value={folder.id} />
                  <input name="title" required maxLength={180} placeholder="عنوان المحاضرة" aria-label="عنوان المحاضرة" />
                  <input name="url" type="url" required maxLength={2048} dir="ltr" placeholder="https://" aria-label="رابط المحاضرة" />
                  <button type="submit">إضافة الرابط</button>
                </form></details>
              </div>
              {links.length > 0 && <div className={styles.items}>{links.map((item, index) => <div key={item.id}><a href={item.url} target="_blank" rel="noopener noreferrer"><Link2 size={17} /><span>{item.title}</span><ExternalLink size={16} /></a><div className={styles.itemActions}><OrderButtons action={moveMemberLinkAction} itemId={item.id} itemName={item.title} itemField="linkId" first={index === 0} last={index === links.length - 1} fields={{ course: course.id, folder: folder.id }}/><details><summary title="تعديل الرابط" aria-label={`تعديل ${item.title}`}><Pencil size={16}/></summary><form action={updateMemberLinkAction} className={styles.form}><input type="hidden" name="linkId" value={item.id}/><input name="title" required defaultValue={item.title} aria-label="عنوان الرابط"/><input name="url" type="url" required defaultValue={item.url} aria-label="الرابط" dir="ltr"/><button type="submit">حفظ</button></form></details><form action={deleteMemberLinkAction}><input type="hidden" name="linkId" value={item.id}/><button className={managerStyles.danger} title="حذف الرابط" aria-label={`حذف ${item.title}`}><Trash2 size={16}/></button></form></div></div>)}</div>}
              {files.length > 0 && <div className={styles.items}>{files.map((item, index) => <div key={item.id}><a href={`/member/library/files/${item.id}?download=1`}><FileText size={17}/><span>{item.title}</span><Download size={16}/></a><div className={styles.itemActions}><OrderButtons action={moveMemberFileAction} itemId={item.id} itemName={item.title} itemField="fileId" first={index === 0} last={index === files.length - 1} fields={{ course: course.id, folder: folder.id }}/><details><summary title="تعديل اسم الملف" aria-label={`تعديل ${item.title}`}><Pencil size={16}/></summary><form action={updateMemberFileAction} className={styles.form}><input type="hidden" name="fileId" value={item.id}/><input name="title" required defaultValue={item.title} aria-label="اسم الملف"/><button type="submit">حفظ</button></form></details><form action={deleteMemberFileAction}><input type="hidden" name="fileId" value={item.id}/><button className={managerStyles.danger} title="حذف الملف" aria-label={`حذف ${item.title}`}><Trash2 size={16}/></button></form></div></div>)}</div>}
              <LibraryUploader folderId={folder.id} uploadUrl="/member/library/upload" />
            </section>}
          </>}
        </div>
      </div>
    </>}
  </main>;
}
