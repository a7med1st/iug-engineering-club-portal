/*
  Warnings:

  - A unique constraint covering the columns `[reminderKey]` on the table `Notification` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "Notification" ADD COLUMN     "reminderKey" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Notification_reminderKey_key" ON "Notification"("reminderKey");
