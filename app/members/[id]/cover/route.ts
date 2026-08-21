import { readFile } from "node:fs/promises";
import path from "node:path";

import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  {
    params,
  }: {
    params: Promise<{
      id: string;
    }>;
  },
) {
  const { id } = await params;

  // لا نشترط وجود العضو داخل الهيكلية هنا؛ صفحة الملف الشخصي
  // تحتاج عرض الغلاف مباشرة بعد الحفظ حتى لو لم يكن للعضو StructureItem.
  const user = await prisma.user.findFirst({
    where: {
      id,
      role: {
        in: ["MEMBER", "ADMIN"],
      },
    },
    select: {
      profileCoverStoredName: true,
      profileCoverMime: true,
    },
  });

  if (!user?.profileCoverStoredName || !user.profileCoverMime) {
    return new Response("Not found", { status: 404 });
  }

  try {
    const file = await readFile(
      path.join(
        process.cwd(),
        "storage",
        "member-covers",
        path.basename(user.profileCoverStoredName),
      ),
    );

    return new Response(file, {
      headers: {
        "Content-Type": user.profileCoverMime,
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}