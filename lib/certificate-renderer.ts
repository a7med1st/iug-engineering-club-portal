import { createHash } from "node:crypto";
import path from "node:path";
import { Resvg } from "@resvg/resvg-js";
import sharp from "sharp";
import { getPrivateBlob } from "@/lib/blob-storage";
import { certificateTextRuns, escapeSvgText, type CertificateFontFamily, type CertificateTemplateSettings, type TextAlign } from "@/lib/certificate-template-settings";

type RenderInput={width:number;height:number;settings:CertificateTemplateSettings;studentName:string;activityTitle:string;activityDate:Date|null};
const fontFiles:Record<CertificateFontFamily,string>={Cairo:"cairo.ttf",Tajawal:"tajawal.ttf","Noto Kufi Arabic":"noto-kufi-arabic.ttf","IBM Plex Sans Arabic":"ibm-plex-sans-arabic.ttf",Amiri:"amiri.ttf",Alexandria:"alexandria.ttf","Thmanyah Sans":"thmanyah-sans.otf",Inter:"inter.ttf"};
const certificateFontPaths = Object.values(fontFiles).map((file) =>
  path.join(process.cwd(), "public", "fonts", "certificates", file),
);
const anchor=(align:TextAlign)=>align==="left"?"start":align==="right"?"end":"middle";
const resvgOptions={font:{fontFiles:certificateFontPaths,loadSystemFonts:false,defaultFontFamily:"Inter",sansSerifFamily:"Inter"}};

export function certificateTemplateFingerprint(value:unknown){return createHash("sha256").update(JSON.stringify(value)).digest("hex")}

export async function buildCertificateOverlay(input:RenderInput){
  const{width,height,settings}=input;
  const text=(value:string,x:number,y:number,size:number,color:string,align:TextAlign,font:CertificateFontFamily,englishFont:CertificateFontFamily,bold:boolean)=>{const runs=certificateTextRuns(value,font,englishFont);return `<text x="${x}" y="${y}" text-anchor="${anchor(align)}" font-family="${runs[0]?.font??font}" font-size="${size}px" font-weight="${bold?700:400}" fill="${color}"${bold?` stroke="${color}" stroke-width="${Math.max(.5,size*.025)}" stroke-linejoin="round" paint-order="stroke fill"`:""} direction="rtl" unicode-bidi="plaintext">${runs.length===1?escapeSvgText(value):runs.map(run=>`<tspan font-family="${run.font}">${escapeSvgText(run.text)}</tspan>`).join("")}</text>`;}
  const date=input.activityDate?new Intl.DateTimeFormat("ar-PS",{dateStyle:"long"}).format(input.activityDate):"";
  return`<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">${text(input.studentName,settings.nameX,settings.nameY,settings.nameFontSize,settings.nameColor,settings.nameAlign,settings.nameFontFamily,settings.nameEnglishFontFamily,settings.nameBold)}${settings.titleVisible?text(input.activityTitle,settings.titleX,settings.titleY,settings.titleFontSize,settings.titleColor,settings.titleAlign,settings.titleFontFamily,settings.titleEnglishFontFamily,settings.titleBold):""}${settings.dateVisible?text(date,settings.dateX,settings.dateY,settings.dateFontSize,settings.dateColor,settings.dateAlign,settings.dateFontFamily,settings.dateEnglishFontFamily,settings.dateBold):""}</svg>`;
}

async function nameBounds(input:RenderInput){
  const overlay=await buildCertificateOverlay({...input,settings:{...input.settings,titleVisible:false,dateVisible:false}});
  const png=new Resvg(overlay,resvgOptions).render().asPng();
  const {data,info}=await sharp(png).extractChannel(3).raw().toBuffer({resolveWithObject:true});
  let left=info.width,right=-1,top=info.height,bottom=-1;
  for(let y=0;y<info.height;y++)for(let x=0;x<info.width;x++)if(data[y*info.width+x]){
    left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);
  }
  return right<0?null:{left,right,top,bottom};
}

export async function fitCertificateName(input:RenderInput){
  const margin=Math.min(8,Math.floor(Math.min(input.width,input.height)*.015));
  let settings=input.settings;
  for(let attempt=0;attempt<16;attempt++){
    const bounds=await nameBounds({...input,settings});
    if(bounds && bounds.left>margin && bounds.right<input.width-1-margin && bounds.top>margin && bounds.bottom<input.height-1-margin)return settings;
    if(!bounds && attempt===0 && settings.nameFontFamily!=="Cairo"){
      settings={...settings,nameFontFamily:"Cairo"};
      continue;
    }
    settings={...settings,nameFontSize:settings.nameFontSize*.85};
  }
  throw new Error(`CERTIFICATE_NAME_NOT_VISIBLE:${settings.nameFontFamily}`);
}

export async function composeCertificate(source:Buffer,input:RenderInput){
  const settings=await fitCertificateName(input);
  const overlay=await buildCertificateOverlay({...input,settings});
  const textLayer = new Resvg(overlay,resvgOptions).render().asPng();
  const buffer=await sharp(source).resize(input.width,input.height,{fit:"fill"}).composite([{input:Buffer.from(textLayer)}]).png().toBuffer();
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
