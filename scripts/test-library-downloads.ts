import assert from "node:assert/strict";
import { createRequire } from "node:module";
import Module from "node:module";
import { gzipSync } from "node:zlib";

const require = createRequire(import.meta.url);
const loader = Module as unknown as { _load: (id: string, ...args: unknown[]) => unknown };
const originalLoad = loader._load;
const bytes = new TextEncoder().encode("%PDF-1.4\n" + "library download contents\n".repeat(100) + "%%EOF");
const file = {
  id: "file", title: "Lecture", originalName: "محاضرة الهندسة.pdf",
  storageKey: "library/test.pdf", mimeType: "application/pdf", folderId: "folder",
  departmentId: "department", folder: { courseId: "course", course: { departments: [{ departmentId: "department" }] } },
};
let role = "STUDENT";
let loggedIn = true;
let visible = true;
let storageError: Error | null = null;
let missing = false;
let compressed = true;
const mockPrisma = {
  libraryFile: { findFirst: async () => file, findUnique: async () => file },
  librarySubmission: { findUnique: async () => file },
  libraryFolder: { findMany: async () => [{ id: "folder", courseId: "course", parentId: null, name: "folder", sortOrder: 0, isVisible: visible }] },
};
loader._load = function (id, ...args) {
  if (id === "@/lib/auth") return { getCurrentUser: async () => loggedIn ? { user: {
    id: "user", role, departmentId: "department", managedDepartmentIds: [], memberPermissions: [], position: null,
  } } : null };
  if (id === "@/lib/prisma") return { prisma: mockPrisma };
  if (id === "@/lib/library/storage" || id === "./storage") return { readLibraryFile: async () => {
    if (storageError) throw storageError;
    if (missing) return null;
    return {
      statusCode: 200, stream: new Blob([bytes]).stream(), blob: { contentType: "application/pdf" },
      headers: new Headers({
        "content-type": "application/pdf",
        "content-length": String(compressed ? gzipSync(bytes).length : bytes.length),
        ...(compressed ? { "content-encoding": "gzip" } : {}),
        "connection": "keep-alive", "transfer-encoding": "chunked", "etag": "file-etag",
      }),
    };
  } };
  return originalLoad.call(this, id, ...args);
};

async function main() {
  const routes = [
    ["../app/library/files/[fileId]/route.ts", "STUDENT"],
    ["../app/member/library/files/[fileId]/route.ts", "MEMBER"],
    ["../app/admin/library/files/[fileId]/route.ts", "ADMIN"],
    ["../app/admin/library/submissions/[submissionId]/route.ts", "ADMIN"],
  ];
  for (const [path, userRole] of routes) {
    const { GET } = require(path);
    role = userRole;
    const context = { params: Promise.resolve({ fileId: "file", submissionId: "submission" }) };
    for (const encoding of [true, false]) {
      compressed = encoding;
      const response = await GET(new Request("https://club.test/file?download=1"), context);
      assert.equal(response.status, 200, path);
      assert.equal(response.headers.get("content-encoding"), null, `${path}: decoded body must not retain gzip header`);
      assert.equal(response.headers.get("transfer-encoding"), null, path);
      assert.equal(response.headers.get("connection"), null, path);
      assert.equal(response.headers.get("content-length"), encoding ? null : String(bytes.length), path);
      assert.match(response.headers.get("content-disposition") ?? "", /^attachment;.*filename\*=UTF-8''/);
      assert.equal(response.headers.get("cache-control"), "private, no-store");
      assert.deepEqual(new Uint8Array(await response.arrayBuffer()), bytes);
    }
    const preview = await GET(new Request("https://club.test/file"), context);
    assert.match(preview.headers.get("content-disposition") ?? "", /^inline;/);
    await preview.body?.cancel();
    missing = true;
    assert.equal((await GET(new Request("https://club.test/file"), context)).status, 404);
    missing = false;
    storageError = new Error("Storage service unavailable");
    assert.equal((await GET(new Request("https://club.test/file"), context)).status, 502);
    storageError = null;
    loggedIn = false;
    assert.ok([401, 404].includes((await GET(new Request("https://club.test/file"), context)).status));
    loggedIn = true;
    if (userRole !== "ADMIN") {
      visible = false;
      assert.equal((await GET(new Request("https://club.test/file"), context)).status, 404);
      visible = true;
    }
  }
  console.log("Library download route tests passed (student, member, admin, submissions).");
}
main().finally(() => { loader._load = originalLoad; }).catch((error) => { console.error(error); process.exitCode = 1; });
