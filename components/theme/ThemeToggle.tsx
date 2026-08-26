"use client";

import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";

type Theme = "light" | "dark";

const STORAGE_KEY = "engineering-club-theme";
const THEME_EVENT = "engineering-club-theme-change";

function currentTheme(): Theme {
  return document.documentElement.dataset.theme === "dark" ? "dark" : "light";
}

function applyTheme(theme: Theme, persist = true) {
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;

  if (persist) {
    try {
      window.localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      // The visual preference still works when storage is unavailable.
    }
  }

  window.dispatchEvent(new CustomEvent(THEME_EVENT, { detail: theme }));
}

export default function ThemeToggle({ className = "" }: { className?: string }) {
  const [theme, setTheme] = useState<Theme>("light");

  useEffect(() => {
    const systemPreference = window.matchMedia("(prefers-color-scheme: dark)");
    const syncTheme = () => setTheme(currentTheme());
    const syncStoredTheme = (event: StorageEvent) => {
      if (event.key !== STORAGE_KEY) return;

      const nextTheme =
        event.newValue === "dark" || event.newValue === "light"
          ? event.newValue
          : window.matchMedia("(prefers-color-scheme: dark)").matches
            ? "dark"
            : "light";

      applyTheme(nextTheme, false);
    };
    const syncSystemTheme = (event: MediaQueryListEvent) => {
      try {
        if (window.localStorage.getItem(STORAGE_KEY)) return;
      } catch {
        // Follow the system when persistent storage is unavailable.
      }

      applyTheme(event.matches ? "dark" : "light", false);
    };

    syncTheme();
    window.addEventListener(THEME_EVENT, syncTheme);
    window.addEventListener("storage", syncStoredTheme);
    systemPreference.addEventListener("change", syncSystemTheme);

    return () => {
      window.removeEventListener(THEME_EVENT, syncTheme);
      window.removeEventListener("storage", syncStoredTheme);
      systemPreference.removeEventListener("change", syncSystemTheme);
    };
  }, []);

  const dark = theme === "dark";
  const label = dark ? "تفعيل الوضع الفاتح" : "تفعيل الوضع الداكن";

  return (
    <button
      type="button"
      className={`theme-toggle${dark ? " is-dark" : ""}${
        className ? ` ${className}` : ""
      }`}
      aria-label={label}
      title={label}
      aria-pressed={dark}
      onClick={() => applyTheme(dark ? "light" : "dark")}
    >
      <span className="theme-toggle-icon" aria-hidden="true">
        {dark ? <Sun /> : <Moon />}
      </span>
    </button>
  );
}
