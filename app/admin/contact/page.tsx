import type { ReactNode } from "react";
import Link from "next/link";
import {
  ArrowUpLeft,
  Handshake,
  Lightbulb,
  MessageSquare,
} from "lucide-react";

import { NonceStyle } from "@/components/security/CspNonce";
import {
  hasGlobalContactAccess,
  requireContactAccess,
} from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function AdminContactPage() {
  const { user } = await requireContactAccess();

  const hasGlobalAccess =
    hasGlobalContactAccess(user);

  const assignedWhere =
    hasGlobalAccess
      ? undefined
      : {
          assignedToId: user.id,
        };

  const [
    complaintsCount,
    newComplaintsCount,
    suggestionsCount,
    newSuggestionsCount,
    collaborationsCount,
    newCollaborationsCount,
  ] = await Promise.all([
    prisma.complaint.count({
      where: assignedWhere,
    }),

    prisma.complaint.count({
      where: hasGlobalAccess
        ? {
            status: "NEW",
          }
        : {
            assignedToId: user.id,
            status: "NEW",
          },
    }),

    prisma.suggestion.count({
      where: assignedWhere,
    }),

    prisma.suggestion.count({
      where: hasGlobalAccess
        ? {
            status: "NEW",
          }
        : {
            assignedToId: user.id,
            status: "NEW",
          },
    }),

    prisma.collaborationRequest.count({
      where: assignedWhere,
    }),

    prisma.collaborationRequest.count({
      where: hasGlobalAccess
        ? {
            status: "NEW",
          }
        : {
            assignedToId: user.id,
            status: "NEW",
          },
    }),
  ]);

  return (
    <main className="admin-contact-page contact-dashboard shell">
      <div className="contact-dashboard-header">
        <div>
          <h1>إدارة التواصل</h1>
          <p>
            اختر نوع الطلبات التي تريد متابعتها.
          </p>
        </div>
      </div>

      <div className="contact-dashboard-grid">
        <ContactTypeCard
          href="/admin/contact/complaints"
          title="الشكاوى"
          description="متابعة شكاوى وملاحظات الطلبة وحالات معالجتها."
          total={complaintsCount}
          newCount={newComplaintsCount}
          icon={
            <MessageSquare
              size={27}
              strokeWidth={1.9}
            />
          }
          tone="blue"
        />

        <ContactTypeCard
          href="/admin/contact/suggestions"
          title="الاقتراحات"
          description="استعراض اقتراحات الطلبة ومتابعة حالة كل اقتراح."
          total={suggestionsCount}
          newCount={newSuggestionsCount}
          icon={
            <Lightbulb
              size={27}
              strokeWidth={1.9}
            />
          }
          tone="cyan"
        />

        <ContactTypeCard
          href="/admin/contact/collaborations"
          title="طلبات التعاون"
          description="متابعة طلبات التعاون الواردة ومسار تنفيذها."
          total={collaborationsCount}
          newCount={newCollaborationsCount}
          icon={
            <Handshake
              size={27}
              strokeWidth={1.9}
            />
          }
          tone="orange"
        />
      </div>

      <NonceStyle>{`
        .contact-dashboard {
          --contact-blue: #1688ff;
          --contact-cyan: #35d4ff;
          --contact-orange: #ff8b32;
          padding-bottom: 40px;
        }

        .contact-dashboard-header {
          margin-bottom: 26px;
        }

        .contact-dashboard-header h1 {
          margin: 0 0 7px;
          color: #0c2340;
          font-size: clamp(1.75rem, 3vw, 2.45rem);
        }

        .contact-dashboard-header p {
          margin: 0;
          color: #6e8096;
          font-size: .9rem;
        }

        .contact-dashboard-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 18px;
        }

        .contact-type-card {
          position: relative;
          isolation: isolate;
          min-height: 210px;
          overflow: hidden;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          gap: 24px;
          padding: 24px;
          border: 1px solid rgba(184, 207, 232, .82);
          border-radius: 24px;
          background:
            radial-gradient(circle at 8% 8%, rgba(22, 136, 255, .13), transparent 30%),
            linear-gradient(145deg, rgba(255, 255, 255, .99), rgba(247, 251, 255, .97));
          box-shadow:
            0 16px 38px rgba(6, 24, 44, .075),
            inset 0 1px 0 rgba(255, 255, 255, .96);
          color: inherit;
          text-decoration: none;
          transition:
            transform .25s cubic-bezier(.22, 1, .36, 1),
            border-color .25s ease,
            box-shadow .25s ease;
        }

        .contact-type-card::before {
          content: "";
          position: absolute;
          inset: 0;
          z-index: -2;
          pointer-events: none;
          background-image:
            linear-gradient(rgba(22, 136, 255, .025) 1px, transparent 1px),
            linear-gradient(90deg, rgba(22, 136, 255, .025) 1px, transparent 1px);
          background-size: 26px 26px;
          mask-image: linear-gradient(to bottom, #000, transparent 76%);
        }

        .contact-type-card::after {
          content: "";
          position: absolute;
          top: -74px;
          left: -54px;
          z-index: -1;
          width: 170px;
          height: 170px;
          border: 25px solid rgba(22, 136, 255, .045);
          border-radius: 50%;
          pointer-events: none;
        }

        .contact-type-card:hover {
          transform: translateY(-5px);
          border-color: rgba(22, 136, 255, .38);
          box-shadow:
            0 22px 48px rgba(9, 55, 100, .13),
            inset 0 1px 0 rgba(255, 255, 255, .98);
        }

        .contact-type-card-head {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 14px;
        }

        .contact-type-icon {
          flex: 0 0 auto;
          width: 54px;
          height: 54px;
          display: grid;
          place-items: center;
          border-radius: 17px;
          color: #fff;
          box-shadow: 0 11px 24px rgba(22, 136, 255, .18);
        }

        .contact-type-icon.tone-blue {
          background: linear-gradient(135deg, #0875df, #2ba8ff);
        }

        .contact-type-icon.tone-cyan {
          background: linear-gradient(135deg, #159acb, #35d4ff);
        }

        .contact-type-icon.tone-orange {
          background: linear-gradient(135deg, #ff8b32, #ffb65e);
        }

        .contact-type-copy {
          min-width: 0;
          flex: 1;
        }

        .contact-type-copy h2 {
          margin: 0 0 8px;
          color: #102139;
          font-size: 1.08rem;
        }

        .contact-type-copy p {
          margin: 0;
          color: #6b7d91;
          font-size: .78rem;
          line-height: 1.85;
        }

        .contact-type-card-footer {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 14px;
          padding-top: 17px;
          border-top: 1px solid rgba(199, 216, 234, .76);
        }

        .contact-type-counts {
          display: flex;
          align-items: center;
          gap: 9px;
          flex-wrap: wrap;
        }

        .contact-count-pill {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          min-height: 30px;
          padding: 5px 10px;
          border: 1px solid #cee4f7;
          border-radius: 999px;
          background: #edf7ff;
          color: #526a82;
          font-family: "Alexandria", sans-serif;
          font-size: .64rem;
          font-weight: 700;
        }

        .contact-count-pill strong {
          color: #0875df;
          font-family: "Sora", sans-serif;
          font-size: .8rem;
        }

        .contact-count-pill.is-new {
          border-color: rgba(22, 136, 255, .2);
          background: linear-gradient(135deg, #e8f5ff, #f1fbff);
          color: #0875df;
        }

        .contact-type-arrow {
          flex: 0 0 auto;
          width: 38px;
          height: 38px;
          display: grid;
          place-items: center;
          border: 1px solid #cce0f2;
          border-radius: 12px;
          background: #f5faff;
          color: #1688ff;
          transition:
            transform .22s ease,
            background .22s ease,
            color .22s ease,
            border-color .22s ease;
        }

        .contact-type-card:hover .contact-type-arrow {
          transform: translate(-2px, -2px);
          border-color: transparent;
          background: linear-gradient(135deg, #1688ff, #35d4ff);
          color: #fff;
        }

        html[data-theme="dark"] .contact-dashboard-header h1 {
          color: #eef7ff !important;
        }

        html[data-theme="dark"] .contact-dashboard-header p {
          color: #a9bfd2 !important;
        }

        html[data-theme="dark"] .contact-type-card {
          border-color: rgba(91, 169, 224, .38) !important;
          background:
            radial-gradient(circle at 8% 8%, rgba(22, 136, 255, .16), transparent 32%),
            linear-gradient(180deg, #0d2b43 0%, #092238 100%) !important;
          box-shadow:
            0 18px 42px rgba(0, 7, 18, .3),
            inset 0 1px 0 rgba(157, 211, 248, .08) !important;
        }

        html[data-theme="dark"] .contact-type-card:hover {
          border-color: rgba(103, 199, 255, .58) !important;
          box-shadow:
            0 22px 48px rgba(0, 7, 18, .38),
            inset 0 1px 0 rgba(157, 211, 248, .11) !important;
        }

        html[data-theme="dark"] .contact-type-copy h2 {
          color: #eef7ff !important;
        }

        html[data-theme="dark"] .contact-type-copy p {
          color: #b8ccdc !important;
        }

        html[data-theme="dark"] .contact-type-card-footer {
          border-top-color: rgba(153, 195, 226, .3);
        }

        html[data-theme="dark"] .contact-count-pill {
          border-color: rgba(91, 169, 224, .35);
          background: #0a263d;
          color: #bdd3e4;
        }

        html[data-theme="dark"] .contact-count-pill strong {
          color: #67c7ff;
        }

        html[data-theme="dark"] .contact-count-pill.is-new {
          border-color: rgba(103, 199, 255, .42);
          background: #103550;
          color: #8fd3ff;
        }

        html[data-theme="dark"] .contact-type-arrow {
          border-color: rgba(91, 169, 224, .36);
          background: #0b2a43;
          color: #67c7ff;
        }

        @media (max-width: 900px) {
          .contact-dashboard-grid {
            grid-template-columns: 1fr;
          }

          .contact-type-card {
            min-height: 180px;
          }
        }

        @media (max-width: 560px) {
          .contact-type-card {
            padding: 19px;
            border-radius: 20px;
          }

          .contact-type-card-head {
            align-items: center;
          }

          .contact-type-card-footer {
            align-items: flex-start;
            flex-direction: column;
          }

          .contact-type-arrow {
            align-self: flex-end;
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .contact-type-card,
          .contact-type-arrow {
            transition: none !important;
          }
        }
      `}</NonceStyle>
    </main>
  );
}

function ContactTypeCard({
  href,
  title,
  description,
  total,
  newCount,
  icon,
  tone,
}: {
  href: string;
  title: string;
  description: string;
  total: number;
  newCount: number;
  icon: ReactNode;
  tone: "blue" | "cyan" | "orange";
}) {
  return (
    <Link
      href={href}
      className="contact-type-card"
    >
      <div className="contact-type-card-head">
        <div className="contact-type-copy">
          <h2>{title}</h2>
          <p>{description}</p>
        </div>

        <span
          className={`contact-type-icon tone-${tone}`}
          aria-hidden="true"
        >
          {icon}
        </span>
      </div>

      <div className="contact-type-card-footer">
        <div className="contact-type-counts">
          <span className="contact-count-pill">
            الكل
            <strong>{total}</strong>
          </span>

          <span className="contact-count-pill is-new">
            جديد
            <strong>{newCount}</strong>
          </span>
        </div>

        <span
          className="contact-type-arrow"
          aria-hidden="true"
        >
          <ArrowUpLeft
            size={19}
            strokeWidth={2}
          />
        </span>
      </div>
    </Link>
  );
}
