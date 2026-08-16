-- AlterTable
ALTER TABLE "ActivityRegistrationForm" ALTER COLUMN "title" SET DEFAULT 'ط·آ¸أ¢â‚¬آ ط·آ¸أ¢â‚¬آ¦ط·آ¸ط«â€ ط·آ·ط¢آ°ط·آ·ط¢آ¬ ط·آ·ط¢آ§ط·آ¸أ¢â‚¬â€چط·آ·ط¹آ¾ط·آ·ط¢آ³ط·آ·ط¢آ¬ط·آ¸ط¸آ¹ط·آ¸أ¢â‚¬â€چ';

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "chatLastSeenAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "ChatMessageReceipt" (
    "messageId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "deliveredAt" TIMESTAMP(3),
    "readAt" TIMESTAMP(3),

    CONSTRAINT "ChatMessageReceipt_pkey" PRIMARY KEY ("messageId","userId")
);

-- CreateTable
CREATE TABLE "ChatTyping" (
    "conversationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChatTyping_pkey" PRIMARY KEY ("conversationId","userId")
);

-- CreateIndex
CREATE INDEX "ChatMessageReceipt_userId_deliveredAt_idx" ON "ChatMessageReceipt"("userId", "deliveredAt");

-- CreateIndex
CREATE INDEX "ChatMessageReceipt_userId_readAt_idx" ON "ChatMessageReceipt"("userId", "readAt");

-- CreateIndex
CREATE INDEX "ChatTyping_expiresAt_idx" ON "ChatTyping"("expiresAt");

-- AddForeignKey
ALTER TABLE "ChatMessageReceipt" ADD CONSTRAINT "ChatMessageReceipt_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "ChatMessage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatMessageReceipt" ADD CONSTRAINT "ChatMessageReceipt_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatTyping" ADD CONSTRAINT "ChatTyping_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "ChatConversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatTyping" ADD CONSTRAINT "ChatTyping_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
