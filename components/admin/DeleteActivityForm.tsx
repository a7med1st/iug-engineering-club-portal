"use client";

import { deleteActivity } from "@/app/admin/actions";

export default function DeleteActivityForm({ id, title }: { id: string; title: string }) {
  return (
    <form
      action={deleteActivity}
      onSubmit={(event) => {
        if (!window.confirm(`هل تريد نقل النشاط «${title}» إلى المحذوفات؟ يمكنك استرجاعه لاحقًا.`)) {
          event.preventDefault();
        }
      }}
    >
      <input type="hidden" name="id" value={id} />
      <button className="danger-btn" type="submit">حذف</button>
    </form>
  );
}
