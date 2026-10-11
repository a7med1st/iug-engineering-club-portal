# Activity Workshop Sessions

Implement locally on feature/activity-workshop-sessions. Do not push, merge,
publish, reset databases, or apply migrations to a shared database.

## Contract

- Activity gains requiredAttendanceCount (default 1) and sessions.
- ActivitySession owns a single optional attendanceLink and many attendances.
- ActivityAttendanceLink retains activityId and gains required unique sessionId;
  Activity exposes attendanceLinks (plural).
- ActivitySessionAttendance is unique by sessionId/submissionId and preserves
  checkedInAt, checkedInById, attendanceSource and optional attendanceLinkId.
- Legacy attendance columns remain. Existing activities receive one main session
  and existing attendance is copied in a reviewed, non-destructive SQL migration.
- Eligibility is calculated from approved registration and attendance records,
  with legacy fallback only for activities with no sessions.
- One certificate remains associated with each activity registration.

## Tasks

1. Schema, migration and isolated migration verification (controller).
2. Shared eligibility helper, certificate issuance/validity/progress and tests.
3. Student attendance confirmation, link management and staff check-in compatibility.
4. Dynamic activity sessions editor, server validation, matrix and admin integration.
5. Integrate, review security/permissions, run requested checks, start local preview.

## Verification

Meaningful tests cover thresholds, changing thresholds, duplicates, independent
sessions, expired/disabled links, issuance eligibility and legacy attendance.
Run prisma format/validate/generate, TypeScript, attendance/certificate tests,
and git diff --check. Verify migration against an isolated PostgreSQL-compatible
database before offering migration commands. Inspect desktop/mobile preview.
