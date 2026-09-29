import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { normalizeLibraryCourseCode } from "./course-code";
import { LibraryValidationError } from "./validation";

export type LibraryCourseInput = {
  name: string;
  code: string | null;
  description: string | null;
  level: number;
  semester: number;
  sortOrder: number;
};

export class LibraryCourseMatchError extends LibraryValidationError {
  constructor(public readonly match: { id: string; name: string; departments: string[] }) {
    super("هذا المساق مضاف بالفعل. أكّد الربط لاستخدام ملفاته الحالية.");
  }
}

export async function findLibraryCourseMatch(code: unknown) {
  const normalizedCode = normalizeLibraryCourseCode(code);
  if (!normalizedCode) return null;
  const course = await prisma.libraryCourse.findUnique({
    where: { normalizedCode },
    select: { id: true, name: true, departments: { select: { department: { select: { nameAr: true } } }, orderBy: { department: { nameAr: "asc" } } } },
  });
  return course ? { id: course.id, name: course.name, departments: course.departments.map((item) => item.department.nameAr) } : null;
}

export async function createOrAttachLibraryCourse(input: LibraryCourseInput, departmentId: string, confirmExisting: boolean) {
  const normalizedCode = normalizeLibraryCourseCode(input.code);
  try {
    return await prisma.$transaction(async (tx) => {
      const existing = normalizedCode ? await tx.libraryCourse.findUnique({
        where: { normalizedCode },
        select: { id: true, name: true, departments: { select: { departmentId: true, department: { select: { nameAr: true } } } } },
      }) : null;
      if (existing) {
        if (existing.departments.some((item) => item.departmentId === departmentId)) {
          throw new LibraryValidationError("هذا المساق مضاف بالفعل إلى القسم.");
        }
        if (!confirmExisting) {
          throw new LibraryCourseMatchError({ id: existing.id, name: existing.name, departments: existing.departments.map((item) => item.department.nameAr) });
        }
        await tx.libraryCourseDepartment.create({ data: { courseId: existing.id, departmentId, level: input.level, semester: input.semester, sortOrder: input.sortOrder } });
        return { courseId: existing.id, attached: true };
      }
      const course = await tx.libraryCourse.create({
        data: {
          name: input.name,
          code: input.code,
          normalizedCode,
          description: input.description,
          departments: { create: { departmentId, level: input.level, semester: input.semester, sortOrder: input.sortOrder } },
        },
        select: { id: true },
      });
      return { courseId: course.id, attached: false };
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new LibraryValidationError("تم ربط المساق مسبقًا. حدّث الصفحة وحاول مجددًا.");
    }
    throw error;
  }
}
