import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";

const source = fs.readFileSync(new URL("../app/admin/activities/[id]/documentation/actions.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
let denied, uploadFailure, dbFailure, imageCount, summary, created, cleanup, uploaded, permissions;
const reset = () => { denied = uploadFailure = dbFailure = false; imageCount = 0; summary = undefined; created = []; cleanup = []; uploaded = []; permissions = []; };
const tx = {
  $queryRaw: async () => [],
  activityImage: {
    aggregate: async () => ({ _max: { sortOrder: 4 } }),
    count: async () => imageCount,
    createMany: async ({ data }) => { if (dbFailure) throw Error("db"); created = data; },
  },
};
const mocks = {
  "next/cache": { revalidatePath() {} },
  "next/navigation": { redirect(url) { throw Object.assign(Error("redirect"), { url }); } },
  "@/lib/permissions": { PERMISSIONS: { ACTIVITY_MANAGE: "manage" }, requireActivityPermission: async (...args) => { permissions.push(args); if (denied) throw Error("denied"); return { user: { id: "admin" } }; } },
  "@/lib/prisma": { prisma: { activity: { update: async ({ data }) => { summary = data.postEventSummary; } }, $transaction: async (callback) => callback(tx) } },
  "@/lib/activity-image-storage": {
    ActivityImageStorageError: class extends Error {},
    uploadActivityImage: async (file) => { if (uploadFailure && uploaded.length === 1) throw Error("upload"); const image = { pathname: `gallery/${file.name}`, url: `https://example.test/${file.name}`, originalName: file.name, mime: file.type, size: file.size }; uploaded.push(image); return image; },
    tryDeleteActivityImages: async (paths) => { cleanup.push(...paths); },
  },
  "@/lib/upload-rate-limit": { UploadRateLimitError: class extends Error {}, enforceActivityUploadLimit: async () => {}, uploadRateLimitMessage: () => "limit" },
};
const exports = {};
vm.runInNewContext(compiled, { exports, require: (name) => { assert.ok(name in mocks, name); return mocks[name]; }, File, console });
const form = (count = 2, size = 10) => { const data = new FormData(); data.set("activityId", "activity"); for (let i = 0; i < count; i++) data.append("image", new File([new Uint8Array(size)], `${i}.png`, { type: "image/png" })); return data; };
const upload = async (data, expected) => { await assert.rejects(exports.uploadActivityGalleryImage(data), (error) => error.url?.includes(`?${expected}=`)); };

reset();
assert.equal((await exports.saveDocumentationSummary("activity", "  summary\ntext  ")).success, true);
assert.equal(summary, "summary\ntext");
assert.ok((await exports.saveDocumentationSummary("activity", "x".repeat(10001))).error);
assert.equal((await exports.saveDocumentationSummary("activity", " ")).success, true);
assert.equal(summary, null);
reset(); denied = true;
await assert.rejects(exports.saveDocumentationSummary("activity", "text"), /denied/);
assert.equal(summary, undefined);
await assert.rejects(exports.uploadActivityGalleryImage(form()), /denied/);
assert.equal(uploaded.length, 0);
reset(); await upload(form(), "success");
assert.deepEqual(Array.from(created, (image) => image.sortOrder), [5, 6]);
assert.equal(permissions[0][1], "activity");
reset(); await upload(form(4), "error"); assert.equal(uploaded.length, 0);
reset(); await upload(form(1, 4 * 1024 * 1024 + 1), "error"); assert.equal(uploaded.length, 0);
reset(); imageCount = 29; await upload(form(), "error"); assert.equal(created.length, 0); assert.equal(cleanup.length, 2);
reset(); dbFailure = true; await upload(form(), "error"); assert.equal(cleanup.length, 2);
reset(); uploadFailure = true; await upload(form(), "error"); assert.equal(cleanup.length, 1); assert.equal(created.length, 0);
console.log("Documentation actions: permissions, summary validation, batch order, limits and upload rollback passed.");
