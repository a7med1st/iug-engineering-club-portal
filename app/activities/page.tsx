import type { Prisma } from "@prisma/client";
import Link from "next/link";

import ActivityCard from "@/components/ActivityCard";
import PastActivityCard from "@/components/PastActivityCard";
import PastActivityFilterDropdown from "@/components/PastActivityFilterDropdown";
import {
  activityYear,
  activityYearRange,
  currentActivityWhere,
  pastActivityWhere,
} from "@/lib/activities";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type ActivitiesSearchParams = {
  view?: string | string[];
  q?: string | string[];
  department?: string | string[];
  year?: string | string[];
};

function one(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function Activities({
  searchParams,
}: {
  searchParams: Promise<ActivitiesSearchParams>;
}) {
  const params = await searchParams;
  const isPastView = one(params.view) === "past";
  const now = new Date();
  const query = (one(params.q) ?? "").trim().slice(0, 120);

  const visibilityWhere = isPastView
    ? pastActivityWhere(now)
    : currentActivityWhere(now);

  const [departments, departmentCount, pastActivityDates] = await Promise.all([
    prisma.department.findMany({
      select: { id: true, nameAr: true, slug: true },
      orderBy: { sortOrder: "asc" },
    }),
    prisma.department.count(),
    isPastView
      ? prisma.activity.findMany({
          where: pastActivityWhere(now),
          select: { startsAt: true },
          orderBy: { startsAt: "desc" },
        })
      : Promise.resolve([]),
  ]);

  const availableDepartmentIds = new Set(
    departments.map(({ id }) => id),
  );
  const requestedDepartment = one(params.department) ?? "";
  const department = availableDepartmentIds.has(requestedDepartment)
    ? requestedDepartment
    : "";

  const years = [
    ...new Set(pastActivityDates.map(({ startsAt }) => activityYear(startsAt))),
  ].sort((first, second) => second - first);
  const requestedYear = Number(one(params.year));
  const year = years.includes(requestedYear) ? requestedYear : null;

  const filters: Prisma.ActivityWhereInput[] = [visibilityWhere];

  if (isPastView && query) {
    filters.push({
      title: { contains: query, mode: "insensitive" },
    });
  }

  if (isPastView && department) {
    filters.push({
      departments: { some: { departmentId: department } },
    });
  }

  if (isPastView && year) {
    filters.push({ startsAt: activityYearRange(year) });
  }

  const activities = await prisma.activity.findMany({
    where: { AND: filters },
    include: {
      departments: {
        include: { department: true },
      },
    },
    orderBy: { startsAt: isPastView ? "desc" : "asc" },
  });

  const hasPastFilters = Boolean(query || department || year);

  return (
    <>
      <section className="page-hero">
        <div className="shell">
          <h1>أنشطة النادي الهندسي</h1>
          <p>
            تابع الأنشطة الحالية والقادمة، أو استعرض سجل الأنشطة التي نفذها
            النادي وطلبة كلية الهندسة.
          </p>
        </div>
      </section>

      <section className="section activities-page-section">
        <div className="shell">
          <nav className="activity-tabs" aria-label="عرض الأنشطة">
            <Link
              className={!isPastView ? "active" : ""}
              href="/activities"
              aria-current={!isPastView ? "page" : undefined}
            >
              الحالية والقادمة
            </Link>
            <Link
              className={isPastView ? "active" : ""}
              href="/activities?view=past"
              aria-current={isPastView ? "page" : undefined}
            >
              الأنشطة السابقة
            </Link>
          </nav>

          {isPastView && (
            <form className="past-activity-filters" method="get">
              <input type="hidden" name="view" value="past" />

              <label className="past-activity-search">
                <span>البحث باسم النشاط</span>
                <input
                  type="search"
                  name="q"
                  defaultValue={query}
                  placeholder="اكتب اسم النشاط"
                />
              </label>

              <div className="past-activity-filter-field">
                <span>القسم</span>
                <PastActivityFilterDropdown
                  name="department"
                  label="القسم"
                  defaultValue={department}
                  kind="department"
                  options={[
                    { value: "", label: "جميع الأقسام" },
                    ...departments.map((item) => ({
                      value: item.id,
                      label: item.nameAr,
                      slug: item.slug,
                    })),
                  ]}
                />
              </div>

              <div className="past-activity-filter-field">
                <span>السنة</span>
                <PastActivityFilterDropdown
                  name="year"
                  label="السنة"
                  defaultValue={year?.toString() ?? ""}
                  kind="year"
                  options={[
                    { value: "", label: "جميع السنوات" },
                    ...years.map((item) => ({
                      value: item.toString(),
                      label: item.toString(),
                    })),
                  ]}
                />
              </div>

              <div className="past-activity-filter-actions">
                <button className="primary-btn" type="submit">
                  تطبيق الفلاتر
                </button>
                {hasPastFilters && (
                  <Link className="ghost-btn" href="/activities?view=past">
                    مسح
                  </Link>
                )}
              </div>
            </form>
          )}

          <div
            className={
              isPastView ? "past-activities-grid" : "activities-list"
            }
          >
            {activities.length ? (
              activities.map((activity) =>
                isPastView ? (
                  <PastActivityCard
                    key={activity.id}
                    activity={activity}
                    departmentCount={departmentCount}
                  />
                ) : (
                  <ActivityCard
                    key={activity.id}
                    activity={activity}
                    departmentCount={departmentCount}
                  />
                ),
              )
            ) : (
              <div className="guide-section activities-empty-state-public">
                <h3>
                  {hasPastFilters
                    ? "لا توجد نتائج مطابقة"
                    : isPastView
                      ? "لا توجد أنشطة سابقة حتى الآن"
                      : "لا توجد أنشطة حالية أو قادمة الآن"}
                </h3>
                <p>
                  {hasPastFilters
                    ? "جرّب تعديل كلمات البحث أو اختيار قسم وسنة مختلفين."
                    : "ستظهر الأنشطة هنا فور نشرها أو اكتمال تنفيذها."}
                </p>
                {hasPastFilters && (
                  <Link className="ghost-btn" href="/activities?view=past">
                    عرض جميع الأنشطة السابقة
                  </Link>
                )}
              </div>
            )}
          </div>
        </div>
      </section>
    </>
  );
}
