-- Add the two certificate-name questions without replacing existing answers.
INSERT INTO "ActivityFormQuestion" ("id", "formId", "label", "type", "required", "placeholder", "helpText", "sortOrder", "createdAt", "updatedAt")
SELECT 'cert-name-ar-' || md5(f."id"), f."id", 'الاسم باللغة العربية', 'SHORT_TEXT', true,
       'اكتب اسمك الكامل باللغة العربية', 'سيُطبع هذا الاسم على الشهادة العربية. راجع كتابته قبل التسجيل.',
       COALESCE((SELECT MIN(q."sortOrder") FROM "ActivityFormQuestion" q WHERE q."formId" = f."id"), 0) - 2,
       CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "ActivityRegistrationForm" f
WHERE NOT EXISTS (SELECT 1 FROM "ActivityFormQuestion" q WHERE q."formId" = f."id" AND q."label" = 'الاسم باللغة العربية');

INSERT INTO "ActivityFormQuestion" ("id", "formId", "label", "type", "required", "placeholder", "helpText", "sortOrder", "createdAt", "updatedAt")
SELECT 'cert-name-en-' || md5(f."id"), f."id", 'الاسم باللغة الإنجليزية', 'SHORT_TEXT', true,
       'Full name in English', 'سيُطبع هذا الاسم على الشهادة الإنجليزية كما تكتبه هنا.',
       COALESCE((SELECT MIN(q."sortOrder") FROM "ActivityFormQuestion" q WHERE q."formId" = f."id"), 0) + 1,
       CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "ActivityRegistrationForm" f
WHERE NOT EXISTS (SELECT 1 FROM "ActivityFormQuestion" q WHERE q."formId" = f."id" AND q."label" = 'الاسم باللغة الإنجليزية');
