"use client";

import { useFormStatus } from "react-dom";

export default function PendingSubmitButton({
  children,
  pendingLabel = "جارٍ الحفظ...",
  className = "primary-btn",
}: {
  children: React.ReactNode;
  pendingLabel?: string;
  className?: string;
}) {
  const { pending } = useFormStatus();

  return (
    <button className={className} type="submit" disabled={pending}>
      {pending ? pendingLabel : children}
    </button>
  );
}
