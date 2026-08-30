import { NextRequest, NextResponse } from "next/server";

import {
  buildCspPolicy,
  configuredPublicBlobOrigin,
  createCspNonce,
  cspEnvironment,
} from "@/lib/csp";

let warnedAboutPublicBlobOrigin = false;

function publicBlobOriginForCsp() {
  const origin = configuredPublicBlobOrigin();

  if (!origin && !warnedAboutPublicBlobOrigin) {
    warnedAboutPublicBlobOrigin = true;
    console.warn(
      "CSP omitted the external Public Blob source because " +
        "BLOB_PUBLIC_ORIGIN is missing or invalid. Configure the exact " +
        "https://<safe-host>.public.blob.vercel-storage.com origin.",
    );
  }

  return origin;
}

export function middleware(request: NextRequest) {
  const environment = cspEnvironment();
  if (!environment) return NextResponse.next();

  const nonce = createCspNonce();
  const policy = buildCspPolicy(nonce, {
    development: environment.development,
    publicBlobOrigin: publicBlobOriginForCsp(),
  });
  const requestHeaders = new Headers(request.headers);

  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set(environment.header, policy);

  const response = NextResponse.next({
    request: { headers: requestHeaders },
  });
  response.headers.set(environment.header, policy);

  return response;
}

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|.*\\.(?:avif|css|gif|ico|jpeg|jpg|js|map|otf|png|svg|ttf|txt|webmanifest|webp|woff|woff2|xml)$).*)",
  ],
};
