# Nested Library Folders Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add unlimited nested folders to the specialization library across admin, member, and student flows while preserving department scope, visibility, and private-file cleanup.

**Architecture:** Add an adjacency-list self-relation to `LibraryFolder`, then centralize pure tree traversal in `lib/library/tree.ts`. Existing routes continue to identify the current course and folder by ID; each interface queries a course-scoped folder set, resolves direct children and breadcrumbs, and applies its existing authorization rules.

**Tech Stack:** Next.js 15 App Router, React 19 Server Components and Server Actions, TypeScript, Prisma 6, PostgreSQL, Node assertion scripts, existing CSS Modules and Lucide icons.

**Spec:** `docs/superpowers/specs/2026-09-29-nested-library-folders-design.md`

## Global Constraints

- Folder nesting has unlimited depth.
- A child folder must belong to the same course as its parent.
- Members remain limited to their primary department and visible folder branches.
- Students may access a folder only when it and every ancestor are visible.
- Existing folders migrate as root folders with `parentId = null`.
- Moving folders and drag-and-drop reordering are out of scope.
- Recursive deletion must remove every descendant file from private storage before database cascade deletion.
- Do not modify or commit unrelated `artifacts/` content.

## Review Focus

- A valid-looking parent ID from another course must be rejected by both admin and member creation actions; Task 3 tests this authorization boundary.
- A visible descendant below a hidden ancestor must remain inaccessible to students and members; Tasks 5 and 6 test the full ancestor chain.
- Malformed cyclic ancestry must terminate safely instead of hanging a request; Task 2 tests cycle detection.
- Deleting a deep folder must include storage keys attached at every descendant depth; Task 3 tests subtree collection and cleanup inputs.
- Deep breadcrumbs and child lists must remain course-scoped even when IDs from another course are supplied; Tasks 2, 4, 5, and 6 test course filtering.

---

### Task 1: Prisma Self-Relation And Migration

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/20260929000000_add_nested_library_folders/migration.sql`
- Modify: `scripts/test-library-schema.mjs`

**Interfaces:**
- Produces: `LibraryFolder.parentId`, `LibraryFolder.parent`, and `LibraryFolder.children` with a named self-relation and cascading child deletion.

- [ ] **Step 1: Extend the schema contract test**

Assert that `LibraryFolder` contains nullable `parentId`, named `parent` and `children` relations, `onDelete: Cascade`, and `@@index([courseId, parentId, sortOrder])`; assert the migration adds the nullable column, index, and self-referencing foreign key.

- [ ] **Step 2: Run the schema test and verify RED**

Run: `npm run test:library-schema`

Expected: FAIL because the self-relation and migration do not exist.

- [ ] **Step 3: Add the Prisma relation and non-destructive migration**

Use relation name `LibraryFolderTree`; keep `parentId` nullable so existing rows remain roots. Replace the old course/sort index only if the new composite index fully covers its query prefix.

- [ ] **Step 4: Generate and validate Prisma, then verify GREEN**

Run: `npx prisma generate && npx prisma validate && npm run test:library-schema`

Expected: Prisma generation and validation succeed; schema test passes.

- [ ] **Step 5: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/20260929000000_add_nested_library_folders/migration.sql scripts/test-library-schema.mjs
git commit -m "Add nested library folder schema"
```

### Task 2: Course-Scoped Tree Utilities

**Files:**
- Create: `lib/library/tree.ts`
- Create: `scripts/test-library-tree.ts`
- Modify: `package.json`

**Interfaces:**
- Produces: `type LibraryFolderNode = { id: string; courseId: string; parentId: string | null; name: string; sortOrder: number; isVisible: boolean }`.
- Produces: `directLibraryChildren(folders: readonly LibraryFolderNode[], parentId: string | null): LibraryFolderNode[]`.
- Produces: `libraryFolderBreadcrumb(folders: readonly LibraryFolderNode[], folderId: string): LibraryFolderNode[] | null`.
- Produces: `libraryFolderDescendantIds(folders: readonly LibraryFolderNode[], folderId: string): string[] | null`.
- Produces: `isVisibleLibraryFolderPath(folders: readonly LibraryFolderNode[], folderId: string): boolean`.

- [ ] **Step 1: Write tree behavior tests**

Test ordered root and direct-child selection, a three-level breadcrumb, deep descendant collection, rejection of cross-course ancestry, cycle-safe null results, and false visibility when any ancestor is hidden.

