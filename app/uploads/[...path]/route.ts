import { getPublicBlob } from "@/lib/blob-storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PUBLIC_IMAGE_PATH =
  /^activity-images\/[a-zA-Z0-9_-]+\/(?:cover|gallery)\/[a-f0-9-]+\.(?:avif|gif|jpe?g|png|webp)$/i;

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const pathname = (await params).path.join("/");
  if (!PUBLIC_IMAGE_PATH.test(pathname)) {
    return new Response("Not found", { status: 404 });
  }

  const result = await getPublicBlob(pathname);
  if (!result?.stream || result.statusCode !== 200) {
    return new Response("Not found", { status: 404 });
  }

  const headers = new Headers({
    "Content-Type": result.blob.contentType || "application/octet-stream",
    "Cache-Control": "public, max-age=31536000, immutable",
    "X-Content-Type-Options": "nosniff",
  });
  for (const name of ["content-length", "last-modified"] as const) {
    const value = result.headers.get(name);
    if (value) headers.set(name, value);
  }
  return new Response(result.stream, { status: 200, headers });
}
