"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function RegisterForm({ departments }: { departments: { id: string; nameAr: string }[] }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); setLoading(true); setError("");
    const fd = new FormData(e.currentTarget);
    const res = await fetch("/api/auth/register-student", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(Object.fromEntries(fd.entries())) });
    const data = await res.json().catch(() => ({})); setLoading(false);
    if (!res.ok) return setError(data.error || "تعذر إنشاء الحساب");
    router.push("/login?portal=student&created=1");
  }
  return <form onSubmit={submit} className="stack-form">
    <label>الاسم الكامل<input name="name" required minLength={2} /></label>
    <label>البريد الإلكتروني<input name="email" type="email" required placeholder="يمكن استخدام Gmail أو أي نطاق آخر" /></label>
    <label>القسم<select name="departmentId" defaultValue=""><option value="">اختياري</option>{departments.map(d => <option key={d.id} value={d.id}>{d.nameAr}</option>)}</select></label>
    <label>كلمة المرور<input name="password" type="password" required minLength={8} /></label>
    {error && <div className="form-error">{error}</div>}
    <button className="primary-btn" disabled={loading}>{loading ? "جارٍ الإنشاء..." : "إنشاء حساب الطالب"}</button>
  </form>;
}
