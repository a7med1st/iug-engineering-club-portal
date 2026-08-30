"use client";

import {
  Camera,
  ImageIcon,
  ImageUp,
  Trash2,
  UserRound,
  X,
} from "lucide-react";
import {
  type CSSProperties,
  type ChangeEvent,
  useEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";

import styles from "@/app/member/profile/profile.module.css";

type Props = {
  name: string;
  title: string;
  departmentName: string;
  initials: string;
  avatarUrl: string | null;
  coverUrl: string | null;
};

type MediaKind = "avatar" | "cover";

type LocalPreview = {
  url: string;
  local: boolean;
} | null;

type ViewerState = {
  rect: {
    top: number;
    left: number;
    width: number;
    height: number;
  };
  url: string;
  open: boolean;
} | null;

export default function MemberProfileMediaManager({
  name,
  title,
  departmentName,
  initials,
  avatarUrl,
  coverUrl,
}: Props) {
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);
  const avatarStageRef = useRef<HTMLButtonElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const localUrlsRef = useRef<Set<string>>(new Set());

  const [portalReady, setPortalReady] = useState(false);
  const [avatar, setAvatar] = useState<LocalPreview>(
    avatarUrl ? { url: avatarUrl, local: false } : null,
  );
  const [cover, setCover] = useState<LocalPreview>(
    coverUrl ? { url: coverUrl, local: false } : null,
  );
  const [removeAvatar, setRemoveAvatar] = useState(false);
  const [removeCover, setRemoveCover] = useState(false);
  const [viewer, setViewer] = useState<ViewerState>(null);
  const [cameraKind, setCameraKind] = useState<MediaKind | null>(null);
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [capturing, setCapturing] = useState(false);

  const hasAvatar = Boolean(avatar);
  const hasCover = Boolean(cover);

  const statusText = removeAvatar || removeCover
    ? "سيتم تطبيق الحذف عند حفظ الملف الشخصي."
    : avatar?.local || cover?.local
      ? "المعاينة جاهزة — اضغط حفظ الملف الشخصي لتثبيت الصور."
      : "يمكنك التصوير بالكاميرا أو اختيار صورة من جهازك وتغييرها في أي وقت.";

  useEffect(() => {
    setPortalReady(true);

    return () => {
      streamRef.current?.getTracks().forEach((track) => track.stop());
      localUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
      localUrlsRef.current.clear();
    };
  }, []);

  useEffect(() => {
    if (!cameraKind) return;

    let cancelled = false;
    setCameraReady(false);
    setCameraError(null);

    async function startCamera() {
      if (!navigator.mediaDevices?.getUserMedia) {
        setCameraError("المتصفح لا يدعم تشغيل الكاميرا مباشرة.");
        return;
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: {
            facingMode: "user",
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
        });

        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        streamRef.current = stream;

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => undefined);
        }

        setCameraReady(true);
      } catch (error) {
        console.error(error);
        setCameraError(
          "تعذر تشغيل الكاميرا. تأكد من السماح للموقع باستخدام كاميرا اللابتوب ثم جرّب مرة أخرى.",
        );
      }
    }

    void startCamera();

    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    };
  }, [cameraKind]);

  useEffect(() => {
    if (!viewer && !cameraKind) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [viewer, cameraKind]);

  useEffect(() => {
    if (!viewer && !cameraKind) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;

      if (cameraKind) {
        setCameraKind(null);
        return;
      }

      closeAvatarViewer();
    }

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [viewer, cameraKind]);

  function releaseLocalUrl(preview: LocalPreview) {
    if (!preview?.local) return;

    URL.revokeObjectURL(preview.url);
    localUrlsRef.current.delete(preview.url);
  }

  function applyFile(kind: MediaKind, file: File) {
    const input =
      kind === "avatar" ? avatarInputRef.current : coverInputRef.current;

    if (!input) return;

    try {
      const transfer = new DataTransfer();
      transfer.items.add(file);
      input.files = transfer.files;
    } catch {
      // DataTransfer is supported by current Chromium/Firefox/Safari. If a very
      // old browser blocks assignment, the preview still works and the user can
      // fall back to "اختيار من الجهاز".
    }

    const nextUrl = URL.createObjectURL(file);
    localUrlsRef.current.add(nextUrl);

    if (kind === "avatar") {
      setAvatar((current) => {
        releaseLocalUrl(current);
        return { url: nextUrl, local: true };
      });
      setRemoveAvatar(false);
      return;
    }

    setCover((current) => {
      releaseLocalUrl(current);
      return { url: nextUrl, local: true };
    });
    setRemoveCover(false);
  }

  function setPreview(
    kind: MediaKind,
    event: ChangeEvent<HTMLInputElement>,
  ) {
    const file = event.currentTarget.files?.[0];
    if (!file) return;
    applyFile(kind, file);
  }

  function openFilePicker(kind: MediaKind) {
    const input =
      kind === "avatar" ? avatarInputRef.current : coverInputRef.current;
    input?.click();
  }

  function openCamera(kind: MediaKind) {
    setCameraKind(kind);
  }

  function closeCamera() {
    setCameraKind(null);
    setCameraReady(false);
    setCameraError(null);
    setCapturing(false);
  }

  async function capturePhoto() {
    if (!cameraKind || !videoRef.current || capturing) return;

    const video = videoRef.current;
    if (!video.videoWidth || !video.videoHeight) return;

    setCapturing(true);

    try {
      const sourceWidth = video.videoWidth;
      const sourceHeight = video.videoHeight;
      const targetRatio = cameraKind === "avatar" ? 1 : 16 / 9;
      const sourceRatio = sourceWidth / sourceHeight;

      let sx = 0;
      let sy = 0;
      let sw = sourceWidth;
      let sh = sourceHeight;

      if (sourceRatio > targetRatio) {
        sw = sourceHeight * targetRatio;
        sx = (sourceWidth - sw) / 2;
      } else {
        sh = sourceWidth / targetRatio;
        sy = (sourceHeight - sh) / 2;
      }

      const canvas = document.createElement("canvas");
      canvas.width = cameraKind === "avatar" ? 900 : 1600;
      canvas.height = cameraKind === "avatar" ? 900 : 900;

      const context = canvas.getContext("2d");
      if (!context) throw new Error("Canvas is unavailable");

      // Mirror the captured frame so it matches the live selfie preview.
      context.translate(canvas.width, 0);
      context.scale(-1, 1);
      context.drawImage(
        video,
        sx,
        sy,
        sw,
        sh,
        0,
        0,
        canvas.width,
        canvas.height,
      );

      const blob = await new Promise<Blob | null>((resolve) => {
        canvas.toBlob(resolve, "image/jpeg", 0.9);
      });

      if (!blob) throw new Error("Could not create image");

      const file = new File(
        [blob],
        `${cameraKind}-camera-${Date.now()}.jpg`,
        { type: "image/jpeg" },
      );

      applyFile(cameraKind, file);
      closeCamera();
    } catch (error) {
      console.error(error);
      setCameraError("تعذر التقاط الصورة. حاول مرة أخرى.");
      setCapturing(false);
    }
  }

  function removeImage(kind: MediaKind) {
    if (kind === "avatar") {
      setAvatar((current) => {
        releaseLocalUrl(current);
        return null;
      });
      setRemoveAvatar(Boolean(avatarUrl));
      if (avatarInputRef.current) avatarInputRef.current.value = "";
      closeAvatarViewer(true);
      return;
    }

    setCover((current) => {
      releaseLocalUrl(current);
      return null;
    });
    setRemoveCover(Boolean(coverUrl));
    if (coverInputRef.current) coverInputRef.current.value = "";
  }

  function openAvatarViewer() {
    if (!avatar || !avatarStageRef.current) return;

    const rect = avatarStageRef.current.getBoundingClientRect();
    setViewer({
      rect: {
        top: rect.top,
        left: rect.left,
        width: rect.width,
        height: rect.height,
      },
      url: avatar.url,
      open: false,
    });

    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        setViewer((current) =>
          current ? { ...current, open: true } : current,
        );
      });
    });
  }

  function closeAvatarViewer(immediate = false) {
    if (immediate) {
      setViewer(null);
      return;
    }

    setViewer((current) =>
      current ? { ...current, open: false } : current,
    );

    window.setTimeout(() => setViewer(null), 460);
  }

  const viewerStyle = viewer
    ? ({
        "--viewer-top": `${viewer.rect.top}px`,
        "--viewer-left": `${viewer.rect.left}px`,
        "--viewer-width": `${viewer.rect.width}px`,
        "--viewer-height": `${viewer.rect.height}px`,
      } as CSSProperties)
    : undefined;

  return (
    <>
      <section className={styles.mediaCard}>
        <div className={styles.mediaStage}>
          <div className={styles.coverStage}>
            {hasCover ? (
              <img
                src={cover!.url}
                alt={`صورة غلاف ${name}`}
                className={styles.coverImage}
              />
            ) : (
              <div className={styles.coverFallback}>
                <ImageIcon size={30} />
                <span>أضف صورة غلاف تعكس هويتك داخل النادي</span>
              </div>
            )}
            <div className={styles.coverOverlay} />
          </div>

          <div className={styles.identityStrip}>
            <button
              ref={avatarStageRef}
              type="button"
              className={styles.avatarStage}
              onClick={openAvatarViewer}
              disabled={!hasAvatar}
              aria-label={
                hasAvatar
                  ? "عرض الصورة الشخصية بحجم أكبر"
                  : "لا توجد صورة شخصية لعرضها"
              }
              title={hasAvatar ? "اضغط لعرض الصورة" : undefined}
            >
              {hasAvatar ? (
                <img
                  src={avatar!.url}
                  alt={`الصورة الشخصية لـ ${name}`}
                  className={styles.avatarImage}
                />
              ) : (
                <span className={styles.avatarFallback}>
                  <UserRound size={30} />
                  <strong>{initials}</strong>
                </span>
              )}
            </button>

            <div className={styles.identityCopy}>
              <h2>{name}</h2>
              <p>{title}</p>
              <span>{departmentName}</span>
            </div>
          </div>
        </div>

        <div className={styles.mediaControlsGrid}>
          <article className={styles.mediaControlCard}>
            <div className={styles.mediaControlHead}>
              <div className={styles.mediaControlIcon}>
                <UserRound size={19} />
              </div>
              <div>
                <h3>الصورة الشخصية</h3>
                <p>JPG / PNG / WebP — حتى 5MB</p>
              </div>
            </div>

            <div className={styles.mediaActionRow}>
              <button
                type="button"
                className={styles.mediaPrimaryAction}
                onClick={() => openCamera("avatar")}
              >
                <Camera size={16} />
                فتح الكاميرا
              </button>
              <button
                type="button"
                className={styles.mediaSecondaryAction}
                onClick={() => openFilePicker("avatar")}
              >
                <ImageUp size={16} />
                اختيار من الجهاز
              </button>
              {hasAvatar && (
                <button
                  type="button"
                  className={styles.mediaDangerAction}
                  onClick={() => removeImage("avatar")}
                >
                  <Trash2 size={15} />
                  حذف
                </button>
              )}
            </div>

            <input
              ref={avatarInputRef}
              type="file"
              name="avatar"
              accept="image/jpeg,image/png,image/webp"
              hidden
              onChange={(event) => setPreview("avatar", event)}
            />
            {removeAvatar && (
              <input type="hidden" name="removeAvatar" value="on" />
            )}
          </article>

          <article className={styles.mediaControlCard}>
            <div className={styles.mediaControlHead}>
              <div className={styles.mediaControlIcon}>
                <ImageIcon size={19} />
              </div>
              <div>
                <h3>صورة الغلاف</h3>
                <p>JPG / PNG / WebP — حتى 8MB</p>
              </div>
            </div>

            <div className={styles.mediaActionRow}>
              <button
                type="button"
                className={styles.mediaPrimaryAction}
                onClick={() => openCamera("cover")}
              >
                <Camera size={16} />
                فتح الكاميرا
              </button>
              <button
                type="button"
                className={styles.mediaSecondaryAction}
                onClick={() => openFilePicker("cover")}
              >
                <ImageUp size={16} />
                اختيار من الجهاز
              </button>
              {hasCover && (
                <button
                  type="button"
                  className={styles.mediaDangerAction}
                  onClick={() => removeImage("cover")}
                >
                  <Trash2 size={15} />
                  حذف
                </button>
              )}
            </div>

            <input
              ref={coverInputRef}
              type="file"
              name="cover"
              accept="image/jpeg,image/png,image/webp"
              hidden
              onChange={(event) => setPreview("cover", event)}
            />
            {removeCover && (
              <input type="hidden" name="removeCover" value="on" />
            )}
          </article>
        </div>

        <div className={styles.mediaStatus}>{statusText}</div>
      </section>

      {portalReady && viewer &&
        createPortal(
          <div
            className={`${styles.imageViewer} ${
              viewer.open ? styles.imageViewerOpen : ""
            }`}
            style={viewerStyle}
            role="dialog"
            aria-modal="true"
            aria-label="معاينة الصورة الشخصية"
          >
            <button
              type="button"
              className={styles.imageViewerBackdrop}
              aria-label="إغلاق المعاينة"
              onClick={() => closeAvatarViewer()}
            />

            <div className={styles.imageViewerFrame}>
              <img src={viewer.url} alt={`الصورة الشخصية لـ ${name}`} />
              <button
                type="button"
                className={styles.imageViewerClose}
                onClick={() => closeAvatarViewer()}
                aria-label="إغلاق الصورة"
              >
                <X size={20} />
              </button>
            </div>
          </div>,
          document.body,
        )}

      {portalReady && cameraKind &&
        createPortal(
          <div
            className={styles.cameraModal}
            role="dialog"
            aria-modal="true"
            aria-label="التقاط صورة بالكاميرا"
          >
            <button
              type="button"
              className={styles.cameraBackdrop}
              aria-label="إغلاق الكاميرا"
              onClick={closeCamera}
            />

            <section className={styles.cameraPanel}>
              <div className={styles.cameraHead}>
                <div>
                  <span>كاميرا اللابتوب</span>
                  <h3>
                    {cameraKind === "avatar"
                      ? "التقاط الصورة الشخصية"
                      : "التقاط صورة الغلاف"}
                  </h3>
                </div>
                <button
                  type="button"
                  className={styles.cameraClose}
                  onClick={closeCamera}
                  aria-label="إغلاق الكاميرا"
                >
                  <X size={19} />
                </button>
              </div>

              <div
                className={`${styles.cameraViewport} ${
                  cameraKind === "avatar"
                    ? styles.cameraViewportAvatar
                    : styles.cameraViewportCover
                }`}
              >
                <video
                  ref={videoRef}
                  muted
                  playsInline
                  autoPlay
                  className={styles.cameraVideo}
                />

                {!cameraReady && !cameraError && (
                  <div className={styles.cameraLoading}>
                    <span className={styles.cameraSpinner} />
                    جاري تشغيل الكاميرا...
                  </div>
                )}

                {cameraError && (
                  <div className={styles.cameraError}>
                    <Camera size={28} />
                    <strong>لم نتمكن من الوصول إلى الكاميرا</strong>
                    <p>{cameraError}</p>
                  </div>
                )}

                {cameraReady && !cameraError && (
                  <div
                    className={
                      cameraKind === "avatar"
                        ? styles.cameraAvatarGuide
                        : styles.cameraCoverGuide
                    }
                    aria-hidden="true"
                  />
                )}
              </div>

              <div className={styles.cameraFooter}>
                <button
                  type="button"
                  className={styles.cameraCancelButton}
                  onClick={closeCamera}
                >
                  إلغاء
                </button>
                <button
                  type="button"
                  className={styles.cameraCaptureButton}
                  onClick={() => void capturePhoto()}
                  disabled={!cameraReady || Boolean(cameraError) || capturing}
                >
                  <span className={styles.cameraCaptureDot} />
                  {capturing ? "جاري الالتقاط..." : "التقاط الآن"}
                </button>
              </div>
            </section>
          </div>,
          document.body,
        )}
    </>
  );
}