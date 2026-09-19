import assert from "node:assert/strict";
import { escapeSvgText, parseTemplateSettings } from "../lib/certificate-template-settings";
import { buildCertificateOverlay } from "../lib/certificate-renderer";
import sharp from "sharp";
async function main() {
const valid = new FormData();
for (const [key,value] of Object.entries({nameX:"320",nameY:"210",nameFontSize:"42",nameFontFamily:"Cairo",nameColor:"#112233",nameAlign:"center",titleX:"320",titleY:"280",titleFontSize:"28",titleFontFamily:"Tajawal",titleColor:"#112233",titleAlign:"center",dateX:"320",dateY:"340",dateFontSize:"20",dateFontFamily:"Amiri",dateColor:"#112233",dateAlign:"center",templateWidth:"1200",templateHeight:"850"})) valid.set(key,value);
assert.equal(parseTemplateSettings(valid).ok, true);
valid.set("nameX","1201"); assert.equal(parseTemplateSettings(valid).ok, false);
valid.set("nameX","320"); valid.set("nameColor","red"); assert.equal(parseTemplateSettings(valid).ok, false);
valid.set("nameColor","#112233"); valid.set("nameFontFamily","Comic Sans MS"); assert.equal(parseTemplateSettings(valid).ok, false);
valid.set("nameFontFamily","Cairo");
assert.equal(escapeSvgText(`أحمد & <Ali> "test"`), "أحمد &amp; &lt;Ali&gt; &quot;test&quot;");
const parsed = parseTemplateSettings(valid);
assert.equal(parsed.ok, true);
if (parsed.ok) {
  const svg = await buildCertificateOverlay({ width: 1200, height: 850, settings: parsed.value, studentName: "أحمد", activityTitle: "ورشة", activityDate: new Date("2026-09-19T00:00:00Z") });
  assert.match(svg, /x="320" y="210"/);
  assert.match(svg, /font-size="42px"/);
  assert.match(svg, /font-family="Cairo"/);
  assert.doesNotMatch(svg, /320\/100|210\/100/);
  const png = await sharp({ create: { width: 1200, height: 850, channels: 4, background: "white" } }).composite([{ input: Buffer.from(svg) }]).png().toBuffer();
  const metadata = await sharp(png).metadata();
  assert.deepEqual([metadata.width, metadata.height], [1200, 850]);
}
console.log("certificate template settings tests passed");
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
