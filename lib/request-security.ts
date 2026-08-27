import { NextResponse } from "next/server";

function firstHeaderValue(value: string | null) {
  return value?.split(",", 1)[0]?.trim() || null;
}

function expectedOrigin(request: Request) {
  const requestUrl = new URL(request.url);
  const host =
    process.env.VERCEL === "1"
      ? firstHeaderValue(request.headers.get("x-forwarded-host")) ??
        request.headers.get("host")
      : request.headers.get("host");

  if (!host) {
    return requestUrl.origin;
  }

  const protocol =
    process.env.VERCEL === "1"
      ? firstHeaderValue(request.headers.get("x-forwarded-proto")) ??
        requestUrl.protocol.replace(":", "")
      : requestUrl.protocol.replace(":", "");

  return `${protocol}://${host}`;
}

export function isSameOriginRequest(request: Request) {
  const origin = request.headers.get("origin");

  if (!origin || origin === "null") {
    return false;
  }

  try {
    return new URL(origin).origin === expectedOrigin(request);
  } catch {
    return false;
  }
}

export function rejectCrossOriginRequest(request: Request) {
  if (isSameOriginRequest(request)) {
    return null;
  }

  return NextResponse.json(
    {
      ok: false,
      error: "CROSS_ORIGIN_REQUEST_REJECTED",
    },
    { status: 403 },
  );
}
