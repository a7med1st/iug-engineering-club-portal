-- managedDepartmentIds is only intended for club MEMBER accounts.
UPDATE "User"
SET "managedDepartmentIds" = '{}'::TEXT[]
WHERE "role" <> 'MEMBER'
  AND cardinality("managedDepartmentIds") > 0;