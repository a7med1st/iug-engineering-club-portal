UPDATE "Department"
SET "nameAr" = REPLACE("nameAr", 'الذكاء الصناعي', 'الذكاء الاصطناعي')
WHERE "slug" = 'ai-engineering'
  AND "nameAr" LIKE '%الذكاء الصناعي%';
