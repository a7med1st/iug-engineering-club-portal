import { NextRequest, NextResponse } from "next/server";

import {
  buildCspReportOnly,
  configuredPublicBlobOrigin,
  createCspNonce,
  CSP_REPORT_ONLY_HEADER,
  cspReportOnlyEnvironment,
} from "@/lib/csp";

let warnedAboutPublicBlobOrigin = false;

function publicBlobOriginForReportOnly() {
  const origin = configuredPublicBlobOrigin();

  if (!origin && !warnedAboutPublicBlobOrigin) {
    warnedAboutPublicBlobOrigin = true;
    console.warn(
      "CSP Report-Only omitted the external Public Blob source because " +
        "BLOB_PUBLIC_ORIGIN is missing or invalid. Configure the exact " +
        "https://<safe-host>.public.blob.vercel-storage.com origin.",
    );
  }

  return origin;
}

export function middleware(request: NextRequest) {
  const environment = cspReportOnlyEnvironment();
  if (!environment) return NextResponse.next();

  const nonce = createCspNonce();
  const policy = buildCspReportOnly(nonce, {
    ...environment,
    publicBlobOrigin: publicBlobOriginForReportOnly(),
  });
  const requestHeaders = new Headers(request.headers);

  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set(CSP_REPORT_ONLY_HEADER, policy);

  const response = NextResponse.next({
    request: { headers: requestHeaders },
  });
  response.headers.set(CSP_REPORT_ONLY_HEADER, policy);

  return response;
}

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|.*\\.(?:avif|css|gif|ico|jpeg|jpg|js|map|otf|png|svg|ttf|txt|webmanifest|webp|woff|woff2|xml)$).*)",
  ],
};
