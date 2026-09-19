import { randomUUID } from "node:crypto";
import { putPrivateBlob } from "@/lib/blob-storage";
import { validateAndProcessImage } from "@/lib/upload-security";
export const CERTIFICATE_TEMPLATE_MAX_BYTES=8*1024*1024;
export async function storeCertificateTemplate(activityId:string,file:File){const validated=await validateAndProcessImage(file,{maxBytes:CERTIFICATE_TEMPLATE_MAX_BYTES,maxWidth:8000,maxHeight:8000,maxPixels:24_000_000});const pathname=`certificate-templates/${activityId}/${randomUUID()}${validated.extension}`;await putPrivateBlob(pathname,validated.buffer,validated.mime);return{pathname,originalName:validated.originalName,mime:validated.mime,size:validated.size,width:validated.width!,height:validated.height!}}
