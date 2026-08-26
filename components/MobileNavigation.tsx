"use client";

import Link from "next/link";
import { Menu, X } from "lucide-react";
import { usePathname } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import ThemeToggle from "@/components/theme/ThemeToggle";

type NavigationItem = {
  href: string;
  label: string;
};

type MobileNavigationProps = {
  links: NavigationItem[];
  portal: NavigationItem | null;
  authenticated: boolean;
};

export default function MobileNavigation({
  links,
  portal,
  authenticated,
}: MobileNavigationProps) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const panelId = useId();
  const titleId = `${panelId}-title`;
  const toggleRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const panel = panelRef.current;
    const focusableSelector =
      'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])';
    const focusable = panel
      ? Array.from(panel.querySelectorAll<HTMLElement>(focusableSelector))
      : [];
    focusable[0]?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        toggleRef.current?.focus();
        return;
      }

      if (event.key !== "Tab" || focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  function isActive(href: string) {
    return href === "/" ? pathname === href : pathname.startsWith(href);
  }

  function closeMenu(restoreFocus = false) {
    setOpen(false);
    if (restoreFocus) {
      window.requestAnimationFrame(() => toggleRef.current?.focus());
    }
  }

  return (
    <div className="mobile-navigation">
      <ThemeToggle className="mobile-theme-toggle" />
      <button
        ref={toggleRef}
        className="mobile-menu-toggle"
        type="button"
        aria-label={open ? "إغلاق قائمة التنقل" : "فتح قائمة التنقل"}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((value) => !value)}
      >
        <Menu aria-hidden="true" />
      </button>

      {open && (
        <>
          <button
            className="mobile-menu-backdrop"
            type="button"
            tabIndex={-1}
            aria-label="إغلاق قائمة التنقل"
            onClick={() => closeMenu(true)}
          />
          <div
            ref={panelRef}
            id={panelId}
            className="mobile-menu-panel"
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
          >
            <div className="mobile-menu-head">
              <strong id={titleId}>قائمة التنقل</strong>
              <button
                className="mobile-menu-close"
                type="button"
                aria-label="إغلاق قائمة التنقل"
                onClick={() => closeMenu(true)}
              >
                <X aria-hidden="true" />
              </button>
            </div>

            <nav className="mobile-menu-links" aria-label="التنقل الرئيسي للجوال">
              {links.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className={isActive(link.href) ? "is-active" : undefined}
                  aria-current={isActive(link.href) ? "page" : undefined}
                  onClick={() => closeMenu()}
                >
                  {link.label}
                </Link>
              ))}
            </nav>

            <div className="mobile-menu-actions">
              {portal && (
                <Link className="ghost-btn" href={portal.href} onClick={() => closeMenu()}>
                  {portal.label}
                </Link>
              )}
              {authenticated ? (
                <form action="/api/auth/logout" method="post">
                  <button className="primary-btn" type="submit">تسجيل الخروج</button>
                </form>
              ) : (
                <Link className="primary-btn" href="/login" onClick={() => closeMenu()}>
                  تسجيل الدخول
                </Link>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
