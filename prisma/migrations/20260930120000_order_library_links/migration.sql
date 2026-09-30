ALTER TABLE "LibraryLink" ADD COLUMN "sortOrder" INTEGER NOT NULL DEFAULT 0;

WITH ordered AS (
  SELECT "id", ROW_NUMBER() OVER (PARTITION BY "folderId" ORDER BY "createdAt" DESC, "title", "id") - 1 AS position
  FROM "LibraryLink"
)
UPDATE "LibraryLink" link
SET "sortOrder" = ordered.position
FROM ordered
WHERE link."id" = ordered."id";

DROP INDEX "LibraryLink_folderId_createdAt_idx";
CREATE INDEX "LibraryLink_folderId_sortOrder_createdAt_idx"
ON "LibraryLink"("folderId", "sortOrder", "createdAt");
