#!/usr/bin/env bash
set -eu
echo 'DATABASE_LOCATION backup inspection'
echo 'BACKUP_ACCESS'
id
ls -ld /var/backups/iug-main-2026-10-03 /var/lib/postgresql/16 /var/lib/postgresql/16/main /home/ubuntu /home/opc 2>/dev/null || true
find /var/backups/iug-main-2026-10-03 -maxdepth 3 -type f -printf '%M %u %g %s %TY-%Tm-%Td %TH:%TM %p\n' 2>/dev/null | head -50 || true
echo 'READABLE_APPLICATION_BACKUPS'
find /var/www/main /var/backups /home/iugdeploy -maxdepth 5 \( -path '*/node_modules' -o -path '*/.git' -o -path '*/prisma/migrations' -o -path '*/.next' \) -prune -o -type f \( -iname '*.dump*' -o -iname '*.backup*' -o -iname '*.sql*' -o -iname '*backup*.tar*' -o -iname '*database*.gz' \) -printf '%M %u %g %s %p\n' 2>/dev/null | head -50 || true
cd /var/www/main/current
node --env-file=.env --input-type=module <<'NODE'
import { PrismaClient } from '@prisma/client';
import fs from 'node:fs';
const db = new PrismaClient();
try {
  console.log('DELETED_ACTIVITY_REFERENCE', JSON.stringify(await db.$queryRaw`SELECT DISTINCT title, body, href FROM "Notification" WHERE href LIKE '/activities/cmuf5kqso014f8lvo8ln715ez%' LIMIT 10`));
  console.log('ACTIVITY_RELATION_STORAGE', JSON.stringify(await db.$queryRaw`SELECT pg_relation_filepath('"Activity"') AS path, pg_relation_size('"Activity"')::int AS bytes`));
} finally { await db.$disconnect(); }
for (const dir of ['/var/backups/iug-main-2026-10-03','/var/www/main/shared','/var/www/main/shared/storage/public/activity-images/cmuf5kqso014f8lvo8ln715ez']) {
  try { console.log('DIRECTORY_DETAIL', JSON.stringify({directory:dir,names:fs.readdirSync(dir)})); }
  catch(error) { console.log('DIRECTORY_DENIED', JSON.stringify({directory:dir,code:error.code})); }
}
NODE
