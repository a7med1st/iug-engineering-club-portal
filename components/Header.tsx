import Image from "next/image";
import Link from "next/link";

import { getSession } from "@/lib/auth";
import MainNav from "@/components/MainNav";
import MobileNavigation from "@/components/MobileNavigation";

const navigationLinks = [
  { href: "/", label: "الرئيسية" },
  { href: "/activities", label: "الأنشطة" },
  { href: "/departments", label: "الأقسام" },
  { href: "/delegates", label: "المناديب" },
  { href: "/contact", label: "بوابة التواصل" },
  { href: "/about", label: "من نحن" },
];

export default async function Header() {
  const session = await getSession();

  const portal =
    session?.role === "ADMIN"
      ? {
          href: "/admin",
          label: "لوحة الإدارة",
        }
      : session?.role === "MEMBER"
        ? {
            href: "/member",
            label: "بوابة العضو",
          }
        : session?.role === "STUDENT"
          ? {
              href: "/student",
              label: "لوحتي",
            }
          : null;

  return (
    <header className="site-header">
      <div className="shell header-inner">

        {/* =========================================
            BRAND
        ========================================= */}

        <Link
          className="brand"
          href="/"
          aria-label="العودة إلى الصفحة الرئيسية"
        >
          <span className="brand-logo-box">
            <Image
              src="/images/club-logo.png"
              alt="شعار النادي الهندسي"
              width={180}
              height={180}
              className="brand-logo"
              priority
            />
          </span>

          <span className="brand-text">
            <strong>
              النادي الهندسي للطلاب
            </strong>
          </span>
        </Link>


        {/* =========================================
            DESKTOP NAVIGATION
        ========================================= */}

        <MainNav />


        {/* =========================================
            DESKTOP ACTIONS
        ========================================= */}

        <div className="header-actions desktop-header-actions">

          {portal && (
            <Link
              className="ghost-btn"
              href={portal.href}
            >
              {portal.label}
            </Link>
          )}


          {session ? (
            <form
              action="/api/auth/logout"
              method="post"
            >
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


        {/* =========================================
            MOBILE NAVIGATION
        ========================================= */}

        <MobileNavigation
          links={navigationLinks}
          portal={portal}
          authenticated={Boolean(session)}
        />

      </div>
    </header>
  );
}