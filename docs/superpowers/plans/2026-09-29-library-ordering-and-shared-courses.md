# Library Ordering And Shared Courses Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add folder/file up-down ordering and synchronized cross-department courses matched by normalized course code, while every member remains limited to their primary department.

**Architecture:** Replace direct course ownership with department-specific placement rows while keeping one canonical course and one shared folder/file tree. Centralize code normalization and adjacent-item ordering in pure/testable library modules, then adapt guards, queries, mutations, uploads, and all three library interfaces to resolve access through placements.

**Tech Stack:** Next.js 15 App Router, React 19 Server Components and Server Actions, TypeScript, Prisma 6, PostgreSQL, Node assertion scripts, CSS Modules, and Lucide icons.

**Spec:** `docs/superpowers/specs/2026-09-29-library-ordering-and-shared-courses-design.md`

## Global Constraints

- Every authenticated member with a primary department can create or attach a course in that department without `LIBRARY_MANAGE`.
- A non-empty normalized course code identifies one canonical synchronized course across departments; a missing code always creates an independent course.
- Shared content changes are immediately visible to every linked department, while level, semester, and course order remain placement-specific.
- Folder order is scoped to direct siblings; file order is scoped to one folder; links are not reorderable.
- Up/down controls appear only in admin/member management views and use normal server-action forms with stable mobile layout.
- Course, folder, file, link, upload, preview, download, and deletion authorization must derive department access through placements.
- Existing records must migrate without resetting the database or losing folders, files, links, or storage keys.
- Do not modify or commit unrelated `artifacts/` content.

## Review Focus

- Two concurrent attachments for the same course and department must produce one placement and a safe informational result; Task 4 tests the unique-conflict path.
- Codes containing mixed Arabic/ASCII whitespace, hyphens, underscores, or Latin case differences must resolve identically without altering other characters; Task 2 tests these variants.
- A member-submitted department ID must never override the member's primary department; Tasks 3 and 4 test server-derived scope.
- A move request for an item from another department, parent folder, or folder must not reorder anything; Task 5 tests authorization and strict sibling scopes.
- Deleting the last placement must retain database metadata when private-storage cleanup fails; Task 4 tests cleanup-before-delete behavior.

---

### Task 1: Shared-Course Schema And Non-Destructive Migration

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/20260929120000_share_library_courses_and_order_files/migration.sql`
- Modify: `scripts/test-library-schema.mjs`

**Interfaces:**
- Produces: `LibraryCourseDepartment` with composite ID `[courseId, departmentId]` and placement fields `level`, `semester`, `sortOrder`.
- Produces: nullable unique `LibraryCourse.normalizedCode` and `LibraryFile.sortOrder Int @default(0)`.

- [ ] **Step 1: Extend schema and migration contract tests**

Assert the join relations, composite key, department ordering index, nullable unique normalized code, file ordering field/index, and SQL ordering of placement backfill, duplicate merge, old-column removal, and constraints.

- [ ] **Step 2: Run the schema test and verify RED**

Run: `npm run test:library-schema`

Expected: FAIL because the shared placement model and file order do not exist.

- [ ] **Step 3: Add the Prisma models and migration**

Backfill one placement per existing course; normalize non-empty codes; choose the oldest `(createdAt, id)` duplicate as canonical; insert missing placements; reassign every duplicate folder to the canonical course; then delete duplicate courses and remove direct placement columns. Backfill file order deterministically by `(createdAt, id)` within each folder before adding the new index.

- [ ] **Step 4: Validate generated schema and migration contract**

Run: `npx prisma generate && npx prisma validate && npm run test:library-schema`

Expected: all commands pass.

- [ ] **Step 5: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/20260929120000_share_library_courses_and_order_files/migration.sql scripts/test-library-schema.mjs
git commit -m "Add shared library course placements"
```

### Task 2: Course-Code And Ordering Domain Utilities

