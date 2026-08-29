"use client";

import {
  Camera,
  ImageUp,
  Trash2,
  X,
  Check,
  Eye,
} from "lucide-react";



import type { ChangeEvent } from "react";

import {
  useActionState,
  useEffect,
  useRef,
  useState,
  useTransition,
} from "react";

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

export default function StudentAvatarUploader({
  name,
  initials,
  hasAvatar,
  initialVersion,
}: Props) {
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

  const [localPreviewUrl, setLocalPreviewUrl] =
    useState<string | null>(null);

  const [menuOpen, setMenuOpen] =
    useState(false);

  const [previewOpen, setPreviewOpen] =
    useState(false);

  const [cameraOpen, setCameraOpen] =
    useState(false);

  const [cameraLoading, setCameraLoading] =
    useState(false);

  const [cameraError, setCameraError] =
    useState("");

  const videoRef =
    useRef<HTMLVideoElement>(null);

  const canvasRef =
    useRef<HTMLCanvasElement>(null);

  const fileInputRef =
    useRef<HTMLInputElement>(null);

  const [previewMotion, setPreviewMotion] =
  useState({
    x: 0,
    y: 0,
    scale: 0.2,
  });

  const streamRef =
    useRef<MediaStream | null>(null);

  const state =
    removeState.message
      ? removeState
      : uploadState;

  useEffect(() => {
    if (
      uploadState.success &&
      uploadState.version
    ) {
      setAvatarVisible(true);
      setVersion(
        uploadState.version,
      );

      setLocalPreviewUrl(null);

      setMenuOpen(false);
      closeCamera();
    }
  }, [
    uploadState.success,
    uploadState.version,
  ]);

  useEffect(() => {
    if (
      uploadState.message &&
      !uploadState.success
    ) {
      setLocalPreviewUrl(null);
    }
  }, [
    uploadState.message,
    uploadState.success,
  ]);

  useEffect(() => {
    if (
      removeState.success &&
      removeState.removed
    ) {
      setAvatarVisible(false);
      setLocalPreviewUrl(null);

      if (removeState.version) {
        setVersion(
          removeState.version,
        );
      }

      setMenuOpen(false);
    }
  }, [
    removeState.success,
    removeState.removed,
    removeState.version,
  ]);

  useEffect(() => {
    return () => {
      if (localPreviewUrl) {
        URL.revokeObjectURL(
          localPreviewUrl,
        );
      }
    };
  }, [localPreviewUrl]);

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  function uploadFile(file: File) {
    if (pending) {
      return;
    }

    setLocalPreviewUrl(
      URL.createObjectURL(file),
    );

    const formData =
      new FormData();

    formData.set(
      "avatar",
      file,
    );

    startTransition(() => {
      uploadAction(formData);
    });
  }

  function handleFile(
    event: ChangeEvent<HTMLInputElement>,
  ) {
    const input =
      event.currentTarget;

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
    if (!streamRef.current) {
      return;
    }

    streamRef.current
      .getTracks()
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
    setMenuOpen(false);
    setCameraOpen(true);
    setCameraLoading(true);
    setCameraError("");

    try {
      if (
        !navigator.mediaDevices ||
        !navigator.mediaDevices
          .getUserMedia
      ) {
        throw new Error(
          "هذا المتصفح لا يدعم الوصول إلى الكاميرا.",
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

      streamRef.current =
        stream;

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
        error.name ===
        "NotAllowedError"
      ) {
        setCameraError(
          "تم رفض صلاحية الكاميرا. اسمح للموقع باستخدام الكاميرا من إعدادات المتصفح ثم حاول مرة أخرى.",
        );

        return;
      }

      if (
        error instanceof DOMException &&
        error.name ===
        "NotFoundError"
      ) {
        setCameraError(
          "لم يتم العثور على كاميرا متاحة على هذا الجهاز.",
        );

        return;
      }

      setCameraError(
        "تعذر تشغيل الكاميرا. حاول مرة أخرى أو اختر صورة من الجهاز.",
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
      video.videoWidth === 0 ||
      video.videoHeight === 0
    ) {
      return;
    }

    /*
      نجعل الصورة مربعة 1:1
      عن طريق أخذ أكبر مربع ممكن
      من منتصف الكاميرا.
    */

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
      setCameraError(
        "تعذر معالجة الصورة الملتقطة.",
      );

      return;
    }

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

    canvas.toBlob(
      (blob) => {
        if (!blob) {
          setCameraError(
            "تعذر حفظ الصورة الملتقطة.",
          );

          return;
        }

        const file =
          new File(
            [
              blob,
            ],
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
    <div
      className={
        styles.avatarArea
      }
    >
      {/* AVATAR */}

      <button
        type="button"
        className={
          styles.avatarFrameButton
        }
onClick={(event) => {
  if (pending) {
    return;
  }

  if (!avatarVisible) {
    setMenuOpen(true);
    return;
  }

  const rect =
    event.currentTarget.getBoundingClientRect();

  const avatarCenterX =
    rect.left +
    rect.width / 2;

  const avatarCenterY =
    rect.top +
    rect.height / 2;

  const screenCenterX =
    window.innerWidth / 2;

  const screenCenterY =
    window.innerHeight / 2;

  const targetWidth =
    Math.min(
      window.innerWidth * 0.9,
      850,
    );

  setPreviewMotion({
    x:
      avatarCenterX -
      screenCenterX,

    y:
      avatarCenterY -
      screenCenterY,

    scale:
      Math.max(
        0.1,
        rect.width /
          targetWidth,
      ),
  });

  setPreviewOpen(true);
}}
        disabled={pending}
        aria-label="تغيير الصورة الشخصية"
      >
        <div
          className={
            styles.avatarFrame
          }
        >
          {localPreviewUrl || avatarVisible ? (
            <img
              key={
                localPreviewUrl ??
                version
              }
              src={
                localPreviewUrl ??
                `/student/avatar?v=${encodeURIComponent(
                  version,
                )}`
              }
              alt={`الصورة الشخصية لـ ${name}`}
              className={
                styles.avatarImage
              }
            />
          ) : (
            <span
              className={
                styles.avatarFallback
              }
            >
              {initials}
            </span>
          )}
          
        </div>
      </button>

      <div
        className={
          styles.avatarActions
        }
      >
        <button
          type="button"
          className={
            styles.avatarActionButton
          }
          data-testid="student-avatar-upload-trigger"
          data-avatar-state={
            avatarVisible
              ? "existing"
              : "empty"
          }
          onClick={() =>
            setMenuOpen(true)
          }
          disabled={pending}
        >
          <ImageUp size={16} />

          {avatarVisible
            ? "تغيير الصورة"
            : "إضافة صورة"}
        </button>
      </div>

      <span
        className={
          styles.avatarHint
        }
      >
        JPG أو PNG أو WebP — بحد أقصى 5MB
      </span>

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
            className={`${styles.avatarMessage} ${state.success
                ? styles.avatarSuccess
                : styles.avatarError
              }`}
          >
            {state.message}
          </div>
        )}

      {/* Hidden file picker */}

      <input
        ref={fileInputRef}
        type="file"
        name="avatar"
        accept="image/jpeg,image/png,image/webp"
        onChange={handleFile}
        disabled={pending}
        hidden
      />

      {/* IMAGE OPTIONS */}

      {menuOpen && (
        <div
          className={
            styles.avatarModalLayer
          }
          onMouseDown={(event) => {
            if (
              event.target ===
              event.currentTarget
            ) {
              setMenuOpen(false);
            }
          }}
        >
          <div
            className={
              styles.avatarChoiceCard
            }
          >
            <div
              className={
                styles.avatarChoiceHeader
              }
            >
              <div>
                <span>
                  الصورة الشخصية
                </span>

                <h3>
                  تغيير الصورة
                </h3>

                <p>
                  التقط صورة مباشرة
                  أو اختر صورة من
                  جهازك.
                </p>
              </div>

              <button
                type="button"
                className={
                  styles.avatarModalClose
                }
                onClick={() =>
                  setMenuOpen(false)
                }
              >
                <X size={18} />
              </button>
            </div>

            <div
              className={
                styles.avatarChoiceActions
              }
            >
              {avatarVisible && (
                <button
                  type="button"
                  className={
                    styles.avatarChoiceButton
                  }
                  onClick={() => {
                    setMenuOpen(false);
                    setPreviewOpen(true);
                  }}
                >
                  <span
                    className={
                      styles.avatarChoiceIcon
                    }
                  >
                    <Eye size={22} />
                  </span>

                  <div>
                    <strong>
                      عرض الصورة
                    </strong>

                    <small>
                      مشاهدة الصورة الشخصية بالحجم الكامل
                    </small>
                  </div>
                </button>
              )}

              <button
                type="button"
                className={
                  styles.avatarChoiceButton
                }
                onClick={
                  openCamera
                }
              >
                <span
                  className={
                    styles.avatarChoiceIcon
                  }
                >
                  <Camera
                    size={22}
                  />
                </span>

                <div>
                  <strong>
                    التقاط صورة
                  </strong>

                  <small>
                    استخدام الكاميرا
                    مباشرة من الموقع
                  </small>
                </div>
              </button>

              <button
                type="button"
                className={
                  styles.avatarChoiceButton
                }
                onClick={() => {
                  setMenuOpen(false);

                  fileInputRef.current
                    ?.click();
                }}
              >
                <span
                  className={
                    styles.avatarChoiceIcon
                  }
                >
                  <ImageUp
                    size={22}
                  />
                </span>

                <div>
                  <strong>
                    اختيار من الجهاز
                  </strong>

                  <small>
                    JPG أو PNG أو WebP
                  </small>
                </div>
              </button>

              {avatarVisible && (
                <button
                  type="button"
                  className={`${styles.avatarChoiceButton} ${styles.avatarDeleteChoice}`}
                  onClick={
                    handleRemove
                  }
                  disabled={pending}
                >
                  <span
                    className={
                      styles.avatarChoiceIcon
                    }
                  >
                    <Trash2
                      size={21}
                    />
                  </span>

                  <div>
                    <strong>
                      حذف الصورة
                    </strong>

                    <small>
                      العودة إلى الحرف
                      الافتراضي
                    </small>
                  </div>
                </button>
              )}
            </div>
          </div>
        </div>
      )}
      {/* AVATAR PREVIEW */}

{previewOpen && avatarVisible && (
  <div
    className={styles.avatarImageViewer}
    onMouseDown={(event) => {
      if (event.target === event.currentTarget) {
        setPreviewOpen(false);
      }
    }}
  >
    <button
      type="button"
      className={styles.avatarImageViewerClose}
      onClick={() => setPreviewOpen(false)}
      aria-label="إغلاق الصورة"
    >
      <X size={22} />
    </button>

<img
  src={`/student/avatar?v=${encodeURIComponent(
    version,
  )}`}
  alt={`الصورة الشخصية لـ ${name}`}
  className={
    styles.avatarImageViewerImage
  }
  style={
    {
      "--avatar-start-x":
        `${previewMotion.x}px`,

      "--avatar-start-y":
        `${previewMotion.y}px`,

      "--avatar-start-scale":
        previewMotion.scale,
    } as React.CSSProperties
  }
/>
  </div>
)}
      
      {/* CAMERA */}

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
                onClick={
                  closeCamera
                }
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
                  <Camera
                    size={28}
                  />

                  <span>
                    جاري تشغيل
                    الكاميرا...
                  </span>
                </div>
              )}

              {cameraError && (
                <div
                  className={`${styles.cameraStatus} ${styles.cameraError}`}
                >
                  <Camera
                    size={28}
                  />

                  <span>
                    {cameraError}
                  </span>
                </div>
              )}

              <div
                className={
                  styles.cameraGuide
                }
                aria-hidden="true"
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
                onClick={
                  closeCamera
                }
                disabled={pending}
              >
                إلغاء
              </button>

              <button
                type="button"
                className={
                  styles.cameraCaptureButton
                }
                onClick={
                  capturePhoto
                }
                disabled={
                  pending ||
                  cameraLoading ||
                  Boolean(
                    cameraError,
                  )
                }
              >
                <Camera
                  size={18}
                />

                <span>
                  التقاط الصورة
                </span>

                <Check
                  size={16}
                />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
