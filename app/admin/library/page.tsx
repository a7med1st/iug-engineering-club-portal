import AdminFeedback from "@/components/admin/AdminFeedback";
import LibraryManager from "@/components/admin/library/LibraryManager";
import { PERMISSIONS, requirePermission } from "@/lib/permissions";
import { resolveLibrarySelection } from "@/lib/library/queries";

export const dynamic = "force-dynamic";

export default async function LibraryAdminPage({ searchParams }: { searchParams: Promise<{ department?: string; course?: string; folder?: string; success?: string; error?: string }> }) {
  const { user } = await requirePermission(PERMISSIONS.LIBRARY_MANAGE);
  const params = await searchParams;
  const data = await resolveLibrarySelection(user, params);
  return (
    <section className="admin-page">
      <div className="admin-page-head"><div><h1>إدارة مكتبة التخصص</h1><p className="muted">قم بإدارة مساقات القسم والمجلدات والملفات والروابط التي ستظهر للطلاب في مكتبة تخصصهم.</p></div></div>
      <AdminFeedback error={params.error} success={params.success} />
      <LibraryManager data={data} />
    </section>
  );
}
