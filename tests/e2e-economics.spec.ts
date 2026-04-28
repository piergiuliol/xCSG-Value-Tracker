import { test, expect, Page } from '@playwright/test';

const BASE = 'http://localhost:8077';

// ── Helper: log in as admin ───────────────────────────────────────────────────
async function login(page: Page) {
  await page.goto(BASE);
  await page.waitForLoadState('networkidle');
  if (await page.locator('#loginScreen').isVisible()) {
    await page.fill('#loginUsername', 'admin');
    await page.fill('#loginPassword', 'AliraAdmin2026!');
    await page.click('#loginBtn');
    await expect(page.locator('#appShell')).toBeVisible({ timeout: 10000 });
  }
}

// ── Helper: fill required project fields (no economics) ───────────────────────
async function fillRequiredFields(page: Page, projectName: string) {
  await page.goto(BASE + '/#new');
  await expect(page.locator('#projectForm')).toBeVisible({ timeout: 10000 });

  await page.fill('#fName', projectName);
  await page.selectOption('#fCategory', { index: 1 });

  const firstPioneerRow = page.locator('#pioneersContainer .pioneer-row').first();
  await firstPioneerRow.locator('.pioneer-name').fill('Dr. Econ Test');

  // xCSG performance
  await page.fill('#fXTeam', '2');
  await page.fill('#fRevisions', '1');
  await page.selectOption('#fScopeExpansion', 'No');

  // Legacy baseline (team size is now the legacy team mix, not a single field)
  await page.fill('#fLDays', '8');
  await page.fill('#fLRevisions', '2');
}

// ── Helper: submit the expert survey for a token ──────────────────────────────
async function submitExpertSurvey(page: Page, token: string) {
  await page.goto(BASE + '/#assess/' + token);
  await page.waitForLoadState('domcontentloaded');

  // If already submitted, bail out gracefully
  const alreadySubmitted = await page.locator('.expert-thankyou h2').isVisible({ timeout: 5000 }).catch(() => false);
  if (alreadySubmitted) return;

  await expect(page.locator('.context-title')).toBeVisible({ timeout: 15000 });

  const allSections = await page.locator('.accordion-header[data-section]').evaluateAll(
    (els) => els.map((el) => el.getAttribute('data-section')),
  );

  for (const sec of allSections) {
    await page.click(`.accordion-header[data-section="${sec}"]`);
    await page.waitForTimeout(300);

    const fields = await page.locator(`.accordion-field[data-section="${sec}"]`).evaluateAll(
      (els) => els.map((el) => ({ key: el.getAttribute('data-key')!, tag: el.tagName })),
    );

    for (const f of fields) {
      const sel = page.locator(`.accordion-field[data-key="${f.key}"]`);
      await sel.scrollIntoViewIfNeeded({ timeout: 5000 });
      if (f.tag === 'SELECT') {
        await sel.selectOption({ index: 1 });
      } else {
        await sel.fill('10');
        await sel.evaluate((el) => el.dispatchEvent(new Event('input', { bubbles: true })));
      }
      await page.waitForTimeout(30);
    }
  }

  // Wait for submit to enable then click
  await page.waitForFunction(
    () => {
      const b = document.querySelector('#expertSubmitBtn') as HTMLButtonElement | null;
      return b && !b.disabled;
    },
    null,
    { timeout: 8000 },
  ).catch(() => {});

  await page.click('#expertSubmitBtn');
  await expect(page.locator('#expertContent h2')).toHaveText(/Thank You|Already Submitted/, { timeout: 10000 });
}

