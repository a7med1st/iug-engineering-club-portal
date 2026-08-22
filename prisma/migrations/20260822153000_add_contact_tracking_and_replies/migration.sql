ALTER TYPE "ContactRequestStatus" ADD VALUE 'IN_PROGRESS';

ALTER TABLE "Complaint"
ADD COLUMN "submittedById" TEXT;

ALTER TABLE "Suggestion"
ADD COLUMN "submittedById" TEXT;

ALTER TABLE "CollaborationRequest"
ADD COLUMN "submittedById" TEXT;

CREATE TABLE "ComplaintReply" (
    "id" TEXT NOT NULL,
    "complaintId" TEXT NOT NULL,
    "authorId" TEXT,
    "message" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ComplaintReply_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Complaint_submittedById_createdAt_idx"
ON "Complaint"("submittedById", "createdAt");

CREATE INDEX "Suggestion_submittedById_createdAt_idx"
ON "Suggestion"("submittedById", "createdAt");

CREATE INDEX "CollaborationRequest_submittedById_createdAt_idx"
ON "CollaborationRequest"("submittedById", "createdAt");

CREATE INDEX "ComplaintReply_complaintId_createdAt_idx"
ON "ComplaintReply"("complaintId", "createdAt");

CREATE INDEX "ComplaintReply_authorId_idx"
ON "ComplaintReply"("authorId");

ALTER TABLE "Complaint"
ADD CONSTRAINT "Complaint_submittedById_fkey"
FOREIGN KEY ("submittedById") REFERENCES "User"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Suggestion"
ADD CONSTRAINT "Suggestion_submittedById_fkey"
FOREIGN KEY ("submittedById") REFERENCES "User"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "CollaborationRequest"
ADD CONSTRAINT "CollaborationRequest_submittedById_fkey"
FOREIGN KEY ("submittedById") REFERENCES "User"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ComplaintReply"
ADD CONSTRAINT "ComplaintReply_complaintId_fkey"
FOREIGN KEY ("complaintId") REFERENCES "Complaint"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ComplaintReply"
ADD CONSTRAINT "ComplaintReply_authorId_fkey"
FOREIGN KEY ("authorId") REFERENCES "User"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
