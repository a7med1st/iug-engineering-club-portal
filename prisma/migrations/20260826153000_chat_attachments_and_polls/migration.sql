ALTER TABLE "ChatMessage"
  ALTER COLUMN "body" SET DEFAULT '',
  ADD COLUMN "kind" TEXT NOT NULL DEFAULT 'TEXT',
  ADD COLUMN "pollQuestion" TEXT,
  ADD COLUMN "pollOptions" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

CREATE TABLE "ChatAttachment" (
  "id" TEXT NOT NULL,
  "messageId" TEXT NOT NULL,
  "url" TEXT,
  "pathname" TEXT NOT NULL,
  "originalName" TEXT NOT NULL,
  "mime" TEXT NOT NULL,
  "size" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ChatAttachment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ChatPollVote" (
  "id" TEXT NOT NULL,
  "messageId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "optionIndex" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ChatPollVote_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ChatAttachment_messageId_idx" ON "ChatAttachment"("messageId");
CREATE INDEX "ChatPollVote_messageId_optionIndex_idx" ON "ChatPollVote"("messageId", "optionIndex");
CREATE INDEX "ChatPollVote_userId_idx" ON "ChatPollVote"("userId");
CREATE UNIQUE INDEX "ChatPollVote_messageId_userId_key" ON "ChatPollVote"("messageId", "userId");

ALTER TABLE "ChatAttachment"
  ADD CONSTRAINT "ChatAttachment_messageId_fkey"
  FOREIGN KEY ("messageId") REFERENCES "ChatMessage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ChatPollVote"
  ADD CONSTRAINT "ChatPollVote_messageId_fkey"
  FOREIGN KEY ("messageId") REFERENCES "ChatMessage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ChatPollVote"
  ADD CONSTRAINT "ChatPollVote_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
