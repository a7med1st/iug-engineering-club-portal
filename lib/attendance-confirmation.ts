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
    submissionId: string;
    userId: string;
    checkedInAt: Date;
    checkedInById: null;
    attendanceSource: "SELF_LINK";
    attendanceLinkId: string;
  }): Promise<number>;
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

function registrationError(submission: SubmissionRecord | null): AttendanceErrorCode | null {
  if (!submission) return "NOT_REGISTERED";
  if (submission.status === "SUBMITTED") return "PENDING_REGISTRATION";
  if (submission.status === "REJECTED") return "REJECTED_REGISTRATION";
  if (submission.checkedInAt) return "ALREADY_RECORDED";
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
  const submissionError = registrationError(submission);
  if (submissionError) return { status: submissionError, activity: link.activity };

  return {
    status: "READY" as const,
    activity: link.activity,
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
  const submissionError = registrationError(submission);
  if (submissionError && submissionError !== "ALREADY_RECORDED") {
    return { ok: false, code: submissionError };
  }
  if (submission?.checkedInAt) {
    return { ok: true, alreadyRecorded: true, checkedInAt: submission.checkedInAt };
  }

  const count = await deps.recordAttendance({
    submissionId: submission!.id,
    userId: input.userId,
    checkedInAt: now,
    checkedInById: null,
    attendanceSource: "SELF_LINK",
    attendanceLinkId: link.id,
  });
  if (count === 1) return { ok: true, alreadyRecorded: false, checkedInAt: now };

  const latest = await deps.findSubmission({ activityId: input.activityId, userId: input.userId });
  if (latest?.checkedInAt) {
    return { ok: true, alreadyRecorded: true, checkedInAt: latest.checkedInAt };
  }
  return { ok: false, code: registrationError(latest) ?? "ALREADY_RECORDED" };
}
