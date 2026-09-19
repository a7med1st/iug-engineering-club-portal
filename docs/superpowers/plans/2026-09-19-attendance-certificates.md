# Attendance Links and Certificate Templates Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add secure self-attendance links and private, template-based certificate generation to the existing activity registration workflow.

**Architecture:** Keep `ActivityFormSubmission.checkedInAt` as the single attendance truth and the existing `Certificate` row as the single issuance truth. Add activity-owned attendance-link and certificate-template configuration, server-only validation/rendering services, thin App Router pages/actions, and protected private-file downloads.

**Tech Stack:** Next.js 15 App Router, React 19, TypeScript, Prisma 6, PostgreSQL, Server Actions, Route Handlers, `sharp`, `@vercel/blob`, Lucide React, Node test scripts.

**Spec:** `docs/superpowers/specs/2026-09-19-attendance-certificates-design.md`

## Global Constraints

- Extend the current authentication, registration, attendance, permission, notification, private-blob, and certificate systems; do not create parallel user or attendance stores.
- `ActivityFormSubmission.checkedInAt` remains the canonical attendance marker.
- Certificate eligibility is exactly `status = APPROVED` and `checkedInAt != null`.
- Attendance-link tokens use 32 random bytes encoded as base64url; store only SHA-256 hash and a display prefix.
- Template uploads support PNG, JPEG, and WebP only and pass through the existing byte-level image validation pipeline.
- Template and generated-certificate blobs are private.
- Public certificate verification remains available, but generated certificate display/download requires the owner or an authorized administrator.
- Existing uncommitted changes in registration/export files and `package.json` are user-owned; preserve and integrate with them.
- Follow TDD: every production-code task starts with a failing focused test.

## Review Focus

- A raw token paired with a different activity id must be rejected even if its hash exists for another activity; pin this in Task 3 integration tests.
- A confirmation begun while a link is active but submitted after it expires must fail because the mutation revalidates time; pin this in Task 3 integration tests.
- Arabic names containing `&`, `<`, `>`, quotes, and mixed Latin text must render without SVG injection or corruption; pin this in Task 6 renderer tests.
- A blob upload followed by a database failure must not leave a new certificate marked issued and must attempt orphan cleanup; pin this in Task 7 service tests.
- A certificate owner whose attendance is later removed must lose artifact access while public verification reports current invalidity; pin this in Task 8 route tests.

---

### Task 1: Add Attendance and Certificate Persistence

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/20260919090000_add_attendance_links_and_certificate_templates/migration.sql`
- Create: `scripts/test-attendance-certificate-schema.mjs`
- Modify: `package.json`

**Interfaces:**
- Produces: Prisma models `ActivityAttendanceLink`, `CertificateTemplate`; enum `AttendanceSource`; submission fields `attendanceSource`, `attendanceLinkId`; certificate artifact fields.
- Produces: script command `npm run test:attendance-certificate-schema` used by final verification.

- [ ] **Step 1: Write the failing schema contract test**

Create a Node script that reads `prisma/schema.prisma` and the migration SQL, then asserts the exact models, enum members, unique constraints, foreign-key delete behavior, and indexes:

```js
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const schema = await readFile("prisma/schema.prisma", "utf8");
const migration = await readFile(
  "prisma/migrations/20260919090000_add_attendance_links_and_certificate_templates/migration.sql",
  "utf8",
).catch(() => "");

assert.match(schema, /enum AttendanceSource[\s\S]*STAFF_QR[\s\S]*STAFF_MANUAL[\s\S]*SELF_LINK/);
assert.match(schema, /model ActivityAttendanceLink[\s\S]*tokenHash\s+String\s+@unique/);
assert.match(schema, /model CertificateTemplate[\s\S]*activityId\s+String\s+@unique/);
assert.match(schema, /attendanceLinkId\s+String\?/);
assert.match(schema, /artifactPathname\s+String\?/);
assert.match(migration, /CREATE TABLE "ActivityAttendanceLink"/);
assert.match(migration, /CREATE TABLE "CertificateTemplate"/);
console.log("attendance/certificate schema contract passed");
```

- [ ] **Step 2: Run the test and verify it fails**

Run: `node scripts/test-attendance-certificate-schema.mjs`

Expected: FAIL because the models and migration do not exist.

- [ ] **Step 3: Add the Prisma models and migration**

Add the enum and relations with these field names:

```prisma
enum AttendanceSource {
  STAFF_QR
  STAFF_MANUAL
  SELF_LINK
}

