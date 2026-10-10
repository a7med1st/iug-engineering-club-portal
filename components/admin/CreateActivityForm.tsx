"use client";

import { useRef, useState, type FormEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { createActivity } from "@/app/admin/actions";
import ActivitySessionsEditor from "./ActivitySessionsEditor";

export default function CreateActivityForm({ children }: { children: ReactNode }) {
  const router = useRouter();
  const submitting = useRef(false);
  const [pending, setPending] = useState(false);
  const [version, setVersion] = useState(0);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current) return;
    const data = new FormData(event.currentTarget);
    submitting.current = true;
    setPending(true);
    setResult(null);
    try {
      const saved = await createActivity(data);
      setResult(saved);
      if (saved.success) {
        setVersion((current) => current + 1);
        router.refresh();
      }
    } catch {
      setResult({ success: false, message: "تعذر الاتصال. بياناتك ما زالت موجودة، حاول مجددًا." });
    } finally {
      submitting.current = false;
      setPending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="stack-form" aria-busy={pending}>
      {result && (
        <p className={result.success ? "form-success" : "form-error"} role={result.success ? "status" : "alert"}>
          {result.message}
        </p>
      )}
      <fieldset key={version} disabled={pending} className="activity-create-fields stack-form">
        <ActivitySessionsEditor />
        {children}
      </fieldset>
    </form>
  );
}
