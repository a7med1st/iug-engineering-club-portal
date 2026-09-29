DROP INDEX "LibraryFolder_courseId_sortOrder_idx";

ALTER TABLE "LibraryFolder" ADD COLUMN "parentId" TEXT;

CREATE INDEX "LibraryFolder_courseId_parentId_sortOrder_idx"
ON "LibraryFolder"("courseId", "parentId", "sortOrder");

ALTER TABLE "LibraryFolder"
ADD CONSTRAINT "LibraryFolder_parentId_fkey"
FOREIGN KEY ("parentId") REFERENCES "LibraryFolder"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
