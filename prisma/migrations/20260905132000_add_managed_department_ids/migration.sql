-- Allow one MEMBER to manage more than one department.
ALTER TABLE "User"
ADD COLUMN "managedDepartmentIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

-- Preserve every existing user's current department as their initial managed department.
UPDATE "User"
SET "managedDepartmentIds" = ARRAY["departmentId"]
WHERE "departmentId" IS NOT NULL
  AND cardinality("managedDepartmentIds") = 0;
