# Attendance Links and Certificate Templates

## Purpose

Add a secure, activity-specific self-attendance flow and a configurable certificate-template workflow to the existing engineering club portal. Students should be able to open a shared attendance link, authenticate, confirm their attendance, and later access a certificate only when their registration is approved and their attendance is recorded. Administrators should manage links, attendance, templates, and certificate issuance from the existing administration experience.

The design extends the current registration, attendance, authentication, notification, certificate, permission, and blob-storage systems. It does not create parallel attendance or certificate subsystems.

## Existing System Constraints

- The application is a Next.js 15 App Router application using Server Components, Server Actions, Prisma, and the existing JWT cookie authentication in `lib/auth.ts`.
- An `ActivityFormSubmission` is the canonical activity registration. `status = APPROVED` means the registration is accepted.
- `ActivityFormSubmission.checkedInAt` is the canonical attendance marker. Existing QR and manual check-in paths already use it.
- A `Certificate` is uniquely tied to one submission and already has a unique verification code, revocation, notifications, public display, and verification pages.
- Private blob storage and upload-security helpers already exist and must be reused.
- Existing permissions and activity-scoped permission checks must protect all administration actions.
- Existing uncommitted work in registration/export files is user-owned and must be preserved.

## Chosen Approach

Use one canonical registration row, one canonical attendance timestamp, and one canonical certificate row per student and activity. Add separate configuration records for attendance links and certificate templates, plus audit metadata on the submission and generated certificate.

This approach was selected over creating new attendance records because duplicate state would make the current attendance dashboard, QR scanner, eligibility checks, and certificate system disagree. It was also selected over browser-only certificate rendering because administrators need a stable issued artifact that can be downloaded later and is not affected by future template edits.

## Data Model

### ActivityAttendanceLink

Add an activity-owned attendance-link model with:

- `id`, `activityId`, and the relation to `Activity`.
- `tokenHash`, unique. The raw token is never stored.
- `tokenPrefix`, used only for administration/audit display.
- `isActive`.
- Optional `opensAt` and `closesAt`.
- `createdById`, `createdAt`, `updatedAt`, and optional `rotatedAt`.
- Indexes on `(activityId, isActive)` and `closesAt`.

An activity has at most one current attendance link. Rotation updates the same record with a new hash and prefix, immediately invalidating the old URL. The raw token is returned only by the create/rotate action so the browser can build and copy the URL.

Tokens use 32 cryptographically random bytes encoded as base64url. The server compares a SHA-256 hash of the URL token to `tokenHash`. A leaked database does not reveal usable attendance URLs.

### Attendance Audit Fields

Extend `ActivityFormSubmission` with:

- `attendanceSource`, nullable enum: `STAFF_QR`, `STAFF_MANUAL`, or `SELF_LINK`.
- `attendanceLinkId`, nullable relation to `ActivityAttendanceLink` with `onDelete: SetNull`.

Existing attendance rows may keep a null source. New QR/manual actions record their source, and self-attendance records `SELF_LINK` plus the link id. `checkedInAt` remains the only attendance truth. The secret token is not copied into the submission.

Removing attendance clears `checkedInAt`, `checkedInById`, `attendanceSource`, and `attendanceLinkId`. Changing a submission away from `APPROVED` clears the same fields.

### CertificateTemplate

Add one optional template per activity:

- `id`, unique `activityId`, and the relation to `Activity`.
- Private source-image metadata: pathname, original filename, MIME type, size, width, and height.
- Normalized text placement for student name, activity title, and activity date. Each element stores `x`, `y`, alignment, font size relative to image width, color, and visibility where applicable.
- `createdById`, `createdAt`, and `updatedAt`.

Coordinates are stored as decimal percentages from 0 to 100 so the editor and generator behave consistently at any preview size. The student name is required; title and date overlays may be disabled when already printed in the uploaded design.

Initial supported template formats are PNG, JPEG, and WebP. SVG and PDF uploads are excluded because they require a different sanitization and rendering security model.

### Generated Certificate Artifact

Extend `Certificate` with nullable generated-file metadata: private pathname, MIME type, size, width, height, `generatedAt`, and a template revision fingerprint. The existing `verificationCode`, `issuedAt`, and `revokedAt` remain authoritative.

Issuing or reissuing generates a PNG from the current template and registration snapshot. A later template edit does not silently alter already issued files. An explicit reissue regenerates the artifact and updates `issuedAt` while retaining the verification code.

## Attendance Flow

The public route is `/attendance/[activityId]/[token]`.

