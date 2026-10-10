-- Preserve legacy fields and populate one canonical session for every activity.
ALTER TABLE "Activity" ADD COLUMN "requiredAttendanceCount" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "Activity" ADD CONSTRAINT "Activity_requiredAttendanceCount_positive" CHECK ("requiredAttendanceCount" >= 1);

CREATE TABLE "ActivitySession" (
    "id" TEXT NOT NULL,
    "activityId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ActivitySession_pkey" PRIMARY KEY ("id")
);

INSERT INTO "ActivitySession" ("id", "activityId", "title", "startsAt", "endsAt", "updatedAt")
SELECT 'legacy-session-' || "id", "id", 'الجلسة الرئيسية', "startsAt", "endsAt", CURRENT_TIMESTAMP FROM "Activity";

ALTER TABLE "ActivityAttendanceLink" ADD COLUMN "sessionId" TEXT;
UPDATE "ActivityAttendanceLink" SET "sessionId" = 'legacy-session-' || "activityId";
ALTER TABLE "ActivityAttendanceLink" ALTER COLUMN "sessionId" SET NOT NULL;
DROP INDEX "ActivityAttendanceLink_activityId_key";
CREATE UNIQUE INDEX "ActivityAttendanceLink_sessionId_key" ON "ActivityAttendanceLink"("sessionId");

CREATE TABLE "ActivitySessionAttendance" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "submissionId" TEXT NOT NULL,
    "checkedInAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "checkedInById" TEXT,
    "attendanceSource" "AttendanceSource" NOT NULL,
    "attendanceLinkId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ActivitySessionAttendance_pkey" PRIMARY KEY ("id")
);

INSERT INTO "ActivitySessionAttendance" ("id", "sessionId", "submissionId", "checkedInAt", "checkedInById", "attendanceSource", "attendanceLinkId", "updatedAt")
SELECT 'legacy-attendance-' || s."id", 'legacy-session-' || f."activityId", s."id", s."checkedInAt", s."checkedInById",
       COALESCE(s."attendanceSource", 'STAFF_MANUAL'::"AttendanceSource"), s."attendanceLinkId", CURRENT_TIMESTAMP
FROM "ActivityFormSubmission" s JOIN "ActivityRegistrationForm" f ON f."id" = s."formId"
WHERE s."checkedInAt" IS NOT NULL;

CREATE INDEX "ActivitySession_activityId_sortOrder_idx" ON "ActivitySession"("activityId", "sortOrder");
CREATE UNIQUE INDEX "ActivitySessionAttendance_sessionId_submissionId_key" ON "ActivitySessionAttendance"("sessionId", "submissionId");
CREATE INDEX "ActivitySessionAttendance_submissionId_idx" ON "ActivitySessionAttendance"("submissionId");
CREATE INDEX "ActivitySessionAttendance_attendanceLinkId_idx" ON "ActivitySessionAttendance"("attendanceLinkId");
ALTER TABLE "ActivitySession" ADD CONSTRAINT "ActivitySession_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "Activity"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ActivityAttendanceLink" ADD CONSTRAINT "ActivityAttendanceLink_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "ActivitySession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ActivitySessionAttendance" ADD CONSTRAINT "ActivitySessionAttendance_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "ActivitySession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ActivitySessionAttendance" ADD CONSTRAINT "ActivitySessionAttendance_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "ActivityFormSubmission"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ActivitySessionAttendance" ADD CONSTRAINT "ActivitySessionAttendance_attendanceLinkId_fkey" FOREIGN KEY ("attendanceLinkId") REFERENCES "ActivityAttendanceLink"("id") ON DELETE SET NULL ON UPDATE CASCADE;
