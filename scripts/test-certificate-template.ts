import assert from "node:assert/strict";
import { certificateTextRuns, escapeSvgText, parseTemplateSettings } from "../lib/certificate-template-settings";
import { buildCertificateOverlay, composeCertificate } from "../lib/certificate-renderer";
import sharp from "sharp";
async function main() {
const valid = new FormData();
for (const [key,value] of Object.entries({nameX:"320",nameY:"210",nameFontSize:"42",nameFontFamily:"Cairo",nameColor:"#112233",nameAlign:"center",titleX:"320",titleY:"280",titleFontSize:"28",titleFontFamily:"Tajawal",titleColor:"#112233",titleAlign:"center",dateX:"320",dateY:"340",dateFontSize:"20",dateFontFamily:"Amiri",dateColor:"#112233",dateAlign:"center",templateWidth:"1200",templateHeight:"850"})) valid.set(key,value);
assert.equal(parseTemplateSettings(valid).ok, true);
valid.set("nameX","1201"); assert.equal(parseTemplateSettings(valid).ok, false);
valid.set("nameX","320"); valid.set("nameColor","red"); assert.equal(parseTemplateSettings(valid).ok, false);
valid.set("nameColor","#112233"); valid.set("nameFontFamily","Comic Sans MS"); assert.equal(parseTemplateSettings(valid).ok, false);
valid.set("nameFontFamily","Noto Kufi Arabic"); assert.equal(parseTemplateSettings(valid).ok, false);
valid.set("nameFontFamily","Cairo");
valid.set("nameEnglishFontFamily","Alexandria");
valid.set("nameBold","on");
assert.deepEqual(certificateTextRuns("أحمد Ali", "Cairo", "Alexandria"), [{font:"Cairo",text:"أحمد"},{font:"Alexandria",text:" Ali"}]);
valid.set("nameEnglishFontFamily","Comic Sans MS"); assert.equal(parseTemplateSettings(valid).ok, false);
valid.set("nameEnglishFontFamily","Alexandria");
assert.equal(escapeSvgText(`أحمد & <Ali> "test"`), "أحمد &amp; &lt;Ali&gt; &quot;test&quot;");
const parsed = parseTemplateSettings(valid);
assert.equal(parsed.ok, true);
if (parsed.ok) {
  const svg = await buildCertificateOverlay({ width: 1200, height: 850, settings: parsed.value, studentName: "أحمد Ali", activityTitle: "ورشة", activityDate: new Date("2026-09-19T00:00:00Z") });
  assert.match(svg, /x="320" y="210"/);
  assert.match(svg, /font-size="42px"/);
  assert.match(svg, /font-family="Cairo"/);
  assert.match(svg, /font-weight="700"/);
  assert.match(svg, /font-family="Alexandria"/);
  assert.doesNotMatch(svg, /320\/100|210\/100/);
  const png = await sharp({ create: { width: 1200, height: 850, channels: 4, background: "white" } }).composite([{ input: Buffer.from(svg) }]).png().toBuffer();
  const metadata = await sharp(png).metadata();
  assert.deepEqual([metadata.width, metadata.height], [1200, 850]);
}
valid.set("nameFontFamily", "Thmanyah Sans");
assert.equal(parseTemplateSettings(valid).ok, true, "Thmanyah must be accepted for Arabic text");
valid.set("nameFontFamily", "Cairo");
valid.set("nameEnglishFontFamily", "Thmanyah Sans");
assert.equal(parseTemplateSettings(valid).ok, true, "Thmanyah must remain available for English text");
for (const fontFamily of ["Alexandria"] as const) {
  valid.set("nameFontFamily", fontFamily);
  const fontParsed = parseTemplateSettings(valid);
  assert.equal(fontParsed.ok, true, `${fontFamily} must be accepted for certificate text`);
  if (fontParsed.ok) {
    const svg = await buildCertificateOverlay({ width: 1200, height: 850, settings: fontParsed.value, studentName: "أحمد Engineering", activityTitle: "ورشة", activityDate: new Date("2026-09-19T00:00:00Z") });
    assert.match(svg, new RegExp(`font-family="${fontFamily}"`));
  }
}
const englishSettings = parseTemplateSettings(valid);
assert.ok(englishSettings.ok);
if (englishSettings.ok) {
  const englishSvg = await buildCertificateOverlay({ width: 1200, height: 850, settings: { ...englishSettings.value, dateVisible: true }, studentName: "Ahmad Mohammed", activityTitle: "Engineering Workshop", activityDate: new Date("2026-09-19T00:00:00Z"), language: "en" });
  assert.match(englishSvg, /direction="ltr"/);
  assert.match(englishSvg, /September/);
}
valid.set("nameEnglishFontFamily", "Wister Lilya");
const wisterSettings = parseTemplateSettings(valid);
assert.ok(wisterSettings.ok);
if (wisterSettings.ok) {
  const input = { width: 1200, height: 850, settings: { ...wisterSettings.value, nameX: 600, nameY: 425, nameFontSize: 72, nameBold: false, titleVisible: false, dateVisible: false }, studentName: "Ahmad Mohammed", activityTitle: "", activityDate: null, language: "en" as const };
  const background = await sharp({ create: { width: 1200, height: 850, channels: 3, background: "white" } }).png().toBuffer();
  const wister = await composeCertificate(background, input);
  const inter = await composeCertificate(background, { ...input, settings: { ...input.settings, nameEnglishFontFamily: "Inter" } });
  assert.notDeepEqual(wister, inter, "Wister Lilya must render using the bundled font rather than a fallback");
  const metadata = await sharp(wister).metadata();
  assert.deepEqual([metadata.width, metadata.height], [1200, 850]);
  assert.deepEqual(certificateTextRuns("أحمد Ahmad", "Cairo", "Wister Lilya"), [{ font: "Cairo", text: "أحمد" }, { font: "Wister Lilya", text: " Ahmad" }]);
}
console.log("certificate template settings tests passed");
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