**Files:**
- Create: `lib/library/course-code.ts`
- Create: `lib/library/ordering.ts`
- Create: `scripts/test-library-course-code.ts`
- Create: `scripts/test-library-ordering.ts`
- Modify: `package.json`

**Interfaces:**
- Produces: `normalizeLibraryCourseCode(value: unknown): string | null`.
- Produces: `orderedLibraryItems<T extends { id: string; sortOrder: number; createdAt?: Date }>(items: readonly T[]): T[]`.
- Produces: `libraryAdjacentSwap<T extends { id: string; sortOrder: number; createdAt?: Date }>(items: readonly T[], itemId: string, direction: "up" | "down"): { normalized: Array<{ id: string; sortOrder: number }>; swap: Array<{ id: string; sortOrder: number }> }`.

- [ ] **Step 1: Write failing normalization and ordering tests**

Test `" math 101 "`, `"MATH-101"`, and `"Math_101"` as `MATH101`; Arabic whitespace removal; null/blank independence; deterministic duplicate/sparse normalization; adjacent swaps; and first-up/last-down no-ops.

- [ ] **Step 2: Add scripts to `test:library` and verify RED**

Run: `npm run test:library-course-code && npm run test:library-ordering`

Expected: FAIL because the modules do not exist.

- [ ] **Step 3: Implement both pure utilities**

Normalization removes Unicode whitespace plus `-` and `_`, uppercases Latin through `toUpperCase()`, and returns null for an empty result. Ordering uses `sortOrder`, then `createdAt`, then `id`, and emits consecutive values for the entire supplied scope before the adjacent swap.

- [ ] **Step 4: Run focused tests and verify GREEN**

Run: `npm run test:library-course-code && npm run test:library-ordering && npm run test:library-domain`

Expected: all commands pass.

- [ ] **Step 5: Commit**

```bash
git add lib/library/course-code.ts lib/library/ordering.ts scripts/test-library-course-code.ts scripts/test-library-ordering.ts package.json
git commit -m "Add library sharing and ordering utilities"
```

### Task 3: Placement-Based Authorization And Queries

**Files:**
- Modify: `lib/library/authorization.ts`
- Modify: `lib/library/member.ts`
- Modify: `lib/library/student.ts`
- Modify: `lib/library/queries.ts`
- Modify: `scripts/test-library-permissions.ts`
- Modify: `scripts/test-library-selection.ts`

**Interfaces:**
- Produces: guarded course/folder/file/link resources with authorized `departmentId` derived from `departments.some(...)`.
- Produces: `resolveLibrarySelection` course entries combining canonical course data with the selected department's placement fields.
- Produces: student course access returning canonical course data plus the student's placement `level`, `semester`, and `sortOrder`.

- [ ] **Step 1: Write failing placement authorization and selection tests**

Cover global admins, scoped managers with one linked department, members whose primary department is linked/unlinked, students in linked/unlinked departments, and a forged member department ID that differs from the authenticated primary department.

- [ ] **Step 2: Run focused tests and verify RED**

Run: `npm run test:library-permissions && npm run test:library-selection`

Expected: FAIL because guards and queries still use `LibraryCourse.departmentId`.

- [ ] **Step 3: Rewrite guards through course placements**

Keep existing safe null/not-found behavior. Admin guards accept access when at least one placement department is manageable; member/student guards require a placement matching the server-derived primary department.

- [ ] **Step 4: Rewrite admin, member, and student course queries**

Query `LibraryCourseDepartment` for department lists and counts, select canonical course content, and expose placement metadata under stable flattened view types consumed by current pages.

- [ ] **Step 5: Run tests and type-check**

Run: `npm run test:library-permissions && npm run test:library-selection && npx tsc --noEmit --incremental false`

Expected: all commands pass.

- [ ] **Step 6: Commit**

```bash
git add lib/library/authorization.ts lib/library/member.ts lib/library/student.ts lib/library/queries.ts scripts/test-library-permissions.ts scripts/test-library-selection.ts
git commit -m "Authorize library resources through course placements"
```

