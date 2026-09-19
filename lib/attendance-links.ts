import { createHash, randomBytes } from "node:crypto";

export type AttendanceLinkState =
  | "ACTIVE"
  | "DISABLED"
  | "NOT_OPEN"
  | "EXPIRED";

type AttendanceWindow = {
  isActive: boolean;
  opensAt: Date | null;
  closesAt: Date | null;
};

export function hashAttendanceToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function createAttendanceToken() {
  const token = randomBytes(32).toString("base64url");

  return {
    token,
    tokenHash: hashAttendanceToken(token),
    tokenPrefix: token.slice(0, 8),
  };
}

export function getAttendanceLinkState(
  link: AttendanceWindow,
  now = new Date(),
): AttendanceLinkState {
  if (!link.isActive) return "DISABLED";
  if (link.opensAt && now < link.opensAt) return "NOT_OPEN";
  if (link.closesAt && now > link.closesAt) return "EXPIRED";
  return "ACTIVE";
}

export function validateAttendanceWindow(
  opensAt: Date | null,
  closesAt: Date | null,
) {
  if (opensAt && closesAt && closesAt <= opensAt) {
    return "يجب أن يكون وقت إغلاق رابط الحضور بعد وقت فتحه.";
  }

  return null;
}
