export function canWithdrawActivityRegistration(
  status: "SUBMITTED" | "APPROVED" | "REJECTED",
  checkedInAt: Date | null,
): boolean {
  return status !== "REJECTED" && checkedInAt === null;
}
