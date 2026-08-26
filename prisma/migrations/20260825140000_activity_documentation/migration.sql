-- AlterTable
ALTER TABLE "Activity"
ADD COLUMN "postEventSummary" TEXT,
ADD COLUMN "coverImageUrl" TEXT,
ADD COLUMN "coverImagePathname" TEXT,
ADD COLUMN "coverImageOriginalName" TEXT,
ADD COLUMN "coverImageMime" TEXT,
ADD COLUMN "coverImageSize" INTEGER;

-- CreateTable
CREATE TABLE "ActivityImage" (
    "id" TEXT NOT NULL,
    "activityId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "pathname" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "mime" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ActivityImage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ActivityImage_pathname_key" ON "ActivityImage"("pathname");

-- CreateIndex
CREATE INDEX "ActivityImage_activityId_sortOrder_idx" ON "ActivityImage"("activityId", "sortOrder");

-- AddForeignKey
ALTER TABLE "ActivityImage" ADD CONSTRAINT "ActivityImage_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "Activity"("id") ON DELETE CASCADE ON UPDATE CASCADE;
