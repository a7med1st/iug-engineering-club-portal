import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { QRCodeSVG } from "qrcode.react";
import { certificateQrSettings, parseCertificateQr } from "../lib/certificate-qr";

assert.deepEqual(certificateQrSettings({visible:true,x:1190,y:840,size:160},1200,850), {visible:true,x:1040,y:690,size:160});
assert.equal(certificateQrSettings(null,1200,850).visible,false);
const data = new FormData();
for (const [key,value] of Object.entries({qrX:"30",qrY:"40",qrSize:"160",qrVisible:"on"})) data.set(key,value);
assert.deepEqual(parseCertificateQr(data,1200,850),{visible:true,x:30,y:40,size:160});
data.set("qrX","1100");
assert.throws(()=>parseCertificateQr(data,1200,850));
const svg = renderToStaticMarkup(createElement(QRCodeSVG,{value:"https://example.com/certificates/verify/EC-TEST",size:160,marginSize:4,level:"M"}));
assert.match(svg, /<path/);
assert.match(svg, /width="160"/);
console.log("Certificate QR settings and SVG generation passed");
