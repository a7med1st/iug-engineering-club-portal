"use client";

import {
  CheckCircle2,
  CircleAlert,
  Handshake,
  Lightbulb,
  MessageSquareWarning,
  Send,
  UploadCloud,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import {
  useActionState,
  useState,
  useTransition,
} from "react";

import {
  submitCollaboration,
  submitComplaint,
  submitSuggestion,
  type ContactFormState,
} from "@/app/contact/actions";

import {
  ACTIVITY_TYPE_OPTIONS,
  COMPLAINT_TYPE_OPTIONS,
  COOPERATION_TYPE_OPTIONS,
  ENTITY_TYPE_OPTIONS,
  EXPERIENCE_LEVEL_OPTIONS,
  STUDY_LEVEL_OPTIONS,
} from "@/lib/contact-options";

/* =========================================================
   TYPES
========================================================= */

type Department = {
  id: string;
  nameAr: string;
};

type ContactTab =
  | "complaint"
  | "suggestion"
  | "collaboration";

const initialState: ContactFormState = {
  success: false,
  message: "",
};

/* =========================================================
   MAIN COMPONENT
========================================================= */

export default function ContactPortal({
  departments,
  isSignedIn,
}: {
  departments: Department[];
  isSignedIn: boolean;
}) {
  const [activeTab, setActiveTab] =
    useState<ContactTab>("complaint");

  return (
    <div className="contact-portal">

      {/* ===========================
          TOP CARDS
      =========================== */}

      <div
        className="contact-channel-grid"
        role="tablist"
        aria-label="خيارات التواصل"
      >

        {/* Complaint */}

        <button
          type="button"
          role="tab"
          aria-selected={
            activeTab === "complaint"
          }
          className={`contact-channel contact-channel-complaint ${
            activeTab === "complaint"
              ? "active"
              : ""
          }`}
          onClick={() =>
            setActiveTab("complaint")
          }
        >
          <span className="contact-channel-icon">
            <MessageSquareWarning
              size={26}
              strokeWidth={1.8}
            />
          </span>

          <span className="contact-channel-copy">
            <strong>
              صندوق الشكاوى
            </strong>

            <small>
              شاركنا أي مشكلة أو ملاحظة
              تواجهك لنتمكن من متابعتها
              وتحسين تجربتك.
            </small>
          </span>
        </button>


        {/* Suggestion */}

        <button
          type="button"
          role="tab"
          aria-selected={
            activeTab === "suggestion"
          }
          className={`contact-channel contact-channel-suggestion ${
            activeTab === "suggestion"
              ? "active"
              : ""
          }`}
          onClick={() =>
            setActiveTab("suggestion")
          }
        >
          <span className="contact-channel-icon">
            <Lightbulb
              size={26}
              strokeWidth={1.8}
            />
          </span>

          <span className="contact-channel-copy">
            <strong>
              صندوق الاقتراحات
            </strong>

            <small>
              ساعدنا في اختيار الدورات
              والفعاليات والمواضيع التي
              تهم الطلبة.
            </small>
          </span>
        </button>


        {/* Collaboration */}

        <button
          type="button"
          role="tab"
          aria-selected={
            activeTab ===
            "collaboration"
          }
          className={`contact-channel contact-channel-collaboration ${
            activeTab ===
            "collaboration"
              ? "active"
              : ""
          }`}
          onClick={() =>
            setActiveTab(
              "collaboration"
            )
          }
        >
          <span className="contact-channel-icon">
            <Handshake
              size={26}
              strokeWidth={1.8}
            />
          </span>

          <span className="contact-channel-copy">
            <strong>
              صندوق التعاون
            </strong>

            <small>
              للشركات والمدربين
              والمؤسسات والجهات الراغبة
              بالتعاون مع النادي.
            </small>
          </span>
        </button>

      </div>


      {/* ===========================
          ACTIVE FORM
      =========================== */}

      <div
        className="contact-form-card"
        role="tabpanel"
      >

        {activeTab ===
          "complaint" && (
          <ComplaintForm
            departments={
              departments
            }
            isSignedIn={isSignedIn}
          />
        )}

        {activeTab ===
          "suggestion" && (
          <SuggestionForm
            departments={
              departments
            }
          />
        )}

        {activeTab ===
          "collaboration" && (
          <CollaborationForm />
        )}

      </div>

    </div>
  );
}

/* =========================================================
   COMPLAINT FORM
========================================================= */

function ComplaintForm({
  departments,
  isSignedIn,
}: {
  departments: Department[];
  isSignedIn: boolean;
}) {
  const router = useRouter();
  const [state, formAction] = useActionState(
    submitComplaint,
    initialState
  );

  const [pending, startTransition] = useTransition();

  function handleSubmit(
    event: React.FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    const form = event.currentTarget;

    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }

    const formData = new FormData(form);

    startTransition(() => {
      formAction(formData);
    });
  }

  return (
    <>
      <FormHeading
        title="صندوق الشكاوى"
        description="شاركنا أي شكوى أو مشكلة أو ملاحظة. إذا طلبت ردًا، سيصلك داخل الموقع مع إشعار جديد."
      />

      <form
        id="complaint-form"
        onSubmit={handleSubmit}
        className="contact-form"
      >

        <Honeypot />

        <div className="contact-form-grid">

          {/* Name */}

          <Field
            label="اسم الطالب الثلاثي"
            optional
          >
            <input
              type="text"
              name="studentName"
              placeholder="اكتب اسمك الثلاثي"
              autoComplete="name"
            />
          </Field>


          {/* Contact */}

          <Field
            label="البريد الإلكتروني أو رقم التواصل"
            optional
          >
            <input
              type="text"
              name="contact"
              placeholder="البريد الإلكتروني أو رقم الهاتف"
            />
          </Field>


          {/* Department */}

          <Field label="تخصص الطالب">
            <select
              name="departmentId"
              required
              defaultValue=""
            >
              <option
                value=""
                disabled
              >
                اختر التخصص
              </option>

              {departments.map(
                (department) => (
                  <option
                    key={
                      department.id
                    }
                    value={
                      department.id
                    }
                  >
                    {
                      department.nameAr
                    }
                  </option>
                )
              )}
            </select>
          </Field>


          {/* Study level */}

          <Field label="المستوى الدراسي للطالب">
            <select
              name="studyLevel"
              required
              defaultValue=""
            >
              <option
                value=""
                disabled
              >
                اختر المستوى
              </option>

              {STUDY_LEVEL_OPTIONS.map(
                (option) => (
                  <option
                    key={
                      option.value
                    }
                    value={
                      option.value
                    }
                  >
                    {option.label}
                  </option>
                )
              )}
            </select>
          </Field>


          {/* Complaint type */}

          <Field label="نوع الملاحظة">
            <select
              name="type"
              required
              defaultValue=""
            >
              <option
                value=""
                disabled
              >
                اختر نوع الملاحظة
              </option>

              {COMPLAINT_TYPE_OPTIONS.map(
                (option) => (
                  <option
                    key={
                      option.value
                    }
                    value={
                      option.value
                    }
                  >
                    {option.label}
                  </option>
                )
              )}
            </select>
          </Field>


          {/* Details */}

          <div className="contact-field contact-field-full">
            <label>
              تفاصيل الشكوى أو
              الملاحظة
              <Required />
            </label>

            <textarea
              name="details"
              required
              minLength={10}
              rows={6}
              placeholder="اشرح لنا الشكوى أو المشكلة أو الملاحظة بالتفصيل..."
            />
          </div>


          {/* Wants reply */}

          <div className="contact-field contact-field-full">

            <label>
              هل ترغب بالحصول على
              رد؟
              <Required />
            </label>

            <div className="contact-choice-grid">

              <label className="contact-choice">
                <input
                  type="radio"
                  name="wantsReply"
                  value="yes"
                  required
                  onChange={() => {
                    if (!isSignedIn) {
                      router.push(
                        "/login?returnTo=%2Fcontact%23complaint-form"
                      );
                    }
                  }}
                />

                <span>
                  {isSignedIn
                    ? "نعم، أريد ردًا"
                    : "نعم (يتطلب تسجيل الدخول)"}
                </span>
              </label>


              <label className="contact-choice">
                <input
                  type="radio"
                  name="wantsReply"
                  value="no"
                  required
                />

                <span>
                  لا
                </span>
              </label>

            </div>

            {!isSignedIn && (
              <small className="contact-reply-login-hint">
                <Link href="/login?returnTo=%2Fcontact%23complaint-form">
                  سجّل الدخول
                </Link>{" "}
                أولًا إذا أردت استلام رد الإدارة داخل الموقع.
              </small>
            )}

          </div>

        </div>


        <FormState state={state} />


        <SubmitButton
          pending={pending}
          text="إرسال الشكوى"
        />

      </form>
    </>
  );
}

