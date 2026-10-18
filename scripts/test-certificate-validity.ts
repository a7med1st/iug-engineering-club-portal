import assert from "node:assert/strict";
import { canViewCertificate, isCertificateValid, isIssuedCertificate, hasIssuedCertificateLanguages } from "../lib/certificates";
import { certificateDownloadLanguage } from "../lib/certificate-language";

const valid = {
  revokedAt: null,
  artifactPathname: "certificates/test.png",
  submission: { status: "APPROVED", checkedInAt: new Date() },
};

assert.equal(isCertificateValid(valid), true);
const workshop = {
  ...valid,
  submission: {
    ...valid.submission,
    form: { activity: { sessions: [{ id: "a" }, { id: "b" }], requiredAttendanceCount: 2 } },
    sessionAttendances: [{ sessionId: "a" }, { sessionId: "foreign" }],
  },
};
assert.equal(isCertificateValid(workshop), false, "legacy check-in cannot bypass the session threshold");
assert.equal(isCertificateValid({ ...workshop, submission: { ...workshop.submission, checkedInAt: null, sessionAttendances: [{ sessionId: "a" }, { sessionId: "b" }] } }), true);
assert.equal(isCertificateValid({ ...workshop, submission: { ...workshop.submission, sessionAttendances: [{ sessionId: "a" }, { sessionId: "a" }] } }), false);
assert.equal(isCertificateValid({ ...valid, revokedAt: new Date() }), false);
assert.equal(isCertificateValid({ ...valid, artifactPathname: null }), false);
assert.equal(isCertificateValid({ ...valid, submission: { ...valid.submission, status: "REJECTED" } }), false);
assert.equal(isCertificateValid({ ...valid, submission: { ...valid.submission, checkedInAt: null } }), false);
assert.equal(isIssuedCertificate(valid), true);
const englishOnly = { ...valid, artifactPathname: null, englishArtifactPathname: "certificates/test-en.png" };
assert.equal(isCertificateValid(englishOnly), true);
assert.equal(isIssuedCertificate(englishOnly), true);
assert.equal(isCertificateValid({ ...englishOnly, revokedAt: new Date() }), false);
assert.equal(isCertificateValid({ ...englishOnly, submission: { ...valid.submission, status: "REJECTED" } }), false);
assert.equal(certificateDownloadLanguage(null, englishOnly), "en");
assert.equal(certificateDownloadLanguage(null, valid), "ar");
assert.equal(certificateDownloadLanguage("ar", englishOnly), "ar");
assert.equal(hasIssuedCertificateLanguages(englishOnly, { ar: false, en: true }), true);
assert.equal(hasIssuedCertificateLanguages(englishOnly, { ar: true, en: true }), false);
assert.equal(hasIssuedCertificateLanguages(valid, { ar: true, en: false }), true);
assert.equal(hasIssuedCertificateLanguages(valid, { ar: true, en: true }), false);
assert.equal(hasIssuedCertificateLanguages({ ...valid, englishArtifactPathname: "en.png" }, { ar: true, en: true }), true);
assert.equal(isIssuedCertificate(null), false);
assert.equal(isIssuedCertificate({ revokedAt: null, artifactPathname: null }), false);
assert.equal(isIssuedCertificate({ revokedAt: new Date(), artifactPathname: "certificates/test.png" }), false);

const viewer = { id: "viewer", role: "MEMBER" as const, memberPermissions: [] as string[], position: null as string | null };
assert.equal(canViewCertificate(viewer, "viewer"), true);
assert.equal(canViewCertificate(viewer, "other"), false);
assert.equal(canViewCertificate({ ...viewer, position: "نائب رئيس النادي" }, "other"), true);
assert.equal(canViewCertificate({ ...viewer, position: "رئيس النادي" }, "other"), true);
assert.equal(canViewCertificate({ ...viewer, role: "ADMIN" }, "other"), true);
assert.equal(canViewCertificate({ ...viewer, role: "STUDENT" }, "other"), false);

console.log("certificate validity tests passed");