- [ ] **Step 2: Add `test:library-tree` and run it to verify RED**

Run: `npm run test:library-tree`

Expected: FAIL because `lib/library/tree.ts` does not exist.

- [ ] **Step 3: Implement the pure tree functions**

Build ID maps and parent-to-child maps once per call. Sort by `sortOrder`, then `name`, then `id`; track visited IDs for ancestor and descendant traversal and return `null` on cycles or broken/cross-course chains.

- [ ] **Step 4: Run tests and verify GREEN**

Run: `npm run test:library-tree && npm run test:library-domain`

Expected: both commands pass.

- [ ] **Step 5: Commit**

```bash
git add lib/library/tree.ts scripts/test-library-tree.ts package.json
git commit -m "Add library folder tree utilities"
```

### Task 3: Nested Creation And Recursive Deletion

**Files:**
- Modify: `app/admin/library/actions.ts`
- Modify: `app/member/library/actions.ts`
- Modify: `lib/library/authorization.ts`
- Modify: `lib/library/member.ts`
- Modify: `scripts/test-library-actions.mjs`

**Interfaces:**
- Consumes: Task 1 `parentId`; Task 2 `libraryFolderDescendantIds`.
- Produces: admin and member folder creation accepting optional `parentId` after same-course authorization.
- Produces: folder deletion that enumerates all descendant storage keys before deleting the root record.

- [ ] **Step 1: Extend action tests for nested behavior**

Add executable or contract assertions proving both creation actions validate a submitted parent through their guarded folder lookup and compare `parent.courseId` with the guarded course. Add a deletion test fixture where files exist on a child and grandchild and assert every storage key is passed to cleanup.

- [ ] **Step 2: Run action tests and verify RED**

Run: `npm run test:library-actions`

Expected: FAIL because actions neither persist validated parents nor collect descendant files.

- [ ] **Step 3: Implement parent validation and recursive cleanup**

Keep the existing resource guards as the authorization source. Query all `{ id, courseId, parentId }` records for the guarded course, use Task 2 for subtree IDs, fetch files with `folderId: { in: subtreeIds }`, delete storage objects, then delete the root folder.

- [ ] **Step 4: Preserve parent selection in redirects**

After child creation redirect to the new child; after deletion redirect to the deleted folder's parent or course root. Preserve department and course query parameters.

- [ ] **Step 5: Run focused tests and verify GREEN**

Run: `npm run test:library-actions && npm run test:library-permissions && npx tsc --noEmit --incremental false`

Expected: all commands pass.

- [ ] **Step 6: Commit**

```bash
git add app/admin/library/actions.ts app/member/library/actions.ts lib/library/authorization.ts lib/library/member.ts scripts/test-library-actions.mjs
git commit -m "Support nested library folder mutations"
```

### Task 4: Admin Nested-Folder Interface

**Files:**
- Modify: `lib/library/queries.ts`
- Modify: `components/admin/library/LibraryManager.tsx`
- Modify: `components/admin/library/LibraryManager.module.css`
- Modify: `scripts/test-library-selection.ts`
- Modify: `scripts/test-library-ui.mjs`

**Interfaces:**
- Consumes: Task 2 direct children and breadcrumb utilities.
- Produces: `resolveLibrarySelection` data containing `folderBreadcrumb`, direct `folders`, and the selected folder's links/files.

- [ ] **Step 1: Write failing selection and UI tests**

Test that selecting a deep folder returns only its direct children and complete breadcrumb, while no folder selected returns roots. Add UI contract assertions for breadcrumb links, child creation carrying `parentId`, and a parent-level return target.

- [ ] **Step 2: Run tests and verify RED**

Run: `npm run test:library-selection && npm run test:library-ui`

Expected: FAIL because selection is flat and the admin UI has no nested controls.

- [ ] **Step 3: Update selection queries**

Load course-scoped folder summaries once, validate the requested folder belongs to that course, derive roots or direct children, and derive the breadcrumb. Query links and files only for the selected folder.

- [ ] **Step 4: Update the admin interface**

Render the breadcrumb above child folders, label the creation control according to the current location, submit current `parentId`, and keep existing edit/delete/file/link controls for the selected folder.

- [ ] **Step 5: Add responsive breadcrumb and child-grid styling**

Use the existing visual tokens and keep labels wrapping without horizontal overflow at mobile widths.

