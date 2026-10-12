CREATE TYPE "MemberGroup" AS ENUM ('ADMINISTRATIVE', 'PUBLIC_RELATIONS', 'MEMBERS', 'MEDIA');
ALTER TABLE "ClubStructureItem" ADD COLUMN "memberGroup" "MemberGroup" NOT NULL DEFAULT 'MEMBERS';

-- Classify recognizable legacy roles; administrators can review every assignment.
UPDATE "ClubStructureItem"
SET "memberGroup" = CASE
  WHEN lower("title") ~ '(علاقات|public relations)' THEN 'PUBLIC_RELATIONS'::"MemberGroup"
  WHEN lower("title") ~ '(إعلام|اعلام|media)' THEN 'MEDIA'::"MemberGroup"
  WHEN lower("title") ~ '(رئيس النادي|نائب رئيس|الهيئة الإدارية|هيئة ادارية|club president|vice president|administrative|student coordinator)' THEN 'ADMINISTRATIVE'::"MemberGroup"
  ELSE 'MEMBERS'::"MemberGroup"
END;
