import { KeyRound } from "lucide-react";
import { redirect } from "next/navigation";

import PasswordFlowShell from "@/components/auth/PasswordFlowShell";
import { getCurrentUser } from "@/lib/auth";

import ChangePasswordForm from "./ChangePasswordForm";

export const dynamic = "force-dynamic";

export default async function ChangePasswordPage() {
  const auth = await getCurrentUser();
  if (!auth) redirect("/login?portal=member");

  if (!auth.user.mustChangePassword) {
    redirect(
      auth.user.role === "ADMIN"
        ? "/admin"
        : auth.user.role === "MEMBER"
          ? "/member"
          : "/student",
    );
  }

  return (
    <PasswordFlowShell
      icon={<KeyRound />}
      title="تغيير كلمة المرور المؤقتة"
      description="لحماية حسابك، أنشئ كلمة مرور جديدة قبل متابعة استخدام البوابة."
    >
      <ChangePasswordForm />
    </PasswordFlowShell>
  );
}
