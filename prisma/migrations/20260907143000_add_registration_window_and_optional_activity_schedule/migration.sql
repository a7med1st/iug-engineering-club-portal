-- AlterTable
ALTER TABLE "Activity" ALTER COLUMN "startsAt" DROP NOT NULL;

-- AlterTable
ALTER TABLE "ActivityRegistrationForm"
ADD COLUMN "opensAt" TIMESTAMP(3),
ADD COLUMN "closesAt" TIMESTAMP(3);

-- Preserve existing forms with a valid registration window.
UPDATE "ActivityRegistrationForm" AS form
SET
  "opensAt" = form."createdAt",
  "closesAt" = GREATEST(
    form."createdAt" + INTERVAL '1 day',
    COALESCE(activity."startsAt", activity."endsAt", form."createdAt" + INTERVAL '30 days')
  )
FROM "Activity" AS activity
WHERE activity."id" = form."activityId";

ALTER TABLE "ActivityRegistrationForm"
ALTER COLUMN "opensAt" SET NOT NULL,
ALTER COLUMN "closesAt" SET NOT NULL;
