import assert from "node:assert/strict";
import Module from "node:module";

const template = { id: "template", sourcePathname: "template.png", sourceWidth: 100, sourceHeight: 100 };
const activity = { id: "activity", title: "Workshop", startsAt: null, requiredAttendanceCount: 2, sessions: [{ id: "a" }, { id: "b" }], certificateTemplate: template };
const certificate = { id: "certificate", verificationCode: "EC-TEST", revokedAt: null, artifactPathname: "old.png", issuedAt: new Date() };
const unqualified = { id: "unqualified", userId: null, studentName: "Student", status: "APPROVED", checkedInAt: new Date(), sessionAttendances: [{ sessionId: "a" }], form: { activity, activityId: activity.id }, certificate };
const qualified = { ...unqualified, id: "qualified", checkedInAt: null, sessionAttendances: [{ sessionId: "a" }, { sessionId: "b" }], certificate: null };
let current: any = unqualified;
let rows: any[] = [unqualified, qualified];
const generated: string[] = [];
const created: string[] = [];
let submissionQueries = 0;
let lookupCertificate = false;
let blobReads = 0;
function assertAttendanceSelection(select: any) {
  assert.equal(select.status, true);
  assert.equal(select.checkedInAt, true);
  assert.equal(select.sessionAttendances.select.sessionId, true);
  assert.equal(select.form.select.activity.select.requiredAttendanceCount, true);
  assert.equal(select.form.select.activity.select.sessions.select.id, true);
}
const db = {
  activity: { findMany: async () => [activity] },
  activityFormSubmission: {
    findUnique: async ({ where, select }: any) => {
      if (select.status) assertAttendanceSelection(select);
      const row = rows.find((item) => item.id === where.id) ?? current;
      if (row.id === "qualified") return { ...row, certificate: { ...certificate, artifactPathname: null } };
      return row;
    },
    findMany: async ({ where, select }: any) => {
      assert.equal(where.checkedInAt, undefined, "legacy timestamp must not exclude session attendees");
      assertAttendanceSelection(select);
      submissionQueries++;
      return rows;
    },
  },
  certificateTemplate: { findUnique: async () => template },
  certificate: {
    findUnique: async ({ where, select, include }: any) => {
      if (where.verificationCode && lookupCertificate) {
        assertAttendanceSelection((select ?? include).submission.select);
        return { ...certificate, submission: { ...current, userId: "student" } };
      }
      return where.verificationCode ? null : { ...certificate, submissionId: current.id, submission: current };
    },
    create: async ({ data }: any) => { created.push(data.submissionId); return { ...certificate, ...data }; },
    update: async () => certificate,
  },
};
class Redirect extends Error { constructor(public url: string) { super(url); } }
const loader = Module as unknown as { _load: (request: string, ...args: any[]) => any };
const originalLoad = loader._load;
loader._load = function(request, ...args) {
  if (request === "@/lib/prisma") return { prisma: db };
  if (request === "@/lib/permissions") return { PERMISSIONS: { ADMIN_DASHBOARD: "admin" }, requirePermission: async () => {}, hasPermission: () => false };
  if (request === "next/cache") return { revalidatePath: () => {} };
  if (request === "next/navigation") return { redirect: (url: string) => { throw new Redirect(url); } };
  if (request === "@/lib/auth") return { getCurrentUser: async () => ({ user: { id: "student", role: "STUDENT", memberPermissions: [], position: null } }) };
  if (request === "@/lib/private-file-response") return { privateFileResponse: () => new Response("image") };
  if (request === "@/lib/certificate-renderer") return { renderCertificate: async ({ studentName }: any) => { generated.push(studentName); return { buffer: Buffer.from("image"), mime: "image/png", size: 5, width: 100, height: 100, fingerprint: "test" }; } };
  if (request === "@/lib/blob-storage") return { putPrivateBlob: async () => {}, tryDeletePrivateBlobs: async () => {}, getPrivateBlob: async () => { blobReads++; return {}; } };
  return originalLoad.call(this, request, ...args);
};

async function main() {
  const actions = require("../app/admin/certificates/actions") as typeof import("../app/admin/certificates/actions");
  const certificates = require("../lib/certificates") as typeof import("../lib/certificates");
  const form = new FormData();
  form.set("submissionId", unqualified.id);
  form.set("activityId", activity.id);
  form.set("certificateId", certificate.id);
  form.set("customName", "Student");
  form.set("customNameX", "10");
  form.set("customNameY", "10");
  form.set("customNameFontSize", "20");
  form.set("customNameFontFamily", "Cairo");
  for (const action of [actions.issueCertificate, actions.regenerateCertificate, actions.updateIndividualCertificate]) {
    await assert.rejects(action(form), (error: unknown) => {
      assert.ok(error instanceof Redirect);
      const message = new URL(error.url, "https://test.local").searchParams.get("error");
      assert.ok(message?.includes("1") && message.includes("2"), "eligibility error explains count and required threshold");
      return true;
    });
  }
  assert.equal(generated.length, 0, "ineligible individual actions must not render");
  assert.equal(created.length, 0, "ineligible actions must not create certificates");

  await assert.rejects(actions.issueActivityCertificates(form), Redirect);
  assert.deepEqual(created, ["qualified"], "bulk issuance skips unqualified registrations");
  assert.equal(generated.length, 1);
  generated.length = 0;
  rows = [unqualified, { ...qualified, certificate }];
  await assert.rejects(actions.regenerateActivityCertificates(form), Redirect);
  assert.equal(generated.length, 1, "bulk regeneration skips unqualified registrations");

  submissionQueries = 0;
  const all = await certificates.getCertificateAdminRows({ activityId: activity.id, issued: "ALL" });
  assert.equal(all.rows.length, 2, "admin shows incomplete attendance progress");
  assert.deepEqual(all.rows.map((row) => row.attendanceProgress), [
    { attendanceCount: 1, totalSessions: 2, requiredAttendanceCount: 2, eligible: false },
    { attendanceCount: 2, totalSessions: 2, requiredAttendanceCount: 2, eligible: true },
  ]);
  assert.equal(all.summary.eligibleCount, 1);
  assert.equal(submissionQueries, 1, "progress is loaded in a batch");
  rows = [unqualified, qualified];
  assert.deepEqual((await certificates.getCertificateAdminRows({ activityId: activity.id, issued: "ISSUED" })).rows.map((row) => row.id), ["unqualified"]);
  assert.deepEqual((await certificates.getCertificateAdminRows({ activityId: activity.id, issued: "NOT_ISSUED" })).rows.map((row) => row.id), ["qualified"]);

  lookupCertificate = true;
  const download = require("../app/certificates/[code]/download/route") as typeof import("../app/certificates/[code]/download/route");
  const request = new Request("https://test.local/certificates/EC-TEST/download");
  const context = { params: Promise.resolve({ code: "EC-TEST" }) };
  assert.equal((await download.GET(request, context)).status, 404);
  assert.equal(blobReads, 0, "ineligible downloads must not access the artifact");
  assert.equal(certificates.isCertificateValid((await certificates.getCertificateByCode("EC-TEST"))!), false);
  current = { ...qualified, certificate };
  assert.equal((await download.GET(request, context)).status, 200);
  assert.equal(blobReads, 1);
  assert.equal(certificates.isCertificateValid((await certificates.getCertificateByCode("EC-TEST"))!), true);
  console.log("certificate eligibility action and admin progress tests passed");
}
main().finally(() => { loader._load = originalLoad; }).catch((error) => { console.error(error); process.exitCode = 1; });
