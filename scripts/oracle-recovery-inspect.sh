#!/usr/bin/env bash
set -eu
cd /var/www/main/current
node --env-file=.env --input-type=module <<'NODE'
import { PrismaClient } from '@prisma/client';
const db = new PrismaClient();
try {
  const url = new URL(process.env.DATABASE_URL);
  console.log('DATABASE_LOCATION', JSON.stringify({ host: url.hostname, port: url.port, database: url.pathname }));
  const rows = await db.$queryRaw`SELECT id, title, "createdAt", "updatedAt", "startsAt" FROM "Activity" WHERE title ILIKE ${'%مسار%'} OR title ILIKE ${'%تحديد%'} ORDER BY "createdAt" DESC LIMIT 20`;
  console.log('MATCHING_ACTIVITIES', JSON.stringify(rows));
  console.log('RECENT_ACTIVITIES', JSON.stringify(await db.$queryRaw`SELECT id, title, "createdAt" FROM "Activity" ORDER BY "createdAt" DESC LIMIT 12`));
  console.log('RECOVERY_SETTINGS', JSON.stringify(await db.$queryRaw`SELECT name, setting FROM pg_settings WHERE name IN ('archive_mode','wal_level','data_directory','log_directory','log_statement')`));
  console.log('DATABASE_TABLES', JSON.stringify(await db.$queryRaw`SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND (tablename ILIKE '%backup%' OR tablename ILIKE '%audit%' OR tablename ILIKE '%trash%' OR tablename ILIKE '%delete%')`));
} finally { await db.$disconnect(); }
NODE
echo 'BACKUP_FILE_CANDIDATES'
find /var/backups /var/www/main/shared /home/iugdeploy /home/ubuntu /opt /srv -maxdepth 5 -type f \( -iname '*.sql' -o -iname '*.sql.gz' -o -iname '*.dump' -o -iname '*.backup' -o -iname '*backup*.tar*' \) -printf '%TY-%Tm-%Td %TH:%TM %s %p\n' 2>/dev/null | head -70 || true
echo 'DATABASE_TOOLS'
command -v psql pg_dump pg_restore docker || true
echo 'BACKUP_TIMERS'
systemctl list-timers --all --no-pager 2>/dev/null | grep -Ei 'backup|postgres|snapshot' || true
echo 'SUDO_CAPABILITIES'
sudo -n -l 2>/dev/null || true
