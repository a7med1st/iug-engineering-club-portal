ALTER TABLE "CertificateTemplate"
  ADD COLUMN "nameEnglishFontFamily" TEXT NOT NULL DEFAULT 'Alexandria',
  ADD COLUMN "nameBold" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "titleEnglishFontFamily" TEXT NOT NULL DEFAULT 'Alexandria',
  ADD COLUMN "titleBold" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "dateEnglishFontFamily" TEXT NOT NULL DEFAULT 'Alexandria',
  ADD COLUMN "dateBold" BOOLEAN NOT NULL DEFAULT false;
