# Library Ordering And Shared Courses Design

## Purpose

Add manual up/down ordering for library folders and files in both management interfaces. Also allow departments to share one synchronized library course when they use the same normalized course code, eliminating duplicate folders and uploads.

## Scope

The feature covers the full admin library, member library, and student library. It changes course ownership from one department to many departments, adds file ordering, adds adjacent-item movement, and adds an explicit attach-existing-course flow. Links retain their current ordering and are not reorderable. Folder moving between parents, file moving between folders, drag and drop, and automatic sharing for courses without codes are out of scope.

## Shared Course Model

Replace the direct `LibraryCourse.departmentId` ownership with a join model named `LibraryCourseDepartment`:

- `courseId`: relation to `LibraryCourse`, cascading when the shared course is deleted.
- `departmentId`: relation to `Department`, cascading when the department is deleted.
- `level`, `semester`, and `sortOrder`: placement metadata specific to that department.
- Composite primary key on `[courseId, departmentId]`.
- Department ordering index on `[departmentId, level, semester, sortOrder]`.

`LibraryCourse` keeps shared metadata and content: name, code, normalized code, description, folders, files through folders, and timestamps. Add `normalizedCode String? @unique`. PostgreSQL permits multiple null values, so courses without a code remain independent.

Code normalization trims the value, converts Arabic and ASCII whitespace runs to no spaces, removes hyphens and underscores, and uppercases Latin letters. For example, `math 101`, `MATH-101`, and `Math_101` resolve to the same normalized code `MATH101`. Other characters remain unchanged. The same pure normalization function is used for creation, lookup, and update.

## Existing Data Migration

The migration creates the join table and inserts one placement for every existing course using its current department, level, semester, and sort order. It then removes the old placement columns from `LibraryCourse` only after all links exist.

Existing non-empty codes are normalized before the unique constraint is enabled. If multiple existing courses normalize to the same code, a data migration merges them deterministically:

- The oldest course becomes the canonical shared course.
- Department placements from duplicates are attached to the canonical course. A department already attached keeps its oldest placement.
- Every duplicate course folder, including full nested subtrees, is reassigned to the canonical course without changing parent relationships, files, or links.
- The canonical course keeps its existing name and description; no content is discarded.
- Duplicate course rows are deleted after placements and folders are moved.

The migration is non-destructive and does not reset the database. A migration test covers duplicate normalization, placement preservation, and folder reassignment.

## Add Or Attach Course Flow

The add-course control is available in both `/admin/library` and `/member/library`. Every authenticated member with a primary department may create a course or attach an existing shared course to that department; this does not require `LIBRARY_MANAGE`.

The control uses a two-stage server-backed flow:

1. The member or administrator enters course name, code, level, semester, order, and optional description.
2. When a non-empty code loses focus or the form is submitted, the server checks `normalizedCode` without exposing courses the current user cannot otherwise inspect beyond the safe match summary.
3. If no match exists, submission creates a new shared course and its placement for the current department.
4. If a match exists and is not linked to the current department, the UI shows the existing course name and linked department names and asks for explicit confirmation to attach it.
5. Confirmation creates only the department placement using the submitted level, semester, and order. Existing shared metadata and all content remain unchanged and become immediately visible in the new department.
6. If the course is already linked to the current department, the UI reports that it was previously added and does not create a duplicate.

The final attach action repeats the normalized-code lookup and department checks on the server. It never trusts the preview response or a submitted course ID alone. A database uniqueness constraint on the join prevents duplicate attachments under concurrent requests.

Courses without a code skip matching and are always created as independent courses with `normalizedCode = null`.

## Shared Editing And Deletion

Any administrator or member with library-management access to one linked department may manage the shared course content. Member-library contributors in a linked primary department may add visible folders, files, and links under the existing member rules. Changes to shared folders, files, and links are immediately visible to every linked department.

Management pages display a compact notice when a course is shared, naming the linked departments and explaining that content changes affect all of them.

Deleting a course from a department normally deletes only that `LibraryCourseDepartment` placement. The shared course and content remain available to other linked departments. When the last placement is being removed, the confirmation explicitly states that all folders, links, file metadata, and private stored files will be deleted; only then does the existing recursive storage cleanup run before deleting the shared course.

Updating shared name, code, or description affects every linked department and displays the same shared-content warning. Updating level, semester, or ordering changes only the current department placement. Changing a code reruns normalization and rejects a collision with another shared course; automatic merging during edits is not supported.

