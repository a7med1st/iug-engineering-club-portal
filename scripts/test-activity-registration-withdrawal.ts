import assert from "node:assert/strict";
import { canWithdrawActivityRegistration } from "../lib/activity-registration-withdrawal";

assert.equal(canWithdrawActivityRegistration("SUBMITTED", null), true);
assert.equal(canWithdrawActivityRegistration("APPROVED", null), true);
assert.equal(canWithdrawActivityRegistration("REJECTED", null), false);
assert.equal(canWithdrawActivityRegistration("APPROVED", new Date()), false);
