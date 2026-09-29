import assert from "node:assert/strict";
import { libraryAdjacentSwap, orderedLibraryItems } from "../lib/library/ordering";

const items = [
  { id: "c", sortOrder: 9, createdAt: new Date("2026-01-03") },
  { id: "b", sortOrder: 0, createdAt: new Date("2026-01-02") },
  { id: "a", sortOrder: 0, createdAt: new Date("2026-01-01") },
];

assert.deepEqual(orderedLibraryItems(items).map((item) => item.id), ["a", "b", "c"]);
assert.deepEqual(libraryAdjacentSwap(items, "b", "up"), {
  normalized: [{ id: "a", sortOrder: 0 }, { id: "b", sortOrder: 1 }, { id: "c", sortOrder: 2 }],
  swap: [{ id: "b", sortOrder: 0 }, { id: "a", sortOrder: 1 }],
});
assert.deepEqual(libraryAdjacentSwap(items, "b", "down").swap, [
  { id: "b", sortOrder: 2 },
  { id: "c", sortOrder: 1 },
]);
assert.deepEqual(libraryAdjacentSwap(items, "a", "up").swap, []);
assert.deepEqual(libraryAdjacentSwap(items, "c", "down").swap, []);
assert.deepEqual(libraryAdjacentSwap(items, "missing", "down").swap, []);

console.log("Library ordering tests passed.");
