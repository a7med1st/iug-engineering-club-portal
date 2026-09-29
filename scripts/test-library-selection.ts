import assert from "node:assert/strict";

async function main() {
  process.env.SESSION_SECRET = "library-test-session-secret-32-characters";
  const { pickLibrarySelection, resolveLibraryFolderNavigation } = await import("../lib/library/queries");
  assert.equal(pickLibrarySelection("b", [{ id: "a" }, { id: "b" }])?.id, "b");
  assert.equal(pickLibrarySelection("missing", [{ id: "a" }, { id: "b" }])?.id, "a");
  assert.equal(pickLibrarySelection(undefined, []) ?? null, null);
  const folders = [
    { id: "root", courseId: "course", parentId: null, name: "Root", sortOrder: 0, isVisible: true },
    { id: "child", courseId: "course", parentId: "root", name: "Child", sortOrder: 0, isVisible: true },
    { id: "grandchild", courseId: "course", parentId: "child", name: "Grandchild", sortOrder: 0, isVisible: true },
  ];
  const root = resolveLibraryFolderNavigation(folders, undefined);
  assert.equal(root.selectedFolder, null);
  assert.deepEqual(root.folders.map((folder) => folder.id), ["root"]);
  const deep = resolveLibraryFolderNavigation(folders, "child");
  assert.equal(deep.selectedFolder?.id, "child");
  assert.deepEqual(deep.folders.map((folder) => folder.id), ["grandchild"]);
  assert.deepEqual(deep.folderBreadcrumb.map((folder) => folder.id), ["root", "child"]);
  assert.equal(resolveLibraryFolderNavigation(folders, "missing").selectedFolder, null);
  console.log("Library selection tests passed.");
}
void main();
