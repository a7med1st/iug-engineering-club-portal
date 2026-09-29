type OrderableItem = { id: string; sortOrder: number; createdAt?: Date };

export function orderedLibraryItems<T extends OrderableItem>(items: readonly T[]): T[] {
  return [...items].sort((left, right) =>
    left.sortOrder - right.sortOrder
    || (left.createdAt?.getTime() ?? 0) - (right.createdAt?.getTime() ?? 0)
    || left.id.localeCompare(right.id),
  );
}

export function libraryAdjacentSwap<T extends OrderableItem>(
  items: readonly T[],
  itemId: string,
  direction: "up" | "down",
) {
  const ordered = orderedLibraryItems(items);
  const normalized = ordered.map((item, sortOrder) => ({ id: item.id, sortOrder }));
  const index = ordered.findIndex((item) => item.id === itemId);
  const adjacentIndex = direction === "up" ? index - 1 : index + 1;
  if (index < 0 || adjacentIndex < 0 || adjacentIndex >= ordered.length) return { normalized, swap: [] };
  return {
    normalized,
    swap: [
      { id: ordered[index].id, sortOrder: adjacentIndex },
      { id: ordered[adjacentIndex].id, sortOrder: index },
    ],
  };
}
