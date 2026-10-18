#!/usr/bin/env bash
set -euo pipefail
cd /var/www/main/current
for attempt in {1..18}; do
  if [[ "$(git -C /var/www/main/current rev-parse HEAD)" == '73c88c4fe196fa19912385a9cd0ca074e4fdc9c2' ]]; then break; fi
  sleep 10
done
cd /var/www/main/current
echo CERTIFICATE_DIAGNOSTICS
git rev-parse HEAD
node --env-file=.env --import tsx --input-type=module <<'JS'
import { createRequire } from 'node:module';
const require=createRequire(process.cwd()+'/certificate-readonly-check.cjs');
const {PrismaClient}=require('@prisma/client');
const {certificateNamesFromAnswers,certificateNameError}=require('./lib/certificate-names.ts');
const {getAttendanceProgress}=require('./lib/activity-attendance.ts');
const {parseTemplateSettings}=require('./lib/certificate-template-settings.ts');
const {renderCertificate}=require('./lib/certificate-renderer.ts');
const db=new PrismaClient();
try{
 const activity=await db.activity.findUniqueOrThrow({where:{id:'cmuylvgqt00278lfl61nnjpvw'},include:{certificateTemplate:true,certificateTemplateEnglish:true,sessions:{select:{id:true}},registrationForm:{include:{submissions:{include:{answers:{include:{question:{select:{label:true}}}},sessionAttendances:{select:{sessionId:true}}}}}}});
 const eligible=activity.registrationForm.submissions.filter(row=>getAttendanceProgress({...row,form:{activity}}).eligible);
 const resolved=eligible.map(row=>({row,names:certificateNamesFromAnswers(row.answers,row.studentName)}));
 const valid=resolved.filter(item=>!certificateNameError('en',item.names.en));
 console.log(JSON.stringify({activity:activity.title,eligible:eligible.length,englishNamesResolved:valid.length,englishNamesInvalid:resolved.length-valid.length,templates:{ar:!!activity.certificateTemplate,en:!!activity.certificateTemplateEnglish}}));
 const template=activity.certificateTemplateEnglish;
 if(template&&valid.length){
  const data=new FormData();for(const[key,value]of Object.entries(template))if(value!==null)data.set(key,typeof value==='boolean'?(value?'on':''):String(value));data.set('templateWidth',String(template.sourceWidth));data.set('templateHeight',String(template.sourceHeight));const parsed=parseTemplateSettings(data);if(!parsed.ok)throw Error(parsed.message);
  const example=valid.sort((a,b)=>b.names.en.length-a.names.en.length)[0];
  const rendered=await renderCertificate({sourcePathname:template.sourcePathname,width:template.sourceWidth,height:template.sourceHeight,settings:parsed.value,studentName:example.names.en,activityTitle:activity.title,activityDate:activity.startsAt,qrSettings:template.qrSettings,verificationUrl:'https://example.com/certificates/verify/EC-DIAGNOSTIC',language:'en'});
  console.log(JSON.stringify({readOnlyRender:'success',mime:rendered.mime,width:rendered.width,height:rendered.height,bytes:rendered.size}));
 }
}finally{await db.$disconnect()}
JS
