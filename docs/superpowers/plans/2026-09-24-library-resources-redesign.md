# Library Resources And Admin Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan.

**Goal:** Add secure text/link resources to library folders and rebuild the library administration interface so it matches the existing admin experience across desktop, mobile, light, and dark modes.

**Architecture:** Keep `/admin/library` as a Server Component backed by the existing selection query and Server Actions. Add `LibraryResource` as a folder-owned Prisma entity, centralize validation and department-scoped authorization in `lib/library`, and use small Client Components only for modal dialogs, upload state, and delete confirmation.

**Tech Stack:** Next.js App Router, React, TypeScript, Prisma, PostgreSQL, CSS Modules, Lucide React, Node-based contract tests.

**Spec:** `docs/superpowers/specs/2026-09-24-library-resources-redesign-design.md`

## Global Constraints

- Do not change shared admin navigation, headers, or unrelated pages.
- Reuse `LIBRARY_MANAGE` and derive department access through resource relations; never trust a submitted department ID.
- Store descriptions as plain text and render them without HTML interpretation.
- Accept only absolute `http:` and `https:` URLs without credentials.
- Keep all changes local; do not push.
- Preserve existing uploaded-file behavior and private file delivery.

## Review Focus

- Resource CRUD cannot cross department boundaries.
- URL validation blocks executable, local-file, credential-bearing, and protocol-relative destinations.
- Dialog controls are keyboard accessible and return focus correctly.
- Query scope remains limited to the selected folder.
- RTL layout, small screens, and explicit `html[data-theme="dark"]` styling remain usable.

---

