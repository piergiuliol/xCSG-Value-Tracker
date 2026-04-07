import { test, expect, Page } from '@playwright/test';

const BASE = 'http://localhost:8000';
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
    // Navigate via hash
    await page.evaluate(() => { window.location.hash = '#new'; });
    await page.waitForTimeout(1500);
    await expect(page.locator('#projectForm')).toBeVisible({ timeout: 8000 });

    // Fill project info
    await page.fill('#fName', 'QA Test Project');
    await page.selectOption('#fCategory', { index: 1 });
    await page.fill('#fPioneer', 'Dr. QA');
    await page.fill('#fEmail', 'qa@test.com');

    // xCSG Performance
    await page.selectOption('#fXDays', '4-5');
    await page.selectOption('#fXTeam', '3');
    await page.selectOption('#fRevisions', '2');
    await page.selectOption('#fScopeExpansion', 'Minor');

    // Legacy Baseline — fill required fields
    await page.selectOption('#fLDays', '6-10');
    await page.selectOption('#fLTeam', '4+');
    await page.selectOption('#fLRevisions', '3+');

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
    await page.waitForTimeout(500);
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

    // Verify all 4 accordion headers
    for (const sec of ['B', 'C', 'D', 'F']) {
      await expect(page.locator(`.accordion-header[data-section="${sec}"]`)).toBeVisible();
    }

    // Helpers — use index-based selection for reliability
    const fillSelect = async (name: string, label: string) => {
      const sel = page.locator(`select[name="${name}"]`);
      await sel.selectOption({ label });
      await page.waitForTimeout(100);
    };
    const fillNumber = async (name: string, value: string) => {
      const inp = page.locator(`input[name="${name}"]`);
      await inp.fill(value);
      await inp.evaluate(el => el.dispatchEvent(new Event('input', { bubbles: true })));
      await page.waitForTimeout(100);
    };
    const openSection = async (sec: string) => {
      await page.click(`.accordion-header[data-section="${sec}"]`);
      await page.waitForTimeout(500);
    };

    // ── Section B (4 questions × 2 cols) ──
    await openSection('B');
    await fillSelect('b1_starting_point_xcsg', 'Full hypothesis deck');
    await fillSelect('b1_starting_point_legacy', 'Raw request');
    await fillSelect('b2_research_sources_xcsg', 'Synthesized firm knowledge');
    await fillSelect('b2_research_sources_legacy', 'General web');
    await fillSelect('b3_assembly_ratio_xcsg', '<20% manual');
    await fillSelect('b3_assembly_ratio_legacy', '>80% manual');
    await fillSelect('b4_hypothesis_first_xcsg', 'Fully hypothesis-led');
    await fillSelect('b4_hypothesis_first_legacy', 'Exploratory');

    // ── Section C (3 selects + 2 numeric, no legacy cols) ──
    await openSection('C');
    await fillSelect('c1_specialization_xcsg', 'World-class expert');
    await fillSelect('c2_directness_xcsg', 'Personally leading');
    await fillSelect('c3_judgment_pct_xcsg', '>80%');
    await fillNumber('c4_senior_hours_xcsg', '8');
    await fillNumber('c5_junior_hours_xcsg', '4');

    // ── Section D (3 questions × 2 cols) ──
    await openSection('D');
    await fillSelect('d1_proprietary_data_xcsg', 'Fully proprietary');
    await fillSelect('d1_proprietary_data_legacy', 'None');
    await fillSelect('d2_knowledge_reuse_xcsg', 'Maximum');
    await fillSelect('d2_knowledge_reuse_legacy', 'One-time');
    await fillSelect('d3_moat_test_xcsg', 'Impossible to replicate');
    await fillSelect('d3_moat_test_legacy', 'Easily replicable');

    // ── Section F (2 questions × 2 cols) ──
    await openSection('F');
    await fillSelect('f1_feasibility_xcsg', 'Exceeds requirements');
    await fillSelect('f1_feasibility_legacy', 'Basic');
    await fillSelect('f2_productization_xcsg', 'Scaled');
    await fillSelect('f2_productization_legacy', 'None');

    // Wait for progress to update
    await page.waitForTimeout(500);

    // Debug: check progress and total fields
    const progressText = await page.locator('#expertProgressLabel').textContent();
    console.log('Progress:', progressText);
    const btnText = await page.locator('#expertSubmitBtn').textContent();
    console.log('Submit btn:', btnText);
    const btnDisabled = await page.locator('#expertSubmitBtn').isDisabled();
    console.log('Submit disabled:', btnDisabled);

    // Count total fields on page
    const totalFields = await page.locator('.accordion-field').count();
    console.log('Total accordion fields:', totalFields);
    const filledFields = await page.evaluate(() => {
      let count = 0;
      document.querySelectorAll('.accordion-field').forEach(el => {
        if (el.value !== '' && el.value != null) count++;
      });
      return count;
    });
    console.log('Filled fields:', filledFields);

    // If button is disabled, some fields are missing — log them
    if (btnDisabled) {
      const emptyFields = await page.evaluate(() => {
        const empty: string[] = [];
        document.querySelectorAll('.accordion-field').forEach(el => {
          if (!el.value || el.value === '') empty.push(el.name);
        });
        return empty;
      });
      console.log('Empty fields:', emptyFields);
    }

    expect(btnDisabled).toBe(false);

    // Submit
    await page.click('#expertSubmitBtn');

    // Check for error toast or success
    await page.waitForTimeout(3000);
    const errorToast = page.locator('.toast-error');
    const toastVisible = await errorToast.isVisible().catch(() => false);
    if (toastVisible) {
      const toastText = await errorToast.textContent();
      console.log('⚠️ Error toast after submit:', toastText);
      throw new Error(`Submit failed with toast: ${toastText}`);
    }

    // h2 is a sibling of .expert-thankyou (JS uses innerHTML +=), not a child
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

    // Go to projects
    await page.evaluate(() => { window.location.hash = '#projects'; });
    await page.waitForTimeout(2000);

    // Verify QA Test Project appears
    await expect(page.locator('text=QA Test Project').first()).toBeVisible({ timeout: 8000 });

    // Click on the project to see details
    await page.locator('text=QA Test Project').first().click();
    await page.waitForTimeout(2000);

    // Verify xCSG Score is displayed
    const bodyText = await page.locator('#mainContent').textContent();
    expect(bodyText).toContain('xCSG Score');
  });

  // ─── TEST 5: Project form cleanup ────────────────────────────────────
  test('Test 5: Project form — correct fields present/absent', async () => {
    await page.evaluate(() => { window.location.hash = '#new'; });
    await page.waitForTimeout(1500);
    await expect(page.locator('#projectForm')).toBeVisible({ timeout: 8000 });

    const formHtml = await page.locator('#projectForm').innerHTML();
    // Fields that should NOT exist on new project form
    expect(formHtml).not.toContain('id="fComplexity"');
    expect(formHtml).not.toContain('Client Sector');
    expect(formHtml).not.toContain('Sub-category');
    expect(formHtml).not.toContain('Geography');

    // Fields that SHOULD exist
    await expect(page.locator('#fXTeam')).toBeVisible();
    await expect(page.locator('#fRevisions')).toBeVisible();
    await expect(page.locator('#fScopeExpansion')).toBeVisible();

    // Verify options
    expect(await page.locator('#fXTeam option').count()).toBeGreaterThanOrEqual(4);
    expect(await page.locator('#fRevisions option').count()).toBeGreaterThanOrEqual(4);
    expect(await page.locator('#fScopeExpansion option').count()).toBeGreaterThanOrEqual(3);
  });

  // ─── TEST 6: Navigation ──────────────────────────────────────────────
  test('Test 6: Navigation — all routes work', async () => {
    const routes = ['#portfolio', '#projects', '#norms', '#settings', '#activity'];
    for (const hash of routes) {
      await page.evaluate((h) => { window.location.hash = h; }, hash);
      await page.waitForTimeout(1500);
      const content = await page.locator('#mainContent').textContent();
      expect((content || '').trim().length).toBeGreaterThan(0);
    }
  });

  // ─── Summary ──────────────────────────────────────────────────────────
  test('Summary: JS error check', async () => {
    // Filter out non-critical console errors (422s are normal API validation)
    const realErrors = jsErrors.filter(e => !e.includes('422'));
    if (realErrors.length > 0) {
      console.log('⚠️ JS Errors:', realErrors);
    }
    if (jsErrors.length > 0) {
      console.log('ℹ️ Console errors (including non-critical):', jsErrors);
    }
    expect(realErrors.length).toBe(0);
  });
});
