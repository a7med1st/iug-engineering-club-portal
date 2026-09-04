import Link from "next/link";
import { notFound } from "next/navigation";

import ActivityRegistrationForm from "@/components/activities/ActivityRegistrationForm";
import { formatActivitySchedule } from "@/lib/activities";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type Props = {
    params: Promise<{
        id: string;
    }>;
};

export default async function ActivityRegisterPage({
    params,
}: Props) {
    const { id } = await params;

    const activity = await prisma.activity.findUnique({
        where: {
            id,
        },

        include: {
            departments: {
                include: {
                    department: true,
                },
            },

            registrationForm: {
                include: {
                    questions: {
                        orderBy: {
                            sortOrder: "asc",
                        },
                    },

                    _count: {
                        select: {
                            submissions: true,
                        },
                    },
                },
            },
        },
    });

    if (!activity) {
        notFound();
    }

    const form = activity.registrationForm;

    const occupiedSeats = form
        ? await prisma.activityFormSubmission.count({
            where: {
                formId: form.id,

                status: {
                    not: "REJECTED",
                },
            },
        })
        : 0;

    const remainingSeats =
        activity.capacity > 0
            ? Math.max(
                activity.capacity -
                occupiedSeats,
                0,
            )
            : null;

const isCapacityFull =
  activity.capacity > 0 &&
  occupiedSeats >= activity.capacity;

    return (
        <main className="activity-registration-page">

            <section className="activity-registration-hero">
                <div className="activity-registration-shell">

                    <Link
                        href="/activities"
                        className="activity-registration-back"
                    >
                        ← العودة إلى الأنشطة
                    </Link>

                    <h1>
                        {activity.title}
                    </h1>

                    <p>
                        {activity.description}
                    </p>

                    <div className="activity-registration-meta">

                        <div>
                            <span>المكان</span>
                            <strong>
                                {activity.location}
                            </strong>
                        </div>

                        <div>
                            <span>التاريخ والوقت</span>
                            <strong>
                                {formatActivitySchedule(
                                    activity.startsAt,
                                    activity.endsAt,
                                )}
                            </strong>
                        </div>

                        <div>
                            <span>
                                المقاعد المتبقية
                            </span>

                            <strong>
                                {remainingSeats !== null
                                    ? `${remainingSeats} مقعد`
                                    : "غير محددة"}
                            </strong>
                        </div>

                    </div>

                </div>
            </section>


            <section className="activity-registration-content">
                <div className="activity-registration-shell">

                    {!form ? (
                        <div className="activity-registration-state">
                            <h2>
                                نموذج التسجيل غير متوفر
                            </h2>

                            <p>
                                لم يتم إنشاء نموذج تسجيل لهذا النشاط حتى الآن.
                            </p>
                        </div>
                    ) : !form.isOpen ? (
                        <div className="activity-registration-state">
                            <h2>
                                التسجيل مغلق
                            </h2>

                            <p>
                                قام النادي بإغلاق التسجيل في هذا النشاط.
                            </p>
                        </div>
                    ) : isCapacityFull ? (
                        <div className="activity-registration-state">
                            <h2>
                                اكتمل العدد
                            </h2>

                            <p>
                                تم الوصول إلى الحد الأقصى للمشاركين في هذا النشاط.
                            </p>
                        </div>
                    ) : (
                        <div className="activity-registration-card">

                            <div className="activity-registration-card-head">

                                <h2>
                                    {form.title}
                                </h2>

                                {form.description && (
                                    <p>
                                        {form.description}
                                    </p>
                                )}

                            </div>

                            {form.questions.length === 0 ? (
                                <div className="activity-registration-state">
                                    <h3>
                                        لا توجد أسئلة بعد
                                    </h3>

                                    <p>
                                        لم يقم الأدمن بإضافة أسئلة إلى نموذج التسجيل.
                                    </p>
                                </div>
                            ) : (
                                <ActivityRegistrationForm
                                    activityId={activity.id}
                                    formId={form.id}
                                    questions={form.questions.map(
                                        (question) => ({
                                            id: question.id,
                                            label: question.label,
                                            type: question.type,
                                            required: question.required,
                                            placeholder:
                                                question.placeholder,
                                            helpText:
                                                question.helpText,

                                            options: Array.isArray(
                                                question.options
                                            )
                                                ? question.options.filter(
                                                    (
                                                        option
                                                    ): option is string =>
                                                        typeof option ===
                                                        "string"
                                                )
                                                : [],
                                        })
                                    )}
                                />
                            )}

                        </div>
                    )}

                </div>
            </section>

        </main>
    );
}
