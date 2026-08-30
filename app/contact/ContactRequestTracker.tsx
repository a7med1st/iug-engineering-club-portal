import {
  CheckCircle2,
  CircleDot,
  Clock3,
  Cog,
  MessageSquareReply,
  SearchCheck,
  XCircle,
} from "lucide-react";

import { CONTACT_STATUS_LABELS } from "@/lib/contact-options";
import { prisma } from "@/lib/prisma";

import styles from "./contact-requests.module.css";

function StatusIcon({ status }: { status: string }) {
  if (status === "IN_REVIEW") {
    return <SearchCheck aria-hidden="true" />;
  }

  if (status === "IN_PROGRESS") {
    return <Cog aria-hidden="true" />;
  }

  if (
    status === "RESOLVED" ||
    status === "ACCEPTED" ||
    status === "CONTACTED"
  ) {
    return <CheckCircle2 aria-hidden="true" />;
  }

  if (status === "REJECTED") {
    return <XCircle aria-hidden="true" />;
  }

  return <Clock3 aria-hidden="true" />;
}

export default async function ContactRequestTracker({
  userId,
}: {
  userId: string;
}) {
  const [complaints, suggestions, collaborations] =
    await Promise.all([
      prisma.complaint.findMany({
        where: { submittedById: userId },
        select: {
          id: true,
          details: true,
          status: true,
          createdAt: true,
          replies: {
            select: {
              id: true,
              message: true,
              createdAt: true,
              author: {
                select: { name: true },
              },
            },
            orderBy: { createdAt: "asc" },
          },
        },
      }),
      prisma.suggestion.findMany({
        where: { submittedById: userId },
        select: {
          id: true,
          projectIdea: true,
          status: true,
          createdAt: true,
        },
      }),
      prisma.collaborationRequest.findMany({
        where: { submittedById: userId },
        select: {
          id: true,
          entityName: true,
          status: true,
          createdAt: true,
        },
      }),
    ]);

  const requests = [
    ...complaints.map((request) => ({
      ...request,
      kind: "شكوى أو ملاحظة",
      summary: request.details,
    })),
    ...suggestions.map((request) => ({
      ...request,
      kind: "اقتراح",
      summary: request.projectIdea,
      replies: [],
    })),
    ...collaborations.map((request) => ({
      ...request,
      kind: "طلب تعاون",
      summary: request.entityName,
      replies: [],
    })),
  ].sort(
    (first, second) =>
      second.createdAt.getTime() -
      first.createdAt.getTime(),
  );

  return (
    <section
      id="my-contact-requests"
      className={styles.tracker}
      aria-labelledby="contact-requests-title"
    >
      <div className={styles.heading}>
        <div className={styles.headingIcon}>
          <CircleDot aria-hidden="true" />
        </div>
        <div>
          <h2 id="contact-requests-title">
            متابعة طلباتك
          </h2>
          <p>
            تابع حالة الشكاوى والاقتراحات وطلبات التعاون
            والردود الواردة من النادي.
          </p>
        </div>
      </div>

      {requests.length === 0 ? (
        <div className={styles.empty}>
          لا توجد طلبات مرتبطة بحسابك حتى الآن.
        </div>
      ) : (
        <div className={styles.list}>
          {requests.map((request) => (
            <article
              key={`${request.kind}-${request.id}`}
              className={styles.request}
            >
              <div className={styles.requestHead}>
                <div>
                  <strong>{request.kind}</strong>
                  <time>
                    {new Intl.DateTimeFormat("ar-PS", {
                      dateStyle: "medium",
                      timeStyle: "short",
                    }).format(request.createdAt)}
                  </time>
                </div>
                <span
                  className={`${styles.status} ${styles[`status_${request.status.toLowerCase()}`]}`}
                >
                  <StatusIcon status={request.status} />
                  {
                    CONTACT_STATUS_LABELS[
                      request.status
                    ]
                  }
                </span>
              </div>

              <p className={styles.summary}>
                {request.summary}
              </p>

              {request.replies.length > 0 && (
                <div className={styles.replies}>
                  <div className={styles.replyTitle}>
                    <MessageSquareReply aria-hidden="true" />
                    <strong>رد النادي</strong>
                  </div>
                  {request.replies.map((reply) => (
                    <div
                      key={reply.id}
                      className={styles.reply}
                    >
                      <div>
                        <b>
                          {reply.author?.name ??
                            "إدارة النادي"}
                        </b>
                        <time>
                          {new Intl.DateTimeFormat(
                            "ar-PS",
                            {
                              dateStyle: "medium",
                              timeStyle: "short",
                            },
                          ).format(reply.createdAt)}
                        </time>
                      </div>
                      <p>{reply.message}</p>
                    </div>
                  ))}
                </div>
              )}
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
