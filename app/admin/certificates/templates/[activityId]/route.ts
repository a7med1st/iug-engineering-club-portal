import { getPrivateBlob } from "@/lib/blob-storage";
import { PERMISSIONS, requirePermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { privateFileResponse } from "@/lib/private-file-response";
import { certificateLanguage } from "@/lib/certificate-language";

export const dynamic = "force-dynamic";

export async function GET(request:Request,{params}:{params:Promise<{activityId:string}>}){
  await requirePermission(PERMISSIONS.ADMIN_DASHBOARD);
  const {activityId}=await params;
  const language=certificateLanguage(new URL(request.url).searchParams.get("language"));
  if(!language)return new Response("Invalid language",{status:400});
  const query={where:{activityId},select:{sourcePathname:true,sourceMime:true,sourceOriginalName:true}} as const;
  const template=language==="en"?await prisma.certificateTemplateEnglish.findUnique(query):await prisma.certificateTemplate.findUnique(query);
  if(!template)return new Response("Not found",{status:404});
  const blob=await getPrivateBlob(template.sourcePathname);
  return privateFileResponse(blob,{fallbackMime:template.sourceMime,originalName:template.sourceOriginalName,disposition:"inline",cacheControl:"private, no-store"})??new Response("Not found",{status:404});
}
