"use client";

import {
  useActionState,
  useEffect,
  useState,
} from "react";

import StudentAvatarEditor from "@/components/student/StudentAvatarEditor";

import { useRouter } from "next/navigation";

import type { StudyLevel } from "@prisma/client";

import {
  CalendarDays,
  CircleCheck,
  GraduationCap,
  Hash,
  Mail,
  Pencil,
  Phone,
  School,
  X,
} from "lucide-react";

import {
  updateStudentProfile,
  type StudentProfileState,
} from "@/app/student/actions";

import styles from "@/app/student/student.module.css";

type Props = {
  name: string;
  email: string;
  studentNumber: string | null;
  phone: string | null;
  studyLevel: StudyLevel | null;
  departmentName: string;
  createdAtLabel: string;

  initials: string;
  hasAvatar: boolean;
  avatarVersion: string;
};

const studyLevelLabels: Record<
  StudyLevel,
  string
> = {
  FIRST: "المستوى الأول",
  SECOND: "المستوى الثاني",
  THIRD: "المستوى الثالث",
  FOURTH: "المستوى الرابع",
  FIFTH: "المستوى الخامس",
  GRADUATE: "خريج",
};

const initialState: StudentProfileState = {
  success: false,
  message: "",
};

export default function StudentProfileEditor({
  name,
  email,
  studentNumber,
  phone,
  studyLevel,
  departmentName,
  createdAtLabel,

  initials,
  hasAvatar,
  avatarVersion,
}: Props) {
  const router = useRouter();

  const [editing, setEditing] =
    useState(false);

  const [
    state,
    formAction,
    pending,
  ] = useActionState(
    updateStudentProfile,
    initialState,
  );

  /* ======================================================
     AFTER SUCCESS
  ====================================================== */

  useEffect(() => {
    if (
      state.success &&
      state.version
    ) {
      setEditing(false);
      router.refresh();
    }
  }, [
    state.success,
    state.version,
    router,
  ]);

  /* ======================================================
     ESC CLOSE
  ====================================================== */

  useEffect(() => {
    if (!editing) {
      return;
    }

    function handleKeyDown(
      event: KeyboardEvent,
    ) {
      if (
        event.key === "Escape" &&
        !pending
      ) {
        setEditing(false);
      }
    }

    window.addEventListener(
      "keydown",
      handleKeyDown,
    );

    return () => {
      window.removeEventListener(
        "keydown",
        handleKeyDown,
      );
    };
  }, [editing, pending]);

  const studyLevelLabel =
    studyLevel
      ? studyLevelLabels[studyLevel]
      : "غير محدد";

  return (
    <>
      {/* ==================================================
          PROFILE INFORMATION
      ================================================== */}

      <div
        className={styles.profileEditor}
      >
        <div
          className={
            styles.profileIdentity
          }
        >
          <div
            className={
              styles.profileIdentityText
            }
          >
            <h2>{name}</h2>
          </div>

          <button
            type="button"
            className={`${styles.editProfileButton} ${styles.dashboardActionButton}`}
            onClick={() =>
              setEditing(true)
            }
          >
            <Pencil
              size={15}
              strokeWidth={2}
            />

            <span>
              تعديل بياناتي
            </span>
          </button>
        </div>

        {/* SUCCESS */}

{state.success &&
  state.message && (
    <div
      className={
        styles.profileSuccess
      }
    >
      <CircleCheck
        size={19}
        strokeWidth={2.4}
      />

      <span>
        {state.message}
      </span>
    </div>
  )}

        {/* DETAILS */}

        <div
          className={
            styles.profileDetails
          }
        >
          <ProfileItem
            icon={<Hash size={17} />}
            label="الرقم الجامعي"
            value={
              studentNumber ??
              "غير محدد"
            }
            dir="ltr"
          />

          <ProfileItem
            icon={
              <GraduationCap
                size={18}
              />
            }
            label="التخصص"
            value={departmentName}
          />

          <ProfileItem
            icon={
              <School size={17} />
            }
            label="المستوى الدراسي"
            value={studyLevelLabel}
          />

          <ProfileItem
            icon={
              <Phone size={17} />
            }
            label="رقم الجوال"
            value={
              phone ?? "غير محدد"
            }
            dir="ltr"
          />

          <ProfileItem
            icon={
              <Mail size={17} />
            }
            label="البريد الإلكتروني"
            value={email}
            dir="ltr"
            email
          />

          <ProfileItem
            icon={
              <CalendarDays
                size={17}
              />
            }
            label="تاريخ إنشاء الحساب"
            value={createdAtLabel}
          />
        </div>
      </div>

      {/* ==================================================
          EDIT CARD
      ================================================== */}

      {editing && (
        <div
          className={
            styles.profileEditLayer
          }
        >
          <section
            className={
              styles.profileEditCard
            }
            role="dialog"
            aria-labelledby="student-profile-edit-title"
          >
            {/* HEADER */}

            <div
              className={
                styles.profileEditCardHeader
              }
            >
              <div>
                <span
                  className={
                    styles.profileEditEyebrow
                  }
                >
                  الملف الشخصي
                </span>

                <h2
                  id="student-profile-edit-title"
                >
                  تعديل بياناتي
                </h2>

                <p>
                  حدّث البيانات التي
                  ترغب بتعديلها ثم احفظ
                  التغييرات.
                </p>
              </div>

              <button
                type="button"
                className={
                  styles.profileEditClose
                }
                onClick={() =>
                  setEditing(false)
                }
                disabled={pending}
                aria-label="إغلاق"
              >
                <X
                  size={20}
                  strokeWidth={2}
                />
              </button>
            </div>


<StudentAvatarEditor
  name={name}
  initials={initials}
  hasAvatar={hasAvatar}
  initialVersion={avatarVersion}
/>
            {/* FORM */}

            <form
              action={formAction}
              className={
                styles.profileForm
              }
            >
              <div
                className={
                  styles.profileFormGrid
                }
              >
                {/* NAME */}

                <div
                  className={
                    styles.profileField
                  }
                >
                  <label
                    htmlFor="student-name"
                  >
                    الاسم
                  </label>

                  <input
                    id="student-name"
                    name="name"
                    type="text"
                    defaultValue={name}
                    maxLength={100}
                    required
                    disabled={pending}
                  />

                  {state.fieldErrors
                    ?.name && (
                    <small
                      className={
                        styles.fieldError
                      }
                    >
                      {
                        state
                          .fieldErrors
                          .name
                      }
                    </small>
                  )}
                </div>

                {/* STUDENT NUMBER */}

                <div
                  className={
                    styles.profileField
                  }
                >
                  <label
                    htmlFor="student-number"
                  >
                    الرقم الجامعي
                  </label>

                  <input
                    id="student-number"
                    name="studentNumber"
                    type="text"
                    inputMode="numeric"
                    dir="ltr"
                    defaultValue={
                      studentNumber ??
                      ""
                    }
                    placeholder="120220123"
                    maxLength={20}
                    disabled={pending}
                  />

                  {state.fieldErrors
                    ?.studentNumber && (
                    <small
                      className={
                        styles.fieldError
                      }
                    >
                      {
                        state
                          .fieldErrors
                          .studentNumber
                      }
                    </small>
                  )}
                </div>

                {/* PHONE */}

                <div
                  className={
                    styles.profileField
                  }
                >
                  <label
                    htmlFor="student-phone"
                  >
                    رقم الجوال / واتساب
                  </label>

                  <input
                    id="student-phone"
                    name="phone"
                    type="tel"
                    dir="ltr"
                    defaultValue={
                      phone ?? ""
                    }
                    placeholder="0590000000"
                    maxLength={20}
                    disabled={pending}
                  />

                  {state.fieldErrors
                    ?.phone && (
                    <small
                      className={
                        styles.fieldError
                      }
                    >
                      {
                        state
                          .fieldErrors
                          .phone
                      }
                    </small>
                  )}
                </div>

                {/* LEVEL */}

                <div
                  className={
                    styles.profileField
                  }
                >
                  <label
                    htmlFor="student-level"
                  >
                    المستوى الدراسي
                  </label>

                  <select
                    id="student-level"
                    name="studyLevel"
                    defaultValue={
                      studyLevel ?? ""
                    }
                    disabled={pending}
                  >
                    <option value="">
                      غير محدد
                    </option>

                    <option value="FIRST">
                      المستوى الأول
                    </option>

                    <option value="SECOND">
                      المستوى الثاني
                    </option>

                    <option value="THIRD">
                      المستوى الثالث
                    </option>

                    <option value="FOURTH">
                      المستوى الرابع
                    </option>

                    <option value="FIFTH">
                      المستوى الخامس
                    </option>

                    <option value="GRADUATE">
                      خريج
                    </option>
                  </select>

                  {state.fieldErrors
                    ?.studyLevel && (
                    <small
                      className={
                        styles.fieldError
                      }
                    >
                      {
                        state
                          .fieldErrors
                          .studyLevel
                      }
                    </small>
                  )}
                </div>
              </div>

              {/* READ ONLY */}

              <div
                className={
                  styles.profileReadonlyGrid
                }
              >
                <div
                  className={
                    styles.readonlyProfileField
                  }
                >
                  <Mail size={17} />

                  <div>
                    <span>
                      البريد الإلكتروني
                    </span>

                    <strong dir="ltr">
                      {email}
                    </strong>

                    <small>
                      لا يمكن تعديله من
                      لوحة الطالب
                    </small>
                  </div>
                </div>

                <div
                  className={
                    styles.readonlyProfileField
                  }
                >
                  <GraduationCap
                    size={18}
                  />

                  <div>
                    <span>
                      التخصص
                    </span>

                    <strong>
                      {departmentName}
                    </strong>

                    <small>
                      مرتبط ببيانات
                      الحساب الأكاديمية
                    </small>
                  </div>
                </div>
              </div>

              {/* ERROR */}

              {state.message &&
                !state.success && (
                  <div
                    className={
                      styles.profileError
                    }
                  >
                    {state.message}
                  </div>
                )}

              {/* ACTIONS */}

              <div
                className={
                  styles.profileFormActions
                }
              >
                <button
                  type="button"
                  className={
                    styles.cancelProfileButton
                  }
                  disabled={pending}
                  onClick={() =>
                    setEditing(false)
                  }
                >
                  إلغاء
                </button>

                <button
                  type="submit"
                  className={
                    styles.saveProfileButton
                  }
                  disabled={pending}
                >
                  {pending
                    ? "جارٍ الحفظ..."
                    : "حفظ التغييرات"}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </>
  );
}

/* =========================================================
   PROFILE ITEM
========================================================= */

function ProfileItem({
  icon,
  label,
  value,
  dir,
  email = false,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  dir?: "ltr" | "rtl";
  email?: boolean;
}) {
  return (
    <div
      className={
        styles.profileInfoItem
      }
    >
      <span
        className={
          styles.profileInfoIcon
        }
      >
        {icon}
      </span>

      <div
        className={
          styles.profileInfoContent
        }
      >
        <span
          className={
            styles.profileInfoLabel
          }
        >
          {label}
        </span>

        <strong
          dir={dir}
          className={
            email
              ? styles.profileInfoEmail
              : undefined
          }
        >
          {value}
        </strong>
      </div>
    </div>
  );
}