/* =========================================================
   SUGGESTION FORM
========================================================= */

function SuggestionForm({
  departments,
}: {
  departments: Department[];
}) {
  const [state, formAction] = useActionState(
    submitSuggestion,
    initialState
  );

  const [pending, startTransition] = useTransition();

  function handleSubmit(
    event: React.FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    const form = event.currentTarget;

    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }

    const formData = new FormData(form);

    startTransition(() => {
      formAction(formData);
    });
  }

  return (
    <>
      <FormHeading
        title="صندوق الاقتراحات"
        description="شاركنا اهتماماتك وأفكارك وساعدنا في تطوير الأنشطة والدورات التي يقدمها النادي."
      />

      <form
        onSubmit={handleSubmit}
        className="contact-form"
      >

        <Honeypot />

        <div className="contact-form-grid">

          {/* Name */}

          <Field label="اسم الطالب الثلاثي">
            <input
              type="text"
              name="studentName"
              required
              placeholder="اكتب اسمك الثلاثي"
              autoComplete="name"
            />
          </Field>


          {/* WhatsApp */}

          <Field label="رقم الواتساب مع المقدمة">
            <input
              type="tel"
              name="whatsapp"
              required
              dir="ltr"
              placeholder="+970 59 XXX XXXX"
              autoComplete="tel"
            />
          </Field>


          {/* Department */}

          <Field label="تخصص الطالب">
            <select
              name="departmentId"
              required
              defaultValue=""
            >
              <option
                value=""
                disabled
              >
                اختر التخصص
              </option>

              {departments.map(
                (department) => (
                  <option
                    key={
                      department.id
                    }
                    value={
                      department.id
                    }
                  >
                    {
                      department.nameAr
                    }
                  </option>
                )
              )}
            </select>
          </Field>


          {/* Study level */}

          <Field label="المستوى الدراسي للطالب">
            <select
              name="studyLevel"
              required
              defaultValue=""
            >
              <option
                value=""
                disabled
              >
                اختر المستوى
              </option>

              {STUDY_LEVEL_OPTIONS.map(
                (option) => (
                  <option
                    key={
                      option.value
                    }
                    value={
                      option.value
                    }
                  >
                    {option.label}
                  </option>
                )
              )}
            </select>
          </Field>


          {/* Topics */}

          <div className="contact-field contact-field-full">

            <label>
              ما المواضيع أو التقنيات
              التي ترغب أن يقدم النادي
              دورات أو لقاءات عنها؟
            </label>

            <small className="contact-helper">
              اذكر أي مجال ترغب في
              تعلمه بتخصصك أو خارج
              تخصصك.
            </small>

            <textarea
              name="topics"
              rows={5}
              placeholder="مثال: الذكاء الاصطناعي، Embedded Systems، الأمن السيبراني، إدارة المشاريع..."
            />

          </div>


          {/* Activity type */}

          <Field label="ما نوع النشاط الذي تفضله؟">
            <select
              name="activityType"
              required
              defaultValue=""
            >
              <option
                value=""
                disabled
              >
                اختر نوع النشاط
              </option>

              {ACTIVITY_TYPE_OPTIONS.map(
                (option) => (
                  <option
                    key={
                      option.value
                    }
                    value={
                      option.value
                    }
                  >
                    {option.label}
                  </option>
                )
              )}
            </select>
          </Field>


          {/* Activity level */}

          <Field label="ما المستوى المناسب للنشاط؟">
            <select
              name="activityLevel"
              required
              defaultValue=""
            >
              <option
                value=""
                disabled
              >
                اختر المستوى
              </option>

              {EXPERIENCE_LEVEL_OPTIONS.map(
                (option) => (
                  <option
                    key={
                      option.value
                    }
                    value={
                      option.value
                    }
                  >
                    {option.label}
                  </option>
                )
              )}
            </select>
          </Field>


          {/* Project idea */}

          <div className="contact-field contact-field-full">

            <label>
              هل لديك فكرة فعالية أو
              مشروع ترغب باقتراحه؟
              <Required />
            </label>

            <textarea
              name="projectIdea"
              required
              minLength={3}
              rows={5}
              placeholder="اكتب فكرة الفعالية أو المشروع التي تقترحها..."
            />

          </div>


          {/* Experience */}

          <Field label="مستوى خبرتك في المجال المقترح">
            <select
              name="experienceLevel"
              required
              defaultValue=""
            >
              <option
                value=""
                disabled
              >
                اختر مستوى الخبرة
              </option>

              {EXPERIENCE_LEVEL_OPTIONS.map(
                (option) => (
                  <option
                    key={
                      option.value
                    }
                    value={
                      option.value
                    }
                  >
                    {option.label}
                  </option>
                )
              )}
            </select>
          </Field>

        </div>


        <FormState state={state} />


        <SubmitButton
          pending={pending}
          text="إرسال الاقتراح"
        />

      </form>
    </>
  );
}

