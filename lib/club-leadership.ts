export function isClubLeadership(
  position: string | null | undefined,
): boolean {
  if (!position) return false;

  const positionLower = position.toLowerCase();

  return (
    positionLower.includes("رئيس النادي") ||
    positionLower.includes("نائب رئيس النادي") ||
    positionLower.includes("club president") ||
    positionLower.includes("vice president")
  );
}
