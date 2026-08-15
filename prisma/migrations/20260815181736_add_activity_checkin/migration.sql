/*
  Warnings:

  - Made the column `checkInToken` on table `ActivityFormSubmission` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "ActivityFormSubmission" ALTER COLUMN "checkInToken" SET NOT NULL;
