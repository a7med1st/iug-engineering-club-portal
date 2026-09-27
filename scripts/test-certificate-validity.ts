import assert from "node:assert/strict";
import { isCertificateValid, isIssuedCertificate } from "../lib/certificates";

const valid = {
  revokedAt: null,
  artifactPathname: "certificates/test.png",
  submission: { status: "APPROVED", checkedInAt: new Date() },
};

assert.equal(isCertificateValid(valid), true);
assert.equal(isCertificateValid({ ...valid, revokedAt: new Date() }), false);
assert.equal(isCertificateValid({ ...valid, artifactPathname: null }), false);
assert.equal(isCertificateValid({ ...valid, submission: { ...valid.submission, status: "REJECTED" } }), false);
assert.equal(isCertificateValid({ ...valid, submission: { ...valid.submission, checkedInAt: null } }), false);
assert.equal(isIssuedCertificate(valid), true);
assert.equal(isIssuedCertificate(null), false);
assert.equal(isIssuedCertificate({ revokedAt: null, artifactPathname: null }), false);
assert.equal(isIssuedCertificate({ revokedAt: new Date(), artifactPathname: "certificates/test.png" }), false);

console.log("certificate validity tests passed");
