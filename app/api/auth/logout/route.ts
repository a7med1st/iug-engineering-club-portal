import { NextResponse } from "next/server";

import { clearSession } from "@/lib/auth";
import { rejectCrossOriginRequest } from "@/lib/request-security";

export async function POST(request: Request) {
  const crossOriginResponse = rejectCrossOriginRequest(request);

  if (crossOriginResponse) {
    return crossOriginResponse;
  }

  await clearSession();
  return NextResponse.redirect(new URL("/", request.url), 303);
}
