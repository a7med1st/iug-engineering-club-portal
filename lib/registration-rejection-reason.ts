export const MAX_REGISTRATION_REJECTION_REASON_LENGTH = 500;

export function registrationRejectionReason(status: string, rawReason: unknown): string | null {
  if (status !== "REJECTED") return null;

  const reason = String(rawReason ?? "").trim();
  if (!reason) throw new Error("يرجى كتابة سبب الرفض.");
  if (reason.length > MAX_REGISTRATION_REJECTION_REASON_LENGTH) {
    throw new Error("سبب الرفض طويل جدًا. الحد الأقصى 500 حرف.");
  }

  return reason;
}
