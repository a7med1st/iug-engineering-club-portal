export function getSafeReturnTo(
  value: string | null | undefined,
): string | null {
  if (
    !value ||
    !value.startsWith("/") ||
    value.startsWith("//") ||
    value.includes("\\")
  ) {
    return null;
  }

  return value;
}

export function appendReturnTo(
  path: string,
  returnTo: string | null,
): string {
  if (!returnTo) return path;

  const separator = path.includes("?") ? "&" : "?";
  return `${path}${separator}returnTo=${encodeURIComponent(returnTo)}`;
}
