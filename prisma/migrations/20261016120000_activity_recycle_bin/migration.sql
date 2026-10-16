ALTER TABLE "Activity"
ADD COLUMN "deletedAt" TIMESTAMP(3),
ADD COLUMN "statusBeforeDeletion" "ActivityStatus";

CREATE INDEX "Activity_deletedAt_idx" ON "Activity"("deletedAt");
