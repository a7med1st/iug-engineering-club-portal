-- Add department profile image fields (Blob Storage)
ALTER TABLE "Department" ADD COLUMN "profileImageStoredName" TEXT,
ADD COLUMN "profileImageOriginalName" TEXT,
ADD COLUMN "profileImageMime" TEXT,
ADD COLUMN "profileImageSize" INTEGER,
ADD COLUMN "profileImageUpdatedAt" TIMESTAMP(3);

-- Add department detail image fields (Blob Storage)
ALTER TABLE "Department" ADD COLUMN "detailImageStoredName" TEXT,
ADD COLUMN "detailImageOriginalName" TEXT,
ADD COLUMN "detailImageMime" TEXT,
ADD COLUMN "detailImageSize" INTEGER,
ADD COLUMN "detailImageUpdatedAt" TIMESTAMP(3);
