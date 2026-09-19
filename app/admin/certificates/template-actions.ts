"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { PERMISSIONS, requirePermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { parseTemplateSettings } from "@/lib/certificate-template-settings";
import { storeCertificateTemplate } from "@/lib/certificate-template-storage";
import { tryDeletePrivateBlobs } from "@/lib/blob-storage";

export async function saveCertificateTemplate(formData: FormData) {
  const { user } = await requirePermission(PERMISSIONS.ADMIN_DASHBOARD);
  const activityId = String(formData.get("activityId") ?? "");
  const current = await prisma.certificateTemplate.findUnique({ where: { activityId } });
  const file = formData.get("template");
  const uploaded = file instanceof File && file.size > 0 ? await storeCertificateTemplate(activityId, file) : null;
  if (!current && !uploaded) redirect(`/admin/certificates?activity=${activityId}&error=${encodeURIComponent("اختر صورة قالب أولًا.")}`);
  const source = uploaded
    ? { pathname: uploaded.pathname, originalName: uploaded.originalName, mime: uploaded.mime, size: uploaded.size, width: uploaded.width, height: uploaded.height }
    : { pathname: current!.sourcePathname, originalName: current!.sourceOriginalName, mime: current!.sourceMime, size: current!.sourceSize, width: current!.sourceWidth, height: current!.sourceHeight };
  const trustedData = new FormData();
  for (const [key, value] of formData.entries()) trustedData.set(key, value);
  trustedData.set("templateWidth", String(source.width));
  trustedData.set("templateHeight", String(source.height));
  const parsed = parseTemplateSettings(trustedData);
  if (!parsed.ok) {
    if (uploaded) await tryDeletePrivateBlobs([uploaded.pathname], "invalid-certificate-template-settings");
    redirect(`/admin/certificates?activity=${activityId}&error=${encodeURIComponent(parsed.message)}`);
  }
  await prisma.certificateTemplate.upsert({
    where: { activityId },
    create: { activityId, createdById: user.id, sourcePathname: source.pathname, sourceOriginalName: source.originalName, sourceMime: source.mime, sourceSize: source.size, sourceWidth: source.width, sourceHeight: source.height, ...parsed.value },
    update: { ...(uploaded ? { sourcePathname: source.pathname, sourceOriginalName: source.originalName, sourceMime: source.mime, sourceSize: source.size, sourceWidth: source.width, sourceHeight: source.height } : {}), ...parsed.value },
  });
  if (uploaded && current) await tryDeletePrivateBlobs([current.sourcePathname], "certificate-template-replacement");
  revalidatePath("/admin/certificates");
  redirect(`/admin/certificates?activity=${activityId}&success=${encodeURIComponent("تم حفظ قالب الشهادة.")}`);
}
