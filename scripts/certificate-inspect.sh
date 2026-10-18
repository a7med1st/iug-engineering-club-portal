#!/usr/bin/env bash
set -euo pipefail
cd /var/www/main/current
echo CERTIFICATE_DIAGNOSTICS
git rev-parse HEAD
node --env-file=.env --import tsx --input-type=module <<'JS'
import { PrismaClient } from '@prisma/client';
const db = new PrismaClient();
try {
  const activities = await db.activity.findMany({where:{title:{contains:'Git',mode:'insensitive'},deletedAt:null},select:{id:true,title:true,certificateTemplate:{select:{sourceWidth:true,sourceHeight:true,nameX:true,nameY:true,nameFontSize:true}},certificateTemplateEnglish:{select:{sourceWidth:true,sourceHeight:true,nameX:true,nameY:true,nameFontSize:true}},registrationForm:{select:{id:true,questions:{select:{id:true,label:true,type:true}},submissions:{select:{status:true,checkedInAt:true,answers:{select:{questionId:true,value:true}}}}}}}});
  for(const activity of activities){const form=activity.registrationForm;console.log(JSON.stringify({id:activity.id,title:activity.title,arabic:activity.certificateTemplate,english:activity.certificateTemplateEnglish,submissions:form?.submissions.length,questions:form?.questions.map(q=>({id:q.id,label:q.label,type:q.type,answered:form.submissions.filter(s=>s.answers.some(a=>a.questionId===q.id&&typeof a.value==='string'&&a.value.trim())).length,latinAnswers:form.submissions.filter(s=>s.answers.some(a=>a.questionId===q.id&&typeof a.value==='string'&&/[A-Za-z]/.test(a.value)&&!/[\u0600-\u06ff]/.test(a.value))).length}))}));}
}finally{await db.$disconnect()}
JS
journalctl -u iug-main.service --since '3 hours ago' --no-pager 2>/dev/null | grep -E 'CertificateGenerationError|Certificate bulk issuance failed|TEMPLATE_FILE_MISSING|CERTIFICATE_NAME_NOT_VISIBLE|error:|Error:' | tail -n 35 || true
