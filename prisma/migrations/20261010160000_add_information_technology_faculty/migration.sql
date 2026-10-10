INSERT INTO "Department" ("id", "slug", "nameAr", "nameEn", "coverImage", "sortOrder", "updatedAt")
VALUES (
    'information-technology-faculty',
    'information-technology',
    'كلية تكنولوجيا المعلومات',
    'Faculty of Information Technology',
    '/images/departments/computer.png',
    9,
    CURRENT_TIMESTAMP
)
ON CONFLICT ("slug") DO NOTHING;