/* =========================================================
   COLLABORATION FORM
========================================================= */

function CollaborationForm() {
  const [state, formAction] = useActionState(
    submitCollaboration,
    initialState
  );

  const [pending, startTransition] = useTransition();

  function handleSubmit(
    event: React.FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    const form = event.currentTarget;

    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }

    const formData = new FormData(form);

    startTransition(() => {
      formAction(formData);
    });
  }

  const [
    fileName,
    setFileName,
  ] = useState("");

  const [
    fileSize,
    setFileSize,
  ] = useState("");

  function handleFileChange(
    event: React.ChangeEvent<HTMLInputElement>
  ) {
    const file =
      event.target.files?.[0];

    if (!file) {
      setFileName("");
      setFileSize("");
      return;
    }

    setFileName(file.name);

    const sizeInMb =
      file.size /
      (1024 * 1024);

    setFileSize(
      `${sizeInMb.toFixed(2)} MB`
    );
  }

  return (
    <>
      <FormHeading
        title="صندوق التعاون"
        description="نرحب بالمدربين والشركات والمؤسسات والمجتمعات التقنية والجهات الراغبة بالتعاون مع النادي الهندسي."
      />

      <form
        onSubmit={handleSubmit}
        className="contact-form"
      >

        <Honeypot />

        <div className="contact-form-grid">

          {/* Entity name */}

          <Field label="اسم الشخص / المؤسسة / الجهة">
            <input
              type="text"
              name="entityName"
              required
              placeholder="اكتب اسم الشخص أو الجهة"
            />
          </Field>


          {/* Entity type */}

          <Field label="نوع الجهة">
            <select
              name="entityType"
              required
              defaultValue=""
            >
              <option
                value=""
                disabled
              >
                اختر نوع الجهة
              </option>

              {ENTITY_TYPE_OPTIONS.map(
                (option) => (
                  <option
                    key={
                      option.value
                    }
                    value={
                      option.value
                    }
                  >
                    {option.label}
                  </option>
                )
              )}
            </select>
          </Field>


          {/* Contact person */}

          <Field label="اسم المسؤول عن التواصل">
            <input
              type="text"
              name="contactPerson"
              required
              placeholder="اكتب اسم مسؤول التواصل"
            />
          </Field>


          {/* Phone */}

          <Field label="رقم الهاتف">
            <input
              type="tel"
              name="phone"
              required
              dir="ltr"
              placeholder="+970 ..."
              autoComplete="tel"
            />
          </Field>


          {/* Email */}

          <Field label="البريد الإلكتروني">
            <input
              type="email"
              name="email"
              required
              dir="ltr"
              placeholder="name@example.com"
              autoComplete="email"
            />
          </Field>


          {/* Social / website URL */}

          <Field label="رابط الموقع أو صفحات التواصل الاجتماعي">
            <input
              type="url"
              name="socialUrl"
              required
              dir="ltr"
              placeholder="https://..."
            />
          </Field>


          {/* Cooperation type */}

          <Field label="نوع التعاون المقترح">
            <select
              name="cooperationType"
              required
              defaultValue=""
            >
              <option
                value=""
                disabled
              >
                اختر نوع التعاون
              </option>

              {COOPERATION_TYPE_OPTIONS.map(
                (option) => (
                  <option
                    key={
                      option.value
                    }
                    value={
                      option.value
                    }
                  >
                    {option.label}
                  </option>
                )
              )}
            </select>
          </Field>


          {/* Field */}

          <Field label="المجال">
            <input
              type="text"
              name="field"
              required
              placeholder="مثال: الذكاء الاصطناعي، الأمن السيبراني..."
            />
          </Field>


          {/* Description */}

          <div className="contact-field contact-field-full">

            <label>
              وصف الفكرة أو التعاون
              المقترح
              <Required />
            </label>

            <textarea
              name="description"
              required
              minLength={10}
              rows={6}
              placeholder="اشرح لنا فكرة التعاون المقترحة بالتفصيل..."
            />

          </div>


          {/* File upload */}

          <div className="contact-field contact-field-full">

            <label>
              هل يوجد ملف تعريفي أو
              مقترح؟
              <Optional />
            </label>

            <label className="contact-file-upload">

              <UploadCloud
                size={28}
                strokeWidth={1.7}
              />

              <strong>
                {fileName ||
                  "اختر ملفًا للرفع"}
              </strong>

              {fileSize ? (
                <small>
                  {fileSize}
                </small>
              ) : (
                <small>
                  PDF أو DOCX —
                  الحد الأقصى 5MB
                </small>
              )}

              <input
                type="file"
                name="attachment"
                accept=".pdf,.docx"
                onChange={
                  handleFileChange
                }
              />

            </label>

          </div>


          {/* Notes */}

          <div className="contact-field contact-field-full">

            <label>
              ملاحظات إضافية
              <Optional />
            </label>

            <textarea
              name="additionalNotes"
              rows={5}
              placeholder="أضف أي معلومات أو ملاحظات أخرى ترغب بمشاركتها..."
            />

          </div>

        </div>


        <FormState state={state} />


        <SubmitButton
          pending={pending}
          text="إرسال طلب التعاون"
        />

      </form>
    </>
  );
}

