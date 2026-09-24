# Library Resources And Admin Redesign

## Purpose

Extend the specialization-library administration system so a folder can contain explanatory text and external lecture links in addition to uploaded files. Restyle the existing library page to use the established admin visual language more faithfully without redesigning the shared admin layout or header.

## Scope

This change affects the existing `/admin/library` flow only. It adds CRUD management for link/text resources, integrates them into the selected folder's content area, and refines the library-specific components and CSS. The student-facing library remains outside this phase.

## Data Model

Add `LibraryResource` with:

- `id`: CUID primary key.
- `folderId`: required relation to `LibraryFolder`, cascading on folder deletion.
- `title`: required display title, maximum 180 characters.
- `description`: optional plain text, maximum 5,000 characters.
- `url`: optional external URL, maximum 2,048 characters.
- `sortOrder`: non-negative integer.
- `isVisible`: boolean, default true.
- `createdById`: optional relation to `User`, set null when its creator is deleted.
- `createdAt` and `updatedAt`: timestamps.

At least one of `description` or `url` is required. Add reverse relations to `LibraryFolder` and `User`, plus indexes for folder ordering and creator lookup. Create a normal Prisma migration and never reset the database.

## Resource Validation

The server trims all fields and validates length and ordering. External URLs must parse successfully and use only `https:` or `http:`. Reject credentials in URLs and reject schemes such as `javascript:`, `data:`, `file:`, and protocol-relative URLs. The title shown to users is independent of the destination URL.

Descriptions are stored as plain text and rendered as text, preserving line breaks but never interpreting HTML. Duplicate links are allowed because the same destination can represent different contextual entries.

## Authorization

Reuse `LIBRARY_MANAGE` and existing resource-to-department authorization. Create, update, and delete actions resolve the folder and its course/department through database relations before mutation. No submitted department ID is trusted. Administrators and club leadership retain their existing global behavior, while members remain restricted to `managedDepartmentIds`.

## Admin Experience

Within the selected folder, rename the area conceptually to "محتوى المجلد" and present two clear creation commands:

- "إضافة نص أو رابط" opens a focused editor for title, optional description, optional URL, ordering, and visibility.
- "رفع ملفات" retains the existing secure multi-file uploader.

Resources and files appear in one coherent content section but remain visually distinguishable. A resource with a URL shows an external-link action opening a new tab with `noopener noreferrer`. A text-only resource displays its description directly. Every resource supports editing and confirmed deletion.

Empty states distinguish between a folder with no content and a folder containing only one content category. Success and error feedback reuse `AdminFeedback`.

## Visual Redesign

The page continues inside the existing admin layout. Library-specific styling will use the site's existing CSS variables and common admin patterns for surfaces, borders, typography, buttons, focus states, and dark mode. The redesign will:

- Replace cramped dropdown-style editors with accessible modal dialogs.
- Use restrained club blue/cyan accents with green/orange only for status and secondary cues.
- Keep cards at 8px radius or less and avoid nested decorative cards.
- Improve hierarchy between department, course, folder, and folder content.
- Use compact icon buttons with tooltips for edit, delete, view, and download.
- Keep generous but operational spacing rather than marketing-style composition.
- Preserve RTL alignment and prevent horizontal page scrolling.
- Convert content rows to readable stacked items on mobile.
- Support `html[data-theme="dark"]` using the same surface and text variables as the existing admin pages.

The shared admin navigation, header, and unrelated pages will not be restyled.

## Data Loading And Performance

Extend the existing selected-folder query to load resources only for that folder, ordered by `sortOrder`, then `createdAt`. No resources from other folders, courses, or departments are loaded. The main page remains a Server Component; dialogs and direct interactions remain focused Client Components.

## Error Handling

- Invalid or unsafe URLs return an Arabic validation message.
- Missing description and URL returns an Arabic message requiring content.
- Missing or inaccessible resources return the same safe not-found behavior used by current library content.
- Mutation success revalidates `/admin/library` and preserves selected department, course, and folder query parameters.
- Delete operations always require confirmation.

## Testing And Verification

Add tests for schema relations, text-only resources, URL-only resources, combined description/link resources, unsafe schemes, credentials in URLs, blank content, cross-department authorization contracts, and resource query scoping. Extend route/UI contracts for the external-link security attributes and dialogs.

Run:

```text
npm run test:library
npx prisma validate
npx tsc --noEmit --incremental false
git diff --check
```

Verify `/admin/library` for an administrator and a department-scoped member at desktop and mobile widths in light and dark modes.

## Out Of Scope

- Rich HTML or Markdown editing.
- Embedded third-party players or iframe previews.
- Link health checking or automatic metadata scraping.
- Student-facing pages.
- Nested folders or content version history.
