import type { ReactNode } from "react";
import Link from "next/link";
import {
  ArrowRight,
  ChevronDown,
  MessageSquare,
  Printer,
} from "lucide-react";

import ContactEscalationForm from "@/components/admin/ContactEscalationForm";
import ContactStatusSelect from "@/components/admin/ContactStatusSelect";
import ComplaintReplyForm from "@/components/admin/ComplaintReplyForm";
import { NonceStyle } from "@/components/security/CspNonce";
import {
  hasGlobalContactAccess,
  requireContactAccess,
} from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { CONTACT_STATUS_LABELS } from "@/lib/contact-options";

import { updateContactStatus } from "../actions";

export const dynamic = "force-dynamic";

const complaintStatuses = [
  "NEW",
  "IN_REVIEW",
  "IN_PROGRESS",
  "RESOLVED",
] as const;

type ComplaintStatus =
  (typeof complaintStatuses)[number];

const statusTabLabels: Record<
  ComplaintStatus,
  string
> = {
  NEW: "جديد",
  IN_REVIEW: "قيد المراجعة",
  IN_PROGRESS: "قيد التنفيذ",
  RESOLVED: "تم التنفيذ",
};

function isComplaintStatus(
  value: string | undefined,
): value is ComplaintStatus {
  return complaintStatuses.includes(
    value as ComplaintStatus,
  );
}

