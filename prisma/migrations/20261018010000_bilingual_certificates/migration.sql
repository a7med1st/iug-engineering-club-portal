-- AlterTable
ALTER TABLE "Certificate" ADD COLUMN     "englishArtifactHeight" INTEGER,
ADD COLUMN     "englishArtifactMime" TEXT,
ADD COLUMN     "englishArtifactPathname" TEXT,
ADD COLUMN     "englishArtifactSize" INTEGER,
ADD COLUMN     "englishArtifactWidth" INTEGER,
ADD COLUMN     "englishTemplateFingerprint" TEXT;

-- CreateTable
CREATE TABLE "CertificateTemplateEnglish" (
    "id" TEXT NOT NULL,
    "activityId" TEXT NOT NULL,
    "sourcePathname" TEXT NOT NULL,
    "sourceOriginalName" TEXT NOT NULL,
    "sourceMime" TEXT NOT NULL,
    "sourceSize" INTEGER NOT NULL,
    "sourceWidth" INTEGER NOT NULL,
    "sourceHeight" INTEGER NOT NULL,
    "nameX" DECIMAL(10,2) NOT NULL DEFAULT 600,
    "nameY" DECIMAL(10,2) NOT NULL DEFAULT 425,
    "nameFontSize" DECIMAL(10,2) NOT NULL DEFAULT 48,
    "nameFontFamily" TEXT NOT NULL DEFAULT 'Cairo',
    "nameEnglishFontFamily" TEXT NOT NULL DEFAULT 'Alexandria',
    "nameBold" BOOLEAN NOT NULL DEFAULT false,
    "nameColor" TEXT NOT NULL DEFAULT '#111827',
    "nameAlign" TEXT NOT NULL DEFAULT 'center',
    "titleVisible" BOOLEAN NOT NULL DEFAULT false,
    "titleX" DECIMAL(10,2) NOT NULL DEFAULT 600,
    "titleY" DECIMAL(10,2) NOT NULL DEFAULT 550,
    "titleFontSize" DECIMAL(10,2) NOT NULL DEFAULT 32,
    "titleFontFamily" TEXT NOT NULL DEFAULT 'Cairo',
    "titleEnglishFontFamily" TEXT NOT NULL DEFAULT 'Alexandria',
    "titleBold" BOOLEAN NOT NULL DEFAULT false,
    "titleColor" TEXT NOT NULL DEFAULT '#111827',
    "titleAlign" TEXT NOT NULL DEFAULT 'center',
    "dateVisible" BOOLEAN NOT NULL DEFAULT false,
    "dateX" DECIMAL(10,2) NOT NULL DEFAULT 600,
    "dateY" DECIMAL(10,2) NOT NULL DEFAULT 640,
    "dateFontSize" DECIMAL(10,2) NOT NULL DEFAULT 24,
    "dateFontFamily" TEXT NOT NULL DEFAULT 'Cairo',
    "dateEnglishFontFamily" TEXT NOT NULL DEFAULT 'Alexandria',
    "dateBold" BOOLEAN NOT NULL DEFAULT false,
    "dateColor" TEXT NOT NULL DEFAULT '#111827',
    "dateAlign" TEXT NOT NULL DEFAULT 'center',
    "qrSettings" JSONB,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CertificateTemplateEnglish_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CertificateTemplateEnglish_activityId_key" ON "CertificateTemplateEnglish"("activityId");

-- CreateIndex
CREATE UNIQUE INDEX "CertificateTemplateEnglish_sourcePathname_key" ON "CertificateTemplateEnglish"("sourcePathname");

-- AddForeignKey
ALTER TABLE "CertificateTemplateEnglish" ADD CONSTRAINT "CertificateTemplateEnglish_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "Activity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CertificateTemplateEnglish" ADD CONSTRAINT "CertificateTemplateEnglish_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
