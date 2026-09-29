export type LibraryFolderNode = {
  id: string;
  courseId: string;
  parentId: string | null;
  name: string;
  sortOrder: number;
  isVisible: boolean;
};

function compareFolders(left: LibraryFolderNode, right: LibraryFolderNode) {
  return left.sortOrder - right.sortOrder
    || left.name.localeCompare(right.name, "ar")
    || left.id.localeCompare(right.id);
}

export function directLibraryChildren(
  folders: readonly LibraryFolderNode[],
  parentId: string | null,
) {
  return folders.filter((folder) => folder.parentId === parentId).sort(compareFolders);
}

export function libraryFolderBreadcrumb(
  folders: readonly LibraryFolderNode[],
  folderId: string,
): LibraryFolderNode[] | null {
  const byId = new Map(folders.map((folder) => [folder.id, folder]));
  const selected = byId.get(folderId);
  if (!selected) return null;

  const path: LibraryFolderNode[] = [];
  const visited = new Set<string>();
  let current: LibraryFolderNode | undefined = selected;

  while (current) {
    if (visited.has(current.id) || current.courseId !== selected.courseId) return null;
    visited.add(current.id);
    path.push(current);
    if (!current.parentId) break;
    current = byId.get(current.parentId);
    if (!current) return null;
  }

  return path.reverse();
}

export function libraryFolderDescendantIds(
  folders: readonly LibraryFolderNode[],
  folderId: string,
): string[] | null {
  const byId = new Map(folders.map((folder) => [folder.id, folder]));
  const selected = byId.get(folderId);
  if (!selected || !libraryFolderBreadcrumb(folders, folderId)) return null;

  const children = new Map<string, LibraryFolderNode[]>();
  for (const folder of folders) {
    if (!folder.parentId) continue;
    const siblings = children.get(folder.parentId) ?? [];
    siblings.push(folder);
    children.set(folder.parentId, siblings);
  }

  const result: string[] = [];
  const visited = new Set<string>();
  const visit = (folder: LibraryFolderNode): boolean => {
    if (visited.has(folder.id) || folder.courseId !== selected.courseId) return false;
    visited.add(folder.id);
    result.push(folder.id);
    for (const child of (children.get(folder.id) ?? []).sort(compareFolders)) {
      if (!visit(child)) return false;
    }
    return true;
  };

  return visit(selected) ? result : null;
}

export function isVisibleLibraryFolderPath(
  folders: readonly LibraryFolderNode[],
  folderId: string,
) {
  const path = libraryFolderBreadcrumb(folders, folderId);
  return Boolean(path?.every((folder) => folder.isVisible));
}
