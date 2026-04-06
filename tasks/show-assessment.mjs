import { chromium } from '/Users/pj/.npm/_npx/e41f203b7505f1fb/node_modules/playwright/index.mjs';

const BASE = 'http://localhost:8000';
const wait = ms => new Promise(r => setTimeout(r, ms));

async function main() {
  const browser = await chromium.launch({ headless: false, slowMo: 80 });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();

  await page.goto(`${BASE}/`, { waitUntil: 'networkidle' });
  await wait(1000);
  await page.fill('#loginUsername', 'admin');
  await page.fill('#loginPassword', 'AliraAdmin2026!');
  await page.click('#loginBtn');
  await wait(2500);

  // Go to projects and click first row
  await page.goto(`${BASE}/#projects`, { waitUntil: 'networkidle' });
  await wait(2000);
  await page.locator('tr.clickable-row').first().click();
  await wait(2000);

  // Scroll to assessment section
  await page.mouse.wheel(0, 800);
  await wait(1500);

  console.log('✅ Assessment view open — explore!');
  await new Promise(() => {});
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });
