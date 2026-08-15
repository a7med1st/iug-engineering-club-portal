import {
  PERMISSIONS,
  requirePermission,
} from "@/lib/permissions";

import { prisma } from "@/lib/prisma";
import AdminFeedback from "@/components/admin/AdminFeedback";
import { createMember } from "../actions";

export const dynamic = "force-dynamic";

const formatCreatedAt = (date: Date) => new Intl.DateTimeFormat("ar-PS", {
  dateStyle: "medium",
}).format(date);

export default async function MembersAdminPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; success?: string }>;
}) {
  await requirePermission(
    PERMISSIONS.MEMBER_MANAGE,
  );

  const feedback = await searchParams;
  const [departments, members] = await Promise.all([
    prisma.department.findMany({ orderBy: { sortOrder: "asc" } }),
    prisma.user.findMany({
      where: { role: "MEMBER" },
      include: { department: true },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  return (
    <section className="admin-page">
      <div className="admin-page-head">
        <div>
          <h1>إنشاء حساب عضو</h1>
          <p className="muted">حسابات الأعضاء ينشئها الأدمن فقط، ولا يمكن منح صلاحية أدمن من هذا النموذج.</p>
        </div>
      </div>

      <AdminFeedback error={feedback.error} success={feedback.success} />

      <div className="admin-card admin-form-card">
        <h2>بيانات العضو الجديد</h2>
        <form action={createMember} className="stack-form">
          <div className="form-grid">
            <label>
              الاسم
              <input name="name" required autoComplete="name" />
            </label>
            <label>
              البريد الإلكتروني
              <input name="email" type="email" required autoComplete="email" dir="ltr" />
            </label>
            <label>
              كلمة مرور مؤقتة
              <input name="password" type="password" minLength={8} required autoComplete="new-password" dir="ltr" />
            </label>
            <label>
              المسمى داخل النادي
              <input name="position" placeholder="مندوب هندسة الحاسوب" />
            </label>
            <label>
              القسم
              <select name="departmentId" defaultValue="">
                <option value="">بدون قسم</option>
                {departments.map((department) => (
                  <option key={department.id} value={department.id}>{department.nameAr}</option>
                ))}
              </select>
            </label>
            <label>
              الدور والصلاحية
              <input value="عضو (MEMBER)" disabled />
              <input type="hidden" name="role" value="MEMBER" />
            </label>
          </div>
          <button className="primary-btn" type="submit">إنشاء حساب العضو</button>
        </form>
      </div>

      <div className="admin-card members-list-card">
        <div className="admin-card-head">
          <h2>الأعضاء الموجودون</h2>
          <span className="count-badge">{members.length} عضو</span>
        </div>

        {members.length ? (
          <>
            <div className="member-table-wrap">
              <table className="member-table">
                <thead>
                  <tr>
                    <th>الاسم</th>
                    <th>البريد الإلكتروني</th>
                    <th>القسم</th>
                    <th>الدور</th>
                    <th>تاريخ الإنشاء</th>
                  </tr>
                </thead>
                <tbody>
                  {members.map((member) => (
                    <tr key={member.id}>
                      <td><strong>{member.name}</strong></td>
                      <td dir="ltr">{member.email}</td>
                      <td>{member.department?.nameAr ?? "بدون قسم"}</td>
                      <td>عضو</td>
                      <td>{formatCreatedAt(member.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="member-cards">
              {members.map((member) => (
                <article className="member-card" key={member.id}>
                  <div className="member-card-head">
                    <strong>{member.name}</strong>
                    <span>عضو</span>
                  </div>
                  <dl>
                    <div><dt>البريد</dt><dd dir="ltr">{member.email}</dd></div>
                    <div><dt>القسم</dt><dd>{member.department?.nameAr ?? "بدون قسم"}</dd></div>
                    <div><dt>تاريخ الإنشاء</dt><dd>{formatCreatedAt(member.createdAt)}</dd></div>
                  </dl>
                </article>
              ))}
            </div>
          </>
        ) : <p className="empty-state">لا توجد حسابات أعضاء حتى الآن.</p>}
      </div>
    </section>
  );
}