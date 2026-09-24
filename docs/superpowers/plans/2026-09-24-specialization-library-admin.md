# Specialization Library Admin Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the department-scoped administration experience for specialization-library courses, folders, and private files.

**Architecture:** A Server Component at `/admin/library` resolves authorized department, course, and folder selections from query parameters and loads only that branch. Server Actions handle metadata mutations, while dedicated authenticated Route Handlers upload and stream private files; small Client Components own dialogs, accordion behavior, and upload progress.

**Tech Stack:** Next.js 15 App Router, React 19, TypeScript, Prisma 6, PostgreSQL, Vercel Blob/local storage abstraction, CSS Modules, Lucide React.

**Spec:** `docs/superpowers/specs/2026-09-24-specialization-library-admin-design.md`

## Global Constraints

- This phase covers administration only; do not add student-facing pages or navigation.
- Add no user role and no parallel permission system.
- Use `LIBRARY_MANAGE` plus the existing managed-department checks on every server entry point.
- Store file metadata and private storage keys in PostgreSQL; never store binary content there.
- Allow PDF, DOCX, PPTX, XLSX, ZIP, JPEG, PNG, and WebP; maximum 25 MB per file and 10 files per request.
- Keep the current admin layout, global header, RTL behavior, and light/dark visual language intact.
- Never run `prisma migrate reset` and never push commits.

## Review Focus

- A member with `LIBRARY_MANAGE` but assigned to department A must receive no data and perform no mutation against department B.
- A submitted course/folder/file ID paired with a forged parent ID must be resolved through database relations, not trusted form fields.
- A renamed executable or malformed ZIP/Office document must be rejected even when its MIME type and extension claim an allowed format.
- Partial multi-file upload failure must clean up a newly stored blob if its database insert fails and report per-file outcomes.
- Missing blobs during delete must not preserve stale metadata, while other storage failures must be surfaced without pretending deletion succeeded.

---

### Task 1: Register The Library Permission

**Files:**
- Modify: `lib/permissions.ts`
- Modify: `app/admin/layout.tsx`
- Modify: `components/admin/AdminNavigation.tsx`
- Modify: `app/member/page.tsx`
- Test: `scripts/test-library-permissions.ts`
- Modify: `package.json`

**Interfaces:**
- Consumes: existing `hasPermission`, `canAccessDepartment`, `requireDepartmentPermission`, and member permission normalization.
- Produces: `PERMISSIONS.LIBRARY_MANAGE` and an assignable department-scoped permission visible in the existing member editor and admin navigation.

- [ ] **Step 1: Write the failing permission test**

Create `scripts/test-library-permissions.ts` with assertions that `LIBRARY_MANAGE` is recognized, retained by `normalizeMemberPermissions`, granted globally to `ADMIN` and club leadership, denied to an unassigned member, and combined with `canAccessDepartment` to deny another department.

```ts
import assert from "node:assert/strict";
import { PERMISSIONS, hasPermission, normalizeMemberPermissions, canAccessDepartment } from "../lib/permissions";

assert.equal(normalizeMemberPermissions([PERMISSIONS.LIBRARY_MANAGE]).includes(PERMISSIONS.LIBRARY_MANAGE), true);
assert.equal(hasPermission("ADMIN", PERMISSIONS.LIBRARY_MANAGE), true);
assert.equal(hasPermission("MEMBER", PERMISSIONS.LIBRARY_MANAGE, []), false);
assert.equal(hasPermission("MEMBER", PERMISSIONS.LIBRARY_MANAGE, [PERMISSIONS.LIBRARY_MANAGE]), true);
assert.equal(canAccessDepartment({ role: "MEMBER", departmentId: "a", managedDepartmentIds: ["a"], position: null }, "b"), false);
```

- [ ] **Step 2: Run the test and confirm it fails**

Run: `node --import tsx scripts/test-library-permissions.ts`

Expected: TypeScript/runtime failure because `LIBRARY_MANAGE` does not exist.

- [ ] **Step 3: Add the permission and navigation gates**