### Task 4: Create, Match, Attach, Edit, And Detach Courses

**Files:**
- Create: `lib/library/courses.ts`
- Create: `app/api/library/course-match/route.ts`
- Modify: `lib/library/validation.ts`
- Modify: `app/admin/library/actions.ts`
- Modify: `app/member/library/actions.ts`
- Modify: `scripts/test-library-domain.ts`
- Modify: `scripts/test-library-actions.mjs`
- Modify: `scripts/test-library-routes.mjs`

**Interfaces:**
- Produces: `findLibraryCourseMatch(code: unknown): Promise<{ id: string; name: string; departments: string[] } | null>` returning only safe summary data.
- Produces: `createOrAttachLibraryCourse(input, departmentId, confirmExisting): Promise<{ courseId: string; attached: boolean }>` with transaction and unique-conflict handling.
- Produces: `createMemberCourseAction`, with department always taken from `requireMemberLibraryAccess().user.departmentId`.

- [ ] **Step 1: Write failing course workflow tests**

Cover no-code independent creation, unmatched-code creation, safe match preview, required explicit confirmation, existing attachment rejection, concurrent unique conflict, member primary-department enforcement, shared metadata update collision, ordinary detach, final-placement cleanup, and storage failure preserving metadata.

- [ ] **Step 2: Run workflow tests and verify RED**

Run: `npm run test:library-domain && npm run test:library-actions && npm run test:library-routes`

Expected: FAIL because match/attach and placement-aware mutation behavior do not exist.

- [ ] **Step 3: Implement transactional create-or-attach service and preview route**

Normalize and re-query by code inside the final transaction; ignore submitted course identity as authority; return only course name and department names from preview; map composite unique violations to the Arabic already-added response.

- [ ] **Step 4: Adapt admin and member actions**

Admin creation targets only an authorized selected department. Member creation uses only the authenticated primary department. Shared field edits update the canonical course; level/semester/order update only the selected placement; code collisions fail without merging.

- [ ] **Step 5: Implement placement deletion semantics**

Detach when another placement remains. For the final placement, list all storage keys, complete storage cleanup first, then delete the canonical course in a transaction; preserve metadata on cleanup failure.

- [ ] **Step 6: Run focused tests and type-check**

Run: `npm run test:library-domain && npm run test:library-actions && npm run test:library-routes && npx tsc --noEmit --incremental false`

Expected: all commands pass.

- [ ] **Step 7: Commit**

```bash
git add lib/library/courses.ts app/api/library/course-match/route.ts lib/library/validation.ts app/admin/library/actions.ts app/member/library/actions.ts scripts/test-library-domain.ts scripts/test-library-actions.mjs scripts/test-library-routes.mjs
git commit -m "Add synchronized shared course workflow"
```

### Task 5: Transactional Folder And File Ordering

**Files:**
- Modify: `app/admin/library/actions.ts`
- Modify: `app/member/library/actions.ts`
- Modify: `app/admin/library/upload/route.ts`
- Modify: `app/member/library/upload/route.ts`
- Modify: `scripts/test-library-actions.mjs`
- Modify: `scripts/test-library-file-security.ts`

**Interfaces:**
- Consumes: Task 2 `libraryAdjacentSwap` and Task 3 resource guards.
- Produces: `moveFolderAction`, `moveFileAction`, `moveMemberFolderAction`, and `moveMemberFileAction`, each accepting item ID plus `"up" | "down"`.
- Produces: new folder/file creation that appends `max(sortOrder) + 1` inside its exact scope.

- [ ] **Step 1: Write failing move and append tests**

Test direct-sibling folder scope, one-folder file scope, cross-department rejection, forged parent/folder isolation, boundary no-ops, sparse/duplicate normalization, member visibility rules, and appended orders for folder creation and multi-file upload.

- [ ] **Step 2: Run focused tests and verify RED**

Run: `npm run test:library-actions && npm run test:library-file-security`

Expected: FAIL because move actions and append ordering do not exist.

