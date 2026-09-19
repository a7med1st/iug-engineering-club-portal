import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { getPrivateBlob } from "@/lib/blob-storage";
import { escapeSvgText, type CertificateFontFamily, type CertificateTemplateSettings, type TextAlign } from "@/lib/certificate-template-settings";

type RenderInput={width:number;height:number;settings:CertificateTemplateSettings;studentName:string;activityTitle:string;activityDate:Date|null};
const fontFiles:Record<CertificateFontFamily,string>={Cairo:"cairo.woff2",Tajawal:"tajawal.woff2","Noto Kufi Arabic":"noto-kufi-arabic.woff2","IBM Plex Sans Arabic":"ibm-plex-sans-arabic.woff2",Amiri:"amiri.woff2",Inter:"inter.woff2"};
let fontCssPromise:Promise<string>|undefined;
const anchor=(align:TextAlign)=>align==="left"?"start":align==="right"?"end":"middle";

async function embeddedFontCss(){
  fontCssPromise??=Promise.all(Object.entries(fontFiles).map(async([family,file])=>{const buffer=await readFile(path.join(process.cwd(),"public","fonts","certificates",file));return`@font-face{font-family:'${family}';src:url(data:font/woff2;base64,${buffer.toString("base64")}) format('woff2');font-weight:400;font-style:normal}`})).then(rows=>rows.join(""));
  return fontCssPromise;
}

export function certificateTemplateFingerprint(value:unknown){return createHash("sha256").update(JSON.stringify(value)).digest("hex")}

export async function buildCertificateOverlay(input:RenderInput){
  const{width,height,settings}=input;
  const text=(value:string,x:number,y:number,size:number,color:string,align:TextAlign,font:CertificateFontFamily)=>`<text x="${x}" y="${y}" text-anchor="${anchor(align)}" font-family="${font}" font-size="${size}px" font-weight="400" fill="${color}" direction="rtl" unicode-bidi="plaintext">${escapeSvgText(value)}</text>`;
  const date=input.activityDate?new Intl.DateTimeFormat("ar-PS",{dateStyle:"long"}).format(input.activityDate):"";
  return`<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg"><style>${await embeddedFontCss()}</style>${text(input.studentName,settings.nameX,settings.nameY,settings.nameFontSize,settings.nameColor,settings.nameAlign,settings.nameFontFamily)}${settings.titleVisible?text(input.activityTitle,settings.titleX,settings.titleY,settings.titleFontSize,settings.titleColor,settings.titleAlign,settings.titleFontFamily):""}${settings.dateVisible?text(date,settings.dateX,settings.dateY,settings.dateFontSize,settings.dateColor,settings.dateAlign,settings.dateFontFamily):""}</svg>`;
}

export async function composeCertificate(source:Buffer,input:RenderInput){
  const overlay=await buildCertificateOverlay(input);
  const buffer=await sharp(source).resize(input.width,input.height,{fit:"fill"}).composite([{input:Buffer.from(overlay)}]).png().toBuffer();
  const metadata=await sharp(buffer).metadata();
  if(metadata.width!==input.width||metadata.height!==input.height||(metadata.pages??1)!==1)throw new Error("CERTIFICATE_DIMENSION_MISMATCH");
  return buffer;
}

export async function renderCertificate(input:{sourcePathname:string}&RenderInput){
  const stored=await getPrivateBlob(input.sourcePathname);if(!stored?.stream)throw new Error("TEMPLATE_FILE_MISSING");
  const source=Buffer.from(await new Response(stored.stream).arrayBuffer());
  const buffer=await composeCertificate(source,input);
  return{buffer,mime:"image/png",size:buffer.length,width:input.width,height:input.height,fingerprint:certificateTemplateFingerprint({source:input.sourcePathname,settings:input.settings})};
}