Add `LIBRARY_MANAGE` to `PERMISSIONS`, `MEMBER_PERMISSION_OPTIONS` with label `إدارة مكتبة التخصص` and scope `DEPARTMENT`, `DEPARTMENT_SCOPED_SET`, and `ADMIN_AREA_PERMISSIONS`. Add `/admin/library` to `allowedHrefs` when `hasPermission(...)` succeeds, add a `Library` Lucide navigation item, and expose the same destination from the member dashboard.

- [ ] **Step 4: Register and run the test**

Add `test:library-permissions` to `package.json`, run `npm run test:library-permissions`, and expect PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/permissions.ts app/admin/layout.tsx components/admin/AdminNavigation.tsx app/member/page.tsx scripts/test-library-permissions.ts package.json
git commit -m "feat: add specialization library permission"
```

### Task 2: Add The Prisma Library Schema

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/<timestamp>_add_specialization_library/migration.sql`
- Test: `scripts/test-library-schema.mjs`
- Modify: `package.json`

**Interfaces:**
- Produces: Prisma models `LibraryCourse`, `LibraryFolder`, and `LibraryFile`, plus `Department.libraryCourses`, `User.createdLibraryFolders`, and `User.uploadedLibraryFiles` relations.

- [ ] **Step 1: Write a schema contract test**

Create a script that reads `prisma/schema.prisma` and asserts the three models, required relations, unique `storageKey`, indexes, and cascade/set-null actions are present.

