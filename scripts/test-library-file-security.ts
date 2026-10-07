import assert from "node:assert/strict";
import { LIBRARY_MAX_FILE_BYTES } from "../lib/library/constants";
import { validateLibraryUpload } from "../lib/library/file-validation";
import { isPreviewableLibraryMime } from "../lib/library/file-response";
import { safeContentDisposition } from "../lib/private-file-response";

async function main() {
  for (const name of ["ملخص المحاضرة.pdf", "工程📚.pdf", 'notes"\r\n.pdf']) {
    for (const mode of ["inline", "attachment"] as const) {
      const value = safeContentDisposition(name, mode);
      const response = new Response("test", {
        headers: { "content-disposition": value },
      });
      assert.equal(response.status, 200);
      assert.match(value, /^[\x20-\x7e]+$/);
      assert.ok(value.startsWith(mode + ";"));
      assert.ok(value.includes("filename*=UTF-8''" + encodeURIComponent(name)));
    }
  }
  assert.ok(LIBRARY_MAX_FILE_BYTES > 50 * 1024 * 1024, "Library uploads must allow files larger than 50MB.");
  const pdfBytes = new TextEncoder().encode("%PDF-1.4\nbody\n%%EOF");
  const valid = await validateLibraryUpload(new File([pdfBytes], "final.pdf", { type: "application/pdf" }));
  assert.equal(valid.mime, "application/pdf");
  assert.match(valid.storageKey, /^library\/[0-9a-f-]+\.pdf$/);
  await assert.rejects(() => validateLibraryUpload(new File([pdfBytes], "final.exe", { type: "application/pdf" })));
  await assert.rejects(() => validateLibraryUpload(new File([new TextEncoder().encode("MZ")], "fake.pdf", { type: "application/pdf" })));
  const legacyWord = await validateLibraryUpload(new File([new Uint8Array([1, 2, 3])], "notes.doc", { type: "application/msword" }));
  assert.equal(legacyWord.mime, "application/msword");
  assert.match(legacyWord.storageKey, /^library\/[0-9a-f-]+\.doc$/);
  const unknown = await validateLibraryUpload(new File([new Uint8Array([4, 5, 6])], "diagram.cad", { type: "" }));
  assert.equal(unknown.mime, "application/octet-stream");
  assert.match(unknown.storageKey, /^library\/[0-9a-f-]+\.cad$/);
  assert.equal(isPreviewableLibraryMime("application/pdf"), true);
  assert.equal(isPreviewableLibraryMime("image/png"), true);
  assert.equal(isPreviewableLibraryMime("image/svg+xml"), false);
  assert.equal(isPreviewableLibraryMime("text/html"), false);
  console.log("Library file security tests passed.");
}

void main();
