"use client";

import {
  removeActivityCover,
  removeActivityGalleryImage,
} from "@/app/admin/activities/[id]/documentation/actions";

import PendingSubmitButton from "./PendingSubmitButton";

export default function ActivityDocumentationDeleteForm({
  activityId,
  imageId,
  kind,
}: {
  activityId: string;
  imageId?: string;
  kind: "cover" | "gallery";
}) {
  const action =
    kind === "cover" ? removeActivityCover : removeActivityGalleryImage;

  return (
    <form
      action={action}
      onSubmit={(event) => {
        if (!window.confirm("هل تريد حذف هذه الصورة نهائيًا؟")) {
          event.preventDefault();
        }
      }}
    >
      <input type="hidden" name="activityId" value={activityId} />
      {imageId && <input type="hidden" name="imageId" value={imageId} />}
      <PendingSubmitButton
        className="danger-btn"
        pendingLabel="جارٍ الحذف..."
      >
        حذف الصورة
      </PendingSubmitButton>
    </form>
  );
}
