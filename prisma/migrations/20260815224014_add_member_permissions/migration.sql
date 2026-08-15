-- AlterTable
ALTER TABLE "User" ADD COLUMN     "memberPermissions" TEXT[] DEFAULT ARRAY[]::TEXT[];
