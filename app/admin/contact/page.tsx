import type { ReactNode } from "react";
import Link from "next/link";
import {
  ChevronDown,
  Download,
  Handshake,
  Lightbulb,
  MessageSquare,
  Printer,
} from "lucide-react";

import ContactStatusSelect from "@/components/admin/ContactStatusSelect";
import ContactEscalationForm from "@/components/admin/ContactEscalationForm";
import ComplaintReplyForm from "@/components/admin/ComplaintReplyForm";
import { NonceStyle } from "@/components/security/CspNonce";
import { requireContactAccess } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { CONTACT_STATUS_LABELS } from "@/lib/contact-options";
import { updateContactStatus } from "./actions";

export const dynamic = "force-dynamic";

export default async function AdminContactPage({
  searchParams,
}: {
  searchParams: Promise<{ focus?: string }>;
}) {
  const { user } = await requireContactAccess();

  const assignedWhere =
    user.role === "ADMIN"
      ? undefined
      : { assignedToId: user.id };
  const { focus } = await searchParams;

  const [complaints, suggestions, collaborations] = await Promise.all([
    prisma.complaint.findMany({
      where: assignedWhere,
      include: {
        department: true,
        assignedTo: {
          select: { name: true },
        },
        assignedStructureItem: {
          select: { title: true },
        },
        replies: {
          include: {
            author: {
              select: { name: true },
            },
          },
          orderBy: { createdAt: "asc" },
        },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.suggestion.findMany({
      where: assignedWhere,
      include: {
        department: true,
        assignedTo: {
          select: { name: true },
        },
        assignedStructureItem: {
          select: { title: true },
        },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.collaborationRequest.findMany({
      where: assignedWhere,
      include: {
        assignedTo: {
          select: { name: true },
        },
        assignedStructureItem: {
          select: { title: true },
        },
      },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const routingEvents =
    await prisma.contactRoutingEvent.findMany({
      where: {
        OR: [
          {
            requestKind: "COMPLAINT",
            requestId: {
              in: complaints.map((item) => item.id),
            },
          },
          {
            requestKind: "SUGGESTION",
            requestId: {
              in: suggestions.map((item) => item.id),
            },
          },
          {
            requestKind: "COLLABORATION",
            requestId: {
              in: collaborations.map((item) => item.id),
            },
          },
        ],
      },
      orderBy: { createdAt: "asc" },
    });

  const eventsFor = (
    kind: "COMPLAINT" | "SUGGESTION" | "COLLABORATION",
    id: string,
  ) =>
    routingEvents.filter(
      (event) =>
        event.requestKind === kind &&
        event.requestId === id,
    );

  const newComplaints = complaints.filter((item) => item.status === "NEW").length;
  const newSuggestions = suggestions.filter((item) => item.status === "NEW").length;
  const newCollaborations = collaborations.filter((item) => item.status === "NEW").length;

  return (
    <main className="admin-contact-page contact-admin-polished shell">
      <div className="admin-contact-header contact-polished-header">
        <div>
          <h1>إدارة التواصل</h1>
          <p>متابعة الشكاوى والاقتراحات وطلبات التعاون من مكان واحد.</p>
        </div>
      </div>

      <div className="contact-admin-stats contact-polished-stats">
        <StatCard
          title="الشكاوى الجديدة"
          value={newComplaints}
          icon={<MessageSquare size={22} />}
          tone="blue"
        />
        <StatCard
          title="الاقتراحات الجديدة"
          value={newSuggestions}
          icon={<Lightbulb size={22} />}
          tone="cyan"
        />
        <StatCard
          title="طلبات التعاون الجديدة"
          value={newCollaborations}
          icon={<Handshake size={22} />}
          tone="orange"
        />
      </div>

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
              id={`complaint-${item.id}`}
              open={focus === `complaint-${item.id}`}
              className="contact-admin-item contact-request-card"
              key={item.id}
            >
              <summary>
                <div className="contact-admin-summary-copy">
                  <strong>{item.studentName || "طالب مجهول"}</strong>
                  <small>{item.department.nameAr}</small>
                </div>

                <div className="contact-admin-summary-side">
                  <StatusBadge status={item.status} />
                  <span className="contact-card-chevron" aria-hidden="true">
                    <ChevronDown size={17} />
                  </span>
                </div>
              </summary>

              <div className="contact-admin-details">
                <Info title="وسيلة التواصل" value={item.contact || "غير مذكورة"} />
                <Info title="التخصص" value={item.department.nameAr} />
                <Info title="يرغب بالحصول على رد" value={item.wantsReply ? "نعم" : "لا"} />
                <Info
                  title="حساب مرتبط بالطلب"
                  value={item.submittedById ? "نعم" : "لا"}
                />
                <Info
                  title="المسؤول الحالي"
                  value={
                    item.assignedTo
                      ? `${item.assignedTo.name}${
                          item.assignedStructureItem?.title
                            ? ` — ${item.assignedStructureItem.title}`
                            : ""
                        }`
                      : "غير موجّه"
                  }
                />
                <Info title="تاريخ الإرسال" value={item.createdAt.toLocaleString("ar-EG")} />

                <div className="contact-admin-description">
                  <strong>تفاصيل الشكوى</strong>
                  <p>{item.details}</p>
                </div>

                <div className="contact-admin-actions">
                  <Link
                    href={`/admin/contact/print/complaint/${item.id}`}
                    className="ghost-btn contact-print-btn"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <Printer size={17} strokeWidth={1.8} />
                    طباعة / حفظ PDF
                  </Link>
                </div>

                {item.replies.length > 0 && (
                  <div className="complaint-reply-history">
                    <strong>الردود المرسلة</strong>
                    {item.replies.map((reply) => (
                      <article key={reply.id}>
                        <div>
                          <b>{reply.author?.name ?? "إدارة النادي"}</b>
                          <time>
                            {reply.createdAt.toLocaleString("ar-EG")}
                          </time>
                        </div>
                        <p>{reply.message}</p>
                      </article>
                    ))}
                  </div>
                )}

                {item.wantsReply && item.submittedById ? (
                  <ComplaintReplyForm complaintId={item.id} />
                ) : item.wantsReply ? (
                  <div className="complaint-reply-unavailable">
                    صاحب الشكوى طلب ردًا، لكن الطلب غير مرتبط بحساب؛ استخدم
                    وسيلة التواصل المكتوبة إن وُجدت.
                  </div>
                ) : null}

                <RoutingHistory
                  events={eventsFor("COMPLAINT", item.id)}
                />

                <ContactEscalationForm
                  id={item.id}
                  kind="complaint"
                  assignedName={item.assignedTo?.name ?? null}
                />

                <StatusForm
                  id={item.id}
                  kind="complaint"
                  currentStatus={item.status}
                  statuses={["NEW", "IN_REVIEW", "IN_PROGRESS", "RESOLVED"]}
                />
              </div>
            </details>
          ))
        )}
      </AdminSection>

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
              id={`suggestion-${item.id}`}
              open={focus === `suggestion-${item.id}`}
              className="contact-admin-item contact-request-card"
              key={item.id}
            >
              <summary>
                <div className="contact-admin-summary-copy">
                  <strong>{item.studentName}</strong>
                  <small>{item.department.nameAr}</small>
                </div>

                <div className="contact-admin-summary-side">
                  <StatusBadge status={item.status} />
                  <span className="contact-card-chevron" aria-hidden="true">
                    <ChevronDown size={17} />
                  </span>
                </div>
              </summary>

              <div className="contact-admin-details">
                <Info title="رقم الواتساب" value={item.whatsapp} />
                <Info title="التخصص" value={item.department.nameAr} />
                <Info title="المواضيع المقترحة" value={item.topics || "غير مذكورة"} />
                <Info title="فكرة الفعالية أو المشروع" value={item.projectIdea} />
                <Info
                  title="المسؤول الحالي"
                  value={
                    item.assignedTo
                      ? `${item.assignedTo.name}${
                          item.assignedStructureItem?.title
                            ? ` — ${item.assignedStructureItem.title}`
                            : ""
                        }`
                      : "غير موجّه"
                  }
                />

                <div className="contact-admin-actions">
                  <Link
                    href={`/admin/contact/print/suggestion/${item.id}`}
                    className="ghost-btn contact-print-btn"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <Printer size={17} strokeWidth={1.8} />
                    طباعة / حفظ PDF
                  </Link>
                </div>

                <RoutingHistory
                  events={eventsFor("SUGGESTION", item.id)}
                />

                <ContactEscalationForm
                  id={item.id}
                  kind="suggestion"
                  assignedName={item.assignedTo?.name ?? null}
                />

                <StatusForm
                  id={item.id}
                  kind="suggestion"
                  currentStatus={item.status}
                  statuses={["NEW", "IN_REVIEW", "IN_PROGRESS", "RESOLVED"]}
                />
              </div>
            </details>
          ))
        )}
      </AdminSection>

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
              id={`collaboration-${item.id}`}
              open={focus === `collaboration-${item.id}`}
              className="contact-admin-item contact-request-card"
              key={item.id}
            >
              <summary>
                <div className="contact-admin-summary-copy">
                  <strong>{item.entityName}</strong>
                  <small>{item.contactPerson}</small>
                </div>

                <div className="contact-admin-summary-side">
                  <StatusBadge status={item.status} />
                  <span className="contact-card-chevron" aria-hidden="true">
                    <ChevronDown size={17} />
                  </span>
                </div>
              </summary>

              <div className="contact-admin-details">
                <Info title="مسؤول التواصل" value={item.contactPerson} />
                <Info title="الهاتف" value={item.phone} />
                <Info title="البريد الإلكتروني" value={item.email} />
                <Info title="المجال" value={item.field} />
                <Info title="الرابط" value={item.socialUrl} />
                <Info
                  title="المسؤول الحالي"
                  value={
                    item.assignedTo
                      ? `${item.assignedTo.name}${
                          item.assignedStructureItem?.title
                            ? ` — ${item.assignedStructureItem.title}`
                            : ""
                        }`
                      : "غير موجّه"
                  }
                />

                <div className="contact-admin-description">
                  <strong>وصف التعاون</strong>
                  <p>{item.description}</p>
                </div>

                <RoutingHistory
                  events={eventsFor("COLLABORATION", item.id)}
                />

                <ContactEscalationForm
                  id={item.id}
                  kind="collaboration"
                  assignedName={item.assignedTo?.name ?? null}
                />

                {item.attachmentStoredName && (
                  <div className="contact-admin-description">
                    <strong>الملف المرفق</strong>
                    <div className="contact-inline-action">
                      <Link
                        href={`/admin/contact/files/${item.id}`}
                        className="ghost-btn contact-print-btn"
                        data-no-page-transition
                      >
                        <Download size={16} />
                        تحميل الملف المرفق
                      </Link>
                    </div>
                  </div>
                )}

                {item.additionalNotes && (
                  <div className="contact-admin-description">
                    <strong>ملاحظات إضافية</strong>
                    <p>{item.additionalNotes}</p>
                  </div>
                )}

                <div className="contact-admin-actions">
                  <Link
                    href={`/admin/contact/print/collaboration/${item.id}`}
                    className="ghost-btn contact-print-btn"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <Printer size={17} strokeWidth={1.8} />
                    طباعة / حفظ PDF
                  </Link>
                </div>

                <StatusForm
                  id={item.id}
                  kind="collaboration"
                  currentStatus={item.status}
                  statuses={["NEW", "IN_REVIEW", "IN_PROGRESS", "CONTACTED", "ACCEPTED", "RESOLVED", "REJECTED"]}
                />
              </div>
            </details>
          ))
        )}
      </AdminSection>

      <NonceStyle>{`
        .contact-admin-polished {
          --contact-blue: #1688ff;
          --contact-cyan: #35d4ff;
          --contact-orange: #ff8b32;
          --contact-navy: #102139;
          padding-bottom: 36px;
        }

        .contact-polished-header {
          margin-bottom: 24px;
        }

        .contact-polished-header h1 {
          margin: 0 0 7px;
          color: #0c2340;
          font-size: clamp(1.75rem, 3vw, 2.45rem);
        }

        .contact-polished-header p {
          color: #6e8096;
          font-size: .9rem;
        }

        .contact-polished-stats {
          gap: 16px;
          margin-bottom: 28px;
        }

        .contact-admin-polished .contact-admin-stat {
          position: relative;
          isolation: isolate;
          min-height: 108px;
          overflow: hidden;
          padding: 20px 22px;
          border: 1px solid rgba(184, 207, 232, .78);
          border-radius: 20px;
          background:
            radial-gradient(circle at 8% 10%, rgba(22,136,255,.13), transparent 30%),
            linear-gradient(145deg, rgba(255,255,255,.98), rgba(247,251,255,.96));
          box-shadow: 0 14px 34px rgba(6, 24, 44, .07);
          transition: transform .25s cubic-bezier(.22,1,.36,1), border-color .25s ease, box-shadow .25s ease;
        }

        .contact-admin-polished .contact-admin-stat::after {
          content: "";
          position: absolute;
          inset: 0;
          z-index: -1;
          background-image:
            linear-gradient(rgba(22,136,255,.025) 1px, transparent 1px),
            linear-gradient(90deg, rgba(22,136,255,.025) 1px, transparent 1px);
          background-size: 24px 24px;
          mask-image: linear-gradient(to left, #000, transparent 70%);
        }

        .contact-admin-polished .contact-admin-stat:hover {
          transform: translateY(-5px);
          border-color: rgba(22,136,255,.35);
          box-shadow: 0 20px 44px rgba(9, 55, 100, .12);
        }

        .contact-stat-copy {
          display: grid;
          gap: 3px;
        }

        .contact-admin-polished .contact-admin-stat span {
          color: #62758b;
          font-family: "Alexandria", sans-serif;
          font-size: .76rem;
        }

        .contact-admin-polished .contact-admin-stat strong {
          color: #0e2d4d;
          font-family: "Sora", sans-serif;
          font-size: 1.8rem;
          line-height: 1.15;
        }

        .contact-stat-icon {
          width: 48px;
          height: 48px;
          display: grid;
          place-items: center;
          border-radius: 15px;
          color: #fff;
          box-shadow: 0 10px 22px rgba(22,136,255,.17);
        }

        .contact-stat-icon.tone-blue { background: linear-gradient(135deg, #0875df, #2ba8ff); }
        .contact-stat-icon.tone-cyan { background: linear-gradient(135deg, #159acb, #35d4ff); }
        .contact-stat-icon.tone-orange { background: linear-gradient(135deg, #ff8b32, #ffb65e); }

        .contact-admin-polished .contact-admin-section {
          position: relative;
          isolation: isolate;
          margin-bottom: 24px;
          padding: 24px;
          border: 1px solid rgba(179, 204, 232, .76);
          border-radius: 24px;
          background:
            radial-gradient(circle at 92% 0%, rgba(22,136,255,.10), transparent 26%),
            radial-gradient(circle at 4% 100%, rgba(53,212,255,.08), transparent 24%),
            linear-gradient(180deg, #ffffff 0%, #f8fbff 100%);
          box-shadow: 0 18px 48px rgba(6, 24, 44, .075);
        }

        .contact-admin-polished .contact-admin-section::before {
          content: "";
          position: absolute;
          inset: 0;
          z-index: -1;
          border-radius: inherit;
          pointer-events: none;
          background-image:
            linear-gradient(rgba(22,136,255,.025) 1px, transparent 1px),
            linear-gradient(90deg, rgba(22,136,255,.025) 1px, transparent 1px);
          background-size: 28px 28px;
          mask-image: linear-gradient(to bottom, #000, transparent 65%);
        }

        .contact-admin-polished .contact-admin-heading {
          margin-bottom: 18px;
          padding-bottom: 17px;
          border-bottom: 1px solid rgba(199, 216, 234, .72);
        }

        .contact-admin-heading-copy {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .contact-admin-polished .contact-admin-heading h2 {
          color: #0e2947;
          font-size: 1.08rem;
        }

        .contact-count-pill {
          width: max-content;
          padding: 4px 9px;
          border: 1px solid #cee4f7;
          border-radius: 999px;
          background: #edf7ff;
          color: #1688ff !important;
          font-family: "Alexandria", sans-serif;
          font-size: .62rem !important;
          white-space: nowrap;
        }

        .contact-export-btn,
        .contact-print-btn {
          border-color: #c9dced !important;
          background: rgba(255,255,255,.9) !important;
          color: #22415f !important;
          box-shadow: 0 6px 16px rgba(9, 41, 73, .045);
          transition: transform .22s ease, border-color .22s ease, color .22s ease, background .22s ease, box-shadow .22s ease !important;
        }

        .contact-export-btn:hover,
        .contact-print-btn:hover {
          transform: translateY(-2px);
          border-color: #8ac1ef !important;
          background: linear-gradient(135deg, #eff8ff, #f7fdff) !important;
          color: #0875df !important;
          box-shadow: 0 10px 24px rgba(22,136,255,.13);
        }

        .contact-admin-polished .contact-admin-list {
          position: relative;
          isolation: isolate;
          gap: 13px;
        }

        .contact-admin-polished .contact-request-card {
          position: relative;
          z-index: 1;
          overflow: hidden;
          border: 1px solid rgba(197, 215, 233, .9);
          border-inline-start: 4px solid #1688ff;
          border-radius: 18px;
          background: rgba(255,255,255,.88);
          box-shadow: 0 8px 22px rgba(6, 24, 44, .045);
          transition: transform .24s cubic-bezier(.22,1,.36,1), border-color .24s ease, box-shadow .24s ease, background .24s ease;
        }

        .contact-admin-polished .contact-request-card:hover {
          transform: translateY(-3px);
          border-color: rgba(22,136,255,.34);
          background: #fff;
          box-shadow: 0 16px 36px rgba(9, 50, 91, .10);
        }

        .contact-admin-polished .contact-request-card[open] {
          border-color: rgba(22,136,255,.38);
          background: rgba(255,255,255,.98);
          box-shadow: 0 18px 42px rgba(9, 50, 91, .11);
        }

        /* Keep an opened status menu above the cards that come after it. */
        .contact-admin-polished .contact-request-card:has(.contact-status-select.is-open) {
          z-index: 120;
        }

        .contact-admin-polished .contact-request-card summary {
          min-height: 78px;
          padding: 15px 17px;
          border-radius: 14px;
          transition: background .22s ease;
        }


        .contact-admin-polished .contact-request-card[open] > summary {
          border-radius: 17px 17px 0 0;
        }

        .contact-admin-polished .contact-request-card summary:hover {
          background: linear-gradient(90deg, rgba(22,136,255,.035), rgba(53,212,255,.018));
        }

        .contact-admin-summary-copy {
          min-width: 0;
          display: grid !important;
          gap: 4px !important;
        }

        .contact-admin-summary-copy strong {
          color: #102139;
          font-size: .86rem !important;
        }

        .contact-admin-summary-side {
          display: flex;
          align-items: center;
          gap: 9px;
          flex: 0 0 auto;
        }

        .contact-card-chevron {
          width: 34px;
          height: 34px;
          display: grid;
          place-items: center;
          border: 1px solid #d3e3f2;
          border-radius: 10px;
          background: #f4f9fe;
          color: #1688ff;
          transition: transform .22s ease, background .22s ease, color .22s ease;
        }

        .contact-request-card[open] .contact-card-chevron {
          transform: rotate(180deg);
          background: linear-gradient(135deg, #1688ff, #35d4ff);
          color: #fff;
        }

        .contact-admin-polished .contact-status {
          padding: 5px 10px;
          border: 1px solid transparent;
          box-shadow: inset 0 1px 0 rgba(255,255,255,.75);
          font-weight: 700;
        }

        .contact-admin-polished .status-new { border-color: #cce6fb; }
        .contact-admin-polished .status-in_review { border-color: #efdcae; }
        .contact-admin-polished .status-in_progress { border-color: #b9ddf6; }
        .contact-admin-polished .status-resolved,
        .contact-admin-polished .status-accepted { border-color: #c5e8d0; }
        .contact-admin-polished .status-contacted { border-color: #d4dcfb; }
        .contact-admin-polished .status-rejected { border-color: #f0cece; }

        .contact-admin-polished .contact-admin-details {
          position: relative;
          overflow: visible;
          padding: 18px;
          border-radius: 0 0 17px 17px;
          border-top: 1px solid rgba(207, 221, 236, .78);
          background: linear-gradient(180deg, rgba(247,251,255,.72), rgba(255,255,255,.86));
        }

        .contact-admin-polished .contact-admin-info,
        .contact-admin-polished .contact-admin-description {
          border: 1px solid rgba(205, 220, 235, .82);
          background: rgba(255,255,255,.78);
          box-shadow: inset 0 1px 0 rgba(255,255,255,.92);
          transition: transform .22s ease, border-color .22s ease, background .22s ease, box-shadow .22s ease;
        }

        .contact-admin-polished .contact-admin-info:hover,
        .contact-admin-polished .contact-admin-description:hover {
          transform: translateY(-2px);
          border-color: rgba(22,136,255,.26);
          background: #fff;
          box-shadow: 0 8px 20px rgba(22,136,255,.07);
        }

        .contact-admin-polished .contact-admin-info strong {
          color: #6b7d91;
        }

        .contact-admin-polished .contact-admin-info span {
          color: var(--theme-strong-text);
        }

        .contact-admin-polished .contact-admin-description p {
          color: #4c6178;
          max-width: 100%;
          overflow-wrap: anywhere;
          word-break: break-word;
        }

        .contact-admin-polished .contact-admin-details,
        .contact-admin-polished .contact-admin-details > *,
        .contact-admin-polished .contact-admin-description,
        .contact-admin-polished .contact-admin-description p {
          min-width: 0;
        }

        .contact-admin-polished .complaint-reply-history article,
        .contact-admin-polished .complaint-reply-history p {
          min-width: 0;
          max-width: 100%;
          overflow-wrap: anywhere;
          word-break: break-word;
        }

        .contact-admin-actions {
          display: flex;
          align-items: center;
          gap: 9px;
        }

        .contact-inline-action {
          margin-top: 10px;
        }

        .contact-admin-polished .contact-status-form {
          position: relative;
          z-index: 12;
          padding: 12px;
          border: 1px solid rgba(197, 216, 235, .82);
          border-radius: 15px;
          background: linear-gradient(135deg, rgba(244,249,255,.92), rgba(249,253,255,.96));
        }

        .contact-admin-polished .contact-status-form:has(.contact-status-select.is-open) {
          z-index: 130;
          border-color: rgba(22,136,255,.24);
          box-shadow: 0 10px 28px rgba(22,136,255,.07);
        }

        .contact-status-select {
          position: relative;
          z-index: 1;
          flex: 1 1 240px;
          max-width: 340px;
        }

        .contact-status-select.is-open {
          z-index: 150;
        }

        .contact-status-trigger {
          width: 100%;
          min-height: 44px;
          padding: 8px 10px;
          display: flex;
          align-items: center;
          gap: 9px;
          border: 1px solid #c9dced;
          border-radius: 12px;
          background: #fff;
          color: #193651;
          cursor: pointer;
          text-align: right;
          transition: transform .2s ease, border-color .2s ease, box-shadow .2s ease, background .2s ease;
        }

        .contact-status-trigger:hover {
          transform: translateY(-1px);
          border-color: #8bc1ef;
          background: #fafdff;
          box-shadow: 0 8px 20px rgba(22,136,255,.09);
        }

        .contact-status-select.is-open .contact-status-trigger {
          border-color: #1688ff;
          box-shadow: 0 0 0 3px rgba(22,136,255,.10), 0 10px 24px rgba(22,136,255,.10);
        }

        .contact-status-trigger-label {
          min-width: 0;
          flex: 1;
          font-family: "Alexandria", sans-serif;
          font-size: .72rem;
          font-weight: 700;
        }

        .contact-status-trigger-chevron {
          width: 28px;
          height: 28px;
          display: grid;
          place-items: center;
          border-radius: 8px;
          background: #edf6ff;
          color: #1688ff;
          transition: transform .2s ease, background .2s ease, color .2s ease;
        }

        .contact-status-select.is-open .contact-status-trigger-chevron {
          transform: rotate(180deg);
          background: linear-gradient(135deg, #1688ff, #35d4ff);
          color: #fff;
        }

        .contact-status-menu {
          position: absolute;
          top: calc(100% + 8px);
          right: 0;
          left: 0;
          z-index: 999;
          max-height: 280px;
          overflow-y: auto;
          overscroll-behavior: contain;
          padding: 7px;
          border: 1px solid #c6dff3;
          border-radius: 15px;
          background: #ffffff;
          box-shadow:
            0 24px 58px rgba(5,31,61,.22),
            0 4px 14px rgba(22,136,255,.08),
            inset 0 1px 0 rgba(255,255,255,.96);
          animation: contactMenuIn .16s cubic-bezier(.22,1,.36,1) both;
        }

        .contact-status-menu::before {
          content: "";
          position: absolute;
          inset: 0;
          z-index: -1;
          border-radius: inherit;
          pointer-events: none;
          background:
            radial-gradient(circle at 92% 6%, rgba(22,136,255,.075), transparent 32%),
            linear-gradient(180deg, rgba(255,255,255,1), rgba(249,252,255,1));
        }

        .contact-status-menu::-webkit-scrollbar {
          width: 7px;
        }

        .contact-status-menu::-webkit-scrollbar-thumb {
          border-radius: 999px;
          background: #c7dff3;
        }

        .contact-status-menu::-webkit-scrollbar-track {
          background: transparent;
        }

        .contact-status-option {
          width: 100%;
          min-height: 42px;
          padding: 7px 9px;
          display: flex;
          align-items: center;
          gap: 9px;
          border: 1px solid transparent;
          border-radius: 10px;
          background: #ffffff;
          color: #29445f;
          cursor: pointer;
          text-align: right;
          font-family: "Alexandria", sans-serif;
          font-size: .68rem;
          transition: transform .18s ease, background .18s ease, border-color .18s ease;
        }

        .contact-status-option:hover {
          transform: translateX(-2px);
          border-color: rgba(22,136,255,.13);
          background: linear-gradient(135deg, #eef8ff, #f8fdff);
        }

        .contact-status-option.is-active {
          border-color: rgba(22,136,255,.18);
          background: linear-gradient(135deg, #eaf5ff, #f0fbff);
          color: #0f6fc5;
        }

        .contact-status-option-check {
          margin-inline-start: auto;
          width: 25px;
          height: 25px;
          display: grid;
          place-items: center;
          border-radius: 8px;
          color: #fff;
        }

        .contact-status-option.is-active .contact-status-option-check {
          background: linear-gradient(135deg, #1688ff, #35d4ff);
          box-shadow: 0 6px 13px rgba(22,136,255,.18);
        }

        .contact-status-dot {
          flex: 0 0 auto;
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: #91a4b8;
          box-shadow: 0 0 0 3px rgba(145,164,184,.10);
        }

        .status-dot-new { background: #1688ff; box-shadow: 0 0 0 3px rgba(22,136,255,.11); }
        .status-dot-in_review { background: #e8a521; box-shadow: 0 0 0 3px rgba(232,165,33,.11); }
        .status-dot-in_progress { background: #159acb; box-shadow: 0 0 0 3px rgba(21,154,203,.11); }
        .status-dot-resolved,
        .status-dot-accepted { background: #27a45d; box-shadow: 0 0 0 3px rgba(39,164,93,.11); }
        .status-dot-contacted { background: #667eea; box-shadow: 0 0 0 3px rgba(102,126,234,.11); }
        .status-dot-rejected { background: #d95656; box-shadow: 0 0 0 3px rgba(217,86,86,.11); }

        .contact-status-save {
          min-width: 118px;
          min-height: 44px !important;
          border-radius: 12px !important;
          background: linear-gradient(120deg, #0875df 0%, #1688ff 52%, #35d4ff 100%) !important;
          box-shadow: 0 10px 22px rgba(22,136,255,.20) !important;
          transition: transform .22s ease, box-shadow .22s ease, filter .22s ease !important;
        }

        .contact-status-save:hover {
          transform: translateY(-2px);
          filter: saturate(1.08);
          box-shadow: 0 14px 28px rgba(22,136,255,.28) !important;
        }

        .contact-admin-polished .contact-admin-empty {
          min-height: 150px;
          display: grid;
          place-items: center;
          border: 1px dashed #bdd9ef;
          border-radius: 16px;
          background: linear-gradient(135deg, rgba(245,250,255,.9), rgba(250,254,255,.95));
        }

        @keyframes contactMenuIn {
          from { opacity: 0; transform: translateY(-5px) scale(.985); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }

        @media (max-width: 780px) {
          .contact-admin-polished .contact-admin-section { padding: 16px; }
          .contact-admin-summary-side { gap: 6px; }
          .contact-admin-polished .contact-status-form { align-items: stretch; }
          .contact-status-select { max-width: none; width: 100%; }
          .contact-status-save { width: 100%; }
        }

        @media (max-width: 560px) {
          .contact-admin-polished .contact-request-card summary {
            align-items: flex-start;
            flex-direction: column;
          }

          .contact-admin-summary-side {
            width: 100%;
            justify-content: space-between;
          }

          .contact-admin-heading-copy {
            align-items: flex-start;
            flex-direction: column;
            gap: 6px;
          }

          .contact-export-btn { width: 100%; }
          .contact-admin-polished .contact-admin-heading { align-items: stretch; flex-direction: column; }
        }

        @media (prefers-reduced-motion: reduce) {
          .contact-admin-polished .contact-admin-stat,
          .contact-admin-polished .contact-request-card,
          .contact-export-btn,
          .contact-print-btn,
          .contact-status-trigger,
          .contact-status-option,
          .contact-status-save,
          .contact-status-menu {
            transition: none !important;
            animation: none !important;
          }
        }
      `}</NonceStyle>
    </main>
  );
}

