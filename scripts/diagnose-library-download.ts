import { PrismaClient } from "@prisma/client";
import { createHash } from "node:crypto";
import { SignJWT } from "jose";
import { getPrivateBlob } from "../lib/blob-storage";

const prisma = new PrismaClient();
const allFiles = process.argv.includes("--all");
const http = process.argv.includes("--http");
let failures = 0;

class DownloadCheckError extends Error {}

async function digest(stream: ReadableStream<Uint8Array>) {
  const reader = stream.getReader();
  const hash = createHash("sha256");
  let size = 0;
  try {
    for (;;) {
      const chunk = await reader.read();
      if (chunk.done) break;
      size += chunk.value.byteLength;
      hash.update(chunk.value);
    }
  } finally {
    reader.releaseLock();
  }
  return { size, hash: hash.digest("hex") };
}

async function main() {
  const admin = http ? await prisma.user.findFirst({
    where: { role: "ADMIN" },
    select: { id: true, email: true, name: true, role: true, sessionVersion: true },
  }) : null;
  let cookie = "";
  if (http) {
    if (!admin || !process.env.SESSION_SECRET) throw new Error("Authenticated HTTP verification requires an administrator and SESSION_SECRET.");
    const token = await new SignJWT({
      email: admin.email, name: admin.name, role: admin.role, sessionVersion: admin.sessionVersion,
    }).setProtectedHeader({ alg: "HS256" }).setSubject(admin.id)
      .setIssuer("iug-engineering-club-portal").setAudience("iug-engineering-club-web")
      .setIssuedAt().setExpirationTime("1h").sign(new TextEncoder().encode(process.env.SESSION_SECRET));
    cookie = `ec_session=${token}`;
  }

  let cursor: string | undefined;
  let checked = 0;
  do {
    const files = await prisma.libraryFile.findMany({
      select: { id: true, storageKey: true, size: true },
      orderBy: { id: "asc" }, take: allFiles ? 25 : 5,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });
    if (!files.length) break;
    for (const file of files) {
      checked++;
      try {
        const stored = await getPrivateBlob(file.storageKey, { useCache: false, abortSignal: AbortSignal.timeout(120000) });
        if (!stored?.stream) throw new DownloadCheckError("Stored file not found");
        const expected = await digest(stored.stream);
        if (expected.size !== file.size) throw new DownloadCheckError("Stored file size does not match database");
        if (http) {
          const response = await fetch(`http://127.0.0.1:3000/admin/library/files/${encodeURIComponent(file.id)}?download=1`, {
            headers: { cookie }, redirect: "manual", signal: AbortSignal.timeout(120000),
          });
          if (response.status !== 200 || !response.body) {
            await response.body?.cancel();
            throw new DownloadCheckError(`Download HTTP ${response.status}`);
          }
          if (!response.headers.get("content-disposition")?.startsWith("attachment;")) throw new DownloadCheckError("Missing attachment header");
          const actual = await digest(response.body);
          if (actual.size !== expected.size || actual.hash !== expected.hash) throw new DownloadCheckError("Downloaded bytes do not match storage");
        }
        console.log(`PASS library file ${file.id}: ${expected.size} bytes${http ? ", authenticated HTTP download matches storage" : ""}`);
      } catch (error) {
        failures++;
        // Avoid logging credentials, file contents, names, or raw SDK messages.
        console.log(`FAIL library file ${file.id}: ${error instanceof DownloadCheckError ? error.message : error instanceof Error ? error.name : "UnknownError"}`);
      }
    }
    cursor = files[files.length - 1].id;
  } while (allFiles);
  console.log(`Library verification: ${checked} checked, ${failures} failed.`);
  if (failures) process.exitCode = 1;
}
main().finally(() => prisma.$disconnect()).catch((error) => {
  console.error(`Library verification could not run: ${error instanceof Error ? error.name : "UnknownError"}`);
  process.exitCode = 1;
});
