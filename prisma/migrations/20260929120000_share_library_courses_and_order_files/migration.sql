ALTER TABLE "LibraryCourse" ADD COLUMN "normalizedCode" TEXT;
ALTER TABLE "LibraryFile" ADD COLUMN "sortOrder" INTEGER NOT NULL DEFAULT 0;

CREATE TABLE "LibraryCourseDepartment" (
    "courseId" TEXT NOT NULL,
    "departmentId" TEXT NOT NULL,
    "level" INTEGER NOT NULL,
    "semester" INTEGER NOT NULL DEFAULT 1,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "LibraryCourseDepartment_pkey" PRIMARY KEY ("courseId", "departmentId")
);

INSERT INTO "LibraryCourseDepartment" ("courseId", "departmentId", "level", "semester", "sortOrder", "createdAt", "updatedAt")
SELECT "id", "departmentId", "level", "semester", "sortOrder", "createdAt", "updatedAt"
FROM "LibraryCourse";

UPDATE "LibraryCourse"
SET "normalizedCode" = NULLIF(UPPER(REGEXP_REPLACE(TRIM("code"), '[[:space:]_-]+', '', 'g')), '');

CREATE TEMP TABLE "_LibraryCourseCanonical" AS
SELECT "id" AS "courseId",
       FIRST_VALUE("id") OVER (
         PARTITION BY "normalizedCode"
         ORDER BY "createdAt", "id"
       ) AS "canonicalId"
FROM "LibraryCourse"
WHERE "normalizedCode" IS NOT NULL;

CREATE TEMP TABLE "_LibraryCoursePlacementSource" AS
SELECT COALESCE(c."canonicalId", p."courseId") AS "canonicalId",
       p."departmentId", p."level", p."semester", p."sortOrder",
       course."createdAt" AS "courseCreatedAt", p."createdAt", p."updatedAt", p."courseId"
FROM "LibraryCourseDepartment" p
JOIN "LibraryCourse" course ON course."id" = p."courseId"
LEFT JOIN "_LibraryCourseCanonical" c ON c."courseId" = p."courseId";

DELETE FROM "LibraryCourseDepartment"
WHERE "courseId" IN (SELECT "courseId" FROM "_LibraryCourseCanonical");

INSERT INTO "LibraryCourseDepartment" ("courseId", "departmentId", "level", "semester", "sortOrder", "createdAt", "updatedAt")
SELECT DISTINCT ON ("canonicalId", "departmentId")
       "canonicalId", "departmentId", "level", "semester", "sortOrder", "createdAt", "updatedAt"
FROM "_LibraryCoursePlacementSource"
WHERE "courseId" IN (SELECT "courseId" FROM "_LibraryCourseCanonical")
ORDER BY "canonicalId", "departmentId", "courseCreatedAt", "courseId";

UPDATE "LibraryFolder" folder
SET "courseId" = canonical."canonicalId"
FROM "_LibraryCourseCanonical" canonical
WHERE folder."courseId" = canonical."courseId"
  AND canonical."courseId" <> canonical."canonicalId";

DELETE FROM "LibraryCourse" course
USING "_LibraryCourseCanonical" canonical
WHERE course."id" = canonical."courseId"
  AND canonical."courseId" <> canonical."canonicalId";

WITH ordered AS (
  SELECT "id", ROW_NUMBER() OVER (PARTITION BY "folderId" ORDER BY "createdAt", "id") - 1 AS position
  FROM "LibraryFile"
)
UPDATE "LibraryFile" file
SET "sortOrder" = ordered.position
FROM ordered
WHERE file."id" = ordered."id";

DROP INDEX "LibraryCourse_departmentId_level_semester_sortOrder_idx";
DROP INDEX "LibraryFile_folderId_createdAt_idx";
ALTER TABLE "LibraryCourse" DROP CONSTRAINT "LibraryCourse_departmentId_fkey";
ALTER TABLE "LibraryCourse"
  DROP COLUMN "departmentId",
  DROP COLUMN "level",
  DROP COLUMN "semester",
  DROP COLUMN "sortOrder";

CREATE UNIQUE INDEX "LibraryCourse_normalizedCode_key" ON "LibraryCourse"("normalizedCode");
CREATE INDEX "LibraryCourseDepartment_departmentId_level_semester_sortOrder_idx"
ON "LibraryCourseDepartment"("departmentId", "level", "semester", "sortOrder");
CREATE INDEX "LibraryFile_folderId_sortOrder_createdAt_idx"
ON "LibraryFile"("folderId", "sortOrder", "createdAt");

ALTER TABLE "LibraryCourseDepartment"
ADD CONSTRAINT "LibraryCourseDepartment_courseId_fkey"
FOREIGN KEY ("courseId") REFERENCES "LibraryCourse"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "LibraryCourseDepartment"
ADD CONSTRAINT "LibraryCourseDepartment_departmentId_fkey"
FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE CASCADE ON UPDATE CASCADE;
