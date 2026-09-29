import assert from "node:assert/strict";

async function main() {
  process.env.SESSION_SECRET = "library-test-session-secret-32-characters";
  const { PERMISSIONS, canAccessDepartment, hasPermission, memberLibraryDepartmentIds, normalizeMemberPermissions } = await import("../lib/permissions");
  const libraryPermission = PERMISSIONS.LIBRARY_MANAGE;
  assert.equal(normalizeMemberPermissions([libraryPermission]).includes(libraryPermission), true);
  assert.equal(hasPermission("ADMIN", libraryPermission), true);
  assert.equal(hasPermission("MEMBER", libraryPermission, []), false);
  assert.equal(hasPermission("MEMBER", libraryPermission, [libraryPermission]), true);
  assert.equal(canAccessDepartment(
    {
      role: "MEMBER",
      departmentId: "department-a",
      managedDepartmentIds: ["department-a"],
      position: null,
    },
    "department-b",
  ),
    false,
  );
  assert.deepEqual(
    memberLibraryDepartmentIds({
      role: "MEMBER",
      departmentId: "department-a",
      managedDepartmentIds: ["department-a", "department-b"],
    }),
    ["department-a"],
  );
  assert.deepEqual(
    memberLibraryDepartmentIds({
      role: "MEMBER",
      departmentId: null,
      managedDepartmentIds: ["department-a"],
    }),
    [],
  );
  console.log("Library permission tests passed.");
}
void main();