1. The Server Component hashes the token and validates that the activity and link match, the link is active, and the current time is inside the optional attendance window.
2. Invalid, disabled, not-yet-open, and expired links render specific non-sensitive status messages. They do not reveal whether another token exists.
3. An unauthenticated visitor is redirected to `/login?portal=student&returnTo=<attendance-path>`. The existing safe-return helper prevents open redirects. The student registration page must preserve the same `returnTo` value through account creation and email verification.
4. An authenticated non-student receives a role-specific access message and cannot confirm attendance.
5. The page finds the activity's registration submission by `formId` and `userId`. Email-only guest submissions are not automatically claimed because email equality alone is not sufficient proof of ownership.
6. If no account-linked submission exists, the page offers a button to the existing activity registration route with the attendance URL as `returnTo`. If registration is pending or rejected, the page explains that attendance requires an approved registration.
7. An eligible student sees activity name, student name, activity date, and Confirm/Cancel commands. Cancel returns to the student dashboard.
8. Confirm executes a Server Action that repeats every validation. It atomically updates the submission only where `status = APPROVED` and `checkedInAt IS NULL`, setting the timestamp, source, and link id.
9. If the update count is zero, the action rereads the row and returns an idempotent “already recorded” result or the relevant eligibility error. Rapid double submission cannot create duplicate attendance.

The link action does not depend on registration being currently open. A previously approved student may confirm attendance even after registration closes.

## Administration Experience

Extend the existing activity registrations page instead of introducing a disconnected dashboard.

### Attendance Link Panel

An activity-scoped panel allows authorized administrators to:

- Create the link when none exists.
- Copy the current URL.
- Enable or disable it.
- Set or clear opening and closing times, with validation that closing is later than opening.
- Rotate the token after an explicit confirmation. The old URL stops working immediately.
- See current status: active, disabled, scheduled, or expired.

The panel uses existing button, form, alert, and permission patterns. Server Actions use the activity attendance-management permission, validate all fields on the server, and revalidate the registrations page.

### Attendance Dashboard

Keep and extend the existing statistics and table. Counts use these definitions:

- Registered: all non-rejected submissions.
- Approved: `status = APPROVED`.
- Attended: approved submissions with `checkedInAt != null`.
- Not attended: approved submissions with `checkedInAt = null`.
- Attendance rate: attended divided by approved, or zero when no approved submissions exist.

The table exposes name, email, registration status, attendance time, attendance source, and certificate status. Existing manual and QR check-in remain available and interoperable with self-attendance.

## Certificate Template and Issuance Flow

### Template Editor

Add an activity selector and template-management section to the existing certificate administration page. An authorized administrator uploads a validated image to private blob storage, previews it at its natural aspect ratio, and positions overlays on the preview.

The editor provides numeric controls and direct dragging for the name position, plus controls for font size, color, and alignment. Activity title and date have equivalent optional controls. Values are normalized percentages and submitted to a server action, which clamps and validates every value.

Replacing or deleting a template removes the superseded private source blob only after the database update succeeds. Existing issued certificate artifacts are retained.

### Generation

Certificate generation is a server-only service with a narrow input: template record, submission snapshot, activity title/date, and verification code. It:

1. Reads the private template image.
2. Builds escaped SVG text overlays sized from normalized settings.
3. Composites the overlay on the image with the existing `sharp` dependency.
4. Uses a bundled Arabic-capable font file so local and Vercel rendering match.
5. Produces a PNG and writes it to private blob storage under a non-guessable, certificate-specific pathname.
6. Stores artifact metadata on the `Certificate` row.

The database and blob write cannot be one atomic transaction. The service uploads a new uniquely named artifact first, updates the certificate in a database transaction, then best-effort deletes the prior artifact. If the database update fails, it best-effort deletes the newly uploaded orphan and reports failure without marking the certificate issued.

Single and bulk issuance retain the current eligibility rule: only `APPROVED` submissions with `checkedInAt != null`. Issuance is blocked until the activity has a valid template. Bulk issuance processes each eligible submission independently, reports created/skipped/failed totals, and does not revoke or overwrite unrelated certificates.

### Access and Download

- The public verification page remains public and shows verification metadata, but not the private certificate image.
- The certificate display/download route requires either the certificate owner or an administrator with certificate permission.
- Access is denied when the certificate is revoked, the registration is no longer approved, attendance was removed, or the artifact is missing.
- The protected download Route Handler reads the private blob and returns it with `Content-Disposition: attachment` and a sanitized filename.
- The student dashboard links eligible owners to view/download their issued certificate. Existing issuance notifications continue to point to the certificate page.

This changes the current certificate display page from possession-of-code access to owner/admin access. Verification by code remains available separately.

## Security and Validation

