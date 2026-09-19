import assert from "node:assert/strict";

import { getAdminDashboardData } from "../lib/admin-dashboard";
import { prisma } from "../lib/prisma";

async function main() {
  const [dashboard, expectedTotal] = await Promise.all([
    getAdminDashboardData({ departmentId: null, range: "ALL" }),
    prisma.user.count(),
  ]);

  assert.equal(
    dashboard.summary.totalUserCount,
    expectedTotal,
    "Admin dashboard should show every registered account in the unfiltered total",
  );

  assert.equal(
    dashboard.summary.totalUserCount,
    dashboard.summary.studentCount +
      dashboard.summary.memberCount +
      dashboard.summary.adminCount,
    "Registered account total should equal the displayed role breakdown",
  );

  console.log(`admin dashboard user count test passed: ${expectedTotal} accounts`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
