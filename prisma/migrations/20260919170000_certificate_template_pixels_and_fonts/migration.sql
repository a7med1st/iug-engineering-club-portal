ALTER TABLE "CertificateTemplate"
  ALTER COLUMN "nameX" TYPE DECIMAL(10,2), ALTER COLUMN "nameY" TYPE DECIMAL(10,2), ALTER COLUMN "nameFontSize" TYPE DECIMAL(10,2),
  ALTER COLUMN "titleX" TYPE DECIMAL(10,2), ALTER COLUMN "titleY" TYPE DECIMAL(10,2), ALTER COLUMN "titleFontSize" TYPE DECIMAL(10,2),
  ALTER COLUMN "dateX" TYPE DECIMAL(10,2), ALTER COLUMN "dateY" TYPE DECIMAL(10,2), ALTER COLUMN "dateFontSize" TYPE DECIMAL(10,2);

UPDATE "CertificateTemplate" SET
  "nameX"=ROUND("nameX"*"sourceWidth"/100,2), "nameY"=ROUND("nameY"*"sourceHeight"/100,2), "nameFontSize"=ROUND("nameFontSize"*"sourceWidth"/100,2),
  "titleX"=ROUND("titleX"*"sourceWidth"/100,2), "titleY"=ROUND("titleY"*"sourceHeight"/100,2), "titleFontSize"=ROUND("titleFontSize"*"sourceWidth"/100,2),
  "dateX"=ROUND("dateX"*"sourceWidth"/100,2), "dateY"=ROUND("dateY"*"sourceHeight"/100,2), "dateFontSize"=ROUND("dateFontSize"*"sourceWidth"/100,2);

ALTER TABLE "CertificateTemplate"
  ADD COLUMN "nameFontFamily" TEXT NOT NULL DEFAULT 'Cairo', ADD COLUMN "titleFontFamily" TEXT NOT NULL DEFAULT 'Cairo', ADD COLUMN "dateFontFamily" TEXT NOT NULL DEFAULT 'Cairo',
  ALTER COLUMN "nameX" SET DEFAULT 600, ALTER COLUMN "nameY" SET DEFAULT 425, ALTER COLUMN "nameFontSize" SET DEFAULT 48,
  ALTER COLUMN "titleX" SET DEFAULT 600, ALTER COLUMN "titleY" SET DEFAULT 550, ALTER COLUMN "titleFontSize" SET DEFAULT 32,
  ALTER COLUMN "dateX" SET DEFAULT 600, ALTER COLUMN "dateY" SET DEFAULT 640, ALTER COLUMN "dateFontSize" SET DEFAULT 24;
