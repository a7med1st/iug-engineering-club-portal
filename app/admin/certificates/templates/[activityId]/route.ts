import { getPrivateBlob } from "@/lib/blob-storage";
import { PERMISSIONS, requirePermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { privateFileResponse } from "@/lib/private-file-response";

export const dynamic = "force-dynamic";

export async function GET(_:Request,{params}:{params:Promise<{activityId:string}>}){
  await requirePermission(PERMISSIONS.ADMIN_DASHBOARD);
  const {activityId}=await params;
  const template=await prisma.certificateTemplate.findUnique({where:{activityId},select:{sourcePathname:true,sourceMime:true,sourceOriginalName:true}});
  if(!template)return new Response("Not found",{status:404});
  const blob=await getPrivateBlob(template.sourcePathname);
  return privateFileResponse(blob,{fallbackMime:template.sourceMime,originalName:template.sourceOriginalName,disposition:"inline",cacheControl:"private, no-store"})??new Response("Not found",{status:404});
}