model ActivityAttendanceLink {
  id          String    @id @default(cuid())
  activityId  String    @unique
  activity    Activity  @relation(fields: [activityId], references: [id], onDelete: Cascade)
  tokenHash   String    @unique
  tokenPrefix String
  isActive    Boolean   @default(true)
  opensAt     DateTime?
  closesAt    DateTime?
  createdById String?
  createdBy   User?     @relation("AttendanceLinkCreator", fields: [createdById], references: [id], onDelete: SetNull)
  rotatedAt   DateTime?
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt
  submissions ActivityFormSubmission[]

  @@index([activityId, isActive])
  @@index([closesAt])
}
```

Add `attendanceSource AttendanceSource?`, `attendanceLinkId String?`, and the relation to `ActivityFormSubmission`. Add a one-to-one `CertificateTemplate` with source-image metadata and decimal placement fields for name/title/date. Add nullable artifact metadata and `templateFingerprint` to `Certificate`. Add inverse relations to `Activity` and `User`. Use `Decimal @db.Decimal(5, 2)` for normalized coordinates and sizes.

- [ ] **Step 4: Add the package script and validate the migration**

Add:

```json
"test:attendance-certificate-schema": "node scripts/test-attendance-certificate-schema.mjs"
```

Run: `npm run test:attendance-certificate-schema`

Expected: PASS.

Run: `npx prisma validate`

Expected: `The schema at prisma/schema.prisma is valid`.

Run: `npx prisma generate`

Expected: Prisma Client generated successfully.

- [ ] **Step 5: Commit the persistence layer**

```bash
git add prisma/schema.prisma prisma/migrations/20260919090000_add_attendance_links_and_certificate_templates/migration.sql scripts/test-attendance-certificate-schema.mjs package.json
git commit -m "feat: add attendance and certificate persistence"
```

### Task 2: Implement Attendance-Link Domain Logic

**Files:**
- Create: `lib/attendance-links.ts`
- Create: `scripts/test-attendance-links.ts`
- Modify: `package.json`

**Interfaces:**
- Produces: `createAttendanceToken(): { token: string; tokenHash: string; tokenPrefix: string }`.
- Produces: `hashAttendanceToken(token: string): string`.
- Produces: `getAttendanceLinkState(link, now): "ACTIVE" | "DISABLED" | "NOT_OPEN" | "EXPIRED"`.
- Produces: `validateAttendanceWindow(opensAt, closesAt): string | null`.

- [ ] **Step 1: Write failing domain tests**

Test that tokens are URL-safe and at least 43 characters, only hashes/prefixes are deterministic, hashes are 64 lowercase hex characters, wrong tokens differ, each link state is selected at exact boundaries, and closing before/equal opening returns an Arabic validation error.

```ts
import assert from "node:assert/strict";
import {
  createAttendanceToken,
  getAttendanceLinkState,
  hashAttendanceToken,
  validateAttendanceWindow,
} from "../lib/attendance-links";

