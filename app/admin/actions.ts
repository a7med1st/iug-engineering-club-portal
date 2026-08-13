"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";

const activityStatuses = ["DRAFT", "PUBLISHED", "ARCHIVED"] as const;
type ActivityStatusInput = (typeof activityStatuses)[number];

class AdminActionError extends Error {}

function requiredText(formData: FormData, field: string, label: string) {
  const value = String(formData.get(field) ?? "").trim();
  if (!value) throw new AdminActionError(`${label} مطلوب.`);
  return value;
}

function optionalId(formData: FormData, field: string) {
  return String(formData.get(field) ?? "").trim() || null;
}

async function ensureDepartmentExists(departmentId: string | null) {
  if (!departmentId) return;
  const department = await prisma.department.findUnique({
    where: { id: departmentId },
    select: { id: true },
  });
  if (!department) throw new AdminActionError("القسم المحدد غير موجود.");
}

async function runAdminAction(
  path: string,
  successMessage: string,
  fallbackError: string,
  action: () => Promise<void>,
): Promise<never> {
  try {
    await action();
  } catch (error) {
    const message = error instanceof AdminActionError ? error.message : fallbackError;
    redirect(`${path}?error=${encodeURIComponent(message)}`);
  }

  redirect(`${path}?success=${encodeURIComponent(successMessage)}`);
}

export async function createMember(formData: FormData) {
  await requireAdmin();

  return runAdminAction(
    "/admin/members",
    "تم إنشاء حساب العضو بنجاح.",
    "تعذر إنشاء حساب العضو. تحقق من البيانات وحاول مجددًا.",
    async () => {
      const name = requiredText(formData, "name", "الاسم");
      const email = requiredText(formData, "email", "البريد الإلكتروني").toLowerCase();
      const password = String(formData.get("password") ?? "");
      const position = String(formData.get("position") ?? "").trim() || null;
      const departmentId = optionalId(formData, "departmentId");
      const requestedRole = String(formData.get("role") ?? "MEMBER");

      if (name.length < 2 || name.length > 120) {
        throw new AdminActionError("يجب أن يكون الاسم بين حرفين و120 حرفًا.");
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        throw new AdminActionError("أدخل بريدًا إلكترونيًا صالحًا.");
      }
      if (password.length < 8) {
        throw new AdminActionError("يجب ألا تقل كلمة المرور عن 8 أحرف.");
      }
      if (requestedRole !== "MEMBER") {
        throw new AdminActionError("هذه الصفحة مخصصة لإنشاء حسابات الأعضاء فقط.");
      }

      await ensureDepartmentExists(departmentId);
      const existingUser = await prisma.user.findUnique({
        where: { email },
        select: { id: true },
      });
      if (existingUser) throw new AdminActionError("هذا البريد الإلكتروني مستخدم بالفعل.");

      const passwordHash = await bcrypt.hash(password, 12);
      await prisma.user.create({
        data: {
          name,
          email,
          passwordHash,
          role: "MEMBER",
          position,
          departmentId,
        },
      });

      revalidatePath("/admin/members");
    },
  );
}

