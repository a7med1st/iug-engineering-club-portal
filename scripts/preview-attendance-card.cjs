const { PrismaClient } = require('@prisma/client');
const { createHash } = require('node:crypto');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE);
const fs = require('node:fs/promises');
(async () => {
  if (!process.env.DATABASE_URL.includes('127.0.0.1:55441/workshop_preview')) throw Error('Local preview only');
  const db = new PrismaClient();
  const session = await db.activitySession.findFirstOrThrow({ where: { activityId: 'workshop-preview' }, orderBy: { sortOrder: 'asc' } });
  const token = 'local-attendance-card-preview-2026';
  await db.activityAttendanceLink.upsert({ where: { sessionId: session.id }, update: { tokenHash: createHash('sha256').update(token).digest('hex'), isActive: true }, create: { activityId: session.activityId, sessionId: session.id, tokenHash: createHash('sha256').update(token).digest('hex'), tokenPrefix: token.slice(0,8) } });
  await db.$disconnect();
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const page = await browser.newPage();
  await page.goto('http://127.0.0.1:3000/login?portal=member');
  await page.locator('input[type=email]').fill('preview@example.com');
  await page.locator('input[type=password]').fill('WorkshopPreview2026!');
  await page.getByRole('button', { name: 'دخول', exact: true }).click();
  await page.waitForURL(url => !url.pathname.includes('login'));
  await fs.mkdir('artifacts/attendance-card', { recursive: true });
  for (const [name, width, height] of [['desktop',1280,900], ['mobile',390,844]]) {
    await page.setViewportSize({ width, height });
    await page.goto(`http://127.0.0.1:3000/attendance/workshop-preview/${token}`);
    await page.getByRole('heading', { name: session.title, exact: true }).waitFor();
    await page.waitForTimeout(4000);
    await page.evaluate(() => document.documentElement.dataset.theme = 'dark');
    console.log(await page.locator('main section').last().evaluate(el => Array.from(el.querySelectorAll('h1,h2,p,span')).map(n => ({ text: n.textContent, color: getComputedStyle(n).color, fill: getComputedStyle(n).webkitTextFillColor }))));
    if (await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)) throw Error('Horizontal overflow');
    await page.locator('main section').last().screenshot({ path: `artifacts/attendance-card/${name}.png` });
  }
  await browser.close();
  console.log('Session name and desktop/mobile attendance card verified');
})().catch(error => { console.error(error); process.exit(1); });
