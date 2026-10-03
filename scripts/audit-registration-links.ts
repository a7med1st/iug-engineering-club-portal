import { prisma } from "../lib/prisma";

async function main() {
  const rows = await prisma.$queryRaw`
    SELECT COUNT(*)::int AS "unlinkedRegistrations",
      COUNT(*) FILTER (WHERE EXISTS (
        SELECT 1 FROM "User" u
        WHERE LOWER(BTRIM(u.email)) = LOWER(BTRIM(s."studentEmail"))
          AND u."emailVerifiedAt" IS NOT NULL AND u.role IN ('STUDENT', 'MEMBER')
      ))::int AS "matchingVerifiedAccounts",
      COUNT(*) FILTER (WHERE EXISTS (
        SELECT 1 FROM "Certificate" c WHERE c."submissionId" = s.id
          AND c."artifactPathname" IS NOT NULL AND c."revokedAt" IS NULL
      ))::int AS "unlinkedIssuedCertificates"
    FROM "ActivityFormSubmission" s WHERE s."userId" IS NULL
  `;
  console.log(JSON.stringify(rows));
}
main().catch(error => { console.error(error.message); process.exitCode = 1; }).finally(() => prisma.$disconnect());
