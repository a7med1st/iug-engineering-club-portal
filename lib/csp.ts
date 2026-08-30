export const CSP_HEADER =
  "Content-Security-Policy";

export const CSP_REPORT_ONLY_HEADER =
  "Content-Security-Policy-Report-Only";

const PUBLIC_BLOB_HOSTNAME_PATTERN =
  /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.public\.blob\.vercel-storage\.com$/;

export function normalizePublicBlobOrigin(value: string | null | undefined) {
  const configured = value?.trim();
  if (!configured) return null;

  try {
    const url = new URL(configured);

    if (
      url.protocol !== "https:" ||
      url.origin !== configured ||
      url.username ||
      url.password ||
      url.port ||
      !PUBLIC_BLOB_HOSTNAME_PATTERN.test(url.hostname)
    ) {
      return null;
    }

    return url.origin;
  } catch {
    return null;
  }
}

export function configuredPublicBlobOrigin() {
  return normalizePublicBlobOrigin(process.env.BLOB_PUBLIC_ORIGIN);
}

export function createCspNonce() {
  return crypto.randomUUID();
}

export function buildCspPolicy(
  nonce: string,
  options: {
    development: boolean;
    publicBlobOrigin?: string | null;
  },
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
  const publicBlobOrigin = normalizePublicBlobOrigin(
    options.publicBlobOrigin,
  );
  const imageSources = [
    "'self'",
    "data:",
    "blob:",
    ...(publicBlobOrigin ? [publicBlobOrigin] : []),
  ];

  return [
    "default-src 'self'",
    `script-src ${scriptSources.join(" ")}`,
    `style-src 'self' 'nonce-${nonce}' https://fonts.googleapis.com`,
    "style-src-attr 'unsafe-inline'",
    `img-src ${imageSources.join(" ")}`,
    "font-src 'self' https://fonts.gstatic.com",
    `connect-src ${connectSources.join(" ")}`,
    "media-src 'self' blob:",
    "worker-src 'none'",
    "frame-src 'none'",
    "frame-ancestors 'none'",
    "form-action 'self'",
    "base-uri 'none'",
    "object-src 'none'",
    "manifest-src 'none'",
  ].join("; ");
}

export function cspEnvironment() {
  if (process.env.NODE_ENV === "development") {
    return {
      development: true,
      header: CSP_REPORT_ONLY_HEADER,
    };
  }
  if (process.env.VERCEL_ENV === "preview") {
    return {
      development: false,
      header: CSP_HEADER,
    };
  }
  return null;
}
