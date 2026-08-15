"use client";

import {
  Camera,
  ImageUp,
  Trash2,
} from "lucide-react";
import type { ChangeEvent } from "react";
import {
  useActionState,
  useEffect,
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
    }
  }, [
    uploadState.success,
    uploadState.version,
  ]);

  useEffect(() => {
    if (
      removeState.success &&
      removeState.removed
    ) {
      setAvatarVisible(false);

      if (removeState.version) {
        setVersion(
          removeState.version,
        );
      }
    }
  }, [
    removeState.success,
    removeState.removed,
    removeState.version,
  ]);

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

    const formData =
      new FormData();

    formData.set(
      "avatar",
      file,
    );

    startTransition(() => {
      uploadAction(formData);
    });

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

  return (
    <div className={styles.avatarArea}>
      <div className={styles.avatarFrame}>
        {avatarVisible ? (
          <img
            key={version}
            src={`/student/avatar?v=${encodeURIComponent(
              version,
            )}`}
            alt={`الصورة الشخصية لـ ${name}`}
            className={styles.avatarImage}
          />
        ) : (
          <span className={styles.avatarFallback}>
            {initials}
          </span>
        )}
      </div>

      <div className={styles.avatarActions}>
        <label
          className={styles.avatarActionButton}
        >
          <Camera size={16} />

          <span>
            التقاط صورة
          </span>

          <input
            type="file"
            name="avatar"
            accept="image/jpeg,image/png,image/webp"
            capture="user"
            onChange={handleFile}
            disabled={pending}
            hidden
          />
        </label>

        <label
          className={styles.avatarActionButton}
        >
          <ImageUp size={16} />

          <span>
            اختيار من الجهاز
          </span>

          <input
            type="file"
            name="avatar"
            accept="image/jpeg,image/png,image/webp"
            onChange={handleFile}
            disabled={pending}
            hidden
          />
        </label>

        {avatarVisible && (
          <button
            type="button"
            className={`${styles.avatarActionButton} ${styles.avatarRemoveButton}`}
            onClick={handleRemove}
            disabled={pending}
          >
            <Trash2 size={15} />
            حذف الصورة
          </button>
        )}
      </div>

      <small className={styles.avatarHint}>
        JPG أو PNG أو WebP — بحد أقصى 5MB
      </small>

      {pending && (
        <div className={styles.avatarMessage}>
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
  );
}