export default async function ComplaintsPage({
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
    ComplaintStatus =
    isComplaintStatus(params.status)
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
    complaints,
    newCount,
    reviewCount,
    progressCount,
    resolvedCount,
  ] = await Promise.all([
    prisma.complaint.findMany({
      where: {
        ...assignedWhere,
        status: selectedStatus,
      },
      include: {
        department: true,
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
        replies: {
          include: {
            author: {
              select: {
                name: true,
              },
            },
          },
          orderBy: {
            createdAt: "asc",
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    }),

    prisma.complaint.count({
      where: {
        ...assignedWhere,
        status: "NEW",
      },
    }),

    prisma.complaint.count({
      where: {
        ...assignedWhere,
        status: "IN_REVIEW",
      },
    }),

    prisma.complaint.count({
      where: {
        ...assignedWhere,
        status: "IN_PROGRESS",
      },
    }),

    prisma.complaint.count({
      where: {
        ...assignedWhere,
        status: "RESOLVED",
      },
    }),
  ]);

  const routingEvents =
    complaints.length > 0
      ? await prisma.contactRoutingEvent.findMany({
          where: {
            requestKind: "COMPLAINT",
            requestId: {
              in: complaints.map(
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
    ComplaintStatus,
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

          <h1>الشكاوى</h1>

          <p>
            اختر حالة الشكاوى التي تريد متابعتها.
            عند تغيير حالة أي شكوى وحفظها ستنتقل
            تلقائيًا إلى تبويب حالتها الجديدة.
          </p>
        </div>

        <div
          className="contact-page-icon tone-blue"
          aria-hidden="true"
        >
          <MessageSquare
            size={27}
            strokeWidth={1.9}
          />
        </div>
      </div>

      <nav
        className="contact-status-tabs"
        aria-label="حالات الشكاوى"
      >
        {complaintStatuses.map(
          (status) => (
            <Link
              key={status}
              href={`/admin/contact/complaints?status=${status}`}
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
              {complaints.length} طلب
            </span>
          </div>

          <Link
            href="/admin/contact/export/complaints"
            className="ghost-btn contact-export-btn"
            data-no-page-transition
          >
            تصدير Excel
          </Link>
        </div>

        <div className="contact-admin-list">
          {complaints.length === 0 ? (
            <EmptyState
              text={`لا توجد شكاوى بحالة «${statusTabLabels[selectedStatus]}».`}
            />
          ) : (
            complaints.map((item) => (
              <details
                id={`complaint-${item.id}`}
                open={
                  params.focus ===
                  `complaint-${item.id}`
                }
                className="contact-admin-item contact-request-card"
                key={item.id}
              >
                <summary>
                  <div className="contact-admin-summary-copy">
                    <strong>
                      {item.studentName ||
                        "طالب مجهول"}
                    </strong>

                    <small>
                      {item.department.nameAr}
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
                      title="وسيلة التواصل"
                      value={
                        item.contact ||
                        "غير مذكورة"
                      }
                    />

                    <Info
                      title="التخصص"
                      value={
                        item.department
                          .nameAr
                      }
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
                      title="حساب مرتبط بالطلب"
                      value={
                        item.submittedById
                          ? "نعم"
                          : "لا"
                      }
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
                      تفاصيل الشكوى
                    </strong>

                    <p>
                      {item.details}
                    </p>
                  </div>

                  <div className="contact-admin-actions">
                    <Link
                      href={`/admin/contact/print/complaint/${item.id}`}
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

                  {item.replies.length >
                    0 && (
                    <div className="complaint-reply-history">
                      <strong>
                        الردود المرسلة
                      </strong>

                      {item.replies.map(
                        (reply) => (
                          <article
                            key={reply.id}
                          >
                            <div>
                              <b>
                                {reply
                                  .author
                                  ?.name ??
                                  "إدارة النادي"}
                              </b>

                              <time>
                                {reply.createdAt.toLocaleString(
                                  "ar-EG",
                                )}
                              </time>
                            </div>

                            <p>
                              {
                                reply.message
                              }
                            </p>
                          </article>
                        ),
                      )}
                    </div>
                  )}

                  {item.wantsReply &&
                  item.submittedById ? (
                    <ComplaintReplyForm
                      complaintId={
                        item.id
                      }
                    />
                  ) : item.wantsReply ? (
                    <div className="complaint-reply-unavailable">
                      صاحب الشكوى طلب ردًا،
                      لكن الطلب غير مرتبط
                      بحساب؛ استخدم وسيلة
                      التواصل المكتوبة إن
                      وُجدت.
                    </div>
                  ) : null}

                  <RoutingHistory
                    events={eventsFor(
                      item.id,
                    )}
                  />

                  <ContactEscalationForm
                    id={item.id}
                    kind="complaint"
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
          box-shadow: 0 11px 24px rgba(22,136,255,.18);
        }

        .contact-page-icon.tone-blue {
          background: linear-gradient(135deg, #0875df, #2ba8ff);
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
          border: 1px solid rgba(190, 210, 230, .86);
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
          border-color: rgba(22,136,255,.32);
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
          background: #edf6ff;
          color: #1688ff;
          font-family: "Sora", sans-serif;
          font-size: .9rem;
        }

        .contact-status-tab.is-active {
          transform: translateY(-2px);
          border-color: rgba(22,136,255,.48);
          background:
            radial-gradient(circle at 8% 10%, rgba(53,212,255,.13), transparent 34%),
            linear-gradient(145deg, #eff8ff, #ffffff);
          color: #0d6fc8;
          box-shadow:
            0 15px 32px rgba(22,136,255,.12),
            inset 0 1px 0 rgba(255,255,255,.95);
        }

        .contact-status-tab.is-active strong {
          background: linear-gradient(135deg, #1688ff, #35d4ff);
          color: #fff;
        }

        .contact-admin-section {
          position: relative;
          isolation: isolate;
          padding: 24px;
          border: 1px solid rgba(179,204,232,.76);
          border-radius: 24px;
          background:
            radial-gradient(circle at 92% 0%, rgba(22,136,255,.10), transparent 26%),
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
          border: 1px solid #cee4f7;
          border-radius: 999px;
          background: #edf7ff;
          color: #1688ff;
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
          border-inline-start: 4px solid #1688ff;
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
          border-color: rgba(22,136,255,.34);
          box-shadow: 0 15px 34px rgba(9,50,91,.09);
        }

        .contact-request-card[open] {
          border-color: rgba(22,136,255,.4);
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
          border: 1px solid #d3e3f2;
          border-radius: 10px;
          background: #f4f9fe;
          color: #1688ff;
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
        }

        .contact-admin-description p {
          margin: 8px 0 0;
          color: #4c6178;
          line-height: 1.85;
          overflow-wrap: anywhere;
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

        .complaint-reply-history {
          display: grid;
          gap: 10px;
          padding: 14px;
          border: 1px solid rgba(205,220,235,.82);
          border-radius: 14px;
          background: rgba(255,255,255,.78);
        }

        .complaint-reply-history article {
          padding-top: 10px;
          border-top: 1px solid #e3edf5;
        }

        .complaint-reply-history article:first-of-type {
          padding-top: 0;
          border-top: 0;
        }

        .complaint-reply-history article > div {
          display: flex;
          justify-content: space-between;
          gap: 12px;
        }

        .complaint-reply-history time {
          color: #7d8fa2;
          font-size: .65rem;
        }

        .complaint-reply-history p {
          margin: 6px 0 0;
          color: #4c6178;
          overflow-wrap: anywhere;
        }

        .complaint-reply-unavailable {
          padding: 12px 14px;
          border: 1px solid #f0dca7;
          border-radius: 13px;
          background: #fff9e9;
          color: #825e14;
          font-size: .75rem;
          line-height: 1.75;
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
          border: 1px dashed #bdd9ef;
          border-radius: 16px;
          background: linear-gradient(135deg, rgba(245,250,255,.9), rgba(250,254,255,.95));
          color: #718399;
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

        html[data-theme="dark"] .contact-back-link {
          color: #72caff !important;
        }

        html[data-theme="dark"] .contact-status-tab {
          border-color: rgba(91,169,224,.34) !important;
          background:
            linear-gradient(145deg, #0d2d46, #0a2439) !important;
          color: #b9cfdf !important;
          box-shadow:
            0 10px 26px rgba(0,7,18,.22),
            inset 0 1px 0 rgba(157,211,248,.06) !important;
        }

        html[data-theme="dark"] .contact-status-tab:hover {
          border-color: rgba(103,199,255,.55) !important;
          background:
            linear-gradient(145deg, #123650, #0d2a42) !important;
          box-shadow:
            0 14px 32px rgba(0,7,18,.30) !important;
        }

        html[data-theme="dark"] .contact-status-tab strong {
          border: 1px solid rgba(91,169,224,.25);
          background: #123650 !important;
          color: #8ed7ff !important;
        }

        html[data-theme="dark"] .contact-status-tab.is-active {
          border-color: rgba(103,199,255,.72) !important;
          background:
            radial-gradient(circle at 8% 10%, rgba(53,212,255,.12), transparent 34%),
            linear-gradient(145deg, #123a57, #0d2b43) !important;
          color: #8ed7ff !important;
          box-shadow:
            0 15px 34px rgba(0,7,18,.34),
            0 0 0 1px rgba(103,199,255,.06) inset !important;
        }

        html[data-theme="dark"] .contact-status-tab.is-active strong {
          border-color: transparent;
          background:
            linear-gradient(135deg, #1688ff, #35d4ff) !important;
          color: #ffffff !important;
        }

        html[data-theme="dark"] .contact-admin-section {
          border-color: rgba(91,169,224,.34) !important;
          background:
            radial-gradient(circle at 92% 0%, rgba(22,136,255,.10), transparent 28%),
            linear-gradient(180deg, #0b2941 0%, #082238 100%) !important;
          box-shadow:
            0 20px 50px rgba(0,7,18,.30),
            inset 0 1px 0 rgba(157,211,248,.06) !important;
        }

        html[data-theme="dark"] .contact-admin-heading {
          border-bottom-color: rgba(120,176,218,.22) !important;
        }

        html[data-theme="dark"] .contact-count-pill {
          border-color: rgba(103,199,255,.28) !important;
          background: #123650 !important;
          color: #8ed7ff !important;
        }

        html[data-theme="dark"] .contact-export-btn,
        html[data-theme="dark"] .contact-print-btn {
          border-color: rgba(91,169,224,.36) !important;
          background: #0f3049 !important;
          color: #cfe5f5 !important;
          box-shadow: 0 7px 18px rgba(0,7,18,.20) !important;
        }

        html[data-theme="dark"] .contact-export-btn:hover,
        html[data-theme="dark"] .contact-print-btn:hover {
          border-color: rgba(103,199,255,.62) !important;
          background: #153d59 !important;
          color: #8ed7ff !important;
        }

        html[data-theme="dark"] .contact-request-card {
          border-color: rgba(91,169,224,.34) !important;
          border-inline-start-color: #1688ff !important;
          background: #0c2b43 !important;
          box-shadow:
            0 9px 24px rgba(0,7,18,.22),
            inset 0 1px 0 rgba(157,211,248,.045) !important;
        }

        html[data-theme="dark"] .contact-request-card:hover,
        html[data-theme="dark"] .contact-request-card[open] {
          border-color: rgba(103,199,255,.54) !important;
          background: #0e304a !important;
          box-shadow: 0 16px 38px rgba(0,7,18,.30) !important;
        }

        html[data-theme="dark"] .contact-card-chevron {
          border-color: rgba(91,169,224,.32) !important;
          background: #123650 !important;
          color: #79ceff !important;
        }

        html[data-theme="dark"] .contact-admin-details {
          border-top-color: rgba(91,169,224,.26) !important;
          background:
            linear-gradient(180deg, #09263d, #082238) !important;
        }

        html[data-theme="dark"] .contact-admin-info,
        html[data-theme="dark"] .contact-admin-description,
        html[data-theme="dark"] .complaint-reply-history,
        html[data-theme="dark"] .contact-routing-history {
          border-color: rgba(91,169,224,.30) !important;
          background: #0d2d46 !important;
          color: #dcebf6 !important;
          box-shadow:
            inset 0 1px 0 rgba(157,211,248,.04) !important;
        }

        html[data-theme="dark"] .contact-admin-info strong,
        html[data-theme="dark"] .contact-admin-description strong,
        html[data-theme="dark"] .complaint-reply-history > strong,
        html[data-theme="dark"] .contact-routing-history > strong {
          color: #8faabd !important;
        }

        html[data-theme="dark"] .contact-admin-info span,
        html[data-theme="dark"] .contact-admin-description p,
        html[data-theme="dark"] .complaint-reply-history p,
        html[data-theme="dark"] .contact-routing-history p {
          color: #d9e8f3 !important;
        }

        html[data-theme="dark"] .complaint-reply-history article {
          border-top-color: rgba(120,176,218,.18) !important;
        }

        html[data-theme="dark"] .complaint-reply-history time,
        html[data-theme="dark"] .contact-routing-history time {
          color: #8da7bb !important;
        }

        html[data-theme="dark"] .complaint-reply-unavailable {
          border-color: rgba(232,165,33,.34) !important;
          background: rgba(121,82,12,.20) !important;
          color: #f2cf7c !important;
        }

        html[data-theme="dark"] .contact-status-form {
          border-color: rgba(91,169,224,.34) !important;
          background:
            linear-gradient(135deg, #0d2d46, #09263d) !important;
          box-shadow:
            inset 0 1px 0 rgba(157,211,248,.05),
            0 9px 22px rgba(0,7,18,.18) !important;
        }

        html[data-theme="dark"] .contact-status-form:has(.contact-status-select.is-open) {
          border-color: rgba(103,199,255,.58) !important;
          box-shadow:
            0 0 0 3px rgba(22,136,255,.07),
            0 12px 28px rgba(0,7,18,.24) !important;
        }

        html[data-theme="dark"] .contact-admin-empty {
          border-color: rgba(91,169,224,.30) !important;
          background:
            linear-gradient(135deg, #0c2a42, #09243a) !important;
          color: #9fb8ca !important;
        }

        html[data-theme="dark"] .contact-status.status-new {
          border-color: rgba(22,136,255,.36) !important;
          background: rgba(22,136,255,.12) !important;
          color: #80cbff !important;
        }

        html[data-theme="dark"] .contact-status.status-in_review {
          border-color: rgba(232,165,33,.34) !important;
          background: rgba(232,165,33,.11) !important;
          color: #f0c566 !important;
        }

        html[data-theme="dark"] .contact-status.status-in_progress {
          border-color: rgba(53,212,255,.32) !important;
          background: rgba(53,212,255,.10) !important;
          color: #80ddf5 !important;
        }

        html[data-theme="dark"] .contact-status.status-resolved {
          border-color: rgba(39,164,93,.34) !important;
          background: rgba(39,164,93,.12) !important;
          color: #72d99b !important;
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
    complaintStatuses.map(
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
        value="complaint"
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