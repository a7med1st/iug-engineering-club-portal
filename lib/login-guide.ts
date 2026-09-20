export const LOGIN_GUIDE_STORAGE_KEY = "engineering-club-login-guide-completed";
export type LoginGuideDevice = "mobile" | "tablet" | "desktop";

export type LoginGuideStep =
  | "desktop-login"
  | "mobile-menu"
  | "mobile-login"
  | "portal"
  | "credentials";

export function getLoginGuideDevice(viewportWidth: number): LoginGuideDevice {
  if (viewportWidth < 600) return "mobile";
  if (viewportWidth <= 1100) return "tablet";
  return "desktop";
}

export function getLoginGuideStorageKey(device: LoginGuideDevice) {
  return `${LOGIN_GUIDE_STORAGE_KEY}:${device}`;
}

export function shouldAutoStartLoginGuide({
  authenticated,
  completed,
}: {
  authenticated: boolean;
  completed: boolean;
}) {
  return !authenticated && !completed;
}

export function getLoginGuideStartStep({
  mobile,
  pathname,
}: {
  mobile: boolean;
  pathname: string;
}): LoginGuideStep {
  if (pathname.startsWith("/login")) return "portal";
  return mobile ? "mobile-menu" : "desktop-login";
}
