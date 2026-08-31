import { ShieldCheck } from "lucide-react";

import PasswordFlowShell from "@/components/auth/PasswordFlowShell";

import ResetPasswordForm from "./ResetPasswordForm";

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string; portal?: string }>;
}) {
  const params = await searchParams;

  return (
    <PasswordFlowShell
      icon={<ShieldCheck />}
      title="تعيين كلمة مرور جديدة"
      description="أدخل رمز الاستعادة المكوّن من 6 أرقام ثم اختر كلمة مرور جديدة."
    >
      <ResetPasswordForm
        initialEmail={params.email?.slice(0, 254) ?? ""}
        portal={params.portal === "member" ? "member" : "student"}
      />
    </PasswordFlowShell>
  );
}