const created = createAttendanceToken();
assert.match(created.token, /^[A-Za-z0-9_-]{43}$/);
assert.equal(created.tokenHash, hashAttendanceToken(created.token));
assert.equal(created.tokenPrefix, created.token.slice(0, 8));
assert.equal(getAttendanceLinkState({ isActive: true, opensAt: null, closesAt: null }, new Date()), "ACTIVE");
assert.equal(validateAttendanceWindow(new Date("2026-09-19T10:00:00Z"), new Date("2026-09-19T10:00:00Z")) !== null, true);
```

- [ ] **Step 2: Run the test and verify it fails**

Run: `node --import tsx scripts/test-attendance-links.ts`

Expected: FAIL with module-not-found for `lib/attendance-links.ts`.

- [ ] **Step 3: Implement the pure helpers**

Use `randomBytes(32).toString("base64url")` and `createHash("sha256")`. Keep state evaluation and date validation free of Prisma/Next.js imports so direct tests remain fast.

- [ ] **Step 4: Run focused tests**

Add `test:attendance-links` to `package.json` and run `npm run test:attendance-links`.

Expected: PASS with all boundary assertions.

- [ ] **Step 5: Commit the domain layer**

```bash
git add lib/attendance-links.ts scripts/test-attendance-links.ts package.json
git commit -m "feat: add secure attendance link helpers"
```

### Task 3: Build Student Self-Attendance Flow

**Files:**
- Create: `lib/attendance-confirmation.ts`
- Create: `app/attendance/[activityId]/[token]/actions.ts`
- Create: `app/attendance/[activityId]/[token]/page.tsx`
- Create: `app/attendance/[activityId]/[token]/attendance.module.css`
- Create: `scripts/test-attendance-confirmation.ts`
- Modify: `components/AuthForm.tsx`
- Modify: `components/RegisterForm.tsx`
- Modify: `app/verify-email/VerifyEmailClient.tsx`
- Modify: `app/activities/[id]/register/actions.ts`
- Modify: `package.json`

**Interfaces:**
- Consumes: `hashAttendanceToken`, `getAttendanceLinkState` from Task 2.
- Produces: `loadAttendanceConfirmation(input, deps)` returning a discriminated status for page rendering.
- Produces: `confirmAttendance(input, deps)` returning `{ ok: true; alreadyRecorded: boolean; checkedInAt: Date } | { ok: false; code: AttendanceErrorCode }`.
- Produces: Server Action `confirmSelfAttendance(formData)`.

- [ ] **Step 1: Write failing confirmation-service tests**

Use injected repository/clock dependencies so tests cover invalid token, cross-activity token, disabled/not-open/expired links, expiration between page load and submit, non-student role, no registration, submitted/rejected registration, approved registration, prior attendance, and two confirmations where only one conditional update returns count `1`.

```ts
const result = await confirmAttendance(
  { activityId: "activity-a", token: "raw-token", userId: "student-1", role: "STUDENT" },
  fakeDeps({ linkActivityId: "activity-b" }),
);
assert.deepEqual(result, { ok: false, code: "INVALID_LINK" });
```

Assert that a successful update writes `attendanceSource: "SELF_LINK"`, `attendanceLinkId`, `checkedInAt`, and leaves `checkedInById` null.

- [ ] **Step 2: Run tests and verify failure**

Run: `node --import tsx scripts/test-attendance-confirmation.ts`

Expected: FAIL because the service does not exist.

- [ ] **Step 3: Implement the service and atomic mutation**

Define explicit error codes:

```ts
export type AttendanceErrorCode =
  | "INVALID_LINK"
  | "LINK_DISABLED"
  | "NOT_OPEN"
  | "EXPIRED"
  | "WRONG_ROLE"
  | "NOT_REGISTERED"
  | "PENDING_REGISTRATION"
  | "REJECTED_REGISTRATION"
  | "ALREADY_RECORDED";
