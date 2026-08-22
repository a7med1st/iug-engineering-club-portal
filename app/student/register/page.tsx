import RegisterForm from "@/components/RegisterForm";
import { prisma } from "@/lib/prisma";

export default async function Register() {
  const departments =
    await prisma.department.findMany({
      select: { id: true, nameAr: true },
      orderBy: { sortOrder: "asc" },
    });

  return (
    <div className="auth-shell">
      <div className="auth-card">
        <h1>إنشاء حساب طالب</h1>
        <p>
          استخدم بريدًا إلكترونيًا من مزود معتمد.
          سنرسل إليه رمزًا من 6 أرقام لتأكيد ملكيتك
          للبريد قبل تسجيل الدخول.
        </p>
        <RegisterForm departments={departments} />
      </div>
    </div>
  );
}
