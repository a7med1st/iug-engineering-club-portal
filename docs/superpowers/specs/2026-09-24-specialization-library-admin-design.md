# Specialization Library Admin Design

## Purpose

Add a production-ready administration system for each department's specialization library. Authorized department representatives manage only their assigned departments, while administrators and existing club leadership retain global access. This phase covers administration only; the student-facing library will be designed separately.

## Scope

The feature adds course, folder, and file management under `/admin/library`. It reuses the current admin layout, navigation, authentication, department scoping, feedback patterns, upload validation, and private file storage. It does not change the global header, user roles, managed-department behavior, or unrelated admin pages.

## Authorization

Add `LIBRARY_MANAGE` to the existing permission system as a department-scoped permission assignable to members. It is included in the existing admin-area permission set so an authorized member can enter the admin layout.

Every page, Server Action, upload route, download route, and destructive operation must enforce authorization on the server. Access requires both:

1. `LIBRARY_MANAGE`, granted through the existing role, club-leadership, or member-permission rules.
2. Access to the resource's department through the existing `canAccessDepartment` and `managedDepartmentIdsForUser` behavior.

Resource mutations derive the department from the database relationship rather than trusting a submitted department ID. Administrators and existing club leadership can manage every department through the current global-access rules. No role is added.

## Data Model

### LibraryCourse

- `id`: CUID primary key.
- `departmentId`: required relation to `Department`, cascading on department deletion.
- `level`: integer constrained by application validation to 1 through 5.
- `name`: required display name.
- `code`: optional course code.
- `description`: optional short description.
- `sortOrder`: integer used within a department and level.
- `createdAt`, `updatedAt`: timestamps.
- Relation to folders with cascading record deletion.
- Indexes for department, level, and ordering.

### LibraryFolder

- `id`: CUID primary key.
- `courseId`: required relation to `LibraryCourse`, cascading on course deletion.
- `name`: required, user-defined display name with no hardcoded folder types.
- `sortOrder`: integer used within a course.
- `isVisible`: boolean, defaulting to true for the future student view.
- `createdById`: optional relation to `User`, set to null if the user is deleted.
- `createdAt`, `updatedAt`: timestamps.
- Relation to files with cascading record deletion.
- Indexes for course and ordering.

### LibraryFile

- `id`: CUID primary key.
- `folderId`: required relation to `LibraryFolder`, cascading on folder deletion.
- `title`: editable display name.
- `originalName`: original upload name.
- `storageKey`: unique private-storage pathname.
- `mimeType`: validated media type.
- `size`: byte count.
- `uploadedById`: optional relation to `User`, set to null if the user is deleted.
- `createdAt`, `updatedAt`: timestamps.
- Indexes for folder and creation order.

Add reverse relations to `Department` and `User`. Create a normal Prisma migration; never reset the database.

## Routes And Data Loading

The main route is a Server Component:

`/admin/library?department=<id>&course=<id>&folder=<id>`

Query parameters preserve selection in navigation history and allow direct links. Each selected identifier is validated against its parent and the authorized department. Invalid or inaccessible selections fall back to the first valid authorized selection or return the appropriate not-found/forbidden behavior without exposing resource existence.

The page loads only:

- Departments the current user may manage.
- Course counts and courses for the selected department, grouped into levels 1 through 5.
- Folders for the selected course.
- Files for the selected folder.

It does not load files belonging to unselected folders, courses, or departments. Mutations use Server Actions where ordinary form submissions fit. Multipart file uploads use a dedicated Route Handler so the existing global Server Action body limit does not need to increase.

## Admin Interface

Add an "إدارة مكتبة التخصص" navigation item visible only to users who can access the feature. The page remains inside the current admin layout and visual language.

The header contains the page title, a short description, and the selected department. A department selector appears only when more than one department is manageable.

On desktop, an internal side panel lists the five levels, course counts, and their courses. The main region shows the selected course's folders and, beneath them, the selected folder's files. Active course and folder states are visually distinct. On mobile, levels and courses use an accordion and file rows become cards so the page never requires horizontal scrolling.

Course, folder, file-title, visibility, and delete operations use focused dialogs with accessible labels and confirmation. Existing feedback components are reused for success and error states. Empty states explain the next available action. The page itself remains a Server Component; Client Components are limited to dialogs, accordion behavior, drag and drop, upload progress, and other direct interactions.

## File Storage And Uploads

Files are stored privately through the existing storage abstraction in `lib/blob-storage.ts`, supporting the configured Vercel Blob or local storage driver. PostgreSQL stores metadata and the private storage key only. Storage keys include an unguessable UUID and never use the submitted name as a path component.

The upload endpoint accepts at most 10 files per request and at most 25 MB per file. Supported categories are PDF, DOCX, PPTX, XLSX, ZIP, JPEG, PNG, and WebP. The server validates:

- Authentication, `LIBRARY_MANAGE`, and department access.
- File count and declared/actual size.
- An allowlisted filename extension.
- An allowlisted MIME type and its compatibility with the extension.
- Sanitized display names and path traversal resistance.
- A generated, collision-resistant storage key.

Duplicate original filenames are allowed because storage keys are unique. Their student-facing titles may be edited independently. Each upload reports its own progress and result so one rejected file does not hide the status of the others.

Admin preview and download use an authenticated Route Handler that rechecks the file's department scope before streaming from private storage. Inline response is used only for safe browser-preview types; other types download as attachments with safe content-disposition headers.

## Mutations And Consistency

Create and update operations validate trimmed names, optional field lengths, numeric levels and ordering, and ownership of the parent resource. Reordering uses explicit integer `sortOrder` values and deterministic secondary ordering.

Deleting an individual file removes the private object and then its database row, with explicit handling for storage failures. Deleting a folder or course first enumerates its stored file keys, removes the private objects, and then deletes database records in a transaction where applicable. Partial storage deletion is reported rather than silently leaving inconsistent state. Operations are idempotent where practical, and missing storage objects do not prevent stale metadata cleanup.

## Error And UX States

- Loading UI follows the current admin loading conventions.
- Empty states exist for no courses, no folders, and no files.
- Validation and permission failures return safe Arabic messages without leaking inaccessible resource details.
- Upload progress and per-file failures appear in the uploader.
- Successful mutations refresh the affected route data and display existing admin feedback.
- Deletions always require confirmation and never use `window.alert`.

## Testing And Verification

Add focused tests for permission registration and normalization, department-scoped access, upload allowlists and limits, storage-key safety, and unauthorized resource access. Exercise create, update, delete, upload, preview, and download paths for an administrator, an authorized member, and a member assigned to another department.

Required final checks:

```text
npx prisma validate
npx tsc --noEmit
git diff --check
```

Manual verification covers desktop and mobile layouts, RTL, light and dark modes, multiple managed departments, dialog states, multi-file progress, invalid file rejection, and private-file access denial.

## Out Of Scope

- Student-facing library pages and student navigation.
- Public or anonymous file access.
- New user roles or a parallel permission system.
- Nested folders, file versioning, search, analytics, or bulk content import.
- Redesigning the admin layout, global header, or unrelated pages.
