import assert from "node:assert/strict";

import { registrationRejectionReason } from "../lib/registration-rejection-reason";

assert.equal(registrationRejectionReason("REJECTED", "  الشروط غير مكتملة  "), "الشروط غير مكتملة");
assert.equal(registrationRejectionReason("APPROVED", "سبب قديم"), null);
assert.equal(registrationRejectionReason("SUBMITTED", "سبب قديم"), null);
assert.throws(() => registrationRejectionReason("REJECTED", "  "));
assert.throws(() => registrationRejectionReason("REJECTED", "x".repeat(501)));