- [ ] **Step 3: Implement transactional move actions**

Load and authorize the item, derive `courseId + parentId` or `folderId` from the database, lock/update that scope in one Prisma transaction, normalize consecutive values, then apply only the adjacent swap.

- [ ] **Step 4: Append new folders and uploaded files**

Compute the next scoped order inside the metadata-creation transaction. Preserve upload cleanup behavior if storage succeeds but metadata creation fails; assign consecutive values to a multi-file request in request order.

- [ ] **Step 5: Run focused tests and type-check**

Run: `npm run test:library-actions && npm run test:library-file-security && npx tsc --noEmit --incremental false`

Expected: all commands pass.

- [ ] **Step 6: Commit**

```bash
git add app/admin/library/actions.ts app/member/library/actions.ts app/admin/library/upload/route.ts app/member/library/upload/route.ts scripts/test-library-actions.mjs scripts/test-library-file-security.ts
git commit -m "Add folder and file ordering actions"
```

### Task 6: Admin And Member Course Sharing Interfaces

**Files:**
- Create: `components/library/CourseCreateForm.tsx`
- Create: `components/library/CourseCreateForm.module.css`
- Modify: `components/admin/library/LibraryManager.tsx`
- Modify: `components/admin/library/LibraryManager.module.css`
- Modify: `app/member/library/page.tsx`
- Modify: `app/member/library/library.module.css`
- Modify: `scripts/test-library-ui.mjs`

**Interfaces:**
- Consumes: Task 4 safe match endpoint and create/attach actions.
- Produces: reusable create form that previews a normalized-code match and submits `confirmExisting=true` only after explicit confirmation.

- [ ] **Step 1: Write failing UI contract tests**

Assert both management pages render the create/attach form; member form has no authoritative department field; match summary names linked departments; shared course headers show a warning; attach confirmation is explicit; and edit/delete copy distinguishes shared detach from final deletion.

- [ ] **Step 2: Run UI tests and verify RED**

Run: `npm run test:library-ui`

Expected: FAIL because the member page lacks course creation and neither page supports matching.

- [ ] **Step 3: Build the reusable match-aware form**

Check on code blur and submit, debounce duplicate requests, show Arabic loading/error/match states, preserve entered placement metadata, and require a second confirmed submission when a match exists.

- [ ] **Step 4: Integrate admin and member course controls and notices**

Keep admin department selection, force member scope server-side, list linked department names on shared courses, and keep selection query parameters after success or validation failure.

- [ ] **Step 5: Add responsive styling**

Use the existing controls and spacing; ensure long department/course names wrap and dialogs/forms remain usable at mobile widths.

- [ ] **Step 6: Run tests and type-check**

Run: `npm run test:library-ui && npx tsc --noEmit --incremental false`

Expected: all commands pass.

- [ ] **Step 7: Commit**

```bash
git add components/library/CourseCreateForm.tsx components/library/CourseCreateForm.module.css components/admin/library/LibraryManager.tsx components/admin/library/LibraryManager.module.css app/member/library/page.tsx app/member/library/library.module.css scripts/test-library-ui.mjs
git commit -m "Add shared course controls to library management"
```

### Task 7: Folder And File Arrow Controls

**Files:**
- Create: `components/library/OrderButtons.tsx`
- Modify: `components/admin/library/LibraryManager.tsx`
- Modify: `components/admin/library/LibraryManager.module.css`
- Modify: `app/member/library/page.tsx`
- Modify: `app/member/library/library.module.css`
- Modify: `scripts/test-library-ui.mjs`

**Interfaces:**
- Consumes: Task 5 admin/member move actions.
- Produces: reusable `OrderButtons` with `ArrowUp`/`ArrowDown`, Arabic labels containing the item name, disabled boundaries, and hidden selection fields supplied by each page.

- [ ] **Step 1: Write failing arrow-control tests**

Assert every rendered folder and file receives both action forms, first/last disabled states are correct, labels include the item name, links receive no arrows, and department/course/folder selection fields are preserved.

