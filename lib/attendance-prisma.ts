import { Prisma } from "@prisma/client";
import type { AttendanceConfirmationDeps } from "@/lib/attendance-confirmation";
import { getAttendanceLinkState } from "@/lib/attendance-links";
import { consumeRateLimits, createRateLimitKey } from "@/lib/rate-limit";
import { prisma } from "@/lib/prisma";

export async function attendanceTransaction<T>(run: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await prisma.$transaction(run, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && ["P2034", "P2002"].includes(error.code) && attempt < 2) continue;
      throw error;
    }
  }
}

export async function mirrorSessionAttendance(tx: Prisma.TransactionClient, submissionId: string) {
  const submission = await tx.activityFormSubmission.findUniqueOrThrow({
    where: { id: submissionId },
    select: { sessionAttendances: { orderBy: [{ checkedInAt: "asc" }, { id: "asc" }], take: 1 } },
  });
  const first = submission.sessionAttendances[0];
  await tx.activityFormSubmission.update({ where: { id: submissionId }, data: {
    checkedInAt: first?.checkedInAt ?? null, checkedInById: first?.checkedInById ?? null,
    attendanceSource: first?.attendanceSource ?? null, attendanceLinkId: first?.attendanceLinkId ?? null,
  } });
}

export function attendanceDeps(): AttendanceConfirmationDeps {
  return {
    now: () => new Date(),
    findLink: ({ activityId, tokenHash }) => prisma.activityAttendanceLink.findFirst({
      where: { activityId, tokenHash, session: { activityId } },
      include: { session: { select: { id: true, title: true } }, activity: { select: { id: true, title: true, startsAt: true } } },
    }),
    findSubmission: ({ activityId, userId }) => prisma.activityFormSubmission.findFirst({
      where: { userId, form: { activityId } },
      include: { sessionAttendances: true, form: { include: { activity: { include: { sessions: true } } } } },
    }),
    recordAttendance: input => attendanceTransaction(async tx => {
      if (!input.sessionId || !input.activityId || !input.tokenHash) return { code: "INVALID_LINK" as const };
      const link = await tx.activityAttendanceLink.findFirst({ where: {
        id: input.attendanceLinkId, activityId: input.activityId, tokenHash: input.tokenHash,
        sessionId: input.sessionId, session: { activityId: input.activityId },
      } });
      if (!link) return { code: "INVALID_LINK" as const };
      const now = new Date();
      const state = getAttendanceLinkState(link, now);
      if (state === "DISABLED") return { code: "LINK_DISABLED" as const };
      if (state === "NOT_OPEN") return { code: "NOT_OPEN" as const };
      if (state === "EXPIRED") return { code: "EXPIRED" as const };
      const submission = await tx.activityFormSubmission.findFirst({
        where: { id: input.submissionId, userId: input.userId, form: { activityId: link.activityId } },
        include: { sessionAttendances: true },
      });
      if (!submission) return { code: "NOT_REGISTERED" as const };
      if (submission.status === "REJECTED") return { code: "REJECTED_REGISTRATION" as const };
      if (submission.status !== "APPROVED") return { code: "PENDING_REGISTRATION" as const };
      if (submission.sessionAttendances.some(record => record.sessionId === link.sessionId)) return 0;
      await tx.activityFormSubmission.update({ where: { id: submission.id }, data: {
        sessionAttendances: { create: { sessionId: link.sessionId, checkedInAt: now, checkedInById: null, attendanceSource: "SELF_LINK", attendanceLinkId: link.id } },
      } });
      await mirrorSessionAttendance(tx, submission.id);
      return 1;
    }),
    consumeRateLimit: async ({ userId, linkId }) => (await consumeRateLimits([
      { key: createRateLimitKey("attendance", userId, linkId), limit: 5, windowSeconds: 60 },
    ])).allowed,
  };
}

export async function recordStaffSessionAttendance(input: {
  activityId: string; submissionId?: string; token?: string; sessionId?: string;
  userId: string; source: "STAFF_QR" | "STAFF_MANUAL"; remove?: boolean; publishedOnly?: boolean;
}) {
  return attendanceTransaction(async tx => {
    const submission = await tx.activityFormSubmission.findFirst({
      where: input.token ? { checkInToken: input.token } : { id: input.submissionId, form: { activityId: input.activityId } },
      include: { sessionAttendances: true, form: { include: { activity: { include: { sessions: { orderBy: { sortOrder: "asc" } } } } } } },
    });
    if (!submission) return { status: "INVALID_QR" as const, message: "التسجيل غير موجود." };
    if (submission.form.activityId !== input.activityId) return { status: "WRONG_ACTIVITY" as const, message: "الرمز تابع لنشاط آخر." };
    if (input.publishedOnly && submission.form.activity.status !== "PUBLISHED") return { status: "ERROR" as const, message: "النشاط غير متاح لتسجيل الحضور." };
    if (submission.status !== "APPROVED") return { status: "NOT_APPROVED" as const, message: "يمكن تسجيل الحضور للطلاب المقبولين فقط." };
    const sessions = submission.form.activity.sessions;
    const session = input.sessionId ? sessions.find(session => session.id === input.sessionId) : sessions.length === 1 ? sessions[0] : undefined;
    if (!session) return { status: "ERROR" as const, message: "اختر جلسة صالحة قبل تسجيل الحضور." };
    const student = { name: submission.studentName, email: submission.studentEmail, department: submission.studentDepartment };
    const existing = submission.sessionAttendances.find(record => record.sessionId === session.id);
    if (existing && !input.remove) return { status: "ALREADY_CHECKED_IN" as const, message: `حضور جلسة ${session.title} مسجل مسبقاً.`, student, checkedInAt: existing.checkedInAt.toISOString() };
    const checkedInAt = new Date();
    await tx.activityFormSubmission.update({ where: { id: submission.id }, data: {
      sessionAttendances: input.remove ? { deleteMany: { sessionId: session.id } } : { create: {
        sessionId: session.id, checkedInAt, checkedInById: input.userId, attendanceSource: input.source,
      } },
    } });
    await mirrorSessionAttendance(tx, submission.id);
    const count = submission.sessionAttendances.length + (input.remove ? (existing ? -1 : 0) : 1);
    const required = submission.form.activity.requiredAttendanceCount;
    return { status: "SUCCESS" as const, student, checkedInAt: checkedInAt.toISOString(), message: input.remove
      ? `تم إلغاء حضور جلسة ${session.title}. الحضور ${count}/${required}.`
      : `تم تسجيل حضور جلسة ${session.title}. الحضور ${count}/${required}. ${count >= required ? "مؤهل للشهادة." : "لم يكتمل الحضور المطلوب للشهادة."}` };
  });
}
