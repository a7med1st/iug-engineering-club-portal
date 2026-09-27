CREATE TABLE "LibraryLink" (
    "id" TEXT NOT NULL,
    "folderId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "LibraryLink_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "LibraryLink_folderId_createdAt_idx" ON "LibraryLink"("folderId", "createdAt");

ALTER TABLE "LibraryLink" ADD CONSTRAINT "LibraryLink_folderId_fkey" FOREIGN KEY ("folderId") REFERENCES "LibraryFolder"("id") ON DELETE CASCADE ON UPDATE CASCADE;
