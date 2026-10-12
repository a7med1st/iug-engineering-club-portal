import assert from "node:assert/strict";
import { MEMBER_GROUPS, parseMemberGroup } from "../lib/member-groups";

assert.deepEqual(MEMBER_GROUPS.map((group) => group.value), ["ADMINISTRATIVE", "PUBLIC_RELATIONS", "MEMBERS", "MEDIA"]);
for (const group of MEMBER_GROUPS) assert.equal(parseMemberGroup(group.value), group.value);
assert.equal(parseMemberGroup(null), "MEMBERS");
assert.equal(parseMemberGroup(null, "MEDIA"), "MEDIA");
assert.throws(() => parseMemberGroup("ADMIN"), /Invalid member group/);
assert.throws(() => parseMemberGroup(""), /Invalid member group/);
console.log("Member group validation passed.");
