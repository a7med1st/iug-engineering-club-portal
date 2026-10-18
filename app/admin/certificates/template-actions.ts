"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { PERMISSIONS, requirePermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { parseTemplateSettings } from "@/lib/certificate-template-settings";
import { storeCertificateTemplate } from "@/lib/certificate-template-storage";
import { tryDeletePrivateBlobs } from "@/lib/blob-storage";
import { parseCertificateQr } from "@/lib/certificate-qr";
import { certificateTemplateForm } from "@/lib/certificate-language";

export async function saveCertificateTemplate(formData: FormData) {
  const { user } = await requirePermission(PERMISSIONS.ADMIN_DASHBOARD);
  const activityId = String(formData.get("activityId") ?? "");
  const uploadedPaths: string[] = [];
  const replacedPaths: string[] = [];
  let failure: string | null = null;
  try {
    const activity = await prisma.activity.findFirst({ where: { id: activityId, deletedAt: null }, select: { id: true } });
    if (!activity) throw new Error("النشاط غير موجود.");
    const updates = [];
    for (const language of ["ar", "en"] as const) {
      const data = certificateTemplateForm(formData, language);
      const input = language === "ar" && !formData.has("ar.templateWidth") ? formData : data;
      if (language === "en" && !formData.has("en.templateWidth")) continue;
      const current = language === "ar" ? await prisma.certificateTemplate.findUnique({ where: { activityId } }) : await prisma.certificateTemplateEnglish.findUnique({ where: { activityId } });
      const file = input.get("template");
      if (!current && !(file instanceof File && file.size > 0)) continue;
      const uploaded = file instanceof File && file.size > 0 ? await storeCertificateTemplate(activityId, file) : null;
      if (uploaded) uploadedPaths.push(uploaded.pathname);
      const source = uploaded ? { sourcePathname: uploaded.pathname, sourceOriginalName: uploaded.originalName, sourceMime: uploaded.mime, sourceSize: uploaded.size, sourceWidth: uploaded.width, sourceHeight: uploaded.height } : current!;
      input.set("templateWidth", String(source.sourceWidth));
      input.set("templateHeight", String(source.sourceHeight));
      const parsed = parseTemplateSettings(input);
      if (!parsed.ok) throw new Error(`${language === "ar" ? "القالب العربي" : "القالب الإنجليزي"}: ${parsed.message}`);
      const qrSettings = parseCertificateQr(input, source.sourceWidth, source.sourceHeight);
      const values = { sourcePathname: source.sourcePathname, sourceOriginalName: source.sourceOriginalName, sourceMime: source.sourceMime, sourceSize: source.sourceSize, sourceWidth: source.sourceWidth, sourceHeight: source.sourceHeight, ...parsed.value, qrSettings };
      const update = { where: { activityId }, create: { activityId, createdById: user.id, ...values }, update: values };
      updates.push(language === "ar" ? prisma.certificateTemplate.upsert(update) : prisma.certificateTemplateEnglish.upsert(update));
      if (uploaded && current) replacedPaths.push(current.sourcePathname);
    }
    if (!updates.length) throw new Error("أرفق صورة قالب شهادة أولًا.");
    await prisma.$transaction(updates);
  } catch (error) {
    await tryDeletePrivateBlobs(uploadedPaths, "certificate-template-save-rollback");
    console.error("Certificate template save failed", { activityId, error });
    failure = error instanceof Error && !error.message.includes("prisma") ? error.message : "تعذر حفظ قوالب الشهادة. حاول مجددًا.";
  }
  if (failure) redirect(`/admin/certificates?activity=${encodeURIComponent(activityId)}&error=${encodeURIComponent(failure)}`);
  await tryDeletePrivateBlobs(replacedPaths, "certificate-template-replacement");
  revalidatePath("/admin/certificates");
  redirect(`/admin/certificates?activity=${encodeURIComponent(activityId)}&success=${encodeURIComponent("تم حفظ قوالب الشهادة. جهّز القالبين قبل إصدار النسختين.")}`);
}
