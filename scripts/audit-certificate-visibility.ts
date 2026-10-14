import { prisma } from "../lib/prisma";
import { getAttendanceProgress } from "../lib/activity-attendance";

async function main() {
  const rows = await prisma.activityFormSubmission.findMany({
    where: { status: "APPROVED" },
    select: {
      status: true, checkedInAt: true, userId: true,
      sessionAttendances: { select: { sessionId: true } },
      certificate: { select: { revokedAt: true, artifactPathname: true } },
      form: { select: { activity: { select: { sessions: { select: { id: true } }, requiredAttendanceCount: true } } } },
    },
  });
  const eligible = rows.filter(row => getAttendanceProgress(row).eligible);
  const issued = rows.filter(row => row.certificate && !row.certificate.revokedAt && row.certificate.artifactPathname);
  console.log(JSON.stringify({
    approved: rows.length, eligible: eligible.length,
    eligibleWithoutCertificate: eligible.filter(row => !row.certificate).length,
    eligibleWithMissingArtifact: eligible.filter(row => row.certificate && !row.certificate.artifactPathname).length,
    activeIssued: issued.length,
    activeHiddenByLegacyAttendance: issued.filter(row => !row.checkedInAt).length,
    activeWithoutLinkedAccount: issued.filter(row => !row.userId).length,
  }, null, 2));
}

main().catch(error => { console.error("Certificate audit failed:", error.code ?? error.name); process.exitCode = 1; }).finally(() => prisma.$disconnect());