function StatCard({
  title,
  value,
  icon,
  tone,
}: {
  title: string;
  value: number;
  icon: ReactNode;
  tone: "blue" | "cyan" | "orange";
}) {
  return (
    <div className="contact-admin-stat">
      <div className="contact-stat-copy">
        <span>{title}</span>
        <strong>{value}</strong>
      </div>
      <span className={`contact-stat-icon tone-${tone}`} aria-hidden="true">
        {icon}
      </span>
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
  children: ReactNode;
}) {
  return (
    <section className="contact-admin-section">
      <div className="contact-admin-heading">
        <div className="contact-admin-heading-copy">
          <h2>{title}</h2>
          <span className="contact-count-pill">{count} طلب</span>
        </div>

        {exportHref && (
          <Link
            href={exportHref}
            className="ghost-btn contact-export-btn"
            data-no-page-transition
          >
            <Download size={17} strokeWidth={1.8} />
            تصدير Excel
          </Link>
        )}
      </div>

      <div className="contact-admin-list">{children}</div>
    </section>
  );
}

function EmptyState({ text }: { text: string }) {
  return <div className="contact-admin-empty">{text}</div>;
}

function Info({ title, value }: { title: string; value: string }) {
  return (
    <div className="contact-admin-info">
      <strong>{title}</strong>
      <span>{value}</span>
    </div>
  );
}

