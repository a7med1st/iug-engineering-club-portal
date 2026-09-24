import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
const confirm = await readFile(new URL("../components/admin/library/ConfirmDeleteButton.tsx", import.meta.url), "utf8");
assert.match(confirm, /<dialog/);
assert.match(confirm, /showModal/);
assert.match(confirm, /إلغاء/);
assert.match(confirm, /تأكيد الحذف/);
console.log("Library UI contract tests passed.");
