"use client";
import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { appendReturnTo, getSafeReturnTo } from "@/lib/safe-return-to";

export default function AuthForm() {
  const search = useSearchParams();
  const router = useRouter();
  const returnTo = useMemo(() => {
    return getSafeReturnTo(search.get("returnTo"));
  }, [search]);
  const initial = search.get("portal") === "member" ? "member" : "student";
  const [portal, setPortal] = useState<"student" | "member">(initial);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const title = useMemo(() => portal === "student" ? "دخول الطالب" : "دخول عضو النادي", [portal]);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); setError(""); setLoading(true);
    const fd = new FormData(e.currentTarget);
    try {
      const res = await fetch("/api/auth/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email: fd.get("email"), password: fd.get("password"), portal }) });
      const data = await res.json().catch(() => ({}));

      if (data.verificationRequired && data.redirect) {
        router.push(appendReturnTo(data.redirect, returnTo));
        return;
      }

      if (!res.ok) {
        setError(data.error || "تعذر تسجيل الدخول");
        return;
      }

      router.push(returnTo || data.redirect || "/");
      router.refresh();
    } catch {
      setError("تعذر الاتصال بالخادم. حاول مرة أخرى.");
    } finally {
      setLoading(false);
    }
  }
  return (
    <div className="auth-card">
      <div className="portal-switch">
        <button className={portal === "student" ? "active" : ""} onClick={() => setPortal("student")} type="button">طالب</button>
        <button className={portal === "member" ? "active" : ""} onClick={() => setPortal("member")} type="button">عضو</button>
      </div>
      <h1>{title}</h1>
      <p>{portal === "student" ? "استخدم البريد الإلكتروني المرتبط بحساب الطالب الذي أنشأته." : "حسابات الأعضاء تُنشأ حصريًا بواسطة مدير النظام ولا يوجد تسجيل ذاتي للأعضاء."}</p>
      <form onSubmit={submit} className="stack-form">
        <label>البريد الإلكتروني<input type="email" name="email" required autoComplete="email" placeholder="name@gmail.com" /></label>
        <label>كلمة المرور<input type="password" name="password" required minLength={8} autoComplete="current-password" /></label>
        {error && <div className="form-error">{error}</div>}
        <button className="primary-btn" disabled={loading}>{loading ? "جارٍ التحقق..." : "دخول"}</button>
      </form>
      {portal === "student" && <p className="auth-foot">لا تملك حسابًا؟ <Link href="/student/register">إنشاء حساب طالب</Link></p>}
    </div>
  );
}