```

The Prisma adapter must query by both `activityId` and `tokenHash`, then use:

```ts
await prisma.activityFormSubmission.updateMany({
  where: { id: submission.id, userId, status: "APPROVED", checkedInAt: null },
  data: {
    checkedInAt: now,
    checkedInById: null,
    attendanceSource: "SELF_LINK",
    attendanceLinkId: link.id,
  },
});
```

- [ ] **Step 4: Build the route and preserve authentication return paths**

The page awaits Next.js 15 `params`, validates the link before exposing activity data, and redirects unauthenticated users with `getSafeReturnTo` semantics. Render dedicated states and an approved-student confirmation form.

Update the student account link in `AuthForm` to use `appendReturnTo("/student/register", returnTo)`. Update `RegisterForm` to read and append the safe `returnTo` when moving to email verification. Keep it through verification and login. Update activity registration success handling so an attendance `returnTo` returns to confirmation after registration rather than always ending at the default activity/student page.

- [ ] **Step 5: Add rate limiting and rerun focused tests**

Apply the existing rate-limit helper to confirmation using `attendance:${user.id}:${link.id}`. Add a test that an injected denied limiter returns a generic retry message without updating attendance.

Run: `npm run test:attendance-confirmation`

Expected: PASS.

Run: `npx tsc --noEmit --incremental false`

Expected: PASS.

- [ ] **Step 6: Commit the student flow**

```bash
git add lib/attendance-confirmation.ts app/attendance components/AuthForm.tsx components/RegisterForm.tsx app/verify-email/VerifyEmailClient.tsx app/activities/[id]/register/actions.ts scripts/test-attendance-confirmation.ts package.json
git commit -m "feat: add student self attendance flow"
```

### Task 4: Add Attendance-Link Administration

**Files:**
- Create: `app/admin/activities/[id]/registrations/AttendanceLinkPanel.tsx`
- Create: `app/admin/activities/[id]/registrations/attendance-link-actions.ts`
- Modify: `app/admin/activities/[id]/registrations/page.tsx`
- Modify: `app/admin/activities/[id]/registrations/attendance.module.css`
- Create: `scripts/test-attendance-link-admin.ts`
- Modify: `package.json`

**Interfaces:**
- Consumes: token/window helpers from Task 2.
- Produces: actions `createAttendanceLink`, `updateAttendanceLink`, `rotateAttendanceLink`.
- Produces: panel props containing activity id, current URL/status/window, and permission flags.

- [ ] **Step 1: Write failing admin-action tests**

Test permission denial, first creation, duplicate creation returning the existing link, invalid date order, enable/disable, rotation replacing hash/prefix and setting `rotatedAt`, and absence of raw tokens in stored data/log payloads.

- [ ] **Step 2: Run the tests and verify failure**

Run: `node --import tsx scripts/test-attendance-link-admin.ts`

Expected: FAIL because the actions/service adapter do not exist.

- [ ] **Step 3: Implement activity-scoped actions**

Use `requireActivityPermission(PERMISSIONS.ATTENDANCE_MANUAL, activityId)` unless inspection reveals an existing narrower attendance-management permission; do not add a broad permission solely for this panel. Parse local datetime values explicitly and call `validateAttendanceWindow`. Return raw token only from create/rotate results.

- [ ] **Step 4: Add the panel to the existing registrations page**

Use existing CSS/button conventions and Lucide icons (`Link2`, `Copy`, `Power`, `RefreshCw`, `Clock`). Include accessible labels, pending states, copy feedback, explicit rotation confirmation, and status text for active/disabled/scheduled/expired. Do not display the full stored token because it is unavailable by design; after navigation, rotation is required if the administrator lost the URL.

- [ ] **Step 5: Record attendance source in existing staff actions**

Modify QR check-in and manual check-in writes to set `STAFF_QR` and `STAFF_MANUAL`. Modify checkout/status-change clearing paths to clear `attendanceSource` and `attendanceLinkId`. Extend the table with source and certificate status while preserving the user’s existing changes in the same files.

- [ ] **Step 6: Verify and commit**

Run: `npm run test:attendance-link-admin`

Expected: PASS.

Run: `npx tsc --noEmit --incremental false`

Expected: PASS.

```bash
git add app/admin/activities/[id]/registrations app/admin/activities/[id]/check-in/actions.ts scripts/test-attendance-link-admin.ts package.json
git commit -m "feat: manage activity attendance links"
```

### Task 5: Add Secure Certificate Template Storage and Validation

**Files:**
- Create: `lib/certificate-template-storage.ts`
- Create: `lib/certificate-template-settings.ts`
- Create: `scripts/test-certificate-template.ts`
- Modify: `package.json`

**Interfaces:**
- Produces: `validateCertificateTemplate(file: File): Promise<ValidatedCertificateTemplate>`.
- Produces: `storeCertificateTemplate(activityId, file): Promise<StoredTemplate>`.
- Produces: `parseTemplateSettings(formData): TemplateSettingsResult`.
- Produces constants `CERTIFICATE_TEMPLATE_MAX_BYTES = 8 * 1024 * 1024` and `CERTIFICATE_TEMPLATE_MAX_PIXELS = 24_000_000`.

- [ ] **Step 1: Write failing validation/settings tests**

Cover valid PNG/JPEG/WebP bytes, filename/MIME spoofing, malformed image, GIF/SVG/PDF rejection, byte/pixel limits, x/y outside 0..100, font size outside 1..20 percent, invalid color values, invalid alignment, and disabled optional overlays.

```ts
assert.deepEqual(parseTemplateSettings(formData({ nameX: "101" })), {
  ok: false,
  message: "موضع الاسم الأفقي يجب أن يكون بين 0 و100.",
});
```

- [ ] **Step 2: Run tests and verify failure**

Run: `node --import tsx scripts/test-certificate-template.ts`

Expected: FAIL because template modules do not exist.

- [ ] **Step 3: Implement validation and private storage**

Reuse `validateAndProcessImage`, `sanitizeOriginalFilename`, `putPrivateBlob`, and `tryDeletePrivateBlobs`. Preserve the original aspect ratio and store a normalized PNG source or the validated project-standard output. Use a pathname under `certificate-templates/<activityId>/<random>.png`.

- [ ] **Step 4: Implement strict settings parsing**

Return a discriminated result and normalized decimals. Accept only `left | center | right`, `#RRGGBB`, explicit booleans, and finite numeric strings. Never silently accept `NaN`, localized digits, or scientific notation.