- [ ] **Step 6: Run tests and verify GREEN**

Run: `npm run test:library-selection && npm run test:library-ui && npx tsc --noEmit --incremental false`

Expected: all commands pass.

- [ ] **Step 7: Commit**

```bash
git add lib/library/queries.ts components/admin/library/LibraryManager.tsx components/admin/library/LibraryManager.module.css scripts/test-library-selection.ts scripts/test-library-ui.mjs
git commit -m "Add nested folder navigation to library admin"
```

### Task 5: Member Nested-Folder Interface And Guards

**Files:**
- Modify: `app/member/library/page.tsx`
- Modify: `app/member/library/library.module.css`
- Modify: `lib/library/member.ts`
- Modify: `scripts/test-library-routes.mjs`

**Interfaces:**
- Consumes: Task 2 breadcrumb, child, and visible-path utilities; Task 3 nested member action.
- Produces: member navigation limited to visible branches in the member's primary department.

- [ ] **Step 1: Write failing member route/UI contract tests**

Assert that the member page renders breadcrumb navigation, submits the current folder as `parentId`, lists only direct children, and checks full-path visibility before granting folder access.

- [ ] **Step 2: Run route tests and verify RED**

Run: `npm run test:library-routes`

Expected: FAIL because the member flow still queries a flat folder list.

- [ ] **Step 3: Implement visible nested member navigation**

Load only folders from the selected course, validate the selected folder's complete visible path, derive direct visible children, and keep files, links, uploads, and additions attached to the selected folder.

- [ ] **Step 4: Update member layout styles**

Add a wrapping breadcrumb and stable nested-folder grid using existing member-library colors and controls.

- [ ] **Step 5: Run tests and verify GREEN**

Run: `npm run test:library-routes && npm run test:library-permissions && npx tsc --noEmit --incremental false`

Expected: all commands pass.

- [ ] **Step 6: Commit**

```bash
git add app/member/library/page.tsx app/member/library/library.module.css lib/library/member.ts scripts/test-library-routes.mjs
git commit -m "Add nested folder navigation for members"
```

### Task 6: Student Browsing, End-To-End Verification, And Push

**Files:**
- Modify: `lib/library/student.ts`
- Modify: `app/library/courses/[courseId]/page.tsx`
- Modify: `app/library/courses/[courseId]/folders/[folderId]/page.tsx`
- Modify: `app/library/library.module.css`
- Modify: `scripts/test-library-routes.mjs`
- Modify: `package.json`

**Interfaces:**
- Consumes: Task 2 breadcrumb, child, and visible-path utilities.
- Produces: student browsing from course roots through unlimited visible nesting.

- [ ] **Step 1: Write failing student visibility and navigation tests**

Test that course pages list roots only, folder pages list direct visible children, breadcrumbs include every ancestor, and `getStudentLibraryFolder` rejects a visible descendant beneath a hidden ancestor or any cross-course chain.

- [ ] **Step 2: Run route tests and verify RED**

Run: `npm run test:library-routes`

Expected: FAIL because student routes neither expose child folders nor validate ancestor visibility.

- [ ] **Step 3: Implement nested student queries and UI**

Filter the course page by `parentId: null`; load the course's folder summaries for folder pages; reject invalid visibility paths; render child cards and deep breadcrumbs before links and files.

- [ ] **Step 4: Register the tree test in `test:library`**

Insert `npm run test:library-tree` into the library suite so future full runs exercise the new domain behavior.

- [ ] **Step 5: Run full automated verification**

Run: `npx prisma generate && npx prisma validate && npx tsc --noEmit --incremental false && npm run test:library && git diff --check`

Expected: every command exits 0.

Run: `npm run test:all`

Expected: exits 0 when PostgreSQL configured by `.env` is available. If it is unavailable, report the exact database connectivity failure and retain the successful database-independent verification above.

- [ ] **Step 6: Browser-check the three flows when the database is available**

Start the existing development server and verify admin creation/navigation/deletion, member department scoping, and student hidden-ancestor denial at desktop and mobile widths with no console errors.

- [ ] **Step 7: Commit implementation and push**

```bash
git add lib/library/student.ts app/library/courses/[courseId]/page.tsx app/library/courses/[courseId]/folders/[folderId]/page.tsx app/library/library.module.css scripts/test-library-routes.mjs package.json
git commit -m "Add nested library browsing for students"
git push origin main
```
