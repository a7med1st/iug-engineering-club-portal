"use client";

import {
  useRef,
  useState,
  type FormEvent,
} from "react";
import { useRouter } from "next/navigation";

import {
  getEmailValidationMessage,
  validateEmail,
} from "@/lib/email-validation";

type RegisterFormProps = {
  departments: {
    id: string;
    nameAr: string;
  }[];
};

type RegisterResponse = {
  error?: string;
  field?: string;
  verificationRequired?: boolean;
  redirect?: string;
};

export default function RegisterForm({
  departments,
}: RegisterFormProps) {
  const router = useRouter();
  const emailRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState("");
  const [emailError, setEmailError] =
    useState("");
  const [loading, setLoading] =
    useState(false);

  function validateEmailField(value: string) {
    const result = validateEmail(value);
    const message =
      getEmailValidationMessage(result) ?? "";

    setEmailError(message);
    return result;
  }

  async function submit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();
    setError("");

    const formData = new FormData(
      event.currentTarget,
    );
    const emailResult = validateEmailField(
      String(formData.get("email") ?? ""),
    );

    if (!emailResult.valid) {
      emailRef.current?.focus();
      return;
    }

    setLoading(true);

    const payload = {
      ...Object.fromEntries(formData.entries()),
      email: emailResult.email,
    };

    try {
      const response = await fetch(
        "/api/auth/register-student",
        {
          method: "POST",
          headers: {
            "content-type":
              "application/json",
          },
          body: JSON.stringify(payload),
        },
      );

      const data =
        (await response
          .json()
          .catch(() => ({}))) as RegisterResponse;

      if (!response.ok) {
        if (
          data.field === "email" &&
          data.error
        ) {
          setEmailError(data.error);
          emailRef.current?.focus();
          return;
        }

        setError(
          data.error ||
            "تعذر إنشاء الحساب.",
        );
        return;
      }

      router.push(
        data.redirect ?? "/verify-email",
      );
    } catch {
      setError(
        "تعذر الاتصال بالخادم. حاول مرة أخرى.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <form
      onSubmit={submit}
      className="stack-form"
    >
      <label>
        الاسم الكامل
        <input
          name="name"
          required
          minLength={2}
          autoComplete="name"
        />
      </label>

      <label>
        البريد الإلكتروني
        <input
          ref={emailRef}
          name="email"
          type="email"
          required
          autoComplete="email"
          placeholder="name@gmail.com"
          dir="ltr"
          aria-invalid={
            emailError ? true : undefined
          }
          aria-describedby="register-email-feedback"
          onBlur={(event) =>
            validateEmailField(
              event.currentTarget.value,
            )
          }
          onChange={(event) => {
            if (emailError) {
              validateEmailField(
                event.currentTarget.value,
              );
            }
          }}
          onInvalid={(event) => {
            event.preventDefault();
            setEmailError(
              "يرجى إدخال بريد إلكتروني صحيح.",
            );
          }}
        />

        <small
          id="register-email-feedback"
          className={
            emailError
              ? "field-error"
              : "field-hint"
          }
          role={emailError ? "alert" : undefined}
        >
          {emailError ||
            "استخدم بريدًا من Gmail أو Outlook أو مزود معتمد آخر."}
        </small>
      </label>

      <label>
        القسم
        <select
          name="departmentId"
          defaultValue=""
        >
          <option value="">اختياري</option>
          {departments.map((department) => (
            <option
              key={department.id}
              value={department.id}
            >
              {department.nameAr}
            </option>
          ))}
        </select>
      </label>

      <label>
        كلمة المرور
        <input
          name="password"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
        />
      </label>

      {error && (
        <div className="form-error" role="alert">
          {error}
        </div>
      )}

      <button
        className="primary-btn"
        disabled={loading}
      >
        {loading
          ? "جارٍ الإنشاء..."
          : "إنشاء حساب الطالب"}
      </button>
    </form>
  );
}
