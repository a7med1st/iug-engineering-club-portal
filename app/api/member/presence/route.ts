import { NextResponse } from "next/server";

import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function POST() {
  const session = await getSession();

  if (!session) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.sub },
    select: { id: true, role: true },
  });

  if (
    !user ||
    (user.role !== "MEMBER" && user.role !== "ADMIN")
  ) {
    return NextResponse.json({ ok: false }, { status: 403 });
  }

  const now = new Date();

  await prisma.$transaction([
    prisma.user.update({
      where: { id: user.id },
      data: { chatLastSeenAt: now },
    }),
    prisma.chatMessageReceipt.updateMany({
      where: {
        userId: user.id,
        deliveredAt: null,
      },
      data: { deliveredAt: now },
    }),
  ]);

  return NextResponse.json({
    ok: true,
    at: now.toISOString(),
  });
}
