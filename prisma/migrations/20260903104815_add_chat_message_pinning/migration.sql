-- AlterTable
ALTER TABLE "ChatMessage" ADD COLUMN     "isPinned" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "pinnedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "ChatMessage_conversationId_isPinned_pinnedAt_idx" ON "ChatMessage"("conversationId", "isPinned", "pinnedAt");
