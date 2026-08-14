-- CreateEnum
CREATE TYPE "ActivityFormQuestionType" AS ENUM ('SHORT_TEXT', 'LONG_TEXT', 'EMAIL', 'PHONE', 'NUMBER', 'SELECT', 'RADIO', 'CHECKBOX');

-- CreateEnum
CREATE TYPE "ActivitySubmissionStatus" AS ENUM ('SUBMITTED', 'APPROVED', 'REJECTED');

-- AlterTable
ALTER TABLE "Activity" ALTER COLUMN "formUrl" DROP NOT NULL;

-- CreateTable
CREATE TABLE "ActivityRegistrationForm" (
    "id" TEXT NOT NULL,
    "activityId" TEXT NOT NULL,
    "title" TEXT NOT NULL DEFAULT 'نموذج التسجيل',
    "description" TEXT NOT NULL DEFAULT '',
    "isOpen" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ActivityRegistrationForm_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActivityFormQuestion" (
    "id" TEXT NOT NULL,
    "formId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "type" "ActivityFormQuestionType" NOT NULL,
    "required" BOOLEAN NOT NULL DEFAULT false,
    "placeholder" TEXT,
    "helpText" TEXT,
    "options" JSONB,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ActivityFormQuestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActivityFormSubmission" (
    "id" TEXT NOT NULL,
    "formId" TEXT NOT NULL,
    "userId" TEXT,
    "studentName" TEXT NOT NULL,
    "studentEmail" TEXT NOT NULL,
    "studentDepartment" TEXT,
    "status" "ActivitySubmissionStatus" NOT NULL DEFAULT 'SUBMITTED',
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ActivityFormSubmission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActivityFormAnswer" (
    "id" TEXT NOT NULL,
    "submissionId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ActivityFormAnswer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ActivityRegistrationForm_activityId_key" ON "ActivityRegistrationForm"("activityId");

-- CreateIndex
CREATE INDEX "ActivityFormQuestion_formId_sortOrder_idx" ON "ActivityFormQuestion"("formId", "sortOrder");

-- CreateIndex
CREATE INDEX "ActivityFormSubmission_formId_submittedAt_idx" ON "ActivityFormSubmission"("formId", "submittedAt");

-- CreateIndex
CREATE INDEX "ActivityFormSubmission_userId_idx" ON "ActivityFormSubmission"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "ActivityFormSubmission_formId_userId_key" ON "ActivityFormSubmission"("formId", "userId");

-- CreateIndex
CREATE INDEX "ActivityFormAnswer_questionId_idx" ON "ActivityFormAnswer"("questionId");

-- CreateIndex
CREATE UNIQUE INDEX "ActivityFormAnswer_submissionId_questionId_key" ON "ActivityFormAnswer"("submissionId", "questionId");

-- AddForeignKey
ALTER TABLE "ActivityRegistrationForm" ADD CONSTRAINT "ActivityRegistrationForm_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "Activity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityFormQuestion" ADD CONSTRAINT "ActivityFormQuestion_formId_fkey" FOREIGN KEY ("formId") REFERENCES "ActivityRegistrationForm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityFormSubmission" ADD CONSTRAINT "ActivityFormSubmission_formId_fkey" FOREIGN KEY ("formId") REFERENCES "ActivityRegistrationForm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityFormSubmission" ADD CONSTRAINT "ActivityFormSubmission_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityFormAnswer" ADD CONSTRAINT "ActivityFormAnswer_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "ActivityFormSubmission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityFormAnswer" ADD CONSTRAINT "ActivityFormAnswer_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "ActivityFormQuestion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
