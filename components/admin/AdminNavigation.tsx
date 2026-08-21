"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import {
  BookOpenText,
  CalendarPlus,
  Menu,
  MessageSquareText,
  Network,
  UserRound,
  Users,
  X,
  LayoutDashboard,
  FileSpreadsheet,
  Award,
} from "lucide-react";

const adminLinks = [
  {
    href: "/admin/certificates",
    label: "الشهادات",
    icon: Award,
  },
  {
    href: "/admin/reports",
    label: "التقارير",
    icon: FileSpreadsheet,
  },
  {
    href: "/admin/dashboard",
    label: "الإحصائيات",
    icon: LayoutDashboard,
  },
  {
    href: "/member/profile",
    label: "ملفي الشخصي",
    icon: UserRound,
  },
  {
    href: "/admin/activities",
    label: "إضافة نشاط",
    icon: CalendarPlus,
  },
  {
    href: "/admin/members",
    label: "حسابات الأعضاء",
    icon: Users,
  },
  {
    href: "/admin/structure",
    label: "الهيكلية العامة",
    icon: Network,
  },
  {
    href: "/admin/guides",
    label: "أدلة الأقسام",
    icon: BookOpenText,
  },
  {
    href: "/admin/contact",
    label: "إدارة التواصل",
    icon: MessageSquareText,
  },
];

function AdminLinks({
  pathname,
  allowedHrefs,
  onNavigate,
}: {
  pathname: string;
  allowedHrefs: string[];
  onNavigate?: () => void;
}) {
  return (
    <nav aria-label="صفحات لوحة الإدارة">
      {adminLinks
        .filter(
          ({ href }) =>
            href === "/member/profile" ||
            (href === "/admin/certificates" &&
              allowedHrefs.includes("/admin/members")) ||
            (href === "/admin/reports" &&
              allowedHrefs.includes("/admin/activities")) ||
            (href === "/admin/dashboard" &&
              allowedHrefs.includes("/admin/members")) ||
            allowedHrefs.includes(href),
        )
        .map(({ href, label, icon: Icon }) => {
          const active =
            pathname === href ||
            pathname.startsWith(`${href}/`);

          return (
            <Link
              className={`admin-nav-link${active ? " active" : ""}`}
              href={href}
              key={href}
              aria-current={active ? "page" : undefined}
              onClick={onNavigate}
            >
              <Icon
                aria-hidden="true"
                size={18}
                strokeWidth={1.8}
              />

              <span>{label}</span>
            </Link>
          );
        })}
    </nav>
  );
}

export default function AdminNavigation({
  allowedHrefs,
  title = "لوحة الإدارة",
}: {
  allowedHrefs: string[];
  title?: string;
}) {
  const pathname = usePathname();

  const [open, setOpen] = useState(false);

  const toggleRef = useRef<HTMLButtonElement>(null);
  const drawerRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!open) return;

    const previousOverflow =
      document.body.style.overflow;

    document.body.style.overflow = "hidden";

    const focusable = Array.from(
      drawerRef.current?.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])',
      ) ?? [],
    );

    focusable[0]?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);

        window.requestAnimationFrame(() =>
          toggleRef.current?.focus(),
        );

        return;
      }

      if (
        event.key !== "Tab" ||
        !focusable.length
      ) {
        return;
      }

      const first = focusable[0];
      const last =
        focusable[focusable.length - 1];

      if (
        event.shiftKey &&
        document.activeElement === first
      ) {
        event.preventDefault();
        last.focus();
      } else if (
        !event.shiftKey &&
        document.activeElement === last
      ) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener(
      "keydown",
      handleKeyDown,
    );

    return () => {
      document.body.style.overflow =
        previousOverflow;

      document.removeEventListener(
        "keydown",
        handleKeyDown,
      );
    };
  }, [open]);

  function closeDrawer(
    restoreFocus = false,
  ) {
    setOpen(false);

    if (restoreFocus) {
      window.requestAnimationFrame(() =>
        toggleRef.current?.focus(),
      );
    }
  }

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="admin-side">
        <h2>{title}</h2>

        <AdminLinks
          pathname={pathname}
          allowedHrefs={allowedHrefs}
        />
      </aside>

      {/* Mobile top bar */}
      <div className="admin-mobile-nav">
        <strong>{title}</strong>

        <button
          ref={toggleRef}
          className="admin-mobile-toggle"
          type="button"
          aria-label={
            open
              ? "إغلاق قائمة الإدارة"
              : "فتح قائمة الإدارة"
          }
          aria-expanded={open}
          aria-controls="admin-mobile-drawer"
          onClick={() =>
            open
              ? closeDrawer(true)
              : setOpen(true)
          }
        >
          {open ? (
            <X aria-hidden="true" />
          ) : (
            <Menu aria-hidden="true" />
          )}
        </button>
      </div>

      {/* Mobile backdrop */}
      {open && (
        <button
          className="admin-mobile-backdrop"
          type="button"
          aria-label="إغلاق قائمة الإدارة"
          onClick={() =>
            closeDrawer(true)
          }
        />
      )}

      {/* Mobile drawer */}
      <aside
        ref={drawerRef}
        id="admin-mobile-drawer"
        className="admin-mobile-drawer"
        data-state={
          open ? "open" : "closed"
        }
        role="dialog"
        aria-modal={
          open ? "true" : undefined
        }
        aria-label="صفحات لوحة الإدارة"
        aria-hidden={!open}
      >
        <div className="admin-mobile-drawer-head">
          <strong>
            صفحات الإدارة
          </strong>

          <button
            type="button"
            aria-label="إغلاق القائمة"
            onClick={() =>
              closeDrawer(true)
            }
          >
            <X
              aria-hidden="true"
              size={22}
            />
          </button>
        </div>

        <AdminLinks
          pathname={pathname}
          allowedHrefs={allowedHrefs}
          onNavigate={() =>
            closeDrawer(true)
          }
        />
      </aside>
    </>
  );
}