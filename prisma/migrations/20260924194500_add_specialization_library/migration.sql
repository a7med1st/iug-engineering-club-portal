CREATE TABLE "LibraryCourse" (
    "id" TEXT NOT NULL,
    "departmentId" TEXT NOT NULL,
    "level" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "description" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "LibraryCourse_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "LibraryFolder" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isVisible" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "LibraryFolder_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "LibraryFile" (
    "id" TEXT NOT NULL,
    "folderId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "uploadedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "LibraryFile_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "LibraryFile_storageKey_key" ON "LibraryFile"("storageKey");
CREATE INDEX "LibraryCourse_departmentId_level_sortOrder_idx" ON "LibraryCourse"("departmentId", "level", "sortOrder");
CREATE INDEX "LibraryFolder_courseId_sortOrder_idx" ON "LibraryFolder"("courseId", "sortOrder");
CREATE INDEX "LibraryFolder_createdById_idx" ON "LibraryFolder"("createdById");
CREATE INDEX "LibraryFile_folderId_createdAt_idx" ON "LibraryFile"("folderId", "createdAt");
CREATE INDEX "LibraryFile_uploadedById_idx" ON "LibraryFile"("uploadedById");

ALTER TABLE "LibraryCourse" ADD CONSTRAINT "LibraryCourse_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LibraryFolder" ADD CONSTRAINT "LibraryFolder_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "LibraryCourse"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LibraryFolder" ADD CONSTRAINT "LibraryFolder_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "LibraryFile" ADD CONSTRAINT "LibraryFile_folderId_fkey" FOREIGN KEY ("folderId") REFERENCES "LibraryFolder"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LibraryFile" ADD CONSTRAINT "LibraryFile_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
