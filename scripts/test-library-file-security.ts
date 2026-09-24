import assert from "node:assert/strict";
import { validateLibraryUpload } from "../lib/library/file-validation";

async function main() {
  const pdfBytes = new TextEncoder().encode("%PDF-1.4\nbody\n%%EOF");
  const valid = await validateLibraryUpload(new File([pdfBytes], "final.pdf", { type: "application/pdf" }));
  assert.equal(valid.mime, "application/pdf");
  assert.match(valid.storageKey, /^library\/[0-9a-f-]+\.pdf$/);
  await assert.rejects(() => validateLibraryUpload(new File([pdfBytes], "final.exe", { type: "application/pdf" })));
  await assert.rejects(() => validateLibraryUpload(new File([new TextEncoder().encode("MZ")], "fake.pdf", { type: "application/pdf" })));
  await assert.rejects(() => validateLibraryUpload(new File([pdfBytes], "x.svg", { type: "image/svg+xml" })));
  console.log("Library file security tests passed.");
}

void main();
