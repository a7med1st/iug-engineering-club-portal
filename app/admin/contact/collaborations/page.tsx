import Link from "next/link";
import {
  ArrowRight,
  ChevronDown,
  Download,
  Handshake,
  Printer,
} from "lucide-react";

import ContactEscalationForm from "@/components/admin/ContactEscalationForm";
import ContactStatusSelect from "@/components/admin/ContactStatusSelect";
import { NonceStyle } from "@/components/security/CspNonce";
import {
  hasGlobalContactAccess,
  requireContactAccess,
} from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { CONTACT_STATUS_LABELS } from "@/lib/contact-options";

import { updateContactStatus } from "../actions";

export const dynamic = "force-dynamic";

const collaborationStatuses = [
  "NEW",
  "IN_REVIEW",
  "IN_PROGRESS",
  "RESOLVED",
] as const;

type CollaborationStatus =
  (typeof collaborationStatuses)[number];

const statusTabLabels: Record<
  CollaborationStatus,
  string
> = {
  NEW: "جديد",
  IN_REVIEW: "قيد المراجعة",
  IN_PROGRESS: "قيد التنفيذ",
  RESOLVED: "تم التنفيذ",
};

function isCollaborationStatus(
  value: string | undefined,
): value is CollaborationStatus {
  return collaborationStatuses.includes(
    value as CollaborationStatus,
  );
}

