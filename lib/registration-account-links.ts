import { Prisma } from "@prisma/client";

export function registrationAccountLinkQuery(userId: string) {
  return Prisma.sql`
    UPDATE "ActivityFormSubmission" s
    SET "userId" = u.id
    FROM "User" u
    WHERE u.id = ${userId} AND s."userId" IS NULL
      AND u."emailVerifiedAt" IS NOT NULL AND u.role IN ('STUDENT', 'MEMBER')
      AND LOWER(BTRIM(s."studentEmail")) = LOWER(BTRIM(u.email))
      AND (SELECT COUNT(*) FROM "User" candidate
        WHERE LOWER(BTRIM(candidate.email)) = LOWER(BTRIM(u.email))) = 1
      AND NOT EXISTS (SELECT 1 FROM "ActivityFormSubmission" owned
        WHERE owned."formId" = s."formId" AND owned."userId" = u.id)
      AND (SELECT COUNT(*) FROM "ActivityFormSubmission" guest
        WHERE guest."formId" = s."formId" AND guest."userId" IS NULL
          AND LOWER(BTRIM(guest."studentEmail")) = LOWER(BTRIM(u.email))) = 1
  `;
}
