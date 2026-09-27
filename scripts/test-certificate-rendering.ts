import assert from "node:assert/strict";
import sharp from "sharp";
import { composeCertificate, fitCertificateName } from "../lib/certificate-renderer";
import { CERTIFICATE_FONTS, type CertificateFontFamily, type CertificateTemplateSettings } from "../lib/certificate-template-settings";

async function main(){
  const width=1200,height=850;
  const source=await sharp({create:{width,height,channels:4,background:"white"}}).png().toBuffer();
  const settings:CertificateTemplateSettings={nameX:600,nameY:425,nameFontSize:48,nameFontFamily:"Cairo",nameEnglishFontFamily:"Cairo",nameBold:false,nameColor:"#111827",nameAlign:"center",titleVisible:true,titleX:600,titleY:550,titleFontSize:32,titleFontFamily:"Tajawal",titleEnglishFontFamily:"Tajawal",titleBold:false,titleColor:"#111827",titleAlign:"center",dateVisible:true,dateX:600,dateY:640,dateFontSize:24,dateFontFamily:"Amiri",dateEnglishFontFamily:"Amiri",dateBold:false,dateColor:"#111827",dateAlign:"center"};
  const rendered=await composeCertificate(source,{width,height,settings,studentName:"طالب المعاينة",activityTitle:"نشاط المعاينة",activityDate:new Date("2026-09-19T00:00:00Z")});
  const metadata=await sharp(rendered).metadata();
  assert.equal(metadata.format,"png");
  assert.deepEqual([metadata.width,metadata.height],[width,height]);
  assert.equal(metadata.pages??1,1);
  const compactSettings={...settings,nameX:265.5,nameY:188,nameFontSize:32,titleVisible:false,dateVisible:false};
  const compactInput={width:531,height:376,settings:compactSettings,studentName:"آية عبد الرحمن محمد عبد الكريم أحمد فاطمة بنت عبد العزيز",activityTitle:"",activityDate:null};
  const fitted=await fitCertificateName(compactInput);
  assert.ok(fitted.nameFontSize<compactSettings.nameFontSize,"Long names must fit inside a compact certificate");
  const edgeName=await fitCertificateName({...compactInput,studentName:"آية محمد",settings:{...compactSettings,nameX:2,nameY:5}});
  assert.ok(edgeName.nameX>2 && edgeName.nameY>5,"Names near the template edge must be moved into view");
  const missingFont=await fitCertificateName({...compactInput,studentName:"آية محمد",settings:{...compactSettings,nameFontFamily:"Noto Kufi Arabic" as CertificateFontFamily}});
  assert.equal(missingFont.nameFontFamily,"Cairo","A blank font must fall back to a visible Arabic font");
  const compactSource=await sharp({create:{width:531,height:376,channels:4,background:"white"}}).png().toBuffer();
  const compactRendered=await composeCertificate(compactSource,compactInput);
  assert.ok((await sharp(compactRendered).stats()).channels[0].min<255,"The fitted name must appear on the certificate");
  await assert.rejects(fitCertificateName({...compactInput,studentName:""}),/CERTIFICATE_NAME_NOT_VISIBLE/);
  await assert.rejects(fitCertificateName({...compactInput,studentName:"\u200f\u200d\ufeff"}),/CERTIFICATE_NAME_NOT_VISIBLE:no_visible_characters/);
  const invisibleControls=await composeCertificate(compactSource,{...compactInput,studentName:"\u200fAli\u200d"});
  const plainName=await composeCertificate(compactSource,{...compactInput,studentName:"Ali"});
  assert.deepEqual(invisibleControls,plainName,"Invisible controls must not alter certificate names");
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
      settings: { ...settings, nameFontFamily: fontFamily, titleVisible: false, dateVisible: false },
      studentName: "طالب المعاينة",
      activityTitle: "",
      activityDate: null,
    }),
  ));
  assert.equal(fontImages.length, CERTIFICATE_FONTS.length);
  for (const image of fontImages) {
    const imageMetadata = await sharp(image).metadata();
    assert.deepEqual([imageMetadata.width, imageMetadata.height], [width, height]);
    const stats=await sharp(image).stats();
    assert.ok(stats.channels[0].min<255,"Every font choice must produce visible text");
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
