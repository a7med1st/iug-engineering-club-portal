import Link from "next/link";
import { Download, Printer } from "lucide-react";

import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { CONTACT_STATUS_LABELS } from "@/lib/contact-options";

import { updateContactStatus } from "./actions";

export const dynamic = "force-dynamic";

export default async function AdminContactPage() {
  await requireAdmin();

  const [complaints, suggestions, collaborations] =
    await Promise.all([
      prisma.complaint.findMany({
        include: {
          department: true,
        },
        orderBy: {
          createdAt: "desc",
        },
      }),

      prisma.suggestion.findMany({
        include: {
          department: true,
        },
        orderBy: {
          createdAt: "desc",
        },
      }),

      prisma.collaborationRequest.findMany({
        orderBy: {
          createdAt: "desc",
        },
      }),
    ]);

  return (
    <main className="admin-contact-page shell">
      <div className="admin-contact-header">
        <div>
          <span className="eyebrow">ADMIN</span>

          <h1>إدارة التواصل</h1>

          <p>
            متابعة الشكاوى والاقتراحات وطلبات التعاون.
          </p>
        </div>
      </div>

      <div className="contact-admin-stats">
        <StatCard
          title="الشكاوى الجديدة"
          value={
            complaints.filter(
              (item) => item.status === "NEW"
            ).length
          }
        />

        <StatCard
          title="الاقتراحات الجديدة"
          value={
            suggestions.filter(
              (item) => item.status === "NEW"
            ).length
          }
        />

        <StatCard
          title="طلبات التعاون الجديدة"
          value={
            collaborations.filter(
              (item) => item.status === "NEW"
            ).length
          }
        />
      </div>

      {/* =====================================
          COMPLAINTS
      ===================================== */}

      <AdminSection
        title="الشكاوى والملاحظات"
        count={complaints.length}
        exportHref="/admin/contact/export/complaints"
      >
        {complaints.length === 0 ? (
          <EmptyState text="لا توجد شكاوى حتى الآن." />
        ) : (
          complaints.map((item) => (
            <details
              className="contact-admin-item"
              key={item.id}
            >
              <summary>
                <div>
                  <strong>
                    {item.studentName || "طالب مجهول"}
                  </strong>

                  <small>
                    {item.department.nameAr}
                  </small>
                </div>

                <StatusBadge status={item.status} />
              </summary>

              <div className="contact-admin-details">
                <Info
                  title="وسيلة التواصل"
                  value={
                    item.contact ||
                    "غير مذكورة"
                  }
                />

                <Info
                  title="التخصص"
                  value={item.department.nameAr}
                />

                <Info
                  title="يرغب بالحصول على رد"
                  value={
                    item.wantsReply
                      ? "نعم"
                      : "لا"
                  }
                />

                <Info
                  title="تاريخ الإرسال"
                  value={item.createdAt.toLocaleString(
                    "ar-EG"
                  )}
                />

                <div className="contact-admin-description">
                  <strong>
                    تفاصيل الشكوى
                  </strong>

                  <p>{item.details}</p>
                </div>

                <div className="contact-admin-actions">
                  <Link
                    href={`/admin/contact/print/complaint/${item.id}`}
                    className="ghost-btn"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <Printer
                      size={17}
                      strokeWidth={1.8}
                    />
                    طباعة / حفظ PDF
                  </Link>
                </div>

                <StatusForm
                  id={item.id}
                  kind="complaint"
                  currentStatus={item.status}
                  statuses={[
                    "NEW",
                    "IN_REVIEW",
                    "RESOLVED",
                  ]}
                />
              </div>
            </details>
          ))
        )}
      </AdminSection>

      {/* =====================================
          SUGGESTIONS
      ===================================== */}

      <AdminSection
        title="الاقتراحات"
        count={suggestions.length}
        exportHref="/admin/contact/export/suggestions"
      >
        {suggestions.length === 0 ? (
          <EmptyState text="لا توجد اقتراحات حتى الآن." />
        ) : (
          suggestions.map((item) => (
            <details
              className="contact-admin-item"
              key={item.id}
            >
              <summary>
                <div>
                  <strong>
                    {item.studentName}
                  </strong>

                  <small>
                    {item.department.nameAr}
                  </small>
                </div>

                <StatusBadge status={item.status} />
              </summary>

              <div className="contact-admin-details">
                <Info
                  title="رقم الواتساب"
                  value={item.whatsapp}
                />

                <Info
                  title="التخصص"
                  value={item.department.nameAr}
                />

                <Info
                  title="المواضيع المقترحة"
                  value={
                    item.topics ||
                    "غير مذكورة"
                  }
                />

                <Info
                  title="فكرة الفعالية أو المشروع"
                  value={item.projectIdea}
                />

                <div className="contact-admin-actions">
                  <Link
                    href={`/admin/contact/print/suggestion/${item.id}`}
                    className="ghost-btn"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <Printer
                      size={17}
                      strokeWidth={1.8}
                    />
                    طباعة / حفظ PDF
                  </Link>
                </div>

                <StatusForm
                  id={item.id}
                  kind="suggestion"
                  currentStatus={item.status}
                  statuses={[
                    "NEW",
                    "IN_REVIEW",
                    "RESOLVED",
                  ]}
                />
              </div>
            </details>
          ))
        )}
      </AdminSection>

      {/* =====================================
          COLLABORATION
      ===================================== */}

      <AdminSection
        title="طلبات التعاون"
        count={collaborations.length}
        exportHref="/admin/contact/export/collaborations"
      >
        {collaborations.length === 0 ? (
          <EmptyState text="لا توجد طلبات تعاون حتى الآن." />
        ) : (
          collaborations.map((item) => (
            <details
              className="contact-admin-item"
              key={item.id}
            >
              <summary>
                <div>
                  <strong>
                    {item.entityName}
                  </strong>

                  <small>
                    {item.contactPerson}
                  </small>
                </div>

                <StatusBadge status={item.status} />
              </summary>

              <div className="contact-admin-details">
                <Info
                  title="مسؤول التواصل"
                  value={item.contactPerson}
                />

                <Info
                  title="الهاتف"
                  value={item.phone}
                />

                <Info
                  title="البريد الإلكتروني"
                  value={item.email}
                />

                <Info
                  title="المجال"
                  value={item.field}
                />

                <Info
                  title="الرابط"
                  value={item.socialUrl}
                />

                <div className="contact-admin-description">
                  <strong>
                    وصف التعاون
                  </strong>

                  <p>
                    {item.description}
                  </p>
                </div>

                {item.attachmentStoredName && (
                  <div className="contact-admin-description">
                    <strong>
                      الملف المرفق
                    </strong>

                    <div style={{ marginTop: "10px" }}>
                      <Link
                        href={`/admin/contact/files/${item.id}`}
                        className="ghost-btn"
                      >
                        تحميل الملف المرفق
                      </Link>
                    </div>
                  </div>
                )}

                {item.additionalNotes && (
                  <div className="contact-admin-description">
                    <strong>
                      ملاحظات إضافية
                    </strong>

                    <p>
                      {item.additionalNotes}
                    </p>
                  </div>
                )}

                <div className="contact-admin-actions">
                  <Link
                    href={`/admin/contact/print/collaboration/${item.id}`}
                    className="ghost-btn"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <Printer
                      size={17}
                      strokeWidth={1.8}
                    />
                    طباعة / حفظ PDF
                  </Link>
                </div>

                <StatusForm
                  id={item.id}
                  kind="collaboration"
                  currentStatus={item.status}
                  statuses={[
                    "NEW",
                    "IN_REVIEW",
                    "CONTACTED",
                    "ACCEPTED",
                    "REJECTED",
                  ]}
                />
              </div>
            </details>
          ))
        )}
      </AdminSection>
    </main>
  );
}

