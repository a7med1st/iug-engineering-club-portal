import {
  getAttendanceLinkState,
  hashAttendanceToken,
} from "@/lib/attendance-links";

export type AttendanceErrorCode =
  | "INVALID_LINK"
  | "LINK_DISABLED"
  | "NOT_OPEN"
  | "EXPIRED"
  | "WRONG_ROLE"
  | "NOT_REGISTERED"
  | "PENDING_REGISTRATION"
  | "REJECTED_REGISTRATION"
  | "ALREADY_RECORDED"
  | "RATE_LIMITED";

type AttendanceUser = {
  id: string;
  role: "STUDENT" | "MEMBER" | "ADMIN";
  name: string;
};

type LinkRecord = {
  sessionId?: string;
  session?: { id: string; title: string };
  id: string;
  activityId: string;
  isActive: boolean;
  opensAt: Date | null;
  closesAt: Date | null;
  activity: {
    id: string;
    title: string;
    startsAt: Date | null;
  };
};

type SubmissionRecord = {
  sessionAttendances?: { sessionId: string; checkedInAt: Date }[];
  id: string;
  status: "SUBMITTED" | "APPROVED" | "REJECTED";
  checkedInAt: Date | null;
  studentName: string;
};

export type AttendanceConfirmationDeps = {
  now(): Date;
  findLink(input: { activityId: string; tokenHash: string }): Promise<LinkRecord | null>;
  findSubmission(input: { activityId: string; userId: string }): Promise<SubmissionRecord | null>;
  recordAttendance(input: {
    sessionId?: string;
    activityId?: string;
    tokenHash?: string;
    submissionId: string;
    userId: string;
    checkedInAt: Date;
    checkedInById: null;
    attendanceSource: "SELF_LINK";
    attendanceLinkId: string;
  }): Promise<number | { code: AttendanceErrorCode }>;
  consumeRateLimit(input: { userId: string; linkId: string }): Promise<boolean>;
};

type LoadInput = {
  activityId: string;
  token: string;
  user: AttendanceUser | null;
};

function linkError(link: LinkRecord, now: Date): AttendanceErrorCode | null {
  const state = getAttendanceLinkState(link, now);
  if (state === "DISABLED") return "LINK_DISABLED";
  if (state === "NOT_OPEN") return "NOT_OPEN";
  if (state === "EXPIRED") return "EXPIRED";
  return null;
}

function recordedAt(submission: SubmissionRecord | null, sessionId?: string) {
  return sessionId ? submission?.sessionAttendances?.find(record => record.sessionId === sessionId)?.checkedInAt : submission?.checkedInAt;
}

function registrationError(submission: SubmissionRecord | null, sessionId?: string): AttendanceErrorCode | null {
  if (!submission) return "NOT_REGISTERED";
  if (submission.status === "SUBMITTED") return "PENDING_REGISTRATION";
  if (submission.status === "REJECTED") return "REJECTED_REGISTRATION";
  if (recordedAt(submission, sessionId)) return "ALREADY_RECORDED";
  return null;
}

export async function loadAttendanceConfirmation(
  input: LoadInput,
  deps: AttendanceConfirmationDeps,
) {
  const link = await deps.findLink({
    activityId: input.activityId,
    tokenHash: hashAttendanceToken(input.token),
  });
  if (!link) return { status: "INVALID_LINK" as const };

  const stateError = linkError(link, deps.now());
  if (stateError) return { status: stateError };
  if (!input.user) return { status: "LOGIN_REQUIRED" as const, activity: link.activity };
  if (input.user.role !== "STUDENT") return { status: "WRONG_ROLE" as const, activity: link.activity };

  const submission = await deps.findSubmission({
    activityId: input.activityId,
    userId: input.user.id,
  });
  const submissionError = registrationError(submission, link.sessionId);
  if (submissionError) return { status: submissionError, activity: link.activity, session: link.session, submission };

  return {
    status: "READY" as const,
    activity: link.activity,
    session: link.session,
    submission: submission!,
    user: input.user,
  };
}

export async function confirmAttendance(
  input: {
    activityId: string;
    token: string;
    userId: string;
    role: AttendanceUser["role"];
  },
  deps: AttendanceConfirmationDeps,
): Promise<
  | { ok: true; alreadyRecorded: boolean; checkedInAt: Date }
  | { ok: false; code: AttendanceErrorCode }
> {
  if (input.role !== "STUDENT") return { ok: false, code: "WRONG_ROLE" };

  const link = await deps.findLink({
    activityId: input.activityId,
    tokenHash: hashAttendanceToken(input.token),
  });
  if (!link) return { ok: false, code: "INVALID_LINK" };
  const now = deps.now();
  const stateError = linkError(link, now);
  if (stateError) return { ok: false, code: stateError };

  if (!(await deps.consumeRateLimit({ userId: input.userId, linkId: link.id }))) {
    return { ok: false, code: "RATE_LIMITED" };
  }

  const submission = await deps.findSubmission({
    activityId: input.activityId,
    userId: input.userId,
  });
  const submissionError = registrationError(submission, link.sessionId);
  if (submissionError && submissionError !== "ALREADY_RECORDED") {
    return { ok: false, code: submissionError };
  }
  const existingTime = recordedAt(submission, link.sessionId);
  if (existingTime) {
    return { ok: true, alreadyRecorded: true, checkedInAt: existingTime };
  }

  const count = await deps.recordAttendance({
    ...(link.sessionId ? { sessionId: link.sessionId, activityId: input.activityId, tokenHash: hashAttendanceToken(input.token) } : {}),
    submissionId: submission!.id,
    userId: input.userId,
    checkedInAt: now,
    checkedInById: null,
    attendanceSource: "SELF_LINK",
    attendanceLinkId: link.id,
  });
  if (typeof count !== "number") return { ok: false, code: count.code };
  if (count === 1) return { ok: true, alreadyRecorded: false, checkedInAt: now };

  const latest = await deps.findSubmission({ activityId: input.activityId, userId: input.userId });
  const latestTime = recordedAt(latest, link.sessionId);
  if (latestTime) {
    return { ok: true, alreadyRecorded: true, checkedInAt: latestTime };
  }
  return { ok: false, code: registrationError(latest, link.sessionId) ?? "ALREADY_RECORDED" };
}
