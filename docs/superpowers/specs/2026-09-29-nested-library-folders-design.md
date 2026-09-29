# Nested Library Folders Design

## Purpose

Allow specialization-library managers to create folders inside other folders at any depth. Members continue to manage only the library for their primary department, while administrators and authorized library managers retain their existing scope. Students can browse the resulting hierarchy without seeing hidden branches.

## Scope

This change extends the existing `LibraryFolder` model, member library, admin library, and student library. It covers nested-folder creation, browsing, breadcrumbs, and recursive deletion. Moving an existing folder, drag-and-drop reordering, cross-course nesting, and cross-department nesting are out of scope.

## Data Model

Add an optional self-relation to `LibraryFolder`:

- `parentId String?`
- `parent LibraryFolder?` using a named self-relation and `onDelete: Cascade`
- `children LibraryFolder[]` using the same relation name

Root folders have a null `parentId`. Every child retains the same required `courseId` as its parent. Add an index on `[courseId, parentId, sortOrder]` for ordered child queries. Existing folders remain roots after migration because `parentId` is nullable.

The database foreign key guarantees that a parent exists and cascades record deletion. Application validation guarantees that parent and child belong to the same course. The initial feature does not support changing `parentId`, so it cannot create cycles through the UI or Server Actions.

## Folder Navigation

All library interfaces treat the selected folder as the current directory:

- With no selected folder, show only root folders for the selected course.
- With a selected folder, show only its direct children.
- Show the current folder's files and links beneath its child folders.
- Show breadcrumbs from the course root through every ancestor to the current folder.
- Opening a child updates the existing folder identifier in the URL; folder IDs remain stable direct-link targets.

Ancestor paths are assembled from folders belonging to the selected course. Path traversal is bounded defensively by the number of folders in that course, preventing malformed legacy data from causing an infinite loop.

## Creation And Validation

Folder creation accepts an optional `parentId`:

- Creation at the course view stores `parentId = null`.
- Creation while a folder is open stores that folder as the parent.
- The server loads the parent and verifies that it belongs to the submitted course before creation.
- Member actions additionally derive the course and department through existing server-side guards. A submitted parent or course from another department is rejected without exposing the resource.
- Admin actions continue to require `LIBRARY_MANAGE` and department access.

The member and admin interfaces use the same creation form pattern already present. The control text identifies whether the new folder will be created at the course root or inside the current folder.

## Visibility And Student Access

The student course page lists visible root folders only. A student folder page lists visible direct children before the current folder's links and files.

A folder is student-accessible only when it and every ancestor are visible and all belong to the requested course. A hidden ancestor hides its entire subtree even if a descendant is marked visible. Student breadcrumbs include all validated visible ancestors and link back through them.

Member management keeps the current rule that members may work only with visible folders. Therefore, a hidden ancestor also makes its descendants unavailable in the member interface. Full admin management can still inspect and edit hidden branches.

## Recursive Deletion And Storage

Deleting a folder deletes its full descendant tree. Before deleting database records, the action:

1. Loads folder IDs for the subtree within the same course.
2. Loads every `LibraryFile.storageKey` attached to those folders.
3. Deletes the private stored objects through the existing storage abstraction.
4. Deletes the root folder; database cascades remove descendants, links, and file metadata.

The same subtree-aware file enumeration is used wherever folder deletion occurs. Course deletion already selects all files by course and remains compatible. Missing storage objects do not block metadata cleanup, while an actual storage failure returns the existing safe error response.

## Query Boundaries

Add focused library-tree helpers for operations shared by member, admin, and student flows:

- Build ordered direct-child lists from course folders.
- Resolve an ancestor breadcrumb for a selected folder.
- Collect descendant IDs for recursive deletion.
- Confirm that a student-visible path has no hidden ancestor.

These helpers operate on explicit folder records and are unit tested independently. Database queries remain scoped by course and department before tree processing. No helper trusts a client-submitted relationship.

## Error Handling

- A missing or inaccessible parent returns the existing safe not-found or validation behavior.
- A parent from another course is rejected.
- Invalid ancestry or a detected cycle returns not found for students and a safe management error for managers.
- Deleting a nested folder returns to its parent; deleting a root folder returns to the course root.
- Existing Arabic success, validation, empty-state, and upload feedback patterns are retained.

## Testing And Verification

Tests cover:

- Prisma self-relation, nullable migration, cascade behavior, and composite index.
- Root creation and child creation at multiple depths.
- Rejection of a parent from another course or department.
- Ordered direct-child selection and deep breadcrumb construction.
- Cycle-safe ancestry handling for malformed data.
- Student denial when any ancestor is hidden.
- Recursive descendant collection and storage-key cleanup on deletion.
- Member, admin, and student route/UI contracts for nested navigation.
- Existing flat folders continuing to appear as roots.

Final verification runs Prisma validation and generation, TypeScript checking, the complete library test suite, the project test suite when its database dependency is available, and `git diff --check`. Relevant member and student flows are browser-checked at desktop and mobile sizes if the local database can run the application.

## Delivery

After implementation and verification, commit only files related to nested library folders and push the current branch to its configured upstream. Existing unrelated files such as `artifacts/` remain untouched.
