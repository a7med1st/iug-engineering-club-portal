"use client";

import { ImagePlus, Upload } from "lucide-react";
import { useEffect, useState } from "react";

import {
  uploadActivityCover,
  uploadActivityGalleryImage,
} from "@/app/admin/activities/[id]/documentation/actions";
import {
  ACTIVITY_IMAGE_ACCEPT,
  ACTIVITY_IMAGE_MAX_BYTES,
} from "@/lib/activity-image-constants";

import PendingSubmitButton from "./PendingSubmitButton";

export default function ActivityDocumentationUploadForm({
  activityId,
  kind,
  hasCurrentImage = false,
}: {
  activityId: string;
  kind: "cover" | "gallery";
  hasCurrentImage?: boolean;
}) {
  const [preview, setPreview] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  const action =
    kind === "cover" ? uploadActivityCover : uploadActivityGalleryImage;
  const label =
    kind === "cover"
      ? hasCurrentImage
        ? "تغيير صورة الغلاف"
        : "إضافة صورة الغلاف"
      : "إضافة صورة إلى المعرض";

  return (
    <form action={action} className="activity-documentation-upload-form">
      <input type="hidden" name="activityId" value={activityId} />

      <label className="activity-documentation-file-picker">
        <span className="activity-documentation-file-icon" aria-hidden="true">
          {kind === "cover" ? <Upload /> : <ImagePlus />}
        </span>
        <span>
          <strong>{label}</strong>
          <small>JPEG أو PNG أو WebP، بحد أقصى 4 ميجابايت</small>
        </span>
        <input
          type="file"
          name="image"
          accept={ACTIVITY_IMAGE_ACCEPT}
          required
          onChange={(event) => {
            if (preview) URL.revokeObjectURL(preview);
            const file = event.target.files?.[0];

            if (!file || file.size > ACTIVITY_IMAGE_MAX_BYTES) {
              setPreview(null);
              return;
            }

            setPreview(URL.createObjectURL(file));
          }}
        />
      </label>

      {preview && (
        <div className="activity-documentation-local-preview">
          <img src={preview} alt="معاينة الصورة المختارة قبل الرفع" />
        </div>
      )}

      <PendingSubmitButton pendingLabel="جارٍ رفع الصورة...">
        {label}
      </PendingSubmitButton>
    </form>
  );
}
