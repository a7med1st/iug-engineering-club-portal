-- CreateEnum
CREATE TYPE "StudyLevel" AS ENUM ('FIRST', 'SECOND', 'THIRD', 'FOURTH', 'FIFTH', 'GRADUATE');

-- CreateEnum
CREATE TYPE "ComplaintType" AS ENUM ('COMPLAINT', 'ORGANIZATIONAL_PROBLEM', 'IMPROVEMENT_SUGGESTION', 'INQUIRY', 'OTHER');

-- CreateEnum
CREATE TYPE "PreferredActivityType" AS ENUM ('TRAINING_COURSE', 'WORKSHOP', 'TECH_LECTURE', 'COMPETITION', 'DISCUSSION_SESSION', 'PRACTICAL_TRAINING');

-- CreateEnum
CREATE TYPE "ExperienceLevel" AS ENUM ('BEGINNER', 'INTERMEDIATE', 'ADVANCED');

-- CreateEnum
CREATE TYPE "EntityType" AS ENUM ('TRAINER', 'COMPANY', 'EDUCATIONAL_INSTITUTION', 'CHARITY', 'TECH_COMMUNITY', 'INDIVIDUAL', 'OTHER');

-- CreateEnum
CREATE TYPE "CooperationType" AS ENUM ('TRAINING_COURSE', 'WORKSHOP', 'LECTURE', 'EVENT_SPONSORSHIP', 'STRATEGIC_PARTNERSHIP', 'COMMUNITY_INITIATIVE', 'OTHER');

-- CreateEnum
CREATE TYPE "ContactRequestStatus" AS ENUM ('NEW', 'IN_REVIEW', 'RESOLVED', 'CONTACTED', 'ACCEPTED', 'REJECTED');

-- CreateTable
CREATE TABLE "Complaint" (
    "id" TEXT NOT NULL,
    "studentName" TEXT,
    "contact" TEXT,
    "departmentId" TEXT NOT NULL,
    "studyLevel" "StudyLevel" NOT NULL,
    "type" "ComplaintType" NOT NULL,
    "details" TEXT NOT NULL,
    "wantsReply" BOOLEAN NOT NULL,
    "status" "ContactRequestStatus" NOT NULL DEFAULT 'NEW',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Complaint_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Suggestion" (
    "id" TEXT NOT NULL,
    "studentName" TEXT NOT NULL,
    "whatsapp" TEXT NOT NULL,
    "departmentId" TEXT NOT NULL,
    "studyLevel" "StudyLevel" NOT NULL,
    "topics" TEXT,
    "activityType" "PreferredActivityType" NOT NULL,
    "activityLevel" "ExperienceLevel" NOT NULL,
    "projectIdea" TEXT NOT NULL,
    "experienceLevel" "ExperienceLevel" NOT NULL,
    "status" "ContactRequestStatus" NOT NULL DEFAULT 'NEW',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Suggestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CollaborationRequest" (
    "id" TEXT NOT NULL,
    "entityName" TEXT NOT NULL,
    "entityType" "EntityType" NOT NULL,
    "contactPerson" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "socialUrl" TEXT NOT NULL,
    "cooperationType" "CooperationType" NOT NULL,
    "description" TEXT NOT NULL,
    "field" TEXT NOT NULL,
    "attachmentStoredName" TEXT,
    "attachmentOriginalName" TEXT,
    "attachmentMime" TEXT,
    "attachmentSize" INTEGER,
    "additionalNotes" TEXT,
    "status" "ContactRequestStatus" NOT NULL DEFAULT 'NEW',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CollaborationRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Complaint_status_createdAt_idx" ON "Complaint"("status", "createdAt");

-- CreateIndex
CREATE INDEX "Complaint_departmentId_createdAt_idx" ON "Complaint"("departmentId", "createdAt");

-- CreateIndex
CREATE INDEX "Suggestion_status_createdAt_idx" ON "Suggestion"("status", "createdAt");

-- CreateIndex
CREATE INDEX "Suggestion_departmentId_createdAt_idx" ON "Suggestion"("departmentId", "createdAt");

-- CreateIndex
CREATE INDEX "CollaborationRequest_status_createdAt_idx" ON "CollaborationRequest"("status", "createdAt");

-- AddForeignKey
ALTER TABLE "Complaint" ADD CONSTRAINT "Complaint_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Suggestion" ADD CONSTRAINT "Suggestion_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
