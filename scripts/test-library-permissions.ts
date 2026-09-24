import assert from "node:assert/strict";

import {
  PERMISSIONS,
  canAccessDepartment,
  hasPermission,
  normalizeMemberPermissions,
} from "../lib/permissions";

const libraryPermission = PERMISSIONS.LIBRARY_MANAGE;

assert.equal(
  normalizeMemberPermissions([libraryPermission]).includes(libraryPermission),
  true,
);
assert.equal(hasPermission("ADMIN", libraryPermission), true);
assert.equal(hasPermission("MEMBER", libraryPermission, []), false);
assert.equal(hasPermission("MEMBER", libraryPermission, [libraryPermission]), true);
assert.equal(
  canAccessDepartment(
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

console.log("Library permission tests passed.");
