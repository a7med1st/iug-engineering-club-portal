import {
  del,
  get,
  head,
  put,
  type GetBlobResult,
  type HeadBlobResult,
  type PutCommandOptions,
} from "@vercel/blob";
import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, stat, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

export class BlobStorageConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BlobStorageConfigurationError";
  }
}

type BlobAuthOptions = Pick<PutCommandOptions, "oidcToken" | "storeId" | "token">;

export type StoredFileResult = {
  statusCode: number;
  stream: ReadableStream<Uint8Array> | null;
  blob: { contentType: string | null };
  headers: Headers;
};

function configuredValue(name: string) {
  const value = process.env[name]?.trim();
  return value || null;
}

function usesLocalStorage() {
  return configuredValue("FILE_STORAGE_DRIVER") === "local";
}

function requireLocalRoot() {
  const configured = configuredValue("LOCAL_STORAGE_ROOT");
  if (!configured || !path.isAbsolute(configured)) {
    throw new BlobStorageConfigurationError(
      "Local file storage requires an absolute LOCAL_STORAGE_ROOT path.",
    );
  }
  return path.resolve(configured);
}

function safeStoragePath(scope: "private" | "public", pathname: string) {
  if (
    !pathname ||
    pathname.includes("\\") ||
    pathname.includes("\0") ||
    path.posix.isAbsolute(pathname)
  ) {
    throw new Error("Invalid storage pathname.");
  }

  const segments = pathname.split("/");
  if (segments.some((segment) => !segment || segment === "." || segment === "..")) {
    throw new Error("Invalid storage pathname.");
  }

  const scopeRoot = path.join(requireLocalRoot(), scope);
  const target = path.resolve(scopeRoot, ...segments);
  if (!target.startsWith(`${scopeRoot}${path.sep}`)) {
    throw new Error("Invalid storage pathname.");
  }
  return target;
}

async function bodyBuffer(body: Buffer | Blob | File) {
  return Buffer.isBuffer(body) ? body : Buffer.from(await body.arrayBuffer());
}

async function putLocalFile(
  scope: "private" | "public",
  pathname: string,
  body: Buffer | Blob | File,
  contentType: string,
  allowOverwrite = false,
) {
  const target = safeStoragePath(scope, pathname);
  await mkdir(path.dirname(target), { recursive: true, mode: 0o700 });
  const temporary = `${target}.${randomUUID()}.tmp`;
  await writeFile(temporary, await bodyBuffer(body), { flag: "wx", mode: 0o600 });

  try {
    if (!allowOverwrite) {
      try {
        await stat(target);
        throw new Error("A file already exists at this storage pathname.");
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      }
    }
    await rename(temporary, target);
  } catch (error) {
    await unlink(temporary).catch(() => undefined);
    throw error;
  }

  return {
    pathname,
    contentType,
    url:
      scope === "public"
        ? `/uploads/${pathname.split("/").map(encodeURIComponent).join("/")}`
        : "",
  };
}

function mimeFromPathname(pathname: string) {
  const extension = path.extname(pathname).toLowerCase();
  return ({
    ".avif": "image/avif",
    ".gif": "image/gif",
    ".jpeg": "image/jpeg",
    ".jpg": "image/jpeg",
    ".png": "image/png",
    ".webp": "image/webp",
  } as Record<string, string>)[extension] ?? "application/octet-stream";
}

async function getLocalFile(
  scope: "private" | "public",
  pathname: string,
): Promise<StoredFileResult | null> {
  try {
    const target = safeStoragePath(scope, pathname);
    const [data, fileStat] = await Promise.all([readFile(target), stat(target)]);
    const headers = new Headers({
      "content-length": String(fileStat.size),
      "last-modified": fileStat.mtime.toUTCString(),
    });
    return {
      statusCode: 200,
      stream: new Blob([new Uint8Array(data)]).stream(),
      blob: { contentType: mimeFromPathname(pathname) },
      headers,
    };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
}

export function requirePublicStorage() {
  if (usesLocalStorage()) return requireLocalRoot();
  requirePublicBlobAuth();
  return "vercel-blob";
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
  if (configuredValue("NODE_ENV") === "development") {
    const localToken = configuredValue("BLOB_PRIVATE_READ_WRITE_TOKEN");
    if (localToken) return { token: localToken };

    // OIDC values copied into a local .env can be expired or request-scoped.
    // Local reads must use the existing explicit private-store fallback.
    throw new BlobStorageConfigurationError(
      "Private file reads in local development require BLOB_PRIVATE_READ_WRITE_TOKEN.",
    );
  }

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
  if (usesLocalStorage()) {
    return putLocalFile(
      "private",
      pathname,
      body,
      contentType,
      options?.allowOverwrite,
    );
  }
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
  if (usesLocalStorage()) {
    return putLocalFile("public", pathname, body, contentType);
  }
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
  options?: {
    abortSignal?: AbortSignal;
    useCache?: boolean;
  },
): Promise<GetBlobResult | StoredFileResult | null> {
  if (usesLocalStorage()) return getLocalFile("private", pathname);
  return get(pathname, {
    access: "private",
    abortSignal: options?.abortSignal,
    useCache: options?.useCache,
    ...requirePrivateBlobReadAuth(),
  });
}

export async function headPrivateBlob(pathname: string): Promise<HeadBlobResult> {
  if (usesLocalStorage()) {
    const target = safeStoragePath("private", pathname);
    const fileStat = await stat(target);
    return {
      pathname,
      url: "",
      downloadUrl: "",
      contentType: mimeFromPathname(pathname),
      contentDisposition: "attachment",
      size: fileStat.size,
      uploadedAt: fileStat.mtime,
      cacheControl: "private, no-store",
    } as HeadBlobResult;
  }
  return head(pathname, requirePrivateBlobReadAuth());
}

export async function getPublicBlob(pathname: string) {
  if (!usesLocalStorage()) return null;
  return getLocalFile("public", pathname);
}

export function logPrivateBlobReadError(options: {
  route: string;
  pathname: string;
  error: unknown;
  status?: number;
}) {
  console.error("Private blob read failed", {
    route: options.route,
    storageNamespace: options.pathname.startsWith("user-media/")
      ? "user-media"
      : "legacy-or-unknown",
    storeType: "private",
    errorName: options.error instanceof Error ? options.error.name : "UnknownError",
    status:
      options.status ??
      (options.error instanceof BlobStorageConfigurationError ? 503 : 500),
  });
}

export async function deletePrivateBlobs(
  pathnames: Array<string | null | undefined>,
) {
  const unique = [...new Set(pathnames.filter((value): value is string => Boolean(value)))];
  if (unique.length === 0) return;

  if (usesLocalStorage()) {
    await Promise.all(
      unique.map((pathname) =>
        unlink(safeStoragePath("private", pathname)).catch((error) => {
          if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
        }),
      ),
    );
    return;
  }

  await del(unique, requirePrivateBlobAuth());
}

export async function deletePublicBlobs(
  pathnames: Array<string | null | undefined>,
) {
  const unique = [...new Set(pathnames.filter((value): value is string => Boolean(value)))];
  if (unique.length === 0) return;

  if (usesLocalStorage()) {
    await Promise.all(
      unique.map((pathname) =>
        unlink(safeStoragePath("public", pathname)).catch((error) => {
          if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
        }),
      ),
    );
    return;
  }

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
