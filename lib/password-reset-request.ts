import {
  assertEmailDeliveryConfigured,
  sendPasswordResetCode,
} from "@/lib/mail";
import {
  invalidateUndeliveredPasswordResetCode,
  issuePasswordResetCode,
} from "@/lib/password-reset";

export async function deliverPasswordResetCode(normalizedEmail: string) {
  const issued = await issuePasswordResetCode(normalizedEmail);

  if (issued.status !== "ISSUED") return;

  try {
    assertEmailDeliveryConfigured();
    await sendPasswordResetCode({
      email: issued.email,
      name: issued.name,
      code: issued.code,
    });
  } catch (error) {
    await invalidateUndeliveredPasswordResetCode(
      issued.userId,
      issued.codeHash,
    );
    console.error(
      "[password-reset] Email delivery failed.",
      error instanceof Error ? error.name : "UnknownError",
    );
  }
}
