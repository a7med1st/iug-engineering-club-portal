import type { Metadata } from "next";
import { redirect } from "next/navigation";

import VerifyEmailClient from "./VerifyEmailClient";
import {
  getEmailVerificationContext,
  maskEmail,
} from "@/lib/email-verification";
import { getEmailVerificationSession } from "@/lib/email-verification-session";

export const metadata: Metadata = {
  title:
    "تحقق من بريدك الإلكتروني | النادي الهندسي للطلاب",
};

type VerifyEmailPageProps = {
  searchParams: Promise<{
    delivery?: string;
  }>;
};

export default async function VerifyEmailPage({
  searchParams,
}: VerifyEmailPageProps) {
  const session =
    await getEmailVerificationSession();

  if (!session) {
    redirect("/login?verification=required");
  }

  const context =
    await getEmailVerificationContext(
      session.sub,
    );

  if (!context) {
    redirect("/login?verification=required");
  }

  if (context.emailVerifiedAt) {
    const portal =
      context.role === "STUDENT"
        ? "student"
        : "member";

    redirect(
      `/login?portal=${portal}&verified=1`,
    );
  }

  const query = await searchParams;

  return (
    <VerifyEmailClient
      maskedEmail={maskEmail(context.email)}
      initialResendSeconds={
        context.resendAfterSeconds
      }
      initialDeliveryFailed={
        query.delivery === "failed"
      }
    />
  );
}
