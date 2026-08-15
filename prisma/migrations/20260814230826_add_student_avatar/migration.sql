-- AlterTable
ALTER TABLE "User" ADD COLUMN     "avatarMime" TEXT,
ADD COLUMN     "avatarOriginalName" TEXT,
ADD COLUMN     "avatarSize" INTEGER,
ADD COLUMN     "avatarStoredName" TEXT,
ADD COLUMN     "avatarUpdatedAt" TIMESTAMP(3);
