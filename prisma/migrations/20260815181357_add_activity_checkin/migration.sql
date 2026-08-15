/*
  Warnings:

  - A unique constraint covering the columns `[checkInToken]` on the table `ActivityFormSubmission` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "ActivityFormSubmission" ADD COLUMN     "checkInToken" TEXT,
ADD COLUMN     "checkedInAt" TIMESTAMP(3),
ADD COLUMN     "checkedInById" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "ActivityFormSubmission_checkInToken_key" ON "ActivityFormSubmission"("checkInToken");
