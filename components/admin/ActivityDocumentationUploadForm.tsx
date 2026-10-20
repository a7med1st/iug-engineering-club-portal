"use client";

import { ImagePlus, Upload } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { uploadActivityCover, uploadActivityGalleryImage } from "@/app/admin/activities/[id]/documentation/actions";
import { ACTIVITY_IMAGE_ACCEPT, ACTIVITY_IMAGE_MAX_BYTES } from "@/lib/activity-image-constants";
import PendingSubmitButton from "./PendingSubmitButton";

export default function ActivityDocumentationUploadForm({ activityId, kind, hasCurrentImage = false }: {
  activityId: string; kind: "cover" | "gallery"; hasCurrentImage?: boolean;
}) {
  const [previews, setPreviews] = useState<{ url: string; name: string }[]>([]);
  const [error, setError] = useState("");
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const isGallery = kind === "gallery";
  const label = isGallery ? "رفع الصور المختارة" : hasCurrentImage ? "تغيير صورة الغلاف" : "إضافة صورة الغلاف";
  const inputId = `documentation-upload-${kind}`;

  useEffect(() => () => { previews.forEach((preview) => URL.revokeObjectURL(preview.url)); }, [previews]);

  function choose(files: File[]) {
    setError("");
    const invalid = files.length > (isGallery ? 3 : 1) ? "اختر حتى ٣ صور في كل دفعة، أو صورة واحدة للغلاف." :
      files.some((file) => !ACTIVITY_IMAGE_ACCEPT.split(",").includes(file.type)) ? "اختر صوراً بصيغة JPEG أو PNG أو WebP." :
      files.some((file) => file.size === 0 || file.size > ACTIVITY_IMAGE_MAX_BYTES) ? "حجم كل صورة يجب أن يكون أكبر من صفر وحتى ٤ ميجابايت." : "";
    if (invalid) {
      setError(invalid); setPreviews([]);
      if (inputRef.current) inputRef.current.value = "";
      return;
    }
    setPreviews(files.map((file) => ({ url: URL.createObjectURL(file), name: file.name })));
  }

  return (
    <form action={isGallery ? uploadActivityGalleryImage : uploadActivityCover} className="activity-documentation-upload-form">
      <input type="hidden" name="activityId" value={activityId} />
      <label htmlFor={inputId} className={`activity-documentation-file-picker${dragging ? " is-dragging" : ""}`}
        onDragOver={(event) => { event.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault(); setDragging(false);
          const files = Array.from(event.dataTransfer.files);
          if (!inputRef.current) return;
          const transfer = new DataTransfer(); files.forEach((file) => transfer.items.add(file));
          inputRef.current.files = transfer.files;
          choose(files);
        }}>
        <span className="activity-documentation-file-icon" aria-hidden="true">{isGallery ? <ImagePlus /> : <Upload />}</span>
        <span><strong>{isGallery ? "اسحب الصور هنا أو اختر من جهازك" : "اسحب صورة الغلاف هنا أو اختر من جهازك"}</strong><small>JPEG أو PNG أو WebP · حتى ٤ ميجابايت للصورة{isGallery ? " · ٣ صور في الدفعة" : ""}</small></span>
        <input id={inputId} ref={inputRef} type="file" name="image" accept={ACTIVITY_IMAGE_ACCEPT} multiple={isGallery} required aria-describedby={error ? `${inputId}-error` : undefined} aria-invalid={Boolean(error)} onChange={(event) => choose(Array.from(event.target.files ?? []))} />
      </label>
      {error && <p id={`${inputId}-error`} role="alert" className="documentation-upload-error">{error}</p>}
      {previews.length > 0 && <><div className="activity-documentation-local-previews">{previews.map((preview) => <div key={preview.url} className="activity-documentation-local-preview"><img src={preview.url} alt={preview.name} /><small>{preview.name}</small></div>)}</div><PendingSubmitButton pendingLabel="جارٍ رفع الصور…">{label}</PendingSubmitButton></>}
    </form>
  );
}
