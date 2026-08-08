import RegisterForm from "@/components/RegisterForm";
import { prisma } from "@/lib/prisma";
export default async function Register(){const departments=await prisma.department.findMany({select:{id:true,nameAr:true},orderBy:{sortOrder:"asc"}});return <div className="auth-shell"><div className="auth-card"><div className="eyebrow">Student account</div><h1>إنشاء حساب طالب</h1><p>يمكنك التسجيل بأي بريد إلكتروني صالح، ولا يمكن استخدام هذا الحساب إلا من بوابة دخول الطلاب.</p><RegisterForm departments={departments}/></div></div>}