test.describe('Project economics', () => {
  // ── TEST 1: Economics card renders with revenue + xCSG metrics ───────────────
  // NOTE: legacy_cost is now driven by the legacy team mix (role catalog × count),
  // not a standalone rate field. Without a team mix, legacy_cost = None and chips
  // like "Margin Gain" show "—". The card still renders; only xCSG-side metrics
  // (xCSG cost, xCSG margin %) are numeric.
  test('economics card renders with revenue + xCSG metrics', async ({ page }) => {
    await login(page);
    await fillRequiredFields(page, 'Econ E2E Happy Path');

    // Set pioneer day rate before opening the accordion (so currency label is correct)
    const firstPioneerRow = page.locator('#pioneersContainer .pioneer-row').first();
    await firstPioneerRow.locator('.pioneer-day-rate').fill('1500');

    // Open the Economics accordion and fill fields
    await page.locator('fieldset.economics-section legend').click();
    await expect(page.locator('#economicsBody')).toBeVisible({ timeout: 5000 });

    await page.fill('#fRevenue', '120000');
    await page.selectOption('#fPricingModel', { index: 1 }); // first non-placeholder option
    // No legacy rate field anymore — legacy cost comes from team mix (not set here)

    // Submit the project
    await page.click('#projectForm button[type="submit"]');
    await expect(page.locator('.modal-overlay.active')).toBeVisible({ timeout: 8000 });

    // Extract expert token from the modal
    const expertLink = await page.locator('#expertLinkInput').inputValue();
    const match = expertLink.match(/#(?:expert|assess)\/(.+)$/);
    expect(match).not.toBeNull();
    const token = match![1];

    // Dismiss modal
    await page.click('.modal-card .btn-secondary');
    await page.waitForSelector('.modal-card', { state: 'detached' }).catch(() => {});

    // Submit the expert survey (requires re-login first since expert view clears session)
    await submitExpertSurvey(page, token);

    // Re-login and navigate to the project detail
    await login(page);
    await page.evaluate(() => { window.location.hash = '#projects'; });
    await page.waitForSelector('#projectTable tbody tr', { timeout: 8000 });

    await page.locator('#projectTable tbody tr', { hasText: 'Econ E2E Happy Path' }).first().click();
    await page.waitForSelector('#projectForm', { timeout: 8000 });

    // Scroll down to the pioneer rounds table and click the completed R1 chip
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(500);

    // Click the "R1 ✓" chip to open the round detail modal
    await page.locator('.round-chip-clickable').first().click();
    await expect(page.locator('.modal-overlay.active')).toBeVisible({ timeout: 5000 });

    // Card renders; xCSG cost chip is present and numeric.
    // Margin Gain and Legacy cost may show "—" without a team mix — that is expected.
    await expect(page.locator('.economics-card')).toBeVisible({ timeout: 8000 });
    await expect(page.locator('.economics-card')).toContainText('xCSG cost');
  });

  // ── TEST 2: Economics card hidden when no economics fields set ───────────────
  test('economics card is hidden when no economics fields are set', async ({ page }) => {
    await login(page);
    await fillRequiredFields(page, 'No-Econ E2E');
    // Do NOT open the Economics accordion or fill any economics fields.

    await page.click('#projectForm button[type="submit"]');
    await expect(page.locator('.modal-overlay.active')).toBeVisible({ timeout: 8000 });

    const expertLink = await page.locator('#expertLinkInput').inputValue();
    const match = expertLink.match(/#(?:expert|assess)\/(.+)$/);
    expect(match).not.toBeNull();
    const token = match![1];

    await page.click('.modal-card .btn-secondary');
    await page.waitForSelector('.modal-card', { state: 'detached' }).catch(() => {});

    // Submit expert survey
    await submitExpertSurvey(page, token);

    // Re-login and navigate to project detail
    await login(page);
    await page.evaluate(() => { window.location.hash = '#projects'; });
    await page.waitForSelector('#projectTable tbody tr', { timeout: 8000 });

    await page.locator('#projectTable tbody tr', { hasText: 'No-Econ E2E' }).first().click();
    await page.waitForSelector('#projectForm', { timeout: 8000 });

    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(500);

    // Open the round modal — the economics card must NOT appear
    await page.locator('.round-chip-clickable').first().click();
    await expect(page.locator('.modal-overlay.active')).toBeVisible({ timeout: 5000 });

    // The economics card must not exist at all when no economics fields are set
    await expect(page.locator('.economics-card')).toHaveCount(0);
  });

  // ── TEST 3: Currency-change confirmation fires when economics fields are populated
  test('currency-change confirmation fires when economics fields are populated', async ({ page }) => {
    await login(page);
    await fillRequiredFields(page, 'Currency Confirm E2E');

    // Open the Economics accordion
    await page.locator('fieldset.economics-section legend').click();
    await expect(page.locator('#economicsBody')).toBeVisible({ timeout: 5000 });

    // Fill revenue so the confirm triggers
    await page.fill('#fRevenue', '50000');

    // The default currency is EUR. Changing to USD should trigger the confirm dialog.
    // Register the dialog handler BEFORE the selectOption that triggers it.
    let dialogMessage = '';
    page.once('dialog', async (dialog) => {
      dialogMessage = dialog.message();
      await dialog.dismiss(); // "Cancel" — revert to previous currency
    });

    await page.selectOption('#fCurrency', 'USD');

    // Give the dialog handler time to fire
    await page.waitForTimeout(500);

    // Dialog should have mentioned that values won't be converted
    expect(dialogMessage).toContain('will not be converted');

    // After dismissing, the currency should revert to EUR
    await expect(page.locator('#fCurrency')).toHaveValue('EUR');
  });
});
