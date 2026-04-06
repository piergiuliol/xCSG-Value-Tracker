import { chromium } from '/Users/pj/.npm/_npx/e41f203b7505f1fb/node_modules/playwright/index.mjs';

const BASE = 'http://localhost:8000';
const TOKEN = 'CiJcCGYdzwwCFlW7FWOPUbrA7z3LtJ0M3oYQyAfdsRE';
const wait = ms => new Promise(r => setTimeout(r, ms));

async function main() {
  const browser = await chromium.launch({ headless: false, slowMo: 100 });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();

  // Navigate directly to expert form
  await page.goto(`${BASE}/#expert/${TOKEN}`, { waitUntil: 'networkidle' });
  await wait(3000);

  console.log('Expert form should be visible now');
  await new Promise(() => {});
}

main().catch(e => { console.error(e); process.exit(1); });
