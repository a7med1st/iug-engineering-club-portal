import assert from "node:assert/strict";
import { membersForGroup } from "../lib/member-groups";

const computer = { slug: "computer-engineering", sortOrder: 1 };
const architecture = { slug: "architecture", sortOrder: 3 };
const rows = [
  { id: "a1", memberGroup: "MEMBERS", user: { department: architecture } },
  { id: "c1", memberGroup: "MEMBERS", user: { department: computer } },
  { id: "none", memberGroup: "MEMBERS", user: null },
  { id: "a2", memberGroup: "MEMBERS", user: { department: architecture } },
  { id: "c2", memberGroup: "MEMBERS", user: null, department: computer },
  { id: "board", memberGroup: "ADMINISTRATIVE", user: { department: architecture } },
];
assert.deepEqual(membersForGroup(rows, "MEMBERS").map((row) => row.id), ["c1", "c2", "a1", "a2", "none"]);
assert.deepEqual(rows.map((row) => row.id), ["a1", "c1", "none", "a2", "c2", "board"]);
assert.deepEqual(membersForGroup(rows, "ADMINISTRATIVE").map((row) => row.id), ["board"]);
const tied = rows.slice(0, 2).map((row) => ({ ...row, user: { department: { ...row.user!.department, sortOrder: 0 } } }));
assert.deepEqual(membersForGroup([...tied, tied[0]], "MEMBERS").map((row) => row.id), ["a1", "a1", "c1"]);
console.log("Member department ordering passed.");