### Task 1: Add the resource data model

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/<timestamp>_add_library_resources/migration.sql`
- Modify: `scripts/test-library-schema.ts`

- [ ] Add failing schema-contract assertions for `LibraryResource`, the `LibraryFolder.resources` and `User.createdLibraryResources` reverse relations, cascading folder deletion, creator `SetNull`, and required indexes.
- [ ] Run `npx tsx scripts/test-library-schema.ts` and confirm the new assertions fail for the missing model.
- [ ] Add `LibraryResource` with `id`, `folderId`, `title`, nullable `description`, nullable `url`, `sortOrder`, `isVisible`, nullable `createdById`, and timestamps.
- [ ] Add indexes on `[folderId, sortOrder]` and `[createdById]`, then generate a normal additive migration without resetting or deleting existing data.
- [ ] Run `npx prisma format`, `npx prisma validate`, and the schema test until they pass.
- [ ] Commit the schema, migration, and test together.

### Task 2: Implement validation and scoped authorization

**Files:**
- Modify: `lib/library/validation.ts`
- Modify: `lib/library/authorization.ts`
- Modify: `scripts/test-library-domain.ts`
- Modify: `scripts/test-library-permissions.ts`

- [ ] Add failing validation cases for text-only, URL-only, combined content, blank content, overlong fields, negative ordering, protocol-relative URLs, unsupported schemes, and URL credentials.
- [ ] Add failing authorization contract coverage proving resource access resolves through `resource.folder.course.departmentId` and preserves global versus managed-department behavior.
- [ ] Run the focused domain and permission tests and confirm the new cases fail.
- [ ] Implement `validateLibraryResourceInput(formData)` returning normalized title, nullable description, nullable URL, non-negative `sortOrder`, and `isVisible`.
- [ ] Parse URLs with `URL`, require an explicit `http:` or `https:` scheme, reject username/password credentials, and return Arabic validation errors.
- [ ] Implement `requireLibraryResource(resourceId)` using the same safe not-found behavior and department authorization as folders and files.
- [ ] Run the focused tests until they pass, then commit.

### Task 3: Load resources only for the selected folder

**Files:**
- Modify: `lib/library/queries.ts`
- Modify: `scripts/test-library-selection.ts`

- [ ] Add a failing query contract showing resources are empty without a selected folder and fetched only for `selectedFolder.id`.
- [ ] Assert ordering by `sortOrder`, then `createdAt`, while keeping the current file query intact.
- [ ] Run `npx tsx scripts/test-library-selection.ts` and confirm failure.
- [ ] Extend `resolveLibrarySelection` to return `resources` from a single selected-folder query.
- [ ] Run the selection test until it passes and commit.

### Task 4: Add resource Server Actions

**Files:**
- Modify: `app/admin/library/actions.ts`
- Modify: `scripts/test-library-actions.ts`

- [ ] Add failing action contracts for `createResourceAction`, `updateResourceAction`, and `deleteResourceAction`.
- [ ] Cover validation, creator attribution, folder/resource authorization, selected-query preservation, and `/admin/library` revalidation.
- [ ] Run `npx tsx scripts/test-library-actions.ts` and confirm the new contracts fail.
- [ ] Implement create, update, and delete mutations using the shared validators and authorization helpers.
- [ ] Return errors through the existing feedback mechanism and redirect/revalidate consistently with course, folder, and file actions.
- [ ] Run the action tests until they pass and commit.

### Task 5: Build accessible library dialogs

**Files:**
- Create: `components/admin/library/LibraryDialog.tsx`
- Create: `components/admin/library/LibraryResourceForm.tsx`
- Modify: `components/admin/library/ConfirmDeleteButton.tsx`
- Modify: `components/admin/library/LibraryManager.module.css`
- Modify: `scripts/test-library-ui.ts`

- [ ] Add failing UI contracts for a native modal dialog, labelled controls, cancel/close behavior, resource fields, and confirmed deletion.
- [ ] Run `npx tsx scripts/test-library-ui.ts` and confirm the dialog contracts fail.
- [ ] Implement a reusable client-side dialog trigger using the native `<dialog>` element, focus restoration, Escape support, and icon tooltips.
- [ ] Implement a resource form with title, plain-text description, external URL, sort order, and visibility controls; communicate that description or URL is required through field labeling and server feedback.
- [ ] Refactor deletion confirmation to target explicit delete forms without a document-wide submit listener.
- [ ] Add dialog and form styling with 8px-or-smaller radii, responsive width, clear focus states, RTL alignment, and explicit dark-theme selectors.
- [ ] Run the UI test until it passes and commit.

### Task 6: Rebuild the library manager and integrate resources

**Files:**
- Modify: `components/admin/library/LibraryManager.tsx`
- Modify: `components/admin/library/LibraryManager.module.css`
- Modify: `components/admin/library/LibraryUploader.tsx`
- Modify: `scripts/test-library-ui.ts`

- [ ] Add failing UI assertions for the folder-content heading, separate add-resource/upload commands, inline plain text, secure external links, resource edit/delete actions, and file/resource empty states.
- [ ] Run the UI test and confirm the new assertions fail.
- [ ] Replace dropdown editors for courses, folders, and file titles with focused `LibraryDialog` forms while preserving all existing fields and actions.
- [ ] Recompose the page into a restrained department bar, level/course navigation, folder list, and one unframed selected-folder content section.
- [ ] Render resources before files as distinct operational rows; preserve description line breaks and use `target="_blank" rel="noopener noreferrer"` for external links.
- [ ] Keep upload as a separate command and refine its visual state to match the redesigned content area.
- [ ] Rewrite the library CSS module into readable rules using existing site variables, stable action dimensions, no nested decorative cards, responsive stacking, and `html[data-theme="dark"]` support.
- [ ] Run the UI test and `npx tsc --noEmit --incremental false` until they pass, then commit.

### Task 7: Integrate, migrate, and verify end to end

**Files:**
- Modify as required by failures: `scripts/test-library-routes.ts`, `scripts/test-role-routes.mjs`, or library files already listed above

- [ ] Run `npm run test:library` and fix only regressions caused by this feature.
- [ ] Run `npx prisma validate` and `npx tsc --noEmit --incremental false`.
- [ ] Apply the new migration with the repository's normal Prisma migration command, without resetting the database.
- [ ] Run `npm run test:all` and `git diff --check`.
- [ ] Start the local development server on a free port and verify `/admin/library` with browser automation at desktop and mobile widths.
- [ ] Verify creating, editing, opening, and deleting a resource; verify an external link opens securely; verify uploads still work; inspect console errors.
- [ ] Verify light and dark themes and confirm no horizontal overflow or overlapping controls.
- [ ] Review the final diff for unrelated changes, commit the verified implementation locally, and do not push.

