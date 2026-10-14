export type AttendanceMatrixSession = {
  id: string;
  title: string;
};

export type AttendanceMatrixSubmission = {
  status: string;
  sessionAttendances: { sessionId: string }[];
};

export type SessionAttendanceSummary = {
  sessionId: string;
  presentCount: number;
  totalCount: number;
  rate: number;
};

export function getSessionAttendanceSummaries(
  sessions: AttendanceMatrixSession[],
  submissions: AttendanceMatrixSubmission[],
): SessionAttendanceSummary[] {
  const approvedSubmissions = submissions.filter(
    (submission) => submission.status === "APPROVED",
  );
  const totalCount = approvedSubmissions.length;

  return sessions.map((session) => {
    const presentCount = approvedSubmissions.filter((submission) =>
      submission.sessionAttendances.some(
        (attendance) => attendance.sessionId === session.id,
      ),
    ).length;

    return {
      sessionId: session.id,
      presentCount,
      totalCount,
      rate: totalCount > 0 ? Math.round((presentCount / totalCount) * 100) : 0,
    };
  });
}
