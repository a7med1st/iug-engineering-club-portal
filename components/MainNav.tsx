"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/", label: "الرئيسية" },
  { href: "/activities", label: "الأنشطة" },
  { href: "/departments", label: "الأقسام" },
  { href: "/delegates", label: "المناديب" },
  { href: "/about", label: "من نحن" },
];

export default function MainNav() {
  const pathname = usePathname();

  return (
    <nav className="main-nav" aria-label="التنقل الرئيسي">
      {links.map((link) => {
        const active =
          link.href === "/"
            ? pathname === "/"
            : pathname.startsWith(link.href);

        return (
          <Link
            key={link.href}
            href={link.href}
            className={active ? "active" : ""}
            aria-current={active ? "page" : undefined}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}