## Authorization

All course authorization resolves linked departments from `LibraryCourseDepartment`:

- Global administrators and club leadership retain current global access.
- A department-scoped library manager may access a course when at least one linked department is within their authorized department set.
- A normal member may contribute only when their primary department has a placement for the course.
- Every normal member with a primary department may create a course placement or attach an existing shared course to that primary department.
- Students see a course only through a placement for their own department.

Folder, file, link, upload, preview, download, and deletion guards derive access through the selected resource's course placements. Client-submitted department IDs never grant access. Shared-course lookup returns only the safe match summary required for confirmation, not file or user details.

## Manual Ordering

`LibraryFolder.sortOrder` remains the folder ordering field. Add `LibraryFile.sortOrder Int @default(0)` and index `[folderId, sortOrder, createdAt]`.

Ordering scopes are strict:

- A folder is ordered only among siblings with the same `courseId` and `parentId`.
- A file is ordered only among files with the same `folderId`.
- Links are unchanged.

Up and down actions accept only an item ID and direction. The server loads the item, derives and authorizes its scope, orders siblings by `sortOrder` with stable ID or creation-time tie breakers, finds the adjacent item, and swaps both positions inside one transaction. Moving the first item up or the last item down is a successful no-op.

Before swapping, the action normalizes duplicate or sparse ordering values for that one scope to deterministic consecutive values. New folders and uploaded files receive the next order value in their scope inside the same database transaction used to create their metadata. This prevents every new item from appearing at position zero.

## Management Interfaces

Both `/admin/library` and `/member/library` include the create-or-attach course control. The member version always targets the member's primary department and never accepts a client-selected department as authority.

Both interfaces also show `ArrowUp` and `ArrowDown` icon buttons for every direct child folder and every file in the current folder. Buttons use Arabic tooltips and accessible labels that include the item name. The unavailable boundary direction is disabled. Existing edit and delete controls remain unchanged.

The controls use normal server-action forms so ordering works without client-side state. Successful movement preserves department, course, and current folder selection and refreshes admin, member, and student views. Layout dimensions remain stable and the controls wrap safely on mobile.

Student pages show folders and files in the saved order but never show management controls.

## Query And Display Changes

Department course lists query through placements and use placement-specific level, semester, and order. Shared course data is returned alongside the selected placement. Existing nested-folder navigation remains unchanged except that folder lists sort by `sortOrder`, then name and ID. File lists sort by `sortOrder`, then creation time and title.

Course counts represent placements in the current department. Shared department names are loaded only for the selected course or safe match preview to avoid expanding every course-list query.

## Error Handling

- Empty code creates an independent course.
- Invalid or inaccessible item IDs return existing safe not-found or dashboard redirects.
- Duplicate course attachment returns an Arabic informational error without creating data.
- A code collision on update returns a validation error and preserves both courses.
- Concurrent move or attachment requests rely on transactions and uniqueness constraints; conflicts return a safe retry message.
- Storage cleanup failure prevents last-placement course deletion and preserves database metadata.
- Shared-course notices make cross-department effects explicit before destructive changes.

## Testing And Verification

Tests cover:

- Code normalization variants and null-code independence.
- Migration of placements and deterministic merge of existing duplicate codes without lost folders or files.
- New course creation when no normalized code matches.
- Existing-course preview, explicit attachment, and duplicate-attachment rejection.
- Normal-member creation and attachment restricted to the member's primary department.
- Immediate cross-department visibility of shared nested folders and files.
- Per-department level, semester, and course ordering.
- Authorization for linked and unlinked departments across actions, uploads, and downloads.
- Detaching one department versus deleting the final placement and stored files.
- Folder ordering limited to direct siblings.
- File ordering limited to one folder.
- Boundary no-ops, duplicate/sparse order normalization, and new-item append behavior.
- Admin/member arrow controls, disabled states, accessible labels, and selection-preserving redirects.
- Student folder and file display order.

Final verification runs Prisma generation and validation, TypeScript, the library suite, database-backed integration tests, `git diff --check`, and browser checks for admin/member desktop and mobile layouts. The implementation is committed and pushed only after the relevant checks pass.

## Out Of Scope

- Sharing courses by name when no code exists.
- Automatically merging courses after an administrator edits a code.
- Per-department copies of shared content.
- Reordering links.
- Drag and drop.
- Moving folders between parents or files between folders.
