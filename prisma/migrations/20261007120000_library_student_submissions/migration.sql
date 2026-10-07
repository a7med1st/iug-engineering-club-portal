CREATE TYPE "LibrarySubmissionStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

CREATE TABLE "LibrarySubmission" (
    "id" TEXT NOT NULL,
    "departmentId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "note" TEXT,
    "originalName" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "status" "LibrarySubmissionStatus" NOT NULL DEFAULT 'PENDING',
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "publishedFileId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "LibrarySubmission_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "LibrarySubmission_storageKey_key" ON "LibrarySubmission"("storageKey");
CREATE INDEX "LibrarySubmission_departmentId_status_createdAt_idx" ON "LibrarySubmission"("departmentId", "status", "createdAt");
CREATE INDEX "LibrarySubmission_studentId_createdAt_idx" ON "LibrarySubmission"("studentId", "createdAt");
ALTER TABLE "LibrarySubmission" ADD CONSTRAINT "LibrarySubmission_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LibrarySubmission" ADD CONSTRAINT "LibrarySubmission_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LibrarySubmission" ADD CONSTRAINT "LibrarySubmission_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
