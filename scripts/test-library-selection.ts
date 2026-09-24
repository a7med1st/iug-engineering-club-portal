import assert from "node:assert/strict";

async function main() {
  process.env.SESSION_SECRET = "library-test-session-secret-32-characters";
  const { pickLibrarySelection } = await import("../lib/library/queries");
  assert.equal(pickLibrarySelection("b", [{ id: "a" }, { id: "b" }])?.id, "b");
  assert.equal(pickLibrarySelection("missing", [{ id: "a" }, { id: "b" }])?.id, "a");
  assert.equal(pickLibrarySelection(undefined, []) ?? null, null);
  console.log("Library selection tests passed.");
}
void main();
