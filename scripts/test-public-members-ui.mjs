import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const listing = await readFile(new URL("../app/delegates/page.tsx", import.meta.url), "utf8");
const profile = await readFile(new URL("../app/members/[id]/page.tsx", import.meta.url), "utf8");
assert.match(listing, /styles\.membersGrid/);
assert.match(listing, /avatarStoredName: true/);
assert.match(listing, /profileLinkedIn: true/);
assert.match(profile, /styles\.profileShell/);
assert.match(profile, /styles\.profileSidebar/);
assert.match(profile, /dir="auto"/);
assert.doesNotMatch(profile, /MemberCoverImage/);
console.log("Public member UI checks passed.");
