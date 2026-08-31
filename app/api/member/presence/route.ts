import { NextResponse } from "next/server";

import { authorizeAuthenticatedApi } from "@/lib/api-auth";
import { privateNoStoreJson } from "@/lib/private-response";
import { prisma } from "@/lib/prisma";
import { rejectCrossOriginRequest } from "@/lib/request-security";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const crossOriginResponse = rejectCrossOriginRequest(request);

  if (crossOriginResponse) {
    return crossOriginResponse;
  }

  const auth = await authorizeAuthenticatedApi();
  if (!auth.authorized) return auth.response;
  const user = auth.user;

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

  return privateNoStoreJson({
    ok: true,
    at: now.toISOString(),
  });
}
