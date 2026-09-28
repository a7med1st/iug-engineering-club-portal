ALTER TABLE "LibraryCourse" ADD COLUMN "semester" INTEGER NOT NULL DEFAULT 1;

DROP INDEX IF EXISTS "LibraryCourse_departmentId_level_sortOrder_idx";
CREATE INDEX "LibraryCourse_departmentId_level_semester_sortOrder_idx"
ON "LibraryCourse"("departmentId", "level", "semester", "sortOrder");
