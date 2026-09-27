import assert from "node:assert/strict";
import sharp from "sharp";
import { composeCertificate } from "../lib/certificate-renderer";
import { CERTIFICATE_FONTS, type CertificateTemplateSettings } from "../lib/certificate-template-settings";

async function main(){
  const width=1200,height=850;
  const source=await sharp({create:{width,height,channels:4,background:"white"}}).png().toBuffer();
  const settings:CertificateTemplateSettings={nameX:600,nameY:425,nameFontSize:48,nameFontFamily:"Cairo",nameEnglishFontFamily:"Cairo",nameBold:false,nameColor:"#111827",nameAlign:"center",titleVisible:true,titleX:600,titleY:550,titleFontSize:32,titleFontFamily:"Tajawal",titleEnglishFontFamily:"Tajawal",titleBold:false,titleColor:"#111827",titleAlign:"center",dateVisible:true,dateX:600,dateY:640,dateFontSize:24,dateFontFamily:"Amiri",dateEnglishFontFamily:"Amiri",dateBold:false,dateColor:"#111827",dateAlign:"center"};
  const rendered=await composeCertificate(source,{width,height,settings,studentName:"طالب المعاينة",activityTitle:"نشاط المعاينة",activityDate:new Date("2026-09-19T00:00:00Z")});
  const metadata=await sharp(rendered).metadata();
  assert.equal(metadata.format,"png");
  assert.deepEqual([metadata.width,metadata.height],[width,height]);
  assert.equal(metadata.pages??1,1);
  const mixedInput={width,height,studentName:"أحمد Ali",activityTitle:"",activityDate:null};
  const regular=await composeCertificate(source,{...mixedInput,settings:{...settings,titleVisible:false,dateVisible:false}});
  const bold=await composeCertificate(source,{...mixedInput,settings:{...settings,nameBold:true,titleVisible:false,dateVisible:false}});
  assert.notDeepEqual(bold,regular,"Bold must change the rendered certificate");
  const englishFont=await composeCertificate(source,{...mixedInput,studentName:"Ali",settings:{...settings,nameEnglishFontFamily:"Thmanyah Sans",titleVisible:false,dateVisible:false}});
  const englishOriginal=await composeCertificate(source,{...mixedInput,studentName:"Ali",settings:{...settings,titleVisible:false,dateVisible:false}});
  assert.notDeepEqual(englishFont,englishOriginal,"The English font choice must change the rendered certificate");
  const mixedEnglishFont=await composeCertificate(source,{...mixedInput,settings:{...settings,nameEnglishFontFamily:"Thmanyah Sans",titleVisible:false,dateVisible:false}});
  assert.notDeepEqual(mixedEnglishFont,regular,"The English font choice must work within mixed-language names");
  const fontImages = await Promise.all(CERTIFICATE_FONTS.map((fontFamily) =>
    composeCertificate(source, {
      width, height,
      settings: { ...settings, nameFontFamily: fontFamily },
      studentName: "طالب المعاينة",
      activityTitle: "نشاط المعاينة",
      activityDate: new Date("2026-09-19T00:00:00Z"),
    }),
  ));
  assert.equal(fontImages.length, CERTIFICATE_FONTS.length);
  for (const image of fontImages) {
    const imageMetadata = await sharp(image).metadata();
    assert.deepEqual([imageMetadata.width, imageMetadata.height], [width, height]);
  }
  for (const fontFamily of ["Alexandria", "Thmanyah Sans"] as const) {
    const fontSettings = { ...settings, nameFontFamily: fontFamily, titleVisible: false, dateVisible: false };
    const englishI = await composeCertificate(source, {
      width, height, settings: fontSettings, studentName: "IIII IIII", activityTitle: "", activityDate: null,
    });
    const englishW = await composeCertificate(source, {
      width, height, settings: fontSettings, studentName: "WWWW WWWW", activityTitle: "", activityDate: null,
    });
    assert.notDeepEqual(englishI, englishW, `${fontFamily} must render English letters, not identical missing-glyph boxes`);
  }
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
