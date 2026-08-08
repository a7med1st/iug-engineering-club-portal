# تشغيل سريع على Windows 11

```powershell
cd path\to\iug-engineering-club-portal
Copy-Item .env.example .env
notepad .env
```

تأكد أن Docker Desktop مفتوح ويظهر **Engine running**، ثم:

```powershell
docker compose up -d
docker compose ps
npm.cmd install
npm.cmd run db:generate
npm.cmd run db:migrate -- --name init
npm.cmd run db:seed
npm.cmd run dev
```

لو ظهر خطأ pipe مثل `dockerDesktopLinuxEngine` فهذا يعني غالبًا أن Docker Desktop غير شغال أو لم يكتمل تشغيل Linux Engine.
