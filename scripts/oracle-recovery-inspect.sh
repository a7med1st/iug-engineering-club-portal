#!/usr/bin/env bash
set -eu
cd /var/www/main/current
node --env-file=.env --input-type=module <<'NODE'
import { PrismaClient } from '@prisma/client';
import fs from 'node:fs';
const db = new PrismaClient();
const base = new URL(process.env.DATABASE_URL);
console.log('DATABASE_LOCATION', JSON.stringify({ host: base.hostname, database: base.pathname }));
try {
  const databases = await db.$queryRaw`SELECT datname, has_database_privilege(datname, 'CONNECT') AS accessible FROM pg_database WHERE NOT datistemplate`;
  console.log('DATABASES', JSON.stringify(databases));
  console.log('CURRENT_DB_PERMISSIONS', JSON.stringify(await db.$queryRaw`SELECT current_user, rolsuper, rolreplication FROM pg_roles WHERE rolname = current_user`));
  console.log('DELETED_ACTIVITY_NOTIFICATIONS', JSON.stringify(await db.$queryRaw`
    SELECT DISTINCT n.title, n.body, n.href
    FROM "Notification" n
    WHERE n.href LIKE '/activities/%'
      AND NOT EXISTS (SELECT 1 FROM "Activity" a WHERE n.href LIKE '/activities/' || a.id || '%')
    LIMIT 35
  `));
  console.log('ACTIVITY_STATS', JSON.stringify(await db.$queryRaw`SELECT n_live_tup::int, n_dead_tup::int, last_autovacuum, last_vacuum FROM pg_stat_user_tables WHERE relname = 'Activity'`));
  console.log('EXTENSIONS', JSON.stringify(await db.$queryRaw`SELECT extname FROM pg_extension`));
  for (const database of databases.filter(item => item.accessible && item.datname !== base.pathname.slice(1) && item.datname !== 'postgres')) {
    const url = new URL(base); url.pathname = '/' + database.datname;
    const other = new PrismaClient({ datasources: { db: { url: url.toString() } } });
    try {
      console.log('OTHER_DB_MATCHES', JSON.stringify({ database: database.datname, matches: await other.$queryRaw`SELECT id, title, "startsAt", "createdAt" FROM "Activity" WHERE title ILIKE ${'%مسار%'} OR title ILIKE ${'%تحديد%'} OR title ILIKE ${'%عملي%'} LIMIT 20` }));
    } catch { console.log('OTHER_DB_ACTIVITY_UNAVAILABLE', database.datname); }
    finally { await other.$disconnect(); }
  }
} finally { await db.$disconnect(); }
for (const directory of ['/var/www', '/var/backups', '/backups', '/backup', '/mnt', '/media', '/home', '/opt', '/srv', '/var/lib/postgresql', '/home/ubuntu/.oci']) {
  try { console.log('DIRECTORY_ENTRIES', JSON.stringify({ directory, names: fs.readdirSync(directory) })); }
  catch { console.log('DIRECTORY_UNAVAILABLE', directory); }
}
NODE
echo 'EXTENDED_BACKUP_SEARCH'
find /var/www /var/backups /backups /backup /mnt /media /opt /srv /home/iugdeploy -maxdepth 7 -type f \( -iname '*.sql*' -o -iname '*.dump*' -o -iname '*.backup*' -o -iname '*backup*.tar*' -o -iname '*snapshot*' \) -not -path '*/node_modules/*' -not -path '*/.git/*' -printf '%TY-%Tm-%Td %TH:%TM %s %p\n' 2>/dev/null | head -100 || true
echo 'BACKUP_AND_PG_PROCESSES'
ps -eo comm | grep -Ei 'postgres|backup|wal|oci|restic|borg' | sort -u || true
echo 'OCI_TOOLS'
command -v oci restic borg pgbackrest wal-g || true
