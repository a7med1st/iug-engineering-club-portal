"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

type RevealVariant = "up" | "left" | "right" | "scale";

const REVEAL_SELECTOR = "[data-reveal]";
const GROUP_SELECTOR = "[data-reveal-group]";
const EXCLUDED_SELECTOR = [
  "[data-no-reveal]",
  "[data-page-transition-overlay]",
  "[data-page-transition-progress]",
  "[role='dialog']",
  "[role='menu']",
  "[role='listbox']",
  "[aria-busy='true']",
  ".site-header",
  ".mobile-navigation",
  ".mobile-menu-backdrop",
  ".mobile-menu-panel",
  ".notification-dropdown",
  ".toast",
  ".skeleton",
].join(",");

// These stable global classes cover the shared public/admin building blocks.
// CSS-module pages can opt in with data-reveal/data-reveal-group directly.
const SHARED_TARGETS: ReadonlyArray<{
  selector: string;
  variant: RevealVariant;
}> = [
  { selector: ".page-hero > .shell", variant: "up" },
  { selector: ".section-head", variant: "up" },
  { selector: ".guide-cover", variant: "scale" },
  { selector: ".guide-section", variant: "up" },
  { selector: ".empty-guide", variant: "up" },
  { selector: ".activities-empty-state-public", variant: "up" },
  { selector: ".admin-page-head", variant: "up" },
  { selector: ".admin-card", variant: "up" },
  { selector: ".contact-admin-header", variant: "up" },
  { selector: ".contact-admin-section", variant: "up" },
  { selector: ".contact-admin-empty", variant: "up" },
  { selector: ".activity-registration-hero > *", variant: "up" },
  { selector: ".activity-registration-card", variant: "scale" },
  { selector: ".activity-registration-state", variant: "up" },
];

const SHARED_GROUPS: ReadonlyArray<{
  selector: string;
  variant: RevealVariant;
}> = [
  { selector: ".stats-grid", variant: "up" },
  { selector: ".feature-grid", variant: "scale" },
  { selector: ".dept-grid", variant: "scale" },
  { selector: ".activity-grid", variant: "up" },
  { selector: ".activities-list", variant: "up" },
  { selector: ".past-activities-grid", variant: "up" },
  { selector: ".about-grid", variant: "up" },
  { selector: ".activity-registration-stats", variant: "up" },
  { selector: ".contact-admin-stats", variant: "up" },
];

function isVariant(value: string | undefined): value is RevealVariant {
  return value === "up" || value === "left" || value === "right" || value === "scale";
}

function isExcluded(element: HTMLElement) {
  return Boolean(element.closest(EXCLUDED_SELECTOR));
}

function isRendered(element: HTMLElement) {
  return element.getClientRects().length > 0;
}

function setRevealVariant(element: HTMLElement, variant: RevealVariant) {
  if (!isVariant(element.dataset.reveal)) {
    element.dataset.reveal = variant;
  }
}

function applySharedPresets(scope: ParentNode) {
  SHARED_TARGETS.forEach(({ selector, variant }) => {
    if (scope instanceof HTMLElement && scope.matches(selector)) {
      setRevealVariant(scope, variant);
    }
    scope.querySelectorAll<HTMLElement>(selector).forEach((element) => {
      setRevealVariant(element, variant);
    });
  });

  SHARED_GROUPS.forEach(({ selector, variant }) => {
    if (scope instanceof HTMLElement && scope.matches(selector)) {
      if (!isVariant(scope.dataset.revealGroup)) {
        scope.dataset.revealGroup = variant;
      }
    }
    scope.querySelectorAll<HTMLElement>(selector).forEach((group) => {
      if (!isVariant(group.dataset.revealGroup)) {
        group.dataset.revealGroup = variant;
      }
    });
  });
}

function applyGroup(group: HTMLElement) {
  const requestedVariant = group.dataset.revealGroup;
  const variant = isVariant(requestedVariant) ? requestedVariant : "up";

  Array.from(group.children).forEach((child, index) => {
    if (!(child instanceof HTMLElement) || isExcluded(child)) return;

    setRevealVariant(child, variant);
    if (child.dataset.revealDelay === undefined) {
      child.dataset.revealDelay = String(index % 4);
    }
  });
}

export default function ScrollReveal() {
  const pathname = usePathname();

  useEffect(() => {
    const root = document.querySelector<HTMLElement>(
      "main[data-page-transition-content]",
    );

    if (!root || pathname.startsWith("/member/chat") || pathname.includes("/print")) {
      return;
    }

    const reducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    const handled = new WeakSet<HTMLElement>();

    const observer = reducedMotion || !("IntersectionObserver" in window)
      ? null
      : new IntersectionObserver(
          (entries) => {
            entries.forEach((entry) => {
              if (!entry.isIntersecting) return;

              const element = entry.target as HTMLElement;
              element.dataset.revealState = "visible";
              observer?.unobserve(element);
            });
          },
          { threshold: 0.12, rootMargin: "0px 0px -60px 0px" },
        );

    function register(element: HTMLElement) {
      if (handled.has(element) || isExcluded(element) || !isRendered(element)) {
        return;
      }

      // Do not stack reveal transforms/opacity on nested opted-in containers.
      const revealParent = element.parentElement?.closest<HTMLElement>(REVEAL_SELECTOR);
      if (revealParent && revealParent !== element) return;

      handled.add(element);

      if (reducedMotion || !observer) {
        element.dataset.revealState = "visible";
        return;
      }

      const bounds = element.getBoundingClientRect();
      const isAlreadyReached = bounds.top <= window.innerHeight + 50;

      if (isAlreadyReached) {
        // Above-the-fold content, especially heroes, must never flash hidden.
        element.dataset.revealState = "visible";
        return;
      }

      element.dataset.revealState = "pending";
      observer?.observe(element);
    }

    function scan(scope: ParentNode) {
      applySharedPresets(scope);

      const parentGroup =
        scope instanceof HTMLElement
          ? scope.parentElement?.closest<HTMLElement>(GROUP_SELECTOR)
          : null;
      if (parentGroup) applyGroup(parentGroup);

      if (scope instanceof HTMLElement && scope.matches(GROUP_SELECTOR)) {
        applyGroup(scope);
      }
      scope.querySelectorAll<HTMLElement>(GROUP_SELECTOR).forEach(applyGroup);

      if (scope instanceof HTMLElement && scope.matches(REVEAL_SELECTOR)) {
        register(scope);
      }
      scope.querySelectorAll<HTMLElement>(REVEAL_SELECTOR).forEach(register);
    }

    scan(root);

    // Supports streamed App Router content without observing every render.
    const mutationObserver = new MutationObserver((records) => {
      records.forEach((record) => {
        record.addedNodes.forEach((node) => {
          if (node instanceof HTMLElement) scan(node);
        });
      });
    });

    mutationObserver.observe(root, { childList: true, subtree: true });

    return () => {
      mutationObserver.disconnect();
      observer?.disconnect();
    };
  }, [pathname]);

  return null;
}
