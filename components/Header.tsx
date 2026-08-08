import Link from "next/link";
import Image from "next/image";
import { getSession } from "@/lib/auth";

export default async function Header() {
  const session = await getSession();

  return (
    <header className="site-header">
      <div className="shell header-inner">

        <Link className="brand" href="/">
          <div className="brand-logo-box">
            <Image
              src="/images/club-logo.png"
              alt="شعار النادي الهندسي"
              width={180}
              height={180}
              className="brand-logo"
              priority
            />
          </div>

          <span className="brand-text">
            <strong>النادي الهندسي</strong>
            <small>Engineering Club · IUG</small>
          </span>
        </Link>

        <nav className="main-nav" aria-label="التنقل الرئيسي">
          <Link href="/">الرئيسية</Link>
          <Link href="/activities">الأنشطة</Link>
          <Link href="/departments">الأقسام</Link>
          <Link href="/delegates">المناديب</Link>
          <Link href="/about">من نحن</Link>
        </nav>

        <div className="header-actions">
          {session?.role === "ADMIN" && (
            <Link className="ghost-btn" href="/admin">
              لوحة الإدارة
            </Link>
          )}

          {session?.role === "MEMBER" && (
            <Link className="ghost-btn" href="/member">
              لوحة العضو
            </Link>
          )}

          {session ? (
            <form action="/api/auth/logout" method="post">
              <button
                className="primary-btn small"
                type="submit"
              >
                تسجيل الخروج
              </button>
            </form>
          ) : (
            <Link
              className="primary-btn small"
              href="/login"
            >
              تسجيل الدخول
            </Link>
          )}
        </div>

      </div>
    </header>
  );
}