- Never log, persist, or expose raw attendance tokens after create/rotate responses.
- Validate link, activity, time window, user role, registration ownership, approval status, and prior attendance again in the mutation.
- Use constant-format SHA-256 hashes and high-entropy tokens; URLs must not use incremental ids as credentials.
- Apply the existing mutation rate limiter to self-attendance confirmation, keyed by user and link.
- Validate uploaded bytes using the existing image-security pipeline, not only filename or browser MIME type. Enforce existing project size and pixel limits.
- Escape all student/activity text before placing it in SVG markup.
- Keep template and generated files private; serve them only through authenticated Route Handlers.
- Enforce certificate eligibility both when issuing and whenever an owner downloads.
- Administration actions use existing activity-scoped permissions where available; global certificate operations use the existing certificate/admin permission pattern.

## Error Handling

Expected business errors return Arabic, user-facing messages without stack traces: invalid link, disabled link, early/expired window, login required, wrong role, missing registration, pending/rejected registration, already attended, missing template, ineligible certificate, revoked certificate, and unavailable file.

Unexpected database, image-processing, and storage failures are logged with record ids and operation names, without raw tokens or private file contents. UI actions preserve entered configuration after validation errors where practical. Bulk certificate issuance reports partial failures rather than claiming full success.

## Component and Module Boundaries

- `lib/attendance-links.ts`: token creation/hashing and pure link-state evaluation.
- Attendance page and action under `app/attendance/[activityId]/[token]/`.
- Activity-admin attendance-link component/actions colocated with the existing registrations feature.
- `lib/certificate-renderer.ts`: deterministic image rendering and private artifact storage orchestration.
- Certificate-template editor components/actions colocated with `app/admin/certificates/`.
- Protected certificate download Route Handler under `app/certificates/[code]/download/route.ts`.
- Prisma migration for models, enums, relations, indexes, and artifact metadata.

Server Components load authoritative state. Client Components are limited to copy-to-clipboard, drag/preview editing, and pending UI. Server Actions and Route Handlers own authorization and mutations.

## Migration and Compatibility

The migration is additive. Existing submissions, attendance timestamps, and certificates remain valid. Their attendance source and artifact fields remain null. Existing certificates without generated artifacts continue to render through the current HTML certificate page until an administrator configures a template and reissues them; they cannot use the new image download endpoint before regeneration.

No existing attendance URL, QR token, verification code, or registration uniqueness constraint is changed. The feature must not alter activity capacity or registration-opening semantics.

## Testing Strategy

Implementation follows test-driven development.

### Unit Tests

- Token generation, hashing, and link-state evaluation for active, disabled, scheduled, expired, and invalid links.
- Safe coordinate validation/clamping and SVG text escaping.
- Eligibility rules shared by single issue, bulk issue, view, and download.
- Certificate renderer output dimensions and deterministic placement using a fixture image and bundled font.

### Integration Tests

- Unauthenticated attendance URL preserves its full safe return path through login and student registration.
- Wrong activity/token pair, disabled link, invalid window, wrong role, missing registration, pending/rejected registration, and approved registration outcomes.
- Two concurrent confirmations result in one attendance timestamp and an idempotent second response.
- Rotation invalidates the old token and accepts the new token; disabling blocks both page confirmation and direct action calls.
- Manual, QR, and self-link attendance produce the correct source and remain visible in one dashboard.
- Template upload rejects unsupported or malformed files and cleans up replacement artifacts correctly.
- Issuance refuses absent or unapproved students and missing templates.
- Owner/admin download succeeds; another student, revoked certificate, removed attendance, and missing artifact fail.
- Bulk issuance reports mixed success accurately and remains idempotent.

### End-to-End Verification

Run the full flow in the browser at desktop and mobile widths:

1. Admin creates an activity registration, approves a student, configures a link/window, and copies the URL.
2. Logged-out student opens it, logs in, returns to confirmation, and confirms once.
3. Admin sees updated counts, row timestamp/source, and duplicate prevention.
4. Admin uploads a template, positions fields, previews, and issues the certificate.
5. Student receives the notification, views and downloads the generated certificate.
6. A different student cannot download it, while the public verification page still verifies its code.
7. Admin rotates/disables the attendance link and verifies the old/disabled URL is rejected.

Verification includes Prisma validation/migration checks, focused automated tests, lint/type checks available in the repository, production build, browser console checks, and visual screenshots of the attendance confirmation, administration panels, and generated certificate.

## Acceptance Criteria

- One approved registration can be marked attended only once across all attendance methods.
- Attendance links are activity-bound, high entropy, revocable, schedulable, and validated entirely on the server.
- Authentication and account creation return the student to the original attendance URL.
- Only approved attendees can receive certificates.
- An administrator can upload a design, position dynamic text, preview it, and issue stable downloadable certificate files.
- Certificate files are private to their owner and authorized administrators; public verification remains available without exposing the file.
- Existing QR/manual attendance, registration review, statistics, notifications, verification codes, and legacy certificates continue to work.
- The complete flow is covered by focused automated tests and browser verification.