/* =========================================================
   SHARED COMPONENTS
========================================================= */

function FormHeading({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="contact-form-heading">

      <h2>
        {title}
      </h2>

      <p>
        {description}
      </p>

    </div>
  );
}


function Field({
  label,
  optional = false,
  children,
}: {
  label: string;
  optional?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="contact-field">

      <label>
        {label}

        {optional ? (
          <Optional />
        ) : (
          <Required />
        )}
      </label>

      {children}

    </div>
  );
}


function Required() {
  return (
    <span
      className="contact-required"
      aria-label="مطلوب"
      title="حقل مطلوب"
    >
      *
    </span>
  );
}


function Optional() {
  return (
    <span className="contact-optional">
      اختياري
    </span>
  );
}


function FormState({
  state,
}: {
  state: ContactFormState;
}) {
  if (!state.message) {
    return null;
  }

  return (
    <div
      role={state.success ? "status" : "alert"}
      className={`contact-message ${
        state.success
          ? "success"
          : "error"
      }`}
    >
      {state.success ? (
        <CheckCircle2 aria-hidden="true" />
      ) : (
        <CircleAlert aria-hidden="true" />
      )}
      <div>
        {state.success && (
          <strong>تم استلام طلبك بنجاح</strong>
        )}
        <span>{state.message}</span>
      </div>
    </div>
  );
}


function SubmitButton({
  pending,
  text,
}: {
  pending: boolean;
  text: string;
}) {
  return (
    <button
      type="submit"
      className="primary-btn contact-submit"
      disabled={pending}
    >
      <Send
        size={18}
        strokeWidth={1.8}
      />

      <span>
        {pending
          ? "جارٍ الإرسال..."
          : text}
      </span>
    </button>
  );
}


/*
  Honeypot بسيط ضد Bot submissions.
  يتم إخفاؤه لاحقًا بالـCSS.
*/

function Honeypot() {
  return (
    <input
      type="text"
      name="website"
      className="contact-honeypot"
      tabIndex={-1}
      autoComplete="off"
      aria-hidden="true"
    />
  );
}
