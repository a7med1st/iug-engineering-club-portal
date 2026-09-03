"use client";

import { usePathname } from "next/navigation";

export default function ConditionalFooter({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  if (pathname.startsWith("/member/chat")) {
    return null;
  }

  return <>{children}</>;
}