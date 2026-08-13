import Image from "next/image";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { departmentFontClass } from "@/lib/departments";
export default async function DepartmentsPage(){const departments=await prisma.department.findMany({orderBy:{sortOrder:"asc"}});return <><section className="page-hero"><div className="shell"><h1>دليل الأقسام الهندسية</h1><p>كل قسم له صفحة مستقلة. المحتوى التفصيلي متروك للإدارة والمناديب ليتم إضافته عند الجاهزية بدل نشر معلومات غير معتمدة.</p></div></section><section className="section"><div className="shell dept-grid">{departments.map(d=><Link key={d.id} href={`/departments/${d.slug}`} className="dept-card"><Image src={d.coverImage} alt={d.nameAr} fill sizes="(max-width: 700px) 100vw, 50vw"/><div className="dept-card-content"><h3>{d.nameAr}</h3><div className={`en ${departmentFontClass(d.slug)}`}>{d.nameEn}</div></div></Link>)}</div></section></>}
