import { NextResponse } from "next/server";

export const PRIVATE_NO_STORE_CACHE_CONTROL = "private, no-store";

export function privateNoStoreJson<JsonBody>(
  body: JsonBody,
  init: ResponseInit = {},
) {
  const headers = new Headers(init.headers);
  headers.set("Cache-Control", PRIVATE_NO_STORE_CACHE_CONTROL);

  return NextResponse.json(body, {
    ...init,
    headers,
  });
}
