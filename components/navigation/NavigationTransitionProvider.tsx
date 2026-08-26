"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import styles from "./NavigationTransitionProvider.module.css";

type TransitionPhase = "idle" | "exiting" | "loading" | "settling";

const EXIT_DURATION = 175;
const ENTRY_DURATION = 340;
const NAVIGATION_TIMEOUT = 8000;
const CONTENT_SELECTOR = "[data-page-transition-content]";

function prefersReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function getExitDuration() {
  if (prefersReducedMotion()) return 0;
  return window.matchMedia("(max-width: 768px)").matches ? 150 : EXIT_DURATION;
}

function getEntryDuration() {
  if (prefersReducedMotion()) return 20;
  return window.matchMedia("(max-width: 768px)").matches
    ? 290
    : ENTRY_DURATION;
}

function getActiveContent() {
  const scopes = document.querySelectorAll<HTMLElement>(CONTENT_SELECTOR);
  return scopes.item(scopes.length - 1) ?? null;
}

function clearContentAnimationClasses() {
  document.querySelectorAll<HTMLElement>(CONTENT_SELECTOR).forEach((scope) => {
    scope.classList.remove(
      styles.contentExit,
      styles.contentEntry,
      styles.contentEntryActive,
    );
  });
}

function isModifiedClick(event: MouseEvent) {
  return (
    event.button !== 0 ||
    event.metaKey ||
    event.ctrlKey ||
    event.shiftKey ||
    event.altKey
  );
}

function getTransitionDestination(event: MouseEvent) {
  if (event.defaultPrevented || isModifiedClick(event)) return null;

  const target = event.target;
  if (!(target instanceof Element)) return null;

  const anchor = target.closest<HTMLAnchorElement>("a[href]");
  if (!anchor || anchor.dataset.noPageTransition !== undefined) return null;
  if (anchor.hasAttribute("download")) return null;

  const linkTarget = anchor.getAttribute("target");
  if (linkTarget && linkTarget.toLowerCase() !== "_self") return null;

  const rawHref = anchor.getAttribute("href");
  if (!rawHref || rawHref.startsWith("#")) return null;
  if (/^(mailto:|tel:|sms:|javascript:)/i.test(rawHref)) return null;

  let destination: URL;
  try {
    destination = new URL(anchor.href, window.location.href);
  } catch {
    return null;
  }

  if (destination.origin !== window.location.origin) return null;
  if (destination.pathname.startsWith("/api/")) return null;

  // Query and hash changes inside the current route are local UI updates, not
  // full page navigation, so they intentionally bypass the global transition.
  if (destination.pathname === window.location.pathname) return null;

  return `${destination.pathname}${destination.search}${destination.hash}`;
}

export default function NavigationTransitionProvider() {
  const pathname = usePathname();
  const router = useRouter();
  const [phase, setPhase] = useState<TransitionPhase>("idle");
  const phaseRef = useRef<TransitionPhase>("idle");
  const previousPathnameRef = useRef(pathname);
  const pendingNavigationRef = useRef(false);
  const exitTimerRef = useRef<number | null>(null);
  const resetTimerRef = useRef<number | null>(null);
  const entryTimerRef = useRef<number | null>(null);
  const entryFrameRef = useRef<number | null>(null);

  function changePhase(nextPhase: TransitionPhase) {
    phaseRef.current = nextPhase;
    setPhase(nextPhase);
  }

  function clearTimer(timer: React.MutableRefObject<number | null>) {
    if (timer.current !== null) {
      window.clearTimeout(timer.current);
      timer.current = null;
    }
  }

  function resetTransition() {
    clearTimer(exitTimerRef);
    clearTimer(resetTimerRef);
    clearTimer(entryTimerRef);

    if (entryFrameRef.current !== null) {
      window.cancelAnimationFrame(entryFrameRef.current);
      entryFrameRef.current = null;
    }

    pendingNavigationRef.current = false;
    clearContentAnimationClasses();
    changePhase("idle");
  }

  useEffect(() => {
    function handleNavigationClick(event: MouseEvent) {
      const destination = getTransitionDestination(event);
      if (!destination) return;

      if (phaseRef.current !== "idle") {
        event.preventDefault();
        return;
      }

      event.preventDefault();
      pendingNavigationRef.current = true;

      const clickedElement = event.target;
      const anchor =
        clickedElement instanceof Element
          ? clickedElement.closest<HTMLAnchorElement>("a[href]")
          : null;

      anchor?.classList.add(styles.triggered);
      window.setTimeout(
        () => anchor?.classList.remove(styles.triggered),
        240,
      );

      clearContentAnimationClasses();
      getActiveContent()?.classList.add(styles.contentExit);
      changePhase("exiting");

      exitTimerRef.current = window.setTimeout(() => {
        changePhase("loading");
        router.push(destination);
      }, getExitDuration());

      // App Router navigation does not expose a rejecting promise. This guard
      // always restores the page if a route never commits (network/runtime error).
      resetTimerRef.current = window.setTimeout(
        resetTransition,
        NAVIGATION_TIMEOUT,
      );
    }

    document.addEventListener("click", handleNavigationClick, true);
    return () => document.removeEventListener("click", handleNavigationClick, true);
  }, [router]);

  useEffect(() => {
    if (previousPathnameRef.current === pathname) return;

    previousPathnameRef.current = pathname;
    const wasGlobalTransition = pendingNavigationRef.current;
    pendingNavigationRef.current = false;

    clearTimer(exitTimerRef);
    clearTimer(resetTimerRef);
    clearTimer(entryTimerRef);

    clearContentAnimationClasses();
    const content = getActiveContent();

    if (content) {
      content.classList.add(styles.contentEntry);
      // Reading layout here ensures the entry transition starts from its initial
      // state even when a persistent nested layout reuses the same DOM element.
      void content.offsetWidth;

      entryFrameRef.current = window.requestAnimationFrame(() => {
        content.classList.add(styles.contentEntryActive);
        entryFrameRef.current = null;
      });
    }

    if (wasGlobalTransition) changePhase("settling");

    entryTimerRef.current = window.setTimeout(() => {
      clearContentAnimationClasses();
      changePhase("idle");
    }, getEntryDuration());
  }, [pathname]);

  useEffect(
    () => () => {
      clearTimer(exitTimerRef);
      clearTimer(resetTimerRef);
      clearTimer(entryTimerRef);
      if (entryFrameRef.current !== null) {
        window.cancelAnimationFrame(entryFrameRef.current);
      }
      clearContentAnimationClasses();
    },
    [],
  );

  return (
    <>
      <div
        className={`${styles.overlay} ${
          phase !== "idle" ? styles.overlayVisible : ""
        } ${phase === "settling" ? styles.overlaySettling : ""}`}
        data-page-transition-overlay
        aria-hidden="true"
      >
        <span className={styles.sweep} />
      </div>

      <div
        className={`${styles.progress} ${
          phase !== "idle" ? styles.progressVisible : ""
        } ${phase === "settling" ? styles.progressComplete : ""}`}
        data-page-transition-progress
        aria-hidden="true"
      >
        <span className={styles.progressBar} />
      </div>
    </>
  );
}
