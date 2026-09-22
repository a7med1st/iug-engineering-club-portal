import assert from "node:assert/strict";
import sharp from "sharp";
import { composeCertificate } from "../lib/certificate-renderer";
import { CERTIFICATE_FONTS, type CertificateTemplateSettings } from "../lib/certificate-template-settings";

async function main(){
  const width=1200,height=850;
  const source=await sharp({create:{width,height,channels:4,background:"white"}}).png().toBuffer();
  const settings:CertificateTemplateSettings={nameX:600,nameY:425,nameFontSize:48,nameFontFamily:"Cairo",nameColor:"#111827",nameAlign:"center",titleVisible:true,titleX:600,titleY:550,titleFontSize:32,titleFontFamily:"Tajawal",titleColor:"#111827",titleAlign:"center",dateVisible:true,dateX:600,dateY:640,dateFontSize:24,dateFontFamily:"Amiri",dateColor:"#111827",dateAlign:"center"};
  const rendered=await composeCertificate(source,{width,height,settings,studentName:"طالب المعاينة",activityTitle:"نشاط المعاينة",activityDate:new Date("2026-09-19T00:00:00Z")});
  const metadata=await sharp(rendered).metadata();
  assert.equal(metadata.format,"png");
  assert.deepEqual([metadata.width,metadata.height],[width,height]);
  assert.equal(metadata.pages??1,1);
  const fontImages = await Promise.all(CERTIFICATE_FONTS.map((fontFamily) =>
    composeCertificate(source, {
      width, height,
      settings: { ...settings, nameFontFamily: fontFamily },
      studentName: "طالب المعاينة",
      activityTitle: "نشاط المعاينة",
      activityDate: new Date("2026-09-19T00:00:00Z"),
    }),
  ));
  assert.equal(new Set(fontImages.map((image) => image.toString("base64"))).size, CERTIFICATE_FONTS.length,
    "Every Arabic font must produce a distinct certificate image");
  const englishSettings = { ...settings, nameFontFamily: "Amiri" as const, titleVisible: false, dateVisible: false };
  const englishI = await composeCertificate(source, {
    width, height, settings: englishSettings, studentName: "IIII IIII", activityTitle: "", activityDate: null,
  });
  const englishW = await composeCertificate(source, {
    width, height, settings: englishSettings, studentName: "WWWW WWWW", activityTitle: "", activityDate: null,
  });
  assert.notDeepEqual(englishI, englishW, "English names must render as letters, not identical missing-glyph boxes");
  console.log(`certificate rendering test passed: one ${metadata.width}x${metadata.height} PNG`);
}
main().catch(error=>{console.error(error);process.exitCode=1});
