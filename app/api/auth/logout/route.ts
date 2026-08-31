import { NextResponse } from "next/server";

import { clearSession } from "@/lib/auth";
import { rejectCrossOriginRequest } from "@/lib/request-security";

export async function POST(request: Request) {
  const crossOriginResponse = rejectCrossOriginRequest(request);

  if (crossOriginResponse) {
    return crossOriginResponse;
  }

  await clearSession();
  return new NextResponse(null, {
    status: 303,
    headers: { Location: "/" },
  });
}