export async function createActivity(formData: FormData) {
  await requireAdmin();

  return runAdminAction(
    "/admin/activities",
    "تم حفظ النشاط بنجاح.",
    "تعذر حفظ النشاط. تحقق من البيانات وحاول مجددًا.",
    async () => {
      const title = requiredText(formData, "title", "اسم النشاط");
      const description = requiredText(formData, "description", "وصف النشاط");
      const location = requiredText(formData, "location", "مكان النشاط");
      const startsAt = new Date(requiredText(formData, "startsAt", "تاريخ ووقت النشاط"));
      const capacity = Number(formData.get("capacity"));
      const formUrl = requiredText(formData, "formUrl", "رابط التسجيل");
      const statusValue = String(formData.get("status") ?? "PUBLISHED").trim();
      const requestedDepartmentIds = [
        ...new Set(
          formData
            .getAll("departmentIds")
            .map((value) => String(value).trim())
            .filter(Boolean),
        ),
      ];

      if (title.length > 160) throw new AdminActionError("اسم النشاط طويل جدًا.");
      if (Number.isNaN(startsAt.getTime())) throw new AdminActionError("تاريخ النشاط غير صالح.");
      if (!Number.isInteger(capacity) || capacity < 1 || capacity > 100_000) {
        throw new AdminActionError("السعة الطلابية يجب أن تكون رقمًا صحيحًا موجبًا.");
      }

      let registrationUrl: URL;
      try {
        registrationUrl = new URL(formUrl);
      } catch {
        throw new AdminActionError("رابط التسجيل غير صالح.");
      }
      if (!["http:", "https:"].includes(registrationUrl.protocol)) {
        throw new AdminActionError("رابط التسجيل يجب أن يبدأ بـ http أو https.");
      }
      if (!activityStatuses.includes(statusValue as ActivityStatusInput)) {
        throw new AdminActionError("حالة النشاط غير صالحة.");
      }
      if (requestedDepartmentIds.length === 0) {
        throw new AdminActionError("اختر قسمًا واحدًا على الأقل أو اختر جميع الأقسام.");
      }

      const selectAll = requestedDepartmentIds.includes("all");
      const explicitDepartmentIds = requestedDepartmentIds.filter(
        (departmentId) => departmentId !== "all",
      );
      const availableDepartments = await prisma.department.findMany({
        select: { id: true },
      });
      const availableDepartmentIds = new Set(
        availableDepartments.map(({ id }) => id),
      );

      if (
        availableDepartments.length === 0 ||
        explicitDepartmentIds.some(
          (departmentId) => !availableDepartmentIds.has(departmentId),
        )
      ) {
        throw new AdminActionError("يتضمن اختيار الأقسام قسمًا غير موجود.");
      }

      // A general activity intentionally has no join rows. This keeps it general
      // even when departments are added later; subsets use the join table normally.
      const departmentIds = selectAll ? [] : explicitDepartmentIds;

      await prisma.activity.create({
        data: {
          title,
          description,
          location,
          startsAt,
          capacity,
          formUrl: registrationUrl.toString(),
          status: statusValue as ActivityStatusInput,
          departments: departmentIds.length
            ? {
                create: departmentIds.map((departmentId) => ({
                  department: { connect: { id: departmentId } },
                })),
              }
            : undefined,
        },
      });

      revalidatePath("/");
      revalidatePath("/admin/activities");
      revalidatePath("/activities");
    },
  );
}

export async function deleteActivity(formData: FormData) {
  await requireAdmin();

  return runAdminAction(
    "/admin/activities",
    "تم حذف النشاط.",
    "تعذر حذف النشاط.",
    async () => {
      const id = requiredText(formData, "id", "معرّف النشاط");
      await prisma.activity.delete({ where: { id } });

      revalidatePath("/");
      revalidatePath("/admin/activities");
      revalidatePath("/activities");
    },
  );
}

export async function saveGuide(formData: FormData) {
  await requireAdmin();

  return runAdminAction(
    "/admin/guides",
    "تم حفظ دليل القسم.",
    "تعذر حفظ دليل القسم.",
    async () => {
      const departmentId = requiredText(formData, "departmentId", "القسم");
      const department = await prisma.department.findUnique({
        where: { id: departmentId },
        select: { slug: true },
      });
      if (!department) throw new AdminActionError("القسم المحدد غير موجود.");

      const content = {
        overview: String(formData.get("overview") ?? "").trim(),
        fitFor: String(formData.get("fitFor") ?? "").trim(),
        careersIncome: String(formData.get("careersIncome") ?? "").trim(),
        skillsCourses: String(formData.get("skillsCourses") ?? "").trim(),
        comparisons: String(formData.get("comparisons") ?? "").trim(),
        faq: String(formData.get("faq") ?? "").trim(),
      };

      await prisma.departmentGuide.upsert({
        where: { departmentId },
        create: { departmentId, ...content },
        update: content,
      });

      revalidatePath("/admin/guides");
      revalidatePath("/departments");
      revalidatePath(`/departments/${department.slug}`);
    },
  );
}

export async function addStructureItem(formData: FormData) {
  await requireAdmin();

  return runAdminAction(
    "/admin/structure",
    "تمت إضافة العنصر إلى الهيكلية.",
    "تعذر إضافة العنصر إلى الهيكلية.",
    async () => {
      const name = requiredText(formData, "name", "اسم الشخص");
      const title = requiredText(formData, "title", "المنصب");
      const departmentId = optionalId(formData, "departmentId");

      if (name.length > 120 || title.length > 160) {
        throw new AdminActionError("الاسم أو المنصب طويل جدًا.");
      }
      await ensureDepartmentExists(departmentId);

      await prisma.clubStructureItem.create({
        data: { name, title, departmentId },
      });

      revalidatePath("/admin/structure");
      revalidatePath("/delegates");
    },
  );
}
