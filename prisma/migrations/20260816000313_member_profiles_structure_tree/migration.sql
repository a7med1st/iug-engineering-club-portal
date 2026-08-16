/*
  Warnings:

  - A unique constraint covering the columns `[userId]` on the table `ClubStructureItem` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "ActivityRegistrationForm" ALTER COLUMN "title" SET DEFAULT 'ظ†ظ…ظˆط°ط¬ ط§ظ„طھط³ط¬ظٹظ„';

-- AlterTable
ALTER TABLE "ClubStructureItem" ADD COLUMN     "parentId" TEXT,
ADD COLUMN     "userId" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "profileBio" TEXT,
ADD COLUMN     "profileCoverMime" TEXT,
ADD COLUMN     "profileCoverOriginalName" TEXT,
ADD COLUMN     "profileCoverSize" INTEGER,
ADD COLUMN     "profileCoverStoredName" TEXT,
ADD COLUMN     "profileCoverUpdatedAt" TIMESTAMP(3),
ADD COLUMN     "profileGithub" TEXT,
ADD COLUMN     "profileInstagram" TEXT,
ADD COLUMN     "profileLinkedIn" TEXT,
ADD COLUMN     "profileSkills" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- CreateIndex
CREATE UNIQUE INDEX "ClubStructureItem_userId_key" ON "ClubStructureItem"("userId");

-- CreateIndex
CREATE INDEX "ClubStructureItem_parentId_idx" ON "ClubStructureItem"("parentId");

-- CreateIndex
CREATE INDEX "ClubStructureItem_departmentId_sortOrder_idx" ON "ClubStructureItem"("departmentId", "sortOrder");

-- AddForeignKey
ALTER TABLE "ClubStructureItem" ADD CONSTRAINT "ClubStructureItem_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClubStructureItem" ADD CONSTRAINT "ClubStructureItem_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "ClubStructureItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;