- [ ] **Step 5: Verify and commit**

Run: `npm run test:certificate-template`

Expected: PASS.

```bash
git add lib/certificate-template-storage.ts lib/certificate-template-settings.ts scripts/test-certificate-template.ts package.json
git commit -m "feat: validate and store certificate templates"
```

### Task 6: Implement Deterministic Certificate Rendering

**Files:**
- Create: `lib/certificate-renderer.ts`
- Create: `assets/fonts/NotoNaskhArabic-Regular.ttf`
- Create: `scripts/fixtures/certificate-template.png`
- Create: `scripts/test-certificate-renderer.ts`
- Modify: `package.json`

**Interfaces:**
- Consumes: `getPrivateBlob`, `putPrivateBlob`, `tryDeletePrivateBlobs`.
- Produces: `renderCertificate(input: CertificateRenderInput): Promise<RenderedCertificate>`.
- Produces: `escapeSvgText(value: string): string`.
- Produces: `certificateTemplateFingerprint(template): string`.

- [ ] **Step 1: Write failing renderer tests**

Create a small fixture image and assert output is PNG, dimensions match the template, placement changes pixels near expected coordinates, identical input produces the same fingerprint, and `&<>\"'` are escaped. Include Arabic and mixed Arabic/Latin names and confirm rendering does not throw or produce a blank image.

- [ ] **Step 2: Run tests and verify failure**

Run: `node --import tsx scripts/test-certificate-renderer.ts`

Expected: FAIL because the renderer does not exist.

- [ ] **Step 3: Add the bundled Arabic font with license metadata**

Add the Noto Naskh Arabic regular font file and include its upstream license text in `assets/fonts/OFL.txt`. Load it once on the server and embed it as base64 in the SVG overlay so Vercel and local output match.

- [ ] **Step 4: Implement rendering**

Read the private source image, inspect width/height with `sharp().metadata()`, convert percentage coordinates to pixels, escape all text, calculate anchor from alignment, and composite one SVG overlay. Format activity dates with `Intl.DateTimeFormat("ar-PS", { dateStyle: "long" })`. Return the PNG buffer and metadata without writing database state.

- [ ] **Step 5: Verify and commit**

Run: `npm run test:certificate-renderer`

Expected: PASS and canvas/pixel assertions show a nonblank output.

```bash
git add lib/certificate-renderer.ts assets/fonts scripts/fixtures/certificate-template.png scripts/test-certificate-renderer.ts package.json
git commit -m "feat: render certificates from templates"
```

### Task 7: Build Template Editor and Transactional Issuance

**Files:**
- Create: `components/admin/CertificateTemplateEditor.tsx`
- Modify: `app/admin/certificates/page.tsx`
- Modify: `app/admin/certificates/actions.ts`
- Modify: `app/admin/certificates/certificates.module.css`
- Modify: `lib/certificates.ts`
- Create: `lib/certificate-issuance.ts`
- Create: `scripts/test-certificate-issuance.ts`
- Modify: `package.json`

**Interfaces:**
- Consumes: template storage/settings from Task 5 and renderer from Task 6.
- Produces: actions `saveCertificateTemplate`, `deleteCertificateTemplate`, `issueCertificate`, `issueActivityCertificates`.
- Produces: `issueEligibleCertificate(submissionId, deps)` with cleanup-aware artifact replacement.