- [ ] **Step 2: Run UI tests and verify RED**

Run: `npm run test:library-ui`

Expected: FAIL because arrows are not rendered.

- [ ] **Step 3: Implement and integrate `OrderButtons`**

Use Lucide icons, icon-only buttons with `title` and `aria-label`, fixed dimensions, and normal server-action forms. Render controls beside folder edit/delete controls and file actions in both management views.

- [ ] **Step 4: Stabilize desktop/mobile layout**

Keep actions grouped without overlapping names, allow controlled wrapping, and prevent hover/disabled states from resizing rows.

- [ ] **Step 5: Run tests and type-check**

Run: `npm run test:library-ui && npx tsc --noEmit --incremental false`

Expected: all commands pass.

- [ ] **Step 6: Commit**

```bash
git add components/library/OrderButtons.tsx components/admin/library/LibraryManager.tsx components/admin/library/LibraryManager.module.css app/member/library/page.tsx app/member/library/library.module.css scripts/test-library-ui.mjs
git commit -m "Add library folder and file order controls"
```

### Task 8: Student Display, Full Migration Check, And Browser Verification

**Files:**
- Modify: `app/library/page.tsx`
- Modify: `app/library/courses/[courseId]/page.tsx`
- Modify: `app/library/courses/[courseId]/folders/[folderId]/page.tsx`
- Modify: `app/library/files/[fileId]/route.ts`
- Modify: `app/admin/library/files/[fileId]/route.ts`
- Modify: `app/member/library/files/[fileId]/route.ts`
- Modify: `scripts/test-library-routes.mjs`
- Modify: `scripts/test-library-ui.mjs`

**Interfaces:**
- Consumes: placement-aware student access from Task 3 and saved order from Tasks 1/5.
- Produces: student lists ordered by placement, folders by `(sortOrder, name, id)`, and files by `(sortOrder, createdAt, title)` with no management controls.

- [ ] **Step 1: Write failing student display and file-route tests**

Assert linked-department course visibility/counts, placement-specific level/semester, shared-content visibility, saved folder/file order, no student arrows, and placement-based download/preview guards for all route variants.

- [ ] **Step 2: Run route/UI tests and verify RED**

Run: `npm run test:library-routes && npm run test:library-ui`

Expected: FAIL while pages and file routes still use direct course ownership or old file ordering.

- [ ] **Step 3: Update student pages and all file routes**

Query placements for department filtering and course counts; keep canonical content shared; use deterministic saved ordering; derive file authorization through the folder's course placements.

- [ ] **Step 4: Exercise the migration against a disposable database fixture**

Create two departments with duplicate normalized codes, nested folders, links, and files; apply the migration; verify one canonical course, both placements, intact parent trees/content/storage keys, and deterministic file order.

- [ ] **Step 5: Run the complete automated verification suite**

Run: `npx prisma generate && npx prisma validate && npx tsc --noEmit --incremental false && npm run test:library && git diff --check`

Expected: every command passes with no whitespace errors.

- [ ] **Step 6: Start the development server and verify in a browser**

Check `/admin/library`, `/member/library`, and `/library` at desktop and mobile widths. Exercise create-new, match-and-attach, synchronized content, nested folder arrows, file arrows, disabled boundaries, selection-preserving redirects, and console errors.

- [ ] **Step 7: Commit**

```bash
git add app/library/page.tsx app/library/courses/[courseId]/page.tsx app/library/courses/[courseId]/folders/[folderId]/page.tsx app/library/files/[fileId]/route.ts app/admin/library/files/[fileId]/route.ts app/member/library/files/[fileId]/route.ts scripts/test-library-routes.mjs scripts/test-library-ui.mjs
git commit -m "Complete shared ordered library experience"
```

- [ ] **Step 8: Perform final branch review and push**

Review the complete diff against the spec, repeat any affected focused tests, confirm `artifacts/` is untouched, then push the implementation commits only after all checks remain green.