```js
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
const schema = await readFile(new URL("../prisma/schema.prisma", import.meta.url), "utf8");
for (const model of ["LibraryCourse", "LibraryFolder", "LibraryFile"]) assert.match(schema, new RegExp(`model ${model} \\{`));
assert.match(schema, /storageKey\s+String\s+@unique/);
```

- [ ] **Step 2: Run the contract test and confirm it fails**

Run: `node scripts/test-library-schema.mjs`

Expected: FAIL because the models are absent.

- [ ] **Step 3: Add models and reverse relations**

Implement the exact fields in the approved spec. Use named User relations `LibraryFolderCreator` and `LibraryFileUploader`, `onDelete: Cascade` down Department -> Course -> Folder -> File, and `onDelete: SetNull` for creator/uploader.

- [ ] **Step 4: Create a normal migration**

Run `npx prisma migrate dev --name add_specialization_library --create-only`. Inspect the SQL to confirm it creates only the three tables, foreign keys, unique constraint, and indexes; do not reset or apply destructive unrelated changes.

- [ ] **Step 5: Validate and test**

Add `test:library-schema`, then run `npm run test:library-schema` and `npx prisma validate`; expect both to pass.

- [ ] **Step 6: Commit**

```bash
git add prisma/schema.prisma prisma/migrations scripts/test-library-schema.mjs package.json
git commit -m "feat: add specialization library data model"
```

### Task 3: Implement Library Validation And Resource Authorization

**Files:**
- Create: `lib/library/constants.ts`
- Create: `lib/library/validation.ts`
- Create: `lib/library/authorization.ts`
- Test: `scripts/test-library-domain.ts`
- Modify: `package.json`

**Interfaces:**
- Produces: `LIBRARY_MAX_FILE_BYTES`, `LIBRARY_MAX_FILES`, `validateLibraryCourseInput`, `validateLibraryFolderInput`, `validateLibraryFileTitle`, `getManageableLibraryDepartments(user)`, `requireLibraryCourse(id)`, `requireLibraryFolder(id)`, and `requireLibraryFile(id)`.
- Authorization helpers return resources including the resolved `departmentId` and call `requireDepartmentPermission(PERMISSIONS.LIBRARY_MANAGE, departmentId)`.

- [ ] **Step 1: Write failing domain tests**

Cover levels `0`, `1`, `5`, and `6`; blank/overlong names; integer and negative sort order; optional code/description trimming; and forged department access using injected pure authorization predicates where database calls are not required.

- [ ] **Step 2: Run tests and confirm failure**

Run: `node --import tsx scripts/test-library-domain.ts`

Expected: module-not-found failure.

- [ ] **Step 3: Implement validation and scoped lookup helpers**

Use bounded constants for names and descriptions, return typed normalized values, and have each resource helper select its parent chain from Prisma before invoking the existing department permission guard. Never accept a department ID as proof of ownership.

- [ ] **Step 4: Run tests**

Register `test:library-domain`, run it, and expect PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/library scripts/test-library-domain.ts package.json
git commit -m "feat: add library validation and authorization"
```

### Task 4: Add Secure Library File Validation And Storage

**Files:**
- Create: `lib/library/file-validation.ts`
- Create: `lib/library/storage.ts`
- Test: `scripts/test-library-file-security.ts`
- Modify: `package.json`

**Interfaces:**
- Consumes: `putPrivateBlob`, `getPrivateBlob`, and `deletePrivateBlobs` from `lib/blob-storage.ts`.
- Produces: `validateLibraryUpload(file): Promise<ValidatedLibraryFile>`, `storeLibraryFile(validated)`, `readLibraryFile(storageKey)`, and `deleteLibraryFiles(storageKeys)`.

- [ ] **Step 1: Write failing security tests**

Construct valid minimal signatures/containers and assert acceptance for the allowlist. Assert rejection for empty files, files above 25 MB, extension/MIME mismatch, executable content renamed to `.pdf`, malformed ZIP/Office containers, traversal names, and unsupported SVG/HTML/JS files.

- [ ] **Step 2: Run tests and confirm failure**

Run: `node --import tsx scripts/test-library-file-security.ts`

Expected: module-not-found failure.

- [ ] **Step 3: Implement validators**

Reuse `sanitizeOriginalFilename`, `normalizeMime`, and image processing from `lib/upload-security.ts`. Validate PDF magic/end marker, image decoding through Sharp, and ZIP-based types by checking ZIP signatures plus required package entries (`word/document.xml`, `ppt/presentation.xml`, or `xl/workbook.xml`). Generic ZIP must have a valid ZIP header and end-of-central-directory marker. Generate keys as `library/<uuid><canonical-extension>`.

- [ ] **Step 4: Implement storage wrappers**

Keep wrappers narrow and private-storage-only. On put failure, return no metadata; on later database failure, callers can delete the returned storage key.

- [ ] **Step 5: Run security tests**

Register `test:library-file-security`, run it, and expect PASS.

- [ ] **Step 6: Commit**

```bash
git add lib/library scripts/test-library-file-security.ts package.json
git commit -m "feat: secure specialization library uploads"
```

### Task 5: Implement Course, Folder, And File Metadata Actions

**Files:**
- Create: `app/admin/library/actions.ts`
- Test: `scripts/test-library-actions.ts`
- Modify: `package.json`

**Interfaces:**
- Produces Server Actions: `createCourseAction`, `updateCourseAction`, `deleteCourseAction`, `createFolderAction`, `updateFolderAction`, `deleteFolderAction`, `updateFileTitleAction`, and `deleteFileAction`.
- Every action redirects back through a shared `libraryUrl(selection, feedback)` helper while preserving valid selection query parameters.

- [ ] **Step 1: Write failing action-contract tests**

Test extracted action input functions and verify by source contract that every exported mutation calls a scoped resource/department helper before Prisma mutation. Include a forged folder ID/course ID pairing and a file from another department.

- [ ] **Step 2: Run tests and confirm failure**

Run: `node --import tsx scripts/test-library-actions.ts`

Expected: module-not-found failure.

- [ ] **Step 3: Implement course and folder actions**

Parse and normalize FormData through Task 3 helpers, authorize through parent database relationships, mutate with Prisma, `revalidatePath("/admin/library")`, and redirect with Arabic success/error messages. Folder updates include `isVisible` and `sortOrder`.

- [ ] **Step 4: Implement deletion cleanup and file-title update**

For course/folder deletion, select all descendant `storageKey` values, delete private objects, then delete records. Treat missing objects as already deleted; return a visible error for other storage failures. File deletion follows the same rule for one key. No action reports success before cleanup and metadata deletion complete.

- [ ] **Step 5: Run tests**

Register `test:library-actions`, run it, and expect PASS.

- [ ] **Step 6: Commit**

```bash
git add app/admin/library/actions.ts scripts/test-library-actions.ts package.json
git commit -m "feat: add library management actions"
```

### Task 6: Add Upload, Preview, And Download Routes

**Files:**
- Create: `app/admin/library/upload/route.ts`
- Create: `app/admin/library/files/[fileId]/route.ts`
- Test: `scripts/test-library-routes.ts`
- Modify: `package.json`

**Interfaces:**
- Upload accepts multipart `folderId` and repeated `files`, returning `{ results: Array<{ name: string; ok: boolean; message?: string }> }`.
- File GET accepts `?download=1`; safe images/PDF use inline disposition otherwise, all other types and explicit downloads use attachment.

- [ ] **Step 1: Write failing route policy tests**

Assert unauthenticated requests fail, more than 10 files fail, another department's folder/file fails without leaking existence, each route invokes scoped lookup helpers, content disposition is sanitized, and a database insert failure triggers blob cleanup.

- [ ] **Step 2: Run tests and confirm failure**

Run: `node --import tsx scripts/test-library-routes.ts`

Expected: missing route/module failure.

- [ ] **Step 3: Implement multipart upload**

Authorize the folder before reading file bodies, enforce count, validate and store files one at a time, create metadata using `uploadedById`, and clean up any stored blob whose insert fails. Return HTTP 200 with per-file results when at least one file was processed and 400/401/403-safe equivalents for request-level failures.

- [ ] **Step 4: Implement authenticated file streaming**

Resolve the file and department through Task 3, read the private blob, forward safe length/range/content-type headers, set `Cache-Control: private, no-store`, and produce RFC 5987-safe content disposition. Return 404 for missing metadata/blob without exposing inaccessible files.

- [ ] **Step 5: Run tests**

Register `test:library-routes`, run it, and expect PASS.

- [ ] **Step 6: Commit**

```bash
git add app/admin/library/upload/route.ts app/admin/library/files scripts/test-library-routes.ts package.json
git commit -m "feat: add private library file routes"
```

### Task 7: Build The Server Page And Query Selection

**Files:**
- Create: `app/admin/library/page.tsx`
- Create: `app/admin/library/loading.tsx`
- Create: `lib/library/queries.ts`
- Test: `scripts/test-library-selection.ts`
- Modify: `package.json`

**Interfaces:**
- Produces `resolveLibrarySelection(user, searchParams)` returning `{ departments, selectedDepartment, coursesByLevel, selectedCourse, folders, selectedFolder, files }`.
- Consumes action forms and file URLs from Tasks 5 and 6.

- [ ] **Step 1: Write failing selection tests**

Test deterministic fallback for missing/invalid department, course, and folder IDs; a course not belonging to the selected department; empty departments; multi-department selection; and that file queries run only when a valid folder is selected.

- [ ] **Step 2: Run tests and confirm failure**

Run: `node --import tsx scripts/test-library-selection.ts`

Expected: module-not-found failure.

- [ ] **Step 3: Implement focused queries**

Fetch authorized departments first, courses and level counts only for the selected department, folders only for the selected course, and files only for the selected folder. Order by `sortOrder`, then stable name/creation keys.

- [ ] **Step 4: Implement the Server Component shell**

Render the page heading, conditional department selector, five-level navigation, course/folder/file empty states, and server-rendered data. Use `AdminFeedback` for query-string feedback and pass only serializable data to interactive components.

- [ ] **Step 5: Add loading UI and run tests**

Register and run `test:library-selection`; expect PASS. Confirm `page.tsx` has no `"use client"` directive.

- [ ] **Step 6: Commit**

```bash
git add app/admin/library/page.tsx app/admin/library/loading.tsx lib/library/queries.ts scripts/test-library-selection.ts package.json
git commit -m "feat: add specialization library admin page"
```

### Task 8: Add Interactive Controls And Responsive Styling

**Files:**
- Create: `components/admin/library/LibraryManager.tsx`
- Create: `components/admin/library/LibraryDialogs.tsx`
- Create: `components/admin/library/LibraryUploader.tsx`
- Create: `components/admin/library/LibraryManager.module.css`
- Modify: `app/admin/library/page.tsx`

**Interfaces:**
- `LibraryManager` receives serializable selected data and renders navigation/actions.
- `LibraryDialogs` submits Task 5 Server Actions with accessible native dialog semantics.
- `LibraryUploader` posts to Task 6 and reports progress/results per file before `router.refresh()`.

- [ ] **Step 1: Implement accessible dialogs and controls**

Use Lucide icons with Arabic tooltips/labels, focus restoration, Escape handling, explicit delete confirmations, and pending states via `useFormStatus`. Do not use `window.alert`.

- [ ] **Step 2: Implement drag-and-drop upload**

Validate the client-side count/size for immediate feedback while treating server validation as authoritative. Use `XMLHttpRequest.upload.onprogress` for request progress, list each selected filename, and display the route's per-file result.

- [ ] **Step 3: Implement responsive RTL styles**

Use a two-column desktop grid, compact tablet panel, mobile accordion/cards, `min-width: 0`, overflow-safe filenames, 8px-or-less radii, existing CSS variables/colors, dark-mode selectors already used by the project, and reduced-motion handling. Ensure no nested decorative cards or horizontal page scroll.

- [ ] **Step 4: Run static checks**

Run `npx tsc --noEmit` and `git diff --check`; fix all feature-related findings.

- [ ] **Step 5: Commit**

```bash
git add components/admin/library app/admin/library/page.tsx
git commit -m "feat: build specialization library admin interface"
```

### Task 9: Integrate Routes And Verify End To End

**Files:**
- Modify: `scripts/test-role-routes.mjs`
- Modify: `package.json`
- Modify only if needed by discovered integration defects: files created or changed in Tasks 1-8.

**Interfaces:**
- Produces a verified admin flow and adds library checks to the repository test suite.

- [ ] **Step 1: Extend route coverage**

Add `/admin/library` to admin routes, assert a student is redirected, and, when fixture data exists, test authenticated file streaming and cross-department denial. Add all library test scripts to `test:all` in dependency-safe order.

- [ ] **Step 2: Run focused tests**

Run:

```text
npm run test:library-permissions
npm run test:library-schema
npm run test:library-domain
npm run test:library-file-security
npm run test:library-actions
npm run test:library-routes
npm run test:library-selection
```

Expected: all PASS.

- [ ] **Step 3: Run required verification**

Run:

```text
npx prisma validate
npx tsc --noEmit
git diff --check
```

Expected: all exit 0.

- [ ] **Step 4: Start and visually verify the application**

Start `npm run dev` on an available port. Verify `/admin/library` at desktop and mobile widths in light and dark modes, check console errors, create/edit/delete dialogs, accordion behavior, long Arabic/file names, empty states, and absence of horizontal overflow.

- [ ] **Step 5: Manually verify security and storage**

As an authorized member, create a course/folder, upload valid files, preview/download, rename, hide/show, and delete. Repeat forged requests with another department's IDs and confirm denial. Upload unsupported/mismatched/oversized files and confirm rejection. Confirm the Blob/local private object exists while PostgreSQL contains metadata only.

- [ ] **Step 6: Run the full regression suite**

Run `npm run test:all`. Record any pre-existing or environment-dependent failures separately; fix regressions introduced by this feature.

- [ ] **Step 7: Commit final integration**

```bash
git add scripts/test-role-routes.mjs package.json
git commit -m "test: verify specialization library admin flow"
```

- [ ] **Step 8: Prepare the handoff**

Report created/modified files, models and migration, authorization path, private storage location, commands run with results, and exact manual test steps. Do not push.
