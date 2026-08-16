import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const messages = await prisma.chatMessage.findMany({
    include: {
      conversation: {
        include: {
          participants: true,
        },
      },
      receipts: true,
    },
    orderBy: { createdAt: "asc" },
  });

  let created = 0;

  for (const message of messages) {
    const existing = new Set(
      message.receipts.map((item) => item.userId),
    );

    const recipients =
      message.conversation.participants.filter(
        (item) =>
          item.userId !== message.senderId &&
          !existing.has(item.userId),
      );

    if (!recipients.length) continue;

    await prisma.chatMessageReceipt.createMany({
      data: recipients.map((recipient) => {
        const wasRead = Boolean(
          recipient.lastReadAt &&
            recipient.lastReadAt >= message.createdAt,
        );

        return {
          messageId: message.id,
          userId: recipient.userId,
          deliveredAt: wasRead
            ? recipient.lastReadAt
            : null,
          readAt: wasRead ? recipient.lastReadAt : null,
        };
      }),
      skipDuplicates: true,
    });

    created += recipients.length;
  }

  console.log(
    `Backfilled ${created} chat receipt(s).`,
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
