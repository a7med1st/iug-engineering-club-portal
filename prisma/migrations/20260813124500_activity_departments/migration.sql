-- CreateTable
CREATE TABLE "ActivityDepartment" (
    "activityId" TEXT NOT NULL,
    "departmentId" TEXT NOT NULL,

    CONSTRAINT "ActivityDepartment_pkey" PRIMARY KEY ("activityId", "departmentId")
);

-- Preserve every existing activity-to-department assignment before removing the
-- legacy single-department column. Activities without a department intentionally
-- remain without join rows and continue to represent general activities.
INSERT INTO "ActivityDepartment" ("activityId", "departmentId")
SELECT "id", "departmentId"
FROM "Activity"
WHERE "departmentId" IS NOT NULL;

-- CreateIndex
CREATE INDEX "ActivityDepartment_departmentId_idx" ON "ActivityDepartment"("departmentId");

-- DropForeignKey
ALTER TABLE "Activity" DROP CONSTRAINT "Activity_departmentId_fkey";

-- AlterTable
ALTER TABLE "Activity" DROP COLUMN "departmentId";

-- AddForeignKey
ALTER TABLE "ActivityDepartment" ADD CONSTRAINT "ActivityDepartment_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "Activity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityDepartment" ADD CONSTRAINT "ActivityDepartment_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE CASCADE ON UPDATE CASCADE;
