"use client";

import {
  Camera,
  ImageUp,
  Trash2,
  X,
} from "lucide-react";

import type { ChangeEvent } from "react";

import {
  useActionState,
  useEffect,
  useRef,
  useState,
  useTransition,
} from "react";

import { useRouter } from "next/navigation";

import {
  removeStudentAvatar,
  type StudentAvatarState,
  updateStudentAvatar,
} from "@/app/student/actions";

import styles from "@/app/student/student.module.css";

type Props = {
  name: string;
  initials: string;
  hasAvatar: boolean;
  initialVersion: string;
};

const initialState: StudentAvatarState = {
  success: false,
  message: "",
};

export default function StudentAvatarEditor({
  name,
  initials,
  hasAvatar,
  initialVersion,
}: Props) {
  const router = useRouter();

  const [uploadState, uploadAction] =
    useActionState(
      updateStudentAvatar,
      initialState,
    );

  const [removeState, removeAction] =
    useActionState(
      removeStudentAvatar,
      initialState,
    );

  const [pending, startTransition] =
    useTransition();

  const [avatarVisible, setAvatarVisible] =
    useState(hasAvatar);

  const [version, setVersion] =
    useState(initialVersion);

  const [cameraOpen, setCameraOpen] =
    useState(false);

  const [cameraLoading, setCameraLoading] =
    useState(false);

  const [cameraError, setCameraError] =
    useState("");

  const fileInputRef =
    useRef<HTMLInputElement>(null);

  const videoRef =
    useRef<HTMLVideoElement>(null);

  const canvasRef =
    useRef<HTMLCanvasElement>(null);

  const streamRef =
    useRef<MediaStream | null>(null);

  const state =
    removeState.message
      ? removeState
      : uploadState;

  useEffect(() => {
    setAvatarVisible(hasAvatar);
  }, [hasAvatar]);

  useEffect(() => {
    setVersion(initialVersion);
  }, [initialVersion]);

  useEffect(() => {
    if (
      uploadState.success &&
      uploadState.version
    ) {
      setAvatarVisible(true);
      setVersion(uploadState.version);

      closeCamera();

      router.refresh();
    }
  }, [
    uploadState.success,
    uploadState.version,
    router,
  ]);

  useEffect(() => {
    if (
      removeState.success &&
      removeState.removed
    ) {
      setAvatarVisible(false);

      if (removeState.version) {
        setVersion(removeState.version);
      }

      router.refresh();
    }
  }, [
    removeState.success,
    removeState.removed,
    removeState.version,
    router,
  ]);

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  function uploadFile(file: File) {
    if (pending) {
      return;
    }

    const formData = new FormData();

    formData.set("avatar", file);

    startTransition(() => {
      uploadAction(formData);
    });
  }

  function handleFile(
    event: ChangeEvent<HTMLInputElement>,
  ) {
    const input = event.currentTarget;

    const file =
      input.files?.[0];

    if (!file || pending) {
      return;
    }

    uploadFile(file);

    input.value = "";
  }

  function handleRemove() {
    if (
      pending ||
      !avatarVisible
    ) {
      return;
    }

    startTransition(() => {
      removeAction(
        new FormData(),
      );
    });
  }

  function stopCamera() {
    streamRef.current
      ?.getTracks()
      .forEach((track) => {
        track.stop();
      });

    streamRef.current = null;

    if (videoRef.current) {
      videoRef.current.srcObject =
        null;
    }
  }

  function closeCamera() {
    stopCamera();

    setCameraOpen(false);
    setCameraLoading(false);
    setCameraError("");
  }

  async function openCamera() {
    setCameraOpen(true);
    setCameraLoading(true);
    setCameraError("");

    try {
      if (
        !navigator.mediaDevices ||
        !navigator.mediaDevices.getUserMedia
      ) {
        throw new Error(
          "Camera API unavailable",
        );
      }

      const stream =
        await navigator.mediaDevices
          .getUserMedia({
            video: {
              facingMode: "user",

              width: {
                ideal: 1280,
              },

              height: {
                ideal: 1280,
              },
            },

            audio: false,
          });

      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject =
          stream;

        await videoRef.current.play();
      }

      setCameraLoading(false);
    } catch (error) {
      console.error(
        "Camera access error:",
        error,
      );

      stopCamera();

      setCameraLoading(false);

      if (
        error instanceof DOMException &&
        error.name === "NotAllowedError"
      ) {
        setCameraError(
          "تم رفض صلاحية الكاميرا. اسمح للموقع باستخدام الكاميرا ثم حاول مرة أخرى.",
        );

        return;
      }

      if (
        error instanceof DOMException &&
        error.name === "NotFoundError"
      ) {
        setCameraError(
          "لم يتم العثور على كاميرا على هذا الجهاز.",
        );

        return;
      }

      setCameraError(
        "تعذر تشغيل الكاميرا حاليًا.",
      );
    }
  }

  function capturePhoto() {
    const video =
      videoRef.current;

    const canvas =
      canvasRef.current;

    if (
      !video ||
      !canvas ||
      pending ||
      !video.videoWidth ||
      !video.videoHeight
    ) {
      return;
    }

    const sourceSize =
      Math.min(
        video.videoWidth,
        video.videoHeight,
      );

    const sourceX =
      (
        video.videoWidth -
        sourceSize
      ) / 2;

    const sourceY =
      (
        video.videoHeight -
        sourceSize
      ) / 2;

    const outputSize = 1000;

    canvas.width =
      outputSize;

    canvas.height =
      outputSize;

    const context =
      canvas.getContext("2d");

    if (!context) {
      return;
    }

    /*
      Mirror the captured selfie
      so it matches the live preview.
    */

    context.save();

    context.translate(
      outputSize,
      0,
    );

    context.scale(
      -1,
      1,
    );

    context.drawImage(
      video,
      sourceX,
      sourceY,
      sourceSize,
      sourceSize,
      0,
      0,
      outputSize,
      outputSize,
    );

    context.restore();

    canvas.toBlob(
      (blob) => {
        if (!blob) {
          return;
        }

        const file =
          new File(
            [blob],
            `student-avatar-${Date.now()}.jpg`,
            {
              type: "image/jpeg",
            },
          );

        uploadFile(file);
      },

      "image/jpeg",
      0.9,
    );
  }

  return (
    <>
      <div
        className={
          styles.profileAvatarEditor
        }
      >
        <div
          className={
            styles.profileAvatarPreview
          }
        >
          {avatarVisible ? (
            <img
              key={version}
              src={`/student/avatar?v=${encodeURIComponent(
                version,
              )}`}
              alt={`الصورة الشخصية لـ ${name}`}
            />
          ) : (
            <span>
              {initials}
            </span>
          )}
        </div>

        <div
          className={
            styles.profileAvatarEditorContent
          }
        >
          <div>
            <strong>
              الصورة الشخصية
            </strong>

            <small>
              يمكنك التقاط صورة جديدة أو اختيار صورة من جهازك.
            </small>
          </div>

          <div
            className={
              styles.profileAvatarButtons
            }
          >
            <button
              type="button"
              onClick={openCamera}
              disabled={pending}
            >
              <Camera size={16} />
              التقاط صورة
            </button>

            <button
              type="button"
              onClick={() =>
                fileInputRef.current
                  ?.click()
              }
              disabled={pending}
            >
              <ImageUp size={16} />
              اختيار صورة
            </button>

            {avatarVisible && (
              <button
                type="button"
                className={
                  styles.profileAvatarDelete
                }
                onClick={handleRemove}
                disabled={pending}
              >
                <Trash2 size={16} />
                حذف
              </button>
            )}
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={handleFile}
            disabled={pending}
            hidden
          />

          <small
            className={
              styles.profileAvatarHint
            }
          >
            JPG أو PNG أو WebP — بحد أقصى 5MB
          </small>

          {pending && (
            <div
              className={
                styles.avatarMessage
              }
            >
              جاري تحديث الصورة...
            </div>
          )}

          {!pending &&
            state.message && (
              <div
                className={`${styles.avatarMessage} ${
                  state.success
                    ? styles.avatarSuccess
                    : styles.avatarError
                }`}
              >
                {state.message}
              </div>
            )}
        </div>
      </div>

      {cameraOpen && (
        <div
          className={
            styles.avatarModalLayer
          }
        >
          <div
            className={
              styles.cameraCard
            }
          >
            <div
              className={
                styles.cameraHeader
              }
            >
              <div>
                <span>
                  الكاميرا
                </span>

                <h3>
                  التقاط صورة شخصية
                </h3>
              </div>

              <button
                type="button"
                className={
                  styles.avatarModalClose
                }
                onClick={closeCamera}
              >
                <X size={18} />
              </button>
            </div>

            <div
              className={
                styles.cameraPreview
              }
            >
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className={
                  styles.cameraVideo
                }
              />

              {cameraLoading && (
                <div
                  className={
                    styles.cameraStatus
                  }
                >
                  <Camera size={28} />

                  <span>
                    جاري تشغيل الكاميرا...
                  </span>
                </div>
              )}

              {cameraError && (
                <div
                  className={`${styles.cameraStatus} ${styles.cameraError}`}
                >
                  <Camera size={28} />

                  <span>
                    {cameraError}
                  </span>
                </div>
              )}

              <div
                className={
                  styles.cameraGuide
                }
              />
            </div>

            <canvas
              ref={canvasRef}
              hidden
            />

            <div
              className={
                styles.cameraActions
              }
            >
              <button
                type="button"
                className={
                  styles.cameraCancelButton
                }
                onClick={closeCamera}
                disabled={pending}
              >
                إلغاء
              </button>

              <button
                type="button"
                className={
                  styles.cameraCaptureButton
                }
                onClick={capturePhoto}
                disabled={
                  pending ||
                  cameraLoading ||
                  Boolean(
                    cameraError,
                  )
                }
              >
                <Camera size={18} />

                التقاط الصورة
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}