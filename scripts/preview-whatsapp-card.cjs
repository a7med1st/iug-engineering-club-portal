const { PrismaClient } = require('@prisma/client');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE);
const fs = require('node:fs/promises');
(async () => {
  if (!process.env.DATABASE_URL.includes('127.0.0.1:55441/workshop_preview')) throw Error('Local preview only');
  const db = new PrismaClient();
  await db.activity.upsert({ where: { id: 'whatsapp-card-preview' }, update: {}, create: { capacity: 100, id: 'whatsapp-card-preview', title: 'ورشة تطوير تطبيقات الويب', description: 'ورشة تجريبية', location: 'مختبر الحاسوب', status: 'PUBLISHED', registrationForm: { create: { title: 'التسجيل في الورشة', opensAt: new Date('2026-01-01'), closesAt: new Date('2027-01-01'), requiresAccount: false, whatsappUrl: 'https://chat.whatsapp.com/PreviewOnly', questions: { create: { label: 'ما الذي ترغب بتعلمه؟', type: 'SHORT_TEXT', required: false } } } } } });
  await db.$disconnect();
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await page.goto('http://127.0.0.1:3000/activities/whatsapp-card-preview/register');
  await page.locator('input[name=studentName]').fill('طالب تجربة');
  await page.locator('input[name=studentEmail]').fill(`preview-${Date.now()}@gmail.com`);
  await page.getByRole('button', { name: 'إرسال التسجيل', exact: true }).click();
  const card = page.locator('.activity-registration-whatsapp-card');
  await card.waitFor({ timeout: 30000 });
  await fs.mkdir('artifacts/whatsapp-card', { recursive: true });
  for (const [name,width,height] of [['desktop',1280,900],['mobile',390,844]]) {
    await page.setViewportSize({width,height});
    await page.waitForTimeout(800);
    await card.screenshot({ path: `artifacts/whatsapp-card/${name}.png` });
    if (await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)) throw Error('Horizontal overflow');
  }
  await browser.close();
  console.log('Registration success and WhatsApp card verified on desktop/mobile');
})().catch(error => { console.error(error); process.exit(1); });