function RoutingHistory({
  events,
}: {
  events: {
    id: string;
    fromName: string | null;
    toName: string;
    note: string | null;
    createdAt: Date;
  }[];
}) {
  if (events.length === 0) return null;

  return (
    <div className="contact-routing-history">
      <strong>مسار توجيه الطلب</strong>
      <ol>
        {events.map((event) => (
          <li key={event.id}>
            <div>
              <span>
                {event.fromName
                  ? `${event.fromName} ← ${event.toName}`
                  : `وُجّه إلى ${event.toName}`}
              </span>
              <time>
                {event.createdAt.toLocaleString("ar-EG")}
              </time>
            </div>
            {event.note && <p>{event.note}</p>}
          </li>
        ))}
      </ol>
    </div>
  );
}

function StatusBadge({
  status,
}: {
  status: keyof typeof CONTACT_STATUS_LABELS;
}) {
  return (
    <span className={`contact-status status-${status.toLowerCase()}`}>
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
  const options = statuses.map((status) => ({
    value: status,
    label:
      CONTACT_STATUS_LABELS[
        status as keyof typeof CONTACT_STATUS_LABELS
      ],
  }));

  return (
    <form action={updateContactStatus} className="contact-status-form">
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="kind" value={kind} />

      <ContactStatusSelect
        name="status"
        defaultValue={currentStatus}
        options={options}
      />

      <button type="submit" className="primary-btn small contact-status-save">
        حفظ الحالة
      </button>
    </form>
  );
}
