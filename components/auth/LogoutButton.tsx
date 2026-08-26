"use client";

import { FormEvent, useEffect, useRef, useState } from "react";

const EXIT_ANIMATION_MS = 720;

export default function LogoutButton() {
  const formRef = useRef<HTMLFormElement>(null);
  const timerRef = useRef<number | null>(null);
  const [exiting, setExiting] = useState(false);

  useEffect(
    () => () => {
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
      }
    },
    [],
  );

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (exiting) return;

    setExiting(true);

    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    timerRef.current = window.setTimeout(
      () => formRef.current?.submit(),
      reduceMotion ? 0 : EXIT_ANIMATION_MS,
    );
  }

  const label = exiting ? "جارٍ تسجيل الخروج" : "تسجيل الخروج";

  return (
    <form
      ref={formRef}
      action="/api/auth/logout"
      method="post"
      className="logout-icon-form"
      onSubmit={handleSubmit}
    >
      <button
        type="submit"
        className={`logout-icon-button${exiting ? " is-exiting" : ""}`}
        aria-label={label}
        title={label}
        aria-busy={exiting}
        disabled={exiting}
      >
        <span className="logout-icon-scene" aria-hidden="true">
          <svg
            className="logout-stickman-icon"
            viewBox="0 0 52 42"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <g transform="translate(52 0) scale(-1 1)">
              <g className="logout-stickman">
                <circle className="logout-stick-head" cx="28" cy="12" r="4" />
                <path className="logout-stick-body" d="M27 16L24 26" />
                <path className="logout-stick-arm-back" d="M26 19L31 22L35 19" />
                <path className="logout-stick-arm-front" d="M25 19L19 22" />
                <path className="logout-stick-leg-back" d="M24 26L29 34" />
                <path className="logout-stick-leg-front" d="M24 26L17 33" />
              </g>

              <g className="logout-door-group">
                <g className="logout-door-leaf">
                  <path className="logout-door-panel" d="M33 7L44 10V35L33 38V7Z" />
                  <circle className="logout-door-knob" cx="40.5" cy="23" r="1.2" />
                </g>
                <path className="logout-door-frame" d="M32 5H46V38H32" />
              </g>
            </g>
          </svg>
        </span>
      </button>
    </form>
  );
}
