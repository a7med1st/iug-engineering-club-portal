CREATE TYPE "AttendanceSource" AS ENUM ('STAFF_QR', 'STAFF_MANUAL', 'SELF_LINK');

CREATE TABLE "ActivityAttendanceLink" (
  "id" TEXT NOT NULL,
  "activityId" TEXT NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "tokenPrefix" TEXT NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "opensAt" TIMESTAMP(3),
  "closesAt" TIMESTAMP(3),
  "createdById" TEXT,
  "rotatedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ActivityAttendanceLink_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CertificateTemplate" (
  "id" TEXT NOT NULL,
  "activityId" TEXT NOT NULL,
  "sourcePathname" TEXT NOT NULL,
  "sourceOriginalName" TEXT NOT NULL,
  "sourceMime" TEXT NOT NULL,
  "sourceSize" INTEGER NOT NULL,
  "sourceWidth" INTEGER NOT NULL,
  "sourceHeight" INTEGER NOT NULL,
  "nameX" DECIMAL(5,2) NOT NULL DEFAULT 50,
  "nameY" DECIMAL(5,2) NOT NULL DEFAULT 50,
  "nameFontSize" DECIMAL(5,2) NOT NULL DEFAULT 6,
  "nameColor" TEXT NOT NULL DEFAULT '#111827',
  "nameAlign" TEXT NOT NULL DEFAULT 'center',
  "titleVisible" BOOLEAN NOT NULL DEFAULT false,
  "titleX" DECIMAL(5,2) NOT NULL DEFAULT 50,
  "titleY" DECIMAL(5,2) NOT NULL DEFAULT 65,
  "titleFontSize" DECIMAL(5,2) NOT NULL DEFAULT 3.5,
  "titleColor" TEXT NOT NULL DEFAULT '#111827',
  "titleAlign" TEXT NOT NULL DEFAULT 'center',
  "dateVisible" BOOLEAN NOT NULL DEFAULT false,
  "dateX" DECIMAL(5,2) NOT NULL DEFAULT 50,
  "dateY" DECIMAL(5,2) NOT NULL DEFAULT 75,
  "dateFontSize" DECIMAL(5,2) NOT NULL DEFAULT 2.5,
  "dateColor" TEXT NOT NULL DEFAULT '#111827',
  "dateAlign" TEXT NOT NULL DEFAULT 'center',
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CertificateTemplate_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "ActivityFormSubmission" ADD COLUMN "attendanceSource" "AttendanceSource";
ALTER TABLE "ActivityFormSubmission" ADD COLUMN "attendanceLinkId" TEXT;
ALTER TABLE "Certificate" ADD COLUMN "artifactPathname" TEXT;
ALTER TABLE "Certificate" ADD COLUMN "artifactMime" TEXT;
ALTER TABLE "Certificate" ADD COLUMN "artifactSize" INTEGER;
ALTER TABLE "Certificate" ADD COLUMN "artifactWidth" INTEGER;
ALTER TABLE "Certificate" ADD COLUMN "artifactHeight" INTEGER;
ALTER TABLE "Certificate" ADD COLUMN "generatedAt" TIMESTAMP(3);
ALTER TABLE "Certificate" ADD COLUMN "templateFingerprint" TEXT;

CREATE UNIQUE INDEX "ActivityAttendanceLink_activityId_key" ON "ActivityAttendanceLink"("activityId");
CREATE UNIQUE INDEX "ActivityAttendanceLink_tokenHash_key" ON "ActivityAttendanceLink"("tokenHash");
CREATE INDEX "ActivityAttendanceLink_activityId_isActive_idx" ON "ActivityAttendanceLink"("activityId", "isActive");
CREATE INDEX "ActivityAttendanceLink_closesAt_idx" ON "ActivityAttendanceLink"("closesAt");
CREATE UNIQUE INDEX "CertificateTemplate_activityId_key" ON "CertificateTemplate"("activityId");
CREATE UNIQUE INDEX "CertificateTemplate_sourcePathname_key" ON "CertificateTemplate"("sourcePathname");
CREATE INDEX "ActivityFormSubmission_attendanceLinkId_idx" ON "ActivityFormSubmission"("attendanceLinkId");

ALTER TABLE "ActivityAttendanceLink" ADD CONSTRAINT "ActivityAttendanceLink_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "Activity"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ActivityAttendanceLink" ADD CONSTRAINT "ActivityAttendanceLink_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CertificateTemplate" ADD CONSTRAINT "CertificateTemplate_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "Activity"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CertificateTemplate" ADD CONSTRAINT "CertificateTemplate_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ActivityFormSubmission" ADD CONSTRAINT "ActivityFormSubmission_attendanceLinkId_fkey" FOREIGN KEY ("attendanceLinkId") REFERENCES "ActivityAttendanceLink"("id") ON DELETE SET NULL ON UPDATE CASCADE;