- [ ] **Step 1: Write failing issuance-service tests**

Test missing template, pending/rejected/absent submissions, eligible issue, idempotent active certificate, revoked-certificate reissue, generated blob metadata persistence, upload success plus database failure cleanup, replacement success plus old-file cleanup, and bulk mixed created/skipped/failed counts.

- [ ] **Step 2: Run tests and verify failure**

Run: `node --import tsx scripts/test-certificate-issuance.ts`

Expected: FAIL because the issuance service does not exist.

- [ ] **Step 3: Implement issuance orchestration**

Move shared eligibility logic from action-local code into `lib/certificate-issuance.ts`. Upload the newly rendered file first, update/create the certificate in a transaction, best-effort delete the new file on database failure, and best-effort delete the prior file only after database success. Keep the verification code stable on reissue.

- [ ] **Step 4: Implement template actions and editor**

The editor uses an aspect-ratio constrained preview with absolutely positioned overlays. Dragging updates percentage coordinates; numeric inputs remain the accessible precise control. Include file input, name/title/date visibility, x/y, font size, color swatch/input, alignment menu, Save, Replace, Delete, and preview states. Server actions revalidate `/admin/certificates` and validate permissions/fields again.

- [ ] **Step 5: Update single and bulk issuance UI**

Disable issuance for activities without a template and show a direct template-setup state. Bulk results report `created`, `skipped`, and `failed` counts. Preserve existing certificate filtering, verification links, revoke behavior, and notifications.

- [ ] **Step 6: Verify and commit**

Run: `npm run test:certificate-issuance`

Expected: PASS.

Run: `npx tsc --noEmit --incremental false`

Expected: PASS.

```bash
git add components/admin/CertificateTemplateEditor.tsx app/admin/certificates lib/certificates.ts lib/certificate-issuance.ts scripts/test-certificate-issuance.ts package.json
git commit -m "feat: configure and issue generated certificates"
```

### Task 8: Protect Certificate Viewing and Download

**Files:**
- Create: `lib/certificate-access.ts`
- Create: `app/certificates/[code]/download/route.ts`
- Modify: `app/certificates/[code]/page.tsx`
- Modify: `app/certificates/[code]/certificate.module.css`
- Modify: `app/certificates/verify/[code]/page.tsx`
- Modify: `app/student/certificates/page.tsx`
- Modify: `app/student/certificates/certificates.module.css`
- Create: `scripts/test-certificate-access.ts`
- Modify: `package.json`

**Interfaces:**
- Produces: `authorizeCertificateArtifact(certificate, viewer): CertificateAccessResult`.
- Produces: authenticated `GET /certificates/[code]/download`.
- Consumes: `getPrivateBlob`, `createPrivateFileResponse` and current auth/permission helpers.

- [ ] **Step 1: Write failing access tests**

Cover owner, unrelated student, authorized admin, anonymous viewer, revoked certificate, registration changed from approved, attendance removed, missing artifact, and owner filename sanitization. Assert public verification can load metadata but never returns artifact bytes/pathname.

- [ ] **Step 2: Run tests and verify failure**

Run: `node --import tsx scripts/test-certificate-access.ts`

Expected: FAIL because access policy does not exist.

- [ ] **Step 3: Implement centralized access policy and download handler**

Authorize only when the certificate is active, its submission remains approved/attended, an artifact pathname exists, and the viewer is the submission owner or has the existing certificate administration permission. Return `404` for unknown codes/files, `401` for anonymous artifact access, and `403` for authenticated non-owners. Stream through `createPrivateFileResponse` with `attachment; filename="certificate-<safe-code>.png"`.

- [ ] **Step 4: Update certificate pages**

Make `/certificates/[code]` owner/admin-only and render the generated image with explicit aspect ratio and Download button. Keep legacy no-artifact certificates on the current HTML rendering for their owner/admin, with a clear “requires reissue for download” state. Keep `/certificates/verify/[code]` public and metadata-only, showing invalid status when revoked or no longer eligible.

Update the student certificate cards to include only currently eligible, active certificates and expose View/Download commands.

- [ ] **Step 5: Verify and commit**

Run: `npm run test:certificate-access`

Expected: PASS.

