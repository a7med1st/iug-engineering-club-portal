export type TextAlign = "left" | "center" | "right";
export const CERTIFICATE_FONTS = ["Cairo", "Tajawal", "IBM Plex Sans Arabic", "Amiri", "Alexandria"] as const;
export const CERTIFICATE_ENGLISH_FONTS = ["Alexandria", "Thmanyah Sans", "Inter"] as const;
export type CertificateFontFamily = (typeof CERTIFICATE_FONTS)[number] | (typeof CERTIFICATE_ENGLISH_FONTS)[number];
export type CertificateTemplateSettings = { nameX:number;nameY:number;nameFontSize:number;nameFontFamily:CertificateFontFamily;nameEnglishFontFamily:CertificateFontFamily;nameBold:boolean;nameColor:string;nameAlign:TextAlign;titleVisible:boolean;titleX:number;titleY:number;titleFontSize:number;titleFontFamily:CertificateFontFamily;titleEnglishFontFamily:CertificateFontFamily;titleBold:boolean;titleColor:string;titleAlign:TextAlign;dateVisible:boolean;dateX:number;dateY:number;dateFontSize:number;dateFontFamily:CertificateFontFamily;dateEnglishFontFamily:CertificateFontFamily;dateBold:boolean;dateColor:string;dateAlign:TextAlign };
const color=/^#[0-9a-fA-F]{6}$/;const aligns=new Set(["left","center","right"]);const fonts=new Set<string>(CERTIFICATE_FONTS);
export function escapeSvgText(value:string){return value.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&apos;")}
const arabicCharacter=/[\u0600-\u06ff\u0750-\u077f\u08a0-\u08ff\ufb50-\ufdff\ufe70-\ufeff]/u;
export function certificateTextRuns(value:string,arabicFont:CertificateFontFamily,englishFont:CertificateFontFamily){
  return Array.from(value).reduce<{font:CertificateFontFamily;text:string}[]>((runs,char)=>{
    const font=arabicCharacter.test(char)?(CERTIFICATE_FONTS.includes(arabicFont as (typeof CERTIFICATE_FONTS)[number])?arabicFont:"Cairo"):englishFont;
    const last=runs.at(-1);
    if(last?.font===font)last.text+=char;
    else runs.push({font,text:char});
    return runs;
  },[]);
}
export function parseTemplateSettings(data:FormData):{ok:true;value:CertificateTemplateSettings}|{ok:false;message:string}{
  const dimension=(key:string)=>{const value=Number(data.get(key));return Number.isFinite(value)&&value>0&&value<=8000?value:null};const width=dimension("templateWidth"),height=dimension("templateHeight");if(!width||!height)return{ok:false,message:"أبعاد قالب الشهادة غير صالحة."};
  const number=(key:string,min:number,max:number)=>{const raw=String(data.get(key)??"");if(!/^\d+(\.\d+)?$/.test(raw))return null;const value=Number(raw);return value>=min&&value<=max?value:null};
  const required=[["nameX",0,width],["nameY",0,height],["nameFontSize",1,512],["titleX",0,width],["titleY",0,height],["titleFontSize",1,512],["dateX",0,width],["dateY",0,height],["dateFontSize",1,512]] as const;const values:Record<string,number>={};for(const[key,min,max]of required){const value=number(key,min,max);if(value===null)return{ok:false,message:`قيمة ${key} غير صالحة.`};values[key]=value}
  const nameColor=String(data.get("nameColor")??""),titleColor=String(data.get("titleColor")??""),dateColor=String(data.get("dateColor")??"");if(!color.test(nameColor)||!color.test(titleColor)||!color.test(dateColor))return{ok:false,message:"لون النص غير صالح."};
  const nameAlign=String(data.get("nameAlign")),titleAlign=String(data.get("titleAlign")),dateAlign=String(data.get("dateAlign"));if(!aligns.has(nameAlign)||!aligns.has(titleAlign)||!aligns.has(dateAlign))return{ok:false,message:"محاذاة النص غير صالحة."};
  const nameFontFamily=String(data.get("nameFontFamily")),titleFontFamily=String(data.get("titleFontFamily")),dateFontFamily=String(data.get("dateFontFamily"));if(!fonts.has(nameFontFamily)||!fonts.has(titleFontFamily)||!fonts.has(dateFontFamily))return{ok:false,message:"نوع الخط غير صالح."};
  const englishFonts=["name","title","date"].map(field=>String(data.get(`${field}EnglishFontFamily`)??"Alexandria"));
  if(englishFonts.some(font=>!CERTIFICATE_ENGLISH_FONTS.includes(font as (typeof CERTIFICATE_ENGLISH_FONTS)[number])))return{ok:false,message:"نوع الخط الإنجليزي غير صالح."};
  return{ok:true,value:{...values,nameColor,titleColor,dateColor,nameFontFamily:nameFontFamily as CertificateFontFamily,titleFontFamily:titleFontFamily as CertificateFontFamily,dateFontFamily:dateFontFamily as CertificateFontFamily,nameEnglishFontFamily:englishFonts[0] as CertificateFontFamily,titleEnglishFontFamily:englishFonts[1] as CertificateFontFamily,dateEnglishFontFamily:englishFonts[2] as CertificateFontFamily,nameBold:data.get("nameBold")==="on",titleBold:data.get("titleBold")==="on",dateBold:data.get("dateBold")==="on",nameAlign:nameAlign as TextAlign,titleAlign:titleAlign as TextAlign,dateAlign:dateAlign as TextAlign,titleVisible:data.get("titleVisible")==="on",dateVisible:data.get("dateVisible")==="on"} as CertificateTemplateSettings};
}
