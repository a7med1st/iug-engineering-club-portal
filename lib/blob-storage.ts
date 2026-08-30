import {
  del,
  get,
  head,
  put,
  type GetBlobResult,
  type HeadBlobResult,
  type PutCommandOptions,
} from "@vercel/blob";

export class BlobStorageConfigurationError extends Error {}

type BlobAuthOptions = Pick<PutCommandOptions, "oidcToken" | "storeId" | "token">;

function configuredValue(name: string) {
  const value = process.env[name]?.trim();
  return value || null;
}

function requireBlobAuth(options: {
  label: "Private" | "Public";
  storeIdVariable: "BLOB_PRIVATE_STORE_ID" | "BLOB_PUBLIC_STORE_ID";
  tokenVariables: string[];
}): BlobAuthOptions {
  const storeId = configuredValue(options.storeIdVariable);
  const hasOidcToken = Boolean(configuredValue("VERCEL_OIDC_TOKEN"));
  const isVercelRuntime = configuredValue("VERCEL") === "1";

  if (storeId && (hasOidcToken || isVercelRuntime)) {
    // @vercel/blob resolves the current request-scoped OIDC token itself. Do
    // not pass a read-write token as well because an explicit token wins over
    // OIDC in the SDK.
    return { storeId };
  }

  for (const variable of options.tokenVariables) {
    const token = configuredValue(variable);
    if (token) return { token };
  }

  throw new BlobStorageConfigurationError(
    `${options.label} file storage is not configured. Set VERCEL_OIDC_TOKEN with ` +
      `${options.storeIdVariable}, or provide ${options.tokenVariables.join(" or ")} as a local fallback.`,
  );
}

export function requirePrivateBlobAuth() {
  return requireBlobAuth({
    label: "Private",
    storeIdVariable: "BLOB_PRIVATE_STORE_ID",
    tokenVariables: ["BLOB_PRIVATE_READ_WRITE_TOKEN"],
  });
}

export function requirePublicBlobAuth() {
  return requireBlobAuth({
    label: "Public",
    storeIdVariable: "BLOB_PUBLIC_STORE_ID",
    tokenVariables: ["BLOB_PUBLIC_READ_WRITE_TOKEN", "BLOB_READ_WRITE_TOKEN"],
  });
}

export function requirePrivateBlobReadAuth(): BlobAuthOptions {
  const auth = requirePrivateBlobAuth();
  const oidcToken = configuredValue("VERCEL_OIDC_TOKEN");

  // get() accepts storeId + oidcToken explicitly in @vercel/blob@2.8.0.
  // Read the rotating environment value on every call rather than caching it.
  if ("storeId" in auth && auth.storeId && oidcToken) {
    return { storeId: auth.storeId, oidcToken };
  }

  return auth;
}

export async function putPrivateBlob(
  pathname: string,
  body: Buffer | Blob | File,
  contentType: string,
  options?: { allowOverwrite?: boolean },
) {
  return put(pathname, body, {
    access: "private",
    addRandomSuffix: false,
    allowOverwrite: options?.allowOverwrite,
    contentType,
    ...requirePrivateBlobAuth(),
  });
}

export async function putPublicBlob(
  pathname: string,
  body: Buffer | Blob | File,
  contentType: string,
  cacheControlMaxAge?: number,
) {
  return put(pathname, body, {
    access: "public",
    addRandomSuffix: false,
    contentType,
    cacheControlMaxAge,
    ...requirePublicBlobAuth(),
  });
}

export async function getPrivateBlob(
  pathname: string,
): Promise<GetBlobResult | null> {
  return get(pathname, {
    access: "private",
    ...requirePrivateBlobReadAuth(),
  });
}

export async function headPrivateBlob(pathname: string): Promise<HeadBlobResult> {
  return head(pathname, requirePrivateBlobReadAuth());
}

export function logPrivateBlobReadError(options: {
  route: string;
  pathname: string;
  error: unknown;
  status?: number;
}) {
  console.error("Private blob read failed", {
    route: options.route,
    pathname: options.pathname,
    storeType: "private",
    errorName: options.error instanceof Error ? options.error.name : "UnknownError",
    status: options.status ?? 500,
  });
}

export async function deletePrivateBlobs(
  pathnames: Array<string | null | undefined>,
) {
  const unique = [...new Set(pathnames.filter((value): value is string => Boolean(value)))];
  if (unique.length === 0) return;

  await del(unique, requirePrivateBlobAuth());
}

export async function deletePublicBlobs(
  pathnames: Array<string | null | undefined>,
) {
  const unique = [...new Set(pathnames.filter((value): value is string => Boolean(value)))];
  if (unique.length === 0) return;

  await del(unique, requirePublicBlobAuth());
}

export async function tryDeletePrivateBlobs(
  pathnames: Array<string | null | undefined>,
  context: string,
) {
  try {
    await deletePrivateBlobs(pathnames);
  } catch (error) {
    console.error("Private blob cleanup failed", {
      context,
      count: pathnames.filter(Boolean).length,
      errorName: error instanceof Error ? error.name : "UnknownError",
    });
  }
}

export async function tryDeletePublicBlobs(
  pathnames: Array<string | null | undefined>,
  context: string,
) {
  try {
    await deletePublicBlobs(pathnames);
  } catch (error) {
    console.error("Public blob cleanup failed", {
      context,
      count: pathnames.filter(Boolean).length,
      errorName: error instanceof Error ? error.name : "UnknownError",
    });
  }
}

export function isVercelBlobUrl(value: string) {
  try {
    const url = new URL(value);
    return (
      url.protocol === "https:" &&
      (url.hostname.endsWith(".blob.vercel-storage.com") ||
        url.hostname === "blob.vercel-storage.com")
    );
  } catch {
    return false;
  }
}
