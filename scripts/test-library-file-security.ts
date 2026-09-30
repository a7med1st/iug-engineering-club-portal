import assert from "node:assert/strict";
import { validateLibraryUpload } from "../lib/library/file-validation";
import { isPreviewableLibraryMime } from "../lib/library/file-response";

async function main() {
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
