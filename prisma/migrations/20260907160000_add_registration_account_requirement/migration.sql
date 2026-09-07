-- Existing forms keep their current authenticated-only behavior.
ALTER TABLE "ActivityRegistrationForm"
ADD COLUMN "requiresAccount" BOOLEAN NOT NULL DEFAULT true;
