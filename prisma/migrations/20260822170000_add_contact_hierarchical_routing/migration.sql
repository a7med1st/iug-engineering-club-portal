CREATE TYPE "ContactRequestKind" AS ENUM (
    'COMPLAINT',
    'SUGGESTION',
    'COLLABORATION'
);

ALTER TABLE "Complaint"
ADD COLUMN "assignedToId" TEXT,
ADD COLUMN "assignedStructureItemId" TEXT,
ADD COLUMN "assignedAt" TIMESTAMP(3);

ALTER TABLE "Suggestion"
ADD COLUMN "assignedToId" TEXT,
ADD COLUMN "assignedStructureItemId" TEXT,
ADD COLUMN "assignedAt" TIMESTAMP(3);

ALTER TABLE "CollaborationRequest"
ADD COLUMN "assignedToId" TEXT,
ADD COLUMN "assignedStructureItemId" TEXT,
ADD COLUMN "assignedAt" TIMESTAMP(3);

CREATE TABLE "ContactRoutingEvent" (
    "id" TEXT NOT NULL,
    "requestKind" "ContactRequestKind" NOT NULL,
    "requestId" TEXT NOT NULL,
    "fromUserId" TEXT,
    "fromName" TEXT,
    "toUserId" TEXT NOT NULL,
    "toName" TEXT NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContactRoutingEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Complaint_assignedToId_status_createdAt_idx"
ON "Complaint"("assignedToId", "status", "createdAt");
CREATE INDEX "Complaint_assignedStructureItemId_idx"
ON "Complaint"("assignedStructureItemId");

CREATE INDEX "Suggestion_assignedToId_status_createdAt_idx"
ON "Suggestion"("assignedToId", "status", "createdAt");
CREATE INDEX "Suggestion_assignedStructureItemId_idx"
ON "Suggestion"("assignedStructureItemId");

CREATE INDEX "CollaborationRequest_assignedToId_status_createdAt_idx"
ON "CollaborationRequest"("assignedToId", "status", "createdAt");
CREATE INDEX "CollaborationRequest_assignedStructureItemId_idx"
ON "CollaborationRequest"("assignedStructureItemId");

CREATE INDEX "ContactRoutingEvent_requestKind_requestId_createdAt_idx"
ON "ContactRoutingEvent"("requestKind", "requestId", "createdAt");
CREATE INDEX "ContactRoutingEvent_toUserId_createdAt_idx"
ON "ContactRoutingEvent"("toUserId", "createdAt");

ALTER TABLE "Complaint"
ADD CONSTRAINT "Complaint_assignedToId_fkey"
FOREIGN KEY ("assignedToId") REFERENCES "User"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Complaint"
ADD CONSTRAINT "Complaint_assignedStructureItemId_fkey"
FOREIGN KEY ("assignedStructureItemId") REFERENCES "ClubStructureItem"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Suggestion"
ADD CONSTRAINT "Suggestion_assignedToId_fkey"
FOREIGN KEY ("assignedToId") REFERENCES "User"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Suggestion"
ADD CONSTRAINT "Suggestion_assignedStructureItemId_fkey"
FOREIGN KEY ("assignedStructureItemId") REFERENCES "ClubStructureItem"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "CollaborationRequest"
ADD CONSTRAINT "CollaborationRequest_assignedToId_fkey"
FOREIGN KEY ("assignedToId") REFERENCES "User"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CollaborationRequest"
ADD CONSTRAINT "CollaborationRequest_assignedStructureItemId_fkey"
FOREIGN KEY ("assignedStructureItemId") REFERENCES "ClubStructureItem"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
