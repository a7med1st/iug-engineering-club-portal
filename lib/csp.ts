export const CSP_REPORT_ONLY_HEADER =
  "Content-Security-Policy-Report-Only";

export const PUBLIC_ACTIVITY_BLOB_ORIGIN =
  "https://store_RdgeYZDnESPZowZe.public.blob.vercel-storage.com";

export function createCspNonce() {
  return crypto.randomUUID();
}

export function buildCspReportOnly(
  nonce: string,
  options: { development: boolean },
) {
  const scriptSources = [
    "'self'",
    `'nonce-${nonce}'`,
    "'strict-dynamic'",
    ...(options.development ? ["'unsafe-eval'"] : []),
  ];
  const connectSources = [
    "'self'",
    ...(options.development
      ? ["ws://localhost:*", "ws://127.0.0.1:*"]
      : []),
  ];

  return [
    "default-src 'self'",
    `script-src ${scriptSources.join(" ")}`,
    `style-src 'self' 'nonce-${nonce}' https://fonts.googleapis.com`,
    "style-src-attr 'unsafe-inline'",
    `img-src 'self' data: blob: ${PUBLIC_ACTIVITY_BLOB_ORIGIN}`,
    "font-src 'self' https://fonts.gstatic.com",
    `connect-src ${connectSources.join(" ")}`,
    "media-src 'self'",
    "worker-src 'none'",
    "frame-src 'none'",
    "frame-ancestors 'none'",
    "form-action 'self'",
    "base-uri 'none'",
    "object-src 'none'",
    "manifest-src 'none'",
  ].join("; ");
}

export function cspReportOnlyEnvironment() {
  if (process.env.NODE_ENV === "development") {
    return { development: true };
  }
  if (process.env.VERCEL_ENV === "preview") {
    return { development: false };
  }
  return null;
}
