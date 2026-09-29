import assert from "node:assert/strict";
import {
  directLibraryChildren,
  isVisibleLibraryFolderPath,
  libraryFolderBreadcrumb,
  libraryFolderDescendantIds,
  type LibraryFolderNode,
} from "../lib/library/tree";

const folders: LibraryFolderNode[] = [
  { id: "root-b", courseId: "course-a", parentId: null, name: "B", sortOrder: 1, isVisible: true },
  { id: "root-a", courseId: "course-a", parentId: null, name: "A", sortOrder: 1, isVisible: true },
  { id: "child", courseId: "course-a", parentId: "root-a", name: "Child", sortOrder: 0, isVisible: true },
  { id: "grandchild", courseId: "course-a", parentId: "child", name: "Grandchild", sortOrder: 0, isVisible: true },
];

assert.deepEqual(directLibraryChildren(folders, null).map((folder) => folder.id), ["root-a", "root-b"]);
assert.deepEqual(directLibraryChildren(folders, "root-a").map((folder) => folder.id), ["child"]);
assert.deepEqual(libraryFolderBreadcrumb(folders, "grandchild")?.map((folder) => folder.id), ["root-a", "child", "grandchild"]);
assert.deepEqual(libraryFolderDescendantIds(folders, "root-a"), ["root-a", "child", "grandchild"]);
assert.equal(isVisibleLibraryFolderPath(folders, "grandchild"), true);
assert.equal(isVisibleLibraryFolderPath(folders.map((folder) => folder.id === "child" ? { ...folder, isVisible: false } : folder), "grandchild"), false);

const crossCourse = folders.map((folder) => folder.id === "child" ? { ...folder, courseId: "course-b" } : folder);
assert.equal(libraryFolderBreadcrumb(crossCourse, "grandchild"), null);
assert.equal(libraryFolderDescendantIds(crossCourse, "root-a"), null);

const cyclic: LibraryFolderNode[] = [
  { id: "one", courseId: "course-a", parentId: "two", name: "One", sortOrder: 0, isVisible: true },
  { id: "two", courseId: "course-a", parentId: "one", name: "Two", sortOrder: 0, isVisible: true },
];
assert.equal(libraryFolderBreadcrumb(cyclic, "one"), null);
assert.equal(libraryFolderDescendantIds(cyclic, "one"), null);
assert.equal(isVisibleLibraryFolderPath(cyclic, "one"), false);

console.log("Library tree tests passed.");
