import AdminFeedback from "@/components/admin/AdminFeedback";
import LibraryManager from "@/components/admin/library/LibraryManager";
import { PERMISSIONS, requirePermission } from "@/lib/permissions";
import { resolveLibrarySelection } from "@/lib/library/queries";
import { prisma } from "@/lib/prisma";
import LibrarySubmissions from "@/components/admin/library/LibrarySubmissions";

export const dynamic = "force-dynamic";

export default async function LibraryAdminPage({ searchParams }: { searchParams: Promise<{ department?: string; course?: string; folder?: string; success?: string; error?: string }> }) {
  const { user } = await requirePermission(PERMISSIONS.LIBRARY_MANAGE);
  const params = await searchParams;
  const data = await resolveLibrarySelection(user, params);
  const [submissions, folders] = data.selectedDepartment ? await Promise.all([
    prisma.librarySubmission.findMany({
      where: { departmentId: data.selectedDepartment.id, status: "PENDING" },
      select: { id: true, title: true, note: true, originalName: true, size: true, createdAt: true, student: { select: { name: true } } },
      orderBy: { createdAt: "asc" },
    }),
    prisma.libraryFolder.findMany({
      where: { isVisible: true, course: { departments: { some: { departmentId: data.selectedDepartment.id } } } },
      select: { id: true, name: true, course: { select: { name: true } } },
      orderBy: [{ course: { name: "asc" } }, { name: "asc" }],
    }),
  ]) : [[], []];
  return (
    <section className="admin-page">
      <div className="admin-page-head"><div><h1>إدارة مكتبة التخصص</h1><p className="muted">قم بإدارة مساقات القسم والمجلدات والملفات والروابط التي ستظهر للطلاب في مكتبة تخصصهم.</p></div></div>
      <AdminFeedback error={params.error} success={params.success} />
      {data.selectedDepartment && <LibrarySubmissions departmentId={data.selectedDepartment.id} submissions={submissions} folders={folders} />}
      <LibraryManager data={data} />
    </section>
  );
}
