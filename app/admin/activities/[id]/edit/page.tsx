import Link from "next/link";
import {
  notFound,
} from "next/navigation";

import ActivityFormBuilder from "@/components/admin/ActivityFormBuilder";
import ActivitySchedulePicker from "@/components/admin/ActivitySchedulePicker";
import DepartmentChecklist from "@/components/admin/DepartmentChecklist";

import {
  activityDateTimeInputValues,
} from "@/lib/activities";
import {
  PERMISSIONS,
  isClubLeadership,
  requireActivityPermission,
} from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

import {
  updateActivityText,
} from "../../../actions";

export const dynamic =
  "force-dynamic";

export default async function EditActivityPage({
  params,
  searchParams,
}: {
  params: Promise<{
    id: string;
  }>;

  searchParams: Promise<{
    error?: string;
    success?: string;
  }>;
}) {
  const { id } =
    await params;

  const { user } =
    await requireActivityPermission(
      PERMISSIONS.ACTIVITY_MANAGE,
      id,
    );

  const isAdmin =
    user.role === "ADMIN" ||
    isClubLeadership(
      user.position,
    );

  const [
    activity,
    departments,
  ] = await Promise.all([
    prisma.activity.findUnique({
      where: {
        id,
      },

      include: {
        departments: {
          select: {
            departmentId: true,
          },
        },

        registrationForm: {
          include: {
            questions: {
              orderBy: {
                sortOrder: "asc",
              },

              select: {
                id: true,
                label: true,
                type: true,
                required: true,
                placeholder: true,
                helpText: true,
                options: true,

                _count: {
                  select: {
                    answers: true,
                  },
                },
              },
            },
          },
        },
      },
    }),

    isAdmin
      ? prisma.department.findMany({
          select: {
            id: true,
            nameAr: true,
          },

          orderBy: {
            sortOrder: "asc",
          },
        })
      : user.departmentId
        ? prisma.department.findMany({
            where: {
              id:
                user.departmentId,
            },

            select: {
              id: true,
              nameAr: true,
            },

            orderBy: {
              sortOrder: "asc",
            },
          })
        : Promise.resolve([]),
  ]);

  if (!activity) {
    notFound();
  }

  const feedback =
    await searchParams;

  const start =
    activityDateTimeInputValues(
      activity.startsAt,
    );

  const end =
    activity.endsAt
      ? activityDateTimeInputValues(
          activity.endsAt,
        )
      : {
          date: "",
          time: "",
        };

  const allDepartmentIds =
    departments.map(
      (department) =>
        department.id,
    );

  /*
   * General activities have zero ActivityDepartment rows.
   * In the checklist that means "all departments".
   */
  const initialDepartmentIds =
    activity.departments.length ===
    0
      ? allDepartmentIds
      : activity.departments.map(
          (item) =>
            item.departmentId,
        );

  const initialQuestions =
    (
      activity.registrationForm
        ?.questions ?? []
    ).map(
      (question) => ({
        id: question.id,
        label:
          question.label,
        type:
          question.type,
        required:
          question.required,
        placeholder:
          question.placeholder,
        helpText:
          question.helpText,

        options:
          Array.isArray(
            question.options,
          )
            ? question.options.filter(
                (
                  option,
                ): option is string =>
                  typeof option ===
                  "string",
              )
            : [],

        answerCount:
          question._count.answers,
      }),
    );

  return (
    <section className="admin-page activities-admin-page">
      <div className="admin-page-head">
        <div>
          <h1>
            تعديل النشاط
          </h1>

          <p className="muted">
            يمكنك تعديل بيانات النشاط، الموعد، الأقسام، حالة النشر ونموذج التسجيل من مكان واحد.
          </p>
        </div>

        <div
          style={{
            display: "flex",
            gap: 10,
            flexWrap: "wrap",
          }}
        >
          <Link
            href="/admin/activities"
            className="ghost-btn"
          >
            العودة للأنشطة
          </Link>

          <Link
            href={`/activities/${activity.id}`}
            className="ghost-btn"
          >
            عرض النشاط
          </Link>
        </div>
      </div>

      {feedback.error && (
        <div className="feedback-error">
          {feedback.error}
        </div>
      )}

      {feedback.success && (
        <div className="feedback-success">
          {feedback.success}
        </div>
      )}

      <div className="admin-card activity-form-panel">
        <form
          action={updateActivityText}
          className="stack-form"
        >
          <input
            type="hidden"
            name="activityId"
            value={activity.id}
          />

          <label>
            اسم النشاط

            <input
              type="text"
              name="title"
              defaultValue={
                activity.title
              }
              required
              maxLength={160}
            />
          </label>

          <label>
            وصف النشاط

            <textarea
              name="description"
              defaultValue={
                activity.description
              }
              required
              rows={8}
              maxLength={10000}
            />
          </label>

          <ActivitySchedulePicker
            initialStartDate={
              start.date
            }
            initialStartTime={
              start.time
            }
            initialEndDate={
              end.date
            }
            initialEndTime={
              end.time
            }
          />

          <div className="form-grid">
            <label>
              مكان النشاط

              <input
                name="location"
                defaultValue={
                  activity.location
                }
                required
                maxLength={250}
              />
            </label>

            <label>
              السعة الطلابية

              <input
                type="number"
                min="1"
                max="100000"
                name="capacity"
                defaultValue={
                  activity.capacity
                }
                required
              />
            </label>

            <label>
              حالة النشاط

              <select
                name="status"
                defaultValue={
                  activity.status
                }
              >
                <option value="DRAFT">
                  مسودة
                </option>

                <option value="PUBLISHED">
                  منشور
                </option>

                <option value="ARCHIVED">
                  مؤرشف
                </option>
              </select>
            </label>
          </div>

          {isAdmin ? (
            <DepartmentChecklist
              departments={
                departments
              }
              initialSelectedIds={
                initialDepartmentIds
              }
            />
          ) : (
            <div className="admin-card">
              <strong>
                القسم المستهدف
              </strong>

              <p className="muted">
                {departments[0]
                  ?.nameAr ??
                  "لا يوجد قسم مرتبط بالحساب"}
              </p>

              {user.departmentId && (
                <input
                  type="hidden"
                  name="departmentIds"
                  value={
                    user.departmentId
                  }
                />
              )}
            </div>
          )}

          <ActivityFormBuilder
            initialTitle={
              activity.registrationForm
                ?.title ??
              "نموذج التسجيل"
            }
            initialDescription={
              activity.registrationForm
                ?.description ??
              ""
            }
            initialIsOpen={
              activity.registrationForm
                ?.isOpen ??
              true
            }
            initialQuestions={
              initialQuestions
            }
          />

          {initialQuestions.some(
            (question) =>
              question.answerCount >
              0,
          ) && (
            <p className="muted">
              ملاحظة: يمكن تعديل الأسئلة التي تحتوي على إجابات سابقة، لكن لا يمكن حذفها حفاظًا على تسجيلات الطلاب.
            </p>
          )}

          <label>
            ملخص الفعالية بعد انتهائها

            <textarea
              name="postEventSummary"
              defaultValue={
                activity.postEventSummary ??
                ""
              }
              rows={8}
              maxLength={10000}
              placeholder="يظهر هذا النص في قسم «عن الفعالية» بعد انتهاء النشاط."
            />
          </label>

          <button
            type="submit"
            className="primary-btn"
            disabled={
              !isAdmin &&
              !user.departmentId
            }
          >
            حفظ جميع التعديلات
          </button>
        </form>
      </div>
    </section>
  );
}
