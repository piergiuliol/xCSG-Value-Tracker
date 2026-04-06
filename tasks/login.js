const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: false, slowMo: 80 });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await page.goto('http://localhost:8000/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  await page.fill('#loginUsername', 'admin');
  await page.fill('#loginPassword', 'AliraAdmin2026!');
  await page.click('#loginBtn');
  await page.waitForTimeout(2500);
  console.log('Logged in — browser open');
  await new Promise(() => {});
})();