/* =====================================
   COMPONENTS
===================================== */

function StatCard({
  title,
  value,
}: {
  title: string;
  value: number;
}) {
  return (
    <div className="contact-admin-stat">
      <span>{title}</span>
      <strong>{value}</strong>
    </div>
  );
}

function AdminSection({
  title,
  count,
  exportHref,
  children,
}: {
  title: string;
  count: number;
  exportHref?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="contact-admin-section">
      <div className="contact-admin-heading">
        <div>
          <h2>{title}</h2>

          <span>
            {count} طلب
          </span>
        </div>

        {exportHref && (
          <Link
            href={exportHref}
            className="ghost-btn contact-export-btn"
          >
            <Download
              size={17}
              strokeWidth={1.8}
            />
            تصدير Excel
          </Link>
        )}
      </div>

      <div className="contact-admin-list">
        {children}
      </div>
    </section>
  );
}

function EmptyState({
  text,
}: {
  text: string;
}) {
  return (
    <div className="contact-admin-empty">
      {text}
    </div>
  );
}

function Info({
  title,
  value,
}: {
  title: string;
  value: string;
}) {
  return (
    <div className="contact-admin-info">
      <strong>
        {title}
      </strong>

      <span>
        {value}
      </span>
    </div>
  );
}

function StatusBadge({
  status,
}: {
  status: keyof typeof CONTACT_STATUS_LABELS;
}) {
  return (
    <span
      className={`contact-status status-${status.toLowerCase()}`}
    >
      {CONTACT_STATUS_LABELS[status]}
    </span>
  );
}

function StatusForm({
  id,
  kind,
  currentStatus,
  statuses,
}: {
  id: string;
  kind: string;
  currentStatus: string;
  statuses: string[];
}) {
  return (
    <form
      action={updateContactStatus}
      className="contact-status-form"
    >
      <input
        type="hidden"
        name="id"
        value={id}
      />

      <input
        type="hidden"
        name="kind"
        value={kind}
      />

      <select
        name="status"
        defaultValue={currentStatus}
      >
        {statuses.map((status) => (
          <option
            key={status}
            value={status}
          >
            {
              CONTACT_STATUS_LABELS[
                status as keyof typeof CONTACT_STATUS_LABELS
              ]
            }
          </option>
        ))}
      </select>

      <button
        type="submit"
        className="primary-btn small"
      >
        حفظ الحالة
      </button>
    </form>
  );
}