```bash
git add lib/certificate-access.ts app/certificates app/student/certificates scripts/test-certificate-access.ts package.json
git commit -m "feat: protect certificate artifacts and downloads"
```

### Task 9: Integrate Regression Suite and Verify the Full Flow

**Files:**
- Modify: `package.json`
- Create: `scripts/test-attendance-certificates-flow.mjs`
- Modify only if failures prove necessary: files changed in Tasks 1-8

**Interfaces:**
- Consumes: all prior task interfaces.
- Produces: one repeatable flow command and inclusion in `test:all`.

- [ ] **Step 1: Write the failing flow test**

Create a database-backed test script following the repository’s existing script harness. Seed an admin, two students, activity, registration form, approved submissions, attendance link, and template fixture. Exercise create/rotate/disable states, self-confirmation, duplicate confirmation, issue, owner access, unrelated-user denial, attendance removal denial, and public verification.

- [ ] **Step 2: Run the flow test and verify it exposes missing integration**

Run: `node --require ./scripts/node-platform-fallback.cjs --env-file=.env --import tsx scripts/test-attendance-certificates-flow.mjs`

Expected: FAIL until all route/service adapters and database setup are wired.

- [ ] **Step 3: Complete only the integration gaps found by the test**

Add `test:attendance-certificates` to `package.json` and append it to `test:all`. Keep fixes scoped to mismatched adapters, cleanup, revalidation, or return-path behavior demonstrated by failing assertions.

- [ ] **Step 4: Run focused and global verification**

Run: `npm run test:attendance-links`

Run: `npm run test:attendance-confirmation`

Run: `npm run test:attendance-link-admin`

Run: `npm run test:certificate-template`

Run: `npm run test:certificate-renderer`

Run: `npm run test:certificate-issuance`

Run: `npm run test:certificate-access`

Run: `npm run test:attendance-certificates`

Run: `npm run test:all`

Run: `npm run build`

Expected: every command exits `0`; the production build has no type, route, or prerender failures.

- [ ] **Step 5: Verify in a browser**

Start the development server on an unused port and use `vercel:agent-browser-verify` plus `vercel:verification`. At desktop `1440x900` and mobile `390x844`, verify:

- Logged-out attendance link returns through login and email verification.
- Confirmation states fit without overlap and duplicate submit is idempotent.
- Admin link controls copy, schedule, disable, and rotate correctly.
- Registration statistics/table update source, time, and certificate status.
- Template editor drag and numeric controls stay synchronized.
- Generated certificate is nonblank, Arabic text is legible, and overlays are correctly framed.
- Owner download succeeds, unrelated student fails, public verification remains metadata-only.
- Browser console has no errors and protected blob URLs are not exposed in HTML.

- [ ] **Step 6: Review changes and commit integration**

Run: `git diff --check`

Run: `git status --short`

Confirm user-owned pre-existing changes were preserved and no generated files, secrets, raw attendance tokens, or test artifacts are staged.

```bash
git add package.json scripts/test-attendance-certificates-flow.mjs
git commit -m "test: verify attendance and certificate workflow"
```

### Task 10: Final Review and Handoff

**Files:**
- Review: all files changed by Tasks 1-9
- Modify only for verified review findings: affected files and their focused tests

**Interfaces:**
- Consumes: completed implementation and passing verification evidence.
- Produces: reviewed branch and concise operational notes for migration/deployment.

- [ ] **Step 1: Request a code review**

Use `superpowers:requesting-code-review` against the spec and this plan. Require findings to prioritize authorization bypasses, token leakage, attendance races, blob cleanup, eligibility drift, Arabic rendering, and regressions in existing QR/manual attendance.

- [ ] **Step 2: Address findings with TDD**

For every accepted finding, first add a failing assertion to the owning focused script, run it to observe failure, implement the smallest fix, and rerun that focused script.

- [ ] **Step 3: Re-run completion verification**

Use `superpowers:verification-before-completion`, rerun `npm run test:all` and `npm run build`, and retain exact exit/output evidence before claiming completion.

- [ ] **Step 4: Present deployment notes**

Report the Prisma migration name, required private Blob credentials already used by the project, the new bundled font asset, how admins create links/templates, and any legacy certificates that require explicit reissue. Do not claim deployment or migration execution unless those actions were actually performed.
