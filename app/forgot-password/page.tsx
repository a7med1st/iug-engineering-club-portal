import { MailQuestion } from "lucide-react";

import PasswordFlowShell from "@/components/auth/PasswordFlowShell";

import ForgotPasswordForm from "./ForgotPasswordForm";

export default async function ForgotPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ portal?: string }>;
}) {
  const { portal } = await searchParams;

  return (
    <PasswordFlowShell
      icon={<MailQuestion />}
      title="استعادة كلمة المرور"
      description="أدخل بريد حسابك وسنرسل رمزًا مؤقتًا إذا كان الحساب مؤهلًا للاستعادة."
    >
      <ForgotPasswordForm portal={portal === "member" ? "member" : "student"} />
    </PasswordFlowShell>
  );
}
