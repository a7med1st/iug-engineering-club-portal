"use client";

import { useEffect, useState } from "react";
import Image from "next/image";

export default function IntroGate() {
  const [show, setShow] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setShow(false);
    }, 3800);

    return () => clearTimeout(timer);
  }, []);

  if (!show) return null;

  return (
    <div className="intro-gate" aria-hidden="true">

      <div className="intro-panel intro-left" />
      <div className="intro-panel intro-right" />

      <div className="intro-logo-wrap">
        <div className="intro-logo-bg">
          <div className="intro-logo-spin">
            <Image
              src="/images/club-logo.png"
              alt="النادي الهندسي"
              width={230}
              height={230}
              priority
            />
          </div>
        </div>
      </div>

    </div>
  );
}
