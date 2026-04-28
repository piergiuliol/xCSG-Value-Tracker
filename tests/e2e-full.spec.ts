import { test, expect, Page } from '@playwright/test';

const BASE = 'http://localhost:8077';
const jsErrors: string[] = [];

test.describe.serial('xCSG Value Tracker E2E', () => {
  let page: Page;
  let expertToken = '';

  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    page.on('pageerror', (err) => jsErrors.push(err.message));
    page.on('console', (msg) => {
      if (msg.type() === 'error') jsErrors.push(`Console: ${msg.text()}`);
    });
  });

  test.afterAll(async () => { await page.close(); });

  // ─── TEST 1: Login ───────────────────────────────────────────────────
  test('Test 1: Login', async () => {
    await page.goto(BASE);
    await page.waitForLoadState('networkidle');
    await expect(page.locator('#loginScreen')).toBeVisible();

    await page.fill('#loginUsername', 'admin');
    await page.fill('#loginPassword', 'AliraAdmin2026!');
    await page.click('#loginBtn');

    // Wait for app shell to appear
    await expect(page.locator('#appShell')).toBeVisible({ timeout: 10000 });
    await page.waitForLoadState('networkidle');

    // Verify we're on portfolio
    expect(page.url()).toContain('#portfolio');
  });

  // ─── TEST 2: Create a new project ────────────────────────────────────
  test('Test 2: Create a new project', async () => {
    // Navigate via full URL to ensure route() fires cleanly
    await page.goto(BASE + '/#new');
    await expect(page.locator('#projectForm')).toBeVisible({ timeout: 10000 });

    // Fill project info
    await page.fill('#fName', 'QA Test Project');
    await page.selectOption('#fCategory', { index: 1 });
    // Category change auto-populates #fPractice (each seeded category has one practice).

    // Pioneer assignment is now a separate sub-form: fill the first pioneer row
    // that renderNewProject() pre-creates. There is no inline #fPioneer / #fEmail.
    const firstPioneerRow = page.locator('#pioneersContainer .pioneer-row').first();
    await firstPioneerRow.locator('.pioneer-name').fill('Dr. QA');
    await firstPioneerRow.locator('.pioneer-email').fill('qa@test.com');

    // xCSG Performance
    await page.fill('#fXDays', '5');
    await page.fill('#fXTeam', '3');
    await page.fill('#fRevisions', '2');
    await page.selectOption('#fScopeExpansion', 'No');

    // Legacy Baseline — fill required fields (team size is now the legacy team mix)
    await page.fill('#fLDays', '8');
    await page.fill('#fLRevisions', '3');

    // Submit
    await page.click('#projectForm button[type="submit"]');
    await expect(page.locator('.modal-overlay.active')).toBeVisible({ timeout: 8000 });
    await expect(page.locator('.modal-card h3')).toHaveText('Project Created');

    // Extract expert token
    const expertLink = await page.locator('#expertLinkInput').inputValue();
    const match = expertLink.match(/#(?:expert|assess)\/(.+)$/);
    expect(match).not.toBeNull();
    expertToken = match![1];

    // Close modal
    await page.click('.modal-card .btn-secondary');
    await page.waitForSelector('.modal-card', { state: 'detached' }).catch(() => {});
  });

  // ─── TEST 3: Expert assessment ───────────────────────────────────────
  test('Test 3: Expert assessment (critical flow)', { timeout: 180_000 }, async () => {
    // Expert view is separate from auth — navigate directly
    await page.goto(BASE + '/#assess/' + expertToken);
    await page.waitForLoadState('networkidle');

    // Wait for context card — handle "Already Submitted" case
    const alreadySubmitted = await page.locator('.expert-thankyou h2').isVisible({ timeout: 5000 }).catch(() => false);
    if (alreadySubmitted) {
      await expect(page.locator('.expert-thankyou h2')).toHaveText(/Already Submitted/);
      console.log('ℹ️ Assessment was already submitted in a prior run — skipping form fill');
      return;
    }

    // Normal flow: context card loads
    await expect(page.locator('.context-title')).toHaveText('QA Test Project', { timeout: 10000 });

    // Expert form uses data-key attributes on .accordion-field elements
    const fillField = async (key: string, optionIndex: number) => {
      const sel = page.locator(`.accordion-field[data-key="${key}"]`);
      await sel.waitFor({ state: 'visible', timeout: 5000 });
      const tagName = await sel.evaluate(el => el.tagName);
      if (tagName === 'SELECT') {
        const options = await sel.locator('option').allTextContents();
        // Pick the option at the given 1-based index (skip "— Select —")
        const idx = Math.min(optionIndex, options.length - 1);
        await sel.selectOption({ index: idx });
      } else {
        await sel.fill(String(optionIndex));
        await sel.evaluate(el => el.dispatchEvent(new Event('input', { bubbles: true })));
      }
      await page.waitForTimeout(50);
    };

    const openSection = async (sec: string) => {
      const header = page.locator(`.accordion-header[data-section="${sec}"]`);
      await header.click();
      await page.waitForTimeout(500);
    };

    // Fill all fields dynamically — get all field keys from the DOM
    const allSections = await page.locator('.accordion-header[data-section]').evaluateAll(
      els => els.map(el => el.getAttribute('data-section'))
    );

    for (const sec of allSections) {
      await openSection(sec!);
      const fieldKeys = await page.locator(`.accordion-field[data-section="${sec}"]`).evaluateAll(
        els => els.map(el => ({ key: el.getAttribute('data-key')!, tag: el.tagName }))
      );
      for (const f of fieldKeys) {
        if (f.tag === 'SELECT') {
          await fillField(f.key, 1); // pick first non-placeholder option
        } else {
          await fillField(f.key, 10); // numeric: enter 10
        }
      }
    }

    // Wait for the submit button to become enabled (its disabled state is driven
    // by the progress calculation; if it never enables, the next assert surfaces it).
    await page.waitForFunction(
      () => {
        const b = document.querySelector('#expertSubmitBtn') as HTMLButtonElement | null;
        return b && !b.disabled;
      },
      null,
      { timeout: 5000 },
    ).catch(() => {});

    const btnDisabled = await page.locator('#expertSubmitBtn').isDisabled();
    console.log('Submit disabled:', btnDisabled);

    // If button is disabled, log empty fields
    if (btnDisabled) {
      const emptyFields = await page.evaluate(() => {
        const empty: string[] = [];
        document.querySelectorAll('.accordion-field').forEach((el: any) => {
          if (!el.value || el.value === '') empty.push(el.getAttribute('data-key'));
        });
        return empty;
      });
      console.log('Empty fields:', emptyFields);
    }

    expect(btnDisabled).toBe(false);

    // Submit
    await page.click('#expertSubmitBtn');

    // Wait for either thank-you or an error toast to appear
    await Promise.race([
      page.locator('#expertContent h2').filter({ hasText: /Thank You|Already Submitted/ }).waitFor({ timeout: 10000 }),
      page.locator('.toast-error').waitFor({ state: 'visible', timeout: 10000 }),
    ]).catch(() => {});
    const errorToast = page.locator('.toast-error');
    const toastVisible = await errorToast.isVisible().catch(() => false);
    if (toastVisible) {
      const toastText = await errorToast.textContent();
      console.log('⚠️ Error toast after submit:', toastText);
      throw new Error(`Submit failed with toast: ${toastText}`);
    }

    await expect(page.locator('#expertContent h2')).toHaveText(/Thank You|Already Submitted/, { timeout: 10000 });
  });

  // ─── TEST 4: Dashboard with real metrics ──────────────────────────────
  test('Test 4: Dashboard with real metrics', async () => {
    // Go back to app (need to re-auth since expert view cleared session)
    await page.goto(BASE);
    await page.waitForLoadState('networkidle');

    // If we see login, re-login
    if (await page.locator('#loginScreen').isVisible()) {
      await page.fill('#loginUsername', 'admin');
      await page.fill('#loginPassword', 'AliraAdmin2026!');
      await page.click('#loginBtn');
      await expect(page.locator('#appShell')).toBeVisible({ timeout: 10000 });
      await page.waitForLoadState('networkidle');
    }

    // Verify the projects list shows real metrics. The old UI had a per-project
    // detail panel with an "xCSG Score" banner; in the current UI the detail
    // route is the edit form (metrics are surfaced in the portfolio dashboard
    // KPIs and via the projects table Quality Score column / round chip modals).
    await page.evaluate(() => { window.location.hash = '#projects'; });
    await page.waitForSelector('#projectTable tbody tr', { timeout: 8000 });

    // Verify QA Test Project appears
    await expect(page.locator('text=QA Test Project').first()).toBeVisible({ timeout: 8000 });

    // The project row should show a numeric Quality Score (7th column) — not a dash.
    const projectRow = page.locator('#projectTable tbody tr', { hasText: 'QA Test Project' }).first();
    const qualityCell = projectRow.locator('td').nth(6);
    const qualityText = (await qualityCell.textContent() || '').trim();
    expect(qualityText).not.toBe('');
    expect(qualityText).not.toBe('—');
    expect(qualityText).toMatch(/^\d/); // starts with a digit

    // And the portfolio dashboard KPI tiles should render with real values.
    await page.evaluate(() => { window.location.hash = '#portfolio'; });
    await page.waitForSelector('#mainContent .metric-tile-value', { timeout: 8000 });
    const kpiValues = await page.locator('#mainContent .metric-tile-value').allTextContents();
    const realKpis = kpiValues.filter(v => v.trim() !== '' && v.trim() !== '—');
    expect(realKpis.length).toBeGreaterThanOrEqual(1);
  });

  // ─── TEST 5: Project form cleanup ────────────────────────────────────
  test('Test 5: Project form — correct fields present/absent', async () => {
    await page.evaluate(() => { window.location.hash = '#new'; });
    await expect(page.locator('#projectForm')).toBeVisible({ timeout: 8000 });

    const formHtml = await page.locator('#projectForm').innerHTML();
    // Fields that should NOT exist on new project form
    expect(formHtml).not.toContain('id="fComplexity"');
    expect(formHtml).not.toContain('Client Sector');
    expect(formHtml).not.toContain('Sub-category');
    expect(formHtml).not.toContain('Geography');

    // Fields that SHOULD exist (now number inputs)
    await expect(page.locator('#fXTeam')).toBeVisible();
    await expect(page.locator('#fRevisions')).toBeVisible();
    await expect(page.locator('#fScopeExpansion')).toBeVisible();

    // Verify numeric fields have correct attributes
    expect(await page.locator('#fXTeam').getAttribute('type')).toBe('number');
    expect(await page.locator('#fRevisions').getAttribute('type')).toBe('number');
    expect(await page.locator('#fScopeExpansion option').count()).toBeGreaterThanOrEqual(3);
  });

  // ─── TEST 6: Navigation ──────────────────────────────────────────────
  test('Test 6: Navigation — all routes work', async () => {
    const routes = ['#portfolio', '#projects', '#norms', '#settings', '#activity'];
    for (const hash of routes) {
      await page.evaluate((h) => { window.location.hash = h; }, hash);
      // Wait until #mainContent actually has non-trivial content before reading it
      await page.waitForFunction(
        () => (document.getElementById('mainContent')?.textContent || '').trim().length > 0,
        null,
        { timeout: 8000 },
      ).catch(() => {});
      const content = await page.locator('#mainContent').textContent();
      expect((content || '').trim().length).toBeGreaterThan(0);
    }
  });

  // ─── Summary ──────────────────────────────────────────────────────────
  test('Summary: JS error check', async () => {
    // Filter out non-critical console errors (422s are normal API validation)
    const realErrors = jsErrors.filter(e => !e.includes('422') && !e.includes('favicon') && !e.includes('404'));
    if (realErrors.length > 0) {
      console.log('⚠️ JS Errors:', realErrors);
    }
    if (jsErrors.length > 0) {
      console.log('ℹ️ Console errors (including non-critical):', jsErrors);
    }
    expect(realErrors.length).toBe(0);
  });
});