export default async function CollaborationsPage({
  searchParams,
}: {
  searchParams: Promise<{
    status?: string;
    focus?: string;
  }>;
}) {
  const { user } =
    await requireContactAccess();

  const params = await searchParams;

  const selectedStatus:
    CollaborationStatus =
    isCollaborationStatus(params.status)
      ? params.status
      : "NEW";

  const hasGlobalAccess =
    hasGlobalContactAccess(user);

  const assignedWhere =
    hasGlobalAccess
      ? {}
      : {
          assignedToId: user.id,
        };

  const [
    collaborations,
    newCount,
    reviewCount,
    progressCount,
    resolvedCount,
  ] = await Promise.all([
    prisma.collaborationRequest.findMany({
      where: {
        ...assignedWhere,
        status: selectedStatus,
      },
      include: {
        assignedTo: {
          select: {
            name: true,
          },
        },
        assignedStructureItem: {
          select: {
            title: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    }),

    prisma.collaborationRequest.count({
      where: {
        ...assignedWhere,
        status: "NEW",
      },
    }),

    prisma.collaborationRequest.count({
      where: {
        ...assignedWhere,
        status: "IN_REVIEW",
      },
    }),

    prisma.collaborationRequest.count({
      where: {
        ...assignedWhere,
        status: "IN_PROGRESS",
      },
    }),

    prisma.collaborationRequest.count({
      where: {
        ...assignedWhere,
        status: "RESOLVED",
      },
    }),
  ]);

  const routingEvents =
    collaborations.length > 0
      ? await prisma.contactRoutingEvent.findMany({
          where: {
            requestKind: "COLLABORATION",
            requestId: {
              in: collaborations.map(
                (item) => item.id,
              ),
            },
          },
          orderBy: {
            createdAt: "asc",
          },
        })
      : [];

  const eventsFor = (id: string) =>
    routingEvents.filter(
      (event) =>
        event.requestId === id,
    );

  const counts: Record<
    CollaborationStatus,
    number
  > = {
    NEW: newCount,
    IN_REVIEW: reviewCount,
    IN_PROGRESS: progressCount,
    RESOLVED: resolvedCount,
  };

  return (
    <main className="admin-contact-page contact-requests-page shell">
      <div className="contact-page-head">
        <div>
          <Link
            href="/admin/contact"
            className="contact-back-link"
          >
            <ArrowRight size={17} />
            إدارة التواصل
          </Link>

          <h1>طلبات التعاون</h1>

          <p>
            اختر حالة طلبات التعاون التي تريد متابعتها.
            عند تغيير حالة أي طلب وحفظها سينتقل
            تلقائيًا إلى تبويب حالته الجديدة.
          </p>
        </div>

        <div
          className="contact-page-icon tone-orange"
          aria-hidden="true"
        >
          <Handshake
            size={27}
            strokeWidth={1.9}
          />
        </div>
      </div>

      <nav
        className="contact-status-tabs"
        aria-label="حالات طلبات التعاون"
      >
        {collaborationStatuses.map(
          (status) => (
            <Link
              key={status}
              href={`/admin/contact/collaborations?status=${status}`}
              className={`contact-status-tab status-tab-${status.toLowerCase()} ${
                selectedStatus === status
                  ? "is-active"
                  : ""
              }`}
            >
              <span>
                {statusTabLabels[status]}
              </span>

              <strong>
                {counts[status]}
              </strong>
            </Link>
          ),
        )}
      </nav>

      <section className="contact-admin-section">
        <div className="contact-admin-heading">
          <div>
            <h2>
              {
                statusTabLabels[
                  selectedStatus
                ]
              }
            </h2>

            <span className="contact-count-pill">
              {collaborations.length} طلب
            </span>
          </div>

          <Link
            href="/admin/contact/export/collaborations"
            className="ghost-btn contact-export-btn"
            data-no-page-transition
          >
            تصدير Excel
          </Link>
        </div>

        <div className="contact-admin-list">
          {collaborations.length === 0 ? (
            <EmptyState
              text={`لا توجد طلبات تعاون بحالة «${statusTabLabels[selectedStatus]}».`}
            />
          ) : (
            collaborations.map((item) => (
              <details
                id={`collaboration-${item.id}`}
                open={
                  params.focus ===
                  `collaboration-${item.id}`
                }
                className="contact-admin-item contact-request-card"
                key={item.id}
              >
                <summary>
                  <div className="contact-admin-summary-copy">
                    <strong>
                      {item.entityName}
                    </strong>

                    <small>
                      {item.contactPerson}
                    </small>
                  </div>

                  <div className="contact-admin-summary-side">
                    <StatusBadge
                      status={item.status}
                    />

                    <span
                      className="contact-card-chevron"
                      aria-hidden="true"
                    >
                      <ChevronDown
                        size={17}
                      />
                    </span>
                  </div>
                </summary>

                <div className="contact-admin-details">
                  <div className="contact-info-grid">
                    <Info
                      title="مسؤول التواصل"
                      value={
                        item.contactPerson
                      }
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

                    <Info
                      title="المسؤول الحالي"
                      value={
                        item.assignedTo
                          ? `${
                              item
                                .assignedTo
                                .name
                            }${
                              item
                                .assignedStructureItem
                                ?.title
                                ? ` — ${item.assignedStructureItem.title}`
                                : ""
                            }`
                          : "غير موجّه"
                      }
                    />

                    <Info
                      title="تاريخ الإرسال"
                      value={item.createdAt.toLocaleString(
                        "ar-EG",
                      )}
                    />
                  </div>

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

                      <div className="contact-inline-action">
                        <Link
                          href={`/admin/contact/files/${item.id}`}
                          className="ghost-btn contact-print-btn"
                          data-no-page-transition
                        >
                          <Download
                            size={16}
                          />
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
                        {
                          item.additionalNotes
                        }
                      </p>
                    </div>
                  )}

                  <div className="contact-admin-actions">
                    <Link
                      href={`/admin/contact/print/collaboration/${item.id}`}
                      className="ghost-btn contact-print-btn"
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

                  <RoutingHistory
                    events={eventsFor(
                      item.id,
                    )}
                  />

                  <ContactEscalationForm
                    id={item.id}
                    kind="collaboration"
                    assignedName={
                      item.assignedTo
                        ?.name ?? null
                    }
                  />

                  <StatusForm
                    id={item.id}
                    currentStatus={
                      item.status
                    }
                  />
                </div>
              </details>
            ))
          )}
        </div>
      </section>

      <NonceStyle>{`
        .contact-requests-page {
          --contact-blue: #1688ff;
          --contact-cyan: #35d4ff;
          --contact-orange: #ff8b32;
          padding-bottom: 40px;
        }

        .contact-page-head {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 18px;
          margin-bottom: 22px;
        }

        .contact-back-link {
          width: fit-content;
          display: inline-flex;
          align-items: center;
          gap: 7px;
          margin-bottom: 10px;
          color: #1688ff;
          text-decoration: none;
          font-size: .72rem;
          font-weight: 700;
        }

        .contact-page-head h1 {
          margin: 0 0 7px;
          color: #0c2340;
          font-size: clamp(1.75rem, 3vw, 2.35rem);
        }

        .contact-page-head p {
          max-width: 720px;
          margin: 0;
          color: #6e8096;
          font-size: .86rem;
          line-height: 1.8;
        }

        .contact-page-icon {
          flex: 0 0 auto;
          width: 58px;
          height: 58px;
          display: grid;
          place-items: center;
          border-radius: 18px;
          color: #fff;
          box-shadow: 0 11px 24px rgba(255,139,50,.20);
        }

        .contact-page-icon.tone-orange {
          background: linear-gradient(135deg, #ff7a1a, #ffb65e);
        }

        .contact-status-tabs {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 12px;
          margin-bottom: 22px;
        }

        .contact-status-tab {
          min-height: 78px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          padding: 15px 17px;
          border: 1px solid rgba(190,210,230,.86);
          border-radius: 17px;
          background: linear-gradient(145deg, #fff, #f7fbff);
          box-shadow: 0 9px 24px rgba(6,24,44,.055);
          color: #617289;
          text-decoration: none;
          transition:
            transform .22s ease,
            border-color .22s ease,
            box-shadow .22s ease,
            background .22s ease;
        }

        .contact-status-tab:hover {
          transform: translateY(-3px);
          border-color: rgba(255,139,50,.34);
          box-shadow: 0 14px 30px rgba(9,50,91,.095);
        }

        .contact-status-tab span {
          font-family: "Alexandria", sans-serif;
          font-size: .72rem;
          font-weight: 700;
        }

        .contact-status-tab strong {
          min-width: 34px;
          height: 34px;
          display: grid;
          place-items: center;
          padding: 0 8px;
          border-radius: 11px;
          background: #fff2e8;
          color: #e66f16;
          font-family: "Sora", sans-serif;
          font-size: .9rem;
        }

        .contact-status-tab.is-active {
          transform: translateY(-2px);
          border-color: rgba(255,139,50,.50);
          background:
            radial-gradient(circle at 8% 10%, rgba(255,182,94,.15), transparent 34%),
            linear-gradient(145deg, #fff6ee, #ffffff);
          color: #c65b0b;
          box-shadow:
            0 15px 32px rgba(255,139,50,.13),
            inset 0 1px 0 rgba(255,255,255,.95);
        }

        .contact-status-tab.is-active strong {
          background: linear-gradient(135deg, #ff7a1a, #ffb65e);
          color: #fff;
        }

        .contact-admin-section {
          position: relative;
          isolation: isolate;
          padding: 24px;
          border: 1px solid rgba(179,204,232,.76);
          border-radius: 24px;
          background:
            radial-gradient(circle at 92% 0%, rgba(255,139,50,.09), transparent 26%),
            linear-gradient(180deg, #fff 0%, #f8fbff 100%);
          box-shadow: 0 18px 48px rgba(6,24,44,.075);
        }

        .contact-admin-heading {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 14px;
          margin-bottom: 18px;
          padding-bottom: 17px;
          border-bottom: 1px solid rgba(199,216,234,.72);
        }

        .contact-admin-heading > div {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .contact-admin-heading h2 {
          margin: 0;
          color: #0e2947;
          font-size: 1.08rem;
        }

        .contact-count-pill {
          width: max-content;
          padding: 4px 9px;
          border: 1px solid #f2d6be;
          border-radius: 999px;
          background: #fff4eb;
          color: #e66f16;
          font-family: "Alexandria", sans-serif;
          font-size: .62rem;
          white-space: nowrap;
        }

        .contact-export-btn,
        .contact-print-btn {
          border-color: #c9dced !important;
          background: rgba(255,255,255,.9) !important;
          color: #22415f !important;
        }

        .contact-admin-list {
          display: grid;
          gap: 13px;
        }

        .contact-request-card {
          position: relative;
          overflow: visible;
          border: 1px solid rgba(197,215,233,.9);
          border-inline-start: 4px solid #ff8b32;
          border-radius: 18px;
          background: rgba(255,255,255,.9);
          box-shadow: 0 8px 22px rgba(6,24,44,.045);
          transition:
            transform .24s ease,
            border-color .24s ease,
            box-shadow .24s ease;
        }

        .contact-request-card:hover {
          transform: translateY(-2px);
          border-color: rgba(255,139,50,.36);
          box-shadow: 0 15px 34px rgba(9,50,91,.09);
        }

        .contact-request-card[open] {
          border-color: rgba(255,139,50,.45);
          box-shadow: 0 18px 42px rgba(9,50,91,.11);
        }

        .contact-request-card:has(.contact-status-select.is-open) {
          z-index: 120;
        }

        .contact-request-card summary {
          min-height: 76px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 14px;
          padding: 15px 17px;
          cursor: pointer;
          list-style: none;
        }

        .contact-request-card summary::-webkit-details-marker {
          display: none;
        }

        .contact-admin-summary-copy {
          min-width: 0;
          display: grid;
          gap: 4px;
        }

        .contact-admin-summary-copy strong {
          color: #102139;
          font-size: .86rem;
        }

        .contact-admin-summary-copy small {
          color: #718399;
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
          border: 1px solid #ecd8c5;
          border-radius: 10px;
          background: #fff8f1;
          color: #e66f16;
          transition: transform .22s ease;
        }

        .contact-request-card[open] .contact-card-chevron {
          transform: rotate(180deg);
        }

        .contact-status {
          padding: 5px 10px;
          border: 1px solid #cce6fb;
          border-radius: 999px;
          background: #f2f8fd;
          color: #33536f;
          font-size: .67rem;
          font-weight: 700;
        }

        .status-in_review {
          border-color: #efdcae;
          background: #fff9eb;
          color: #94640a;
        }

        .status-in_progress {
          border-color: #b9ddf6;
          background: #edf8ff;
          color: #147aa4;
        }

        .status-resolved {
          border-color: #c5e8d0;
          background: #effcf3;
          color: #15804a;
        }

        .contact-admin-details {
          position: relative;
          overflow: visible;
          display: grid;
          gap: 14px;
          padding: 18px;
          border-top: 1px solid rgba(207,221,236,.78);
          border-radius: 0 0 17px 17px;
          background: linear-gradient(180deg, rgba(247,251,255,.72), rgba(255,255,255,.86));
        }

        .contact-info-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 11px;
        }

        .contact-admin-info,
        .contact-admin-description {
          min-width: 0;
          padding: 13px 14px;
          border: 1px solid rgba(205,220,235,.82);
          border-radius: 13px;
          background: rgba(255,255,255,.8);
        }

        .contact-admin-info {
          display: grid;
          gap: 4px;
        }

        .contact-admin-info strong,
        .contact-admin-description strong {
          color: #6b7d91;
          font-size: .67rem;
        }

        .contact-admin-info span {
          color: #17324d;
          font-size: .76rem;
          overflow-wrap: anywhere;
        }

        .contact-admin-description p {
          margin: 8px 0 0;
          color: #4c6178;
          line-height: 1.85;
          overflow-wrap: anywhere;
        }

        .contact-inline-action {
          margin-top: 10px;
        }

        .contact-admin-actions {
          display: flex;
          align-items: center;
          gap: 9px;
        }

        .contact-status-form {
          position: relative;
          z-index: 12;
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 12px;
          border: 1px solid rgba(197,216,235,.82);
          border-radius: 15px;
          background: linear-gradient(135deg, rgba(244,249,255,.92), rgba(249,253,255,.96));
        }

        .contact-status-form:has(.contact-status-select.is-open) {
          z-index: 130;
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
        }

        .contact-status-menu {
          position: absolute;
          top: calc(100% + 8px);
          right: 0;
          left: 0;
          z-index: 999;
        }

        .contact-status-save {
          min-width: 118px;
          min-height: 44px !important;
        }

        .contact-routing-history {
          padding: 14px;
          border: 1px solid rgba(205,220,235,.82);
          border-radius: 14px;
          background: rgba(255,255,255,.78);
        }

        .contact-routing-history ol {
          margin: 10px 0 0;
          padding-inline-start: 20px;
        }

        .contact-routing-history li + li {
          margin-top: 10px;
        }

        .contact-routing-history li > div {
          display: flex;
          justify-content: space-between;
          gap: 12px;
        }

        .contact-routing-history time {
          color: #7d8fa2;
          font-size: .65rem;
        }

        .contact-routing-history p {
          margin: 5px 0 0;
          color: #53687d;
        }

        .contact-admin-empty {
          min-height: 180px;
          display: grid;
          place-items: center;
          padding: 24px;
          border: 1px dashed #e7c5a9;
          border-radius: 16px;
          background: linear-gradient(135deg, #fff9f3, #fffdfb);
          color: #86674f;
          text-align: center;
        }

        html[data-theme="dark"] .contact-page-head h1,
        html[data-theme="dark"] .contact-admin-heading h2,
        html[data-theme="dark"] .contact-admin-summary-copy strong {
          color: #eef7ff !important;
        }

        html[data-theme="dark"] .contact-page-head p,
        html[data-theme="dark"] .contact-admin-summary-copy small {
          color: #a9bfd2 !important;
        }

        html[data-theme="dark"] .contact-status-tab,
        html[data-theme="dark"] .contact-admin-section,
        html[data-theme="dark"] .contact-request-card,
        html[data-theme="dark"] .contact-admin-info,
        html[data-theme="dark"] .contact-admin-description,
        html[data-theme="dark"] .contact-routing-history {
          border-color: rgba(91,169,224,.36) !important;
          background: #0b2941 !important;
          color: #dcebf6 !important;
        }

        html[data-theme="dark"] .contact-status-tab.is-active {
          border-color: rgba(255,166,94,.60) !important;
          background: #3a2b20 !important;
        }

        html[data-theme="dark"] .contact-admin-details {
          border-top-color: rgba(91,169,224,.32) !important;
          background: #092238 !important;
        }

        html[data-theme="dark"] .contact-admin-info span,
        html[data-theme="dark"] .contact-admin-description p,
        html[data-theme="dark"] .contact-routing-history p {
          color: #d4e4f0 !important;
        }

        @media (max-width: 900px) {
          .contact-status-tabs {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }

        @media (max-width: 650px) {
          .contact-page-head {
            align-items: flex-start;
          }

          .contact-page-icon {
            width: 50px;
            height: 50px;
          }

          .contact-status-tabs {
            grid-template-columns: 1fr;
          }

          .contact-admin-section {
            padding: 16px;
          }

          .contact-admin-heading {
            align-items: stretch;
            flex-direction: column;
          }

          .contact-info-grid {
            grid-template-columns: 1fr;
          }

          .contact-request-card summary {
            align-items: flex-start;
            flex-direction: column;
          }

          .contact-admin-summary-side {
            width: 100%;
            justify-content: space-between;
          }

          .contact-status-form {
            align-items: stretch;
            flex-direction: column;
          }

          .contact-status-select,
          .contact-status-save {
            width: 100%;
            max-width: none;
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .contact-status-tab,
          .contact-request-card,
          .contact-card-chevron {
            transition: none !important;
          }
        }
      `}</NonceStyle>
    </main>
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
  if (events.length === 0) {
    return null;
  }

  return (
    <div className="contact-routing-history">
      <strong>
        مسار توجيه الطلب
      </strong>

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
                {event.createdAt.toLocaleString(
                  "ar-EG",
                )}
              </time>
            </div>

            {event.note && (
              <p>{event.note}</p>
            )}
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
    <span
      className={`contact-status status-${status.toLowerCase()}`}
    >
      {
        CONTACT_STATUS_LABELS[
          status
        ]
      }
    </span>
  );
}

function StatusForm({
  id,
  currentStatus,
}: {
  id: string;
  currentStatus: string;
}) {
  const options =
    collaborationStatuses.map(
      (status) => ({
        value: status,
        label:
          CONTACT_STATUS_LABELS[
            status
          ],
      }),
    );

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
        value="collaboration"
      />

      <ContactStatusSelect
        name="status"
        defaultValue={
          currentStatus
        }
        options={options}
      />

      <button
        type="submit"
        className="primary-btn small contact-status-save"
      >
        حفظ الحالة
      </button>
    </form>
  );
}
