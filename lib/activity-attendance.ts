export type AttendanceSubmission = {
  status: string;
  checkedInAt: Date | null;
  sessionAttendances?: { sessionId: string }[];
  form?: { activity: { sessions?: { id: string }[]; requiredAttendanceCount?: number } };
};

export type AttendanceProgress = {
  attendanceCount: number;
  totalSessions: number;
  requiredAttendanceCount: number;
  eligible: boolean;
};

/** Only activity-owned, distinct sessions count; legacy attendance applies to zero-session activities. */
export function getAttendanceProgress(submission: AttendanceSubmission): AttendanceProgress {
  const activity = submission.form?.activity;
  const sessionIds = new Set(activity?.sessions?.map((session) => session.id) ?? []);
  const requiredAttendanceCount = Math.max(1, activity?.requiredAttendanceCount ?? 1);
  const attendanceCount = sessionIds.size
    ? new Set((submission.sessionAttendances ?? []).filter((attendance) => sessionIds.has(attendance.sessionId)).map((attendance) => attendance.sessionId)).size
    : Number(Boolean(submission.checkedInAt));

  return {
    attendanceCount,
    totalSessions: sessionIds.size,
    requiredAttendanceCount,
    eligible: submission.status === "APPROVED" && attendanceCount >= requiredAttendanceCount,
  };
}
