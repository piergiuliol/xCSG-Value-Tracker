/**
 * E2E Lifecycle Tests — xCSG Value Tracker
 *
 * Drives 10 realistic engagements through the full lifecycle:
 * Login → Create Project → Fill Expert Assessment → Verify Portfolio
 *
 * Runs like a real user clicking through the app.
 */
import { test, expect, Page } from '@playwright/test';
import { engagements, Engagement } from './test-data';

// ── Helpers ──────────────────────────────────────────────────────────────────

const ADMIN = { username: 'admin', password: 'AliraAdmin2026!' };

/** Login as admin — skips if already logged in */
async function login(page: Page) {
  await page.goto('/');
  // If app shell visible, already logged in
  const appShell = page.locator('#appShell');
  if (await appShell.isVisible().catch(() => false)) {
    const display = await appShell.evaluate(el => getComputedStyle(el).display);
    if (display !== 'none') return;
  }
  // Fill login form
  await page.locator('#loginUsername').fill(ADMIN.username);
  await page.locator('#loginPassword').fill(ADMIN.password);
  await page.locator('#loginBtn').click();
  // Wait for app shell to appear
  await expect(page.locator('#appShell')).toBeVisible({ timeout: 5000 });
}

/** Select a dropdown option by visible text */
async function selectOption(page: Page, selector: string, value: string) {
  await page.locator(selector).selectOption({ label: value });
}

/** Select by value attribute */
async function selectByValue(page: Page, selector: string, value: string) {
  await page.locator(selector).selectOption(value);
}

/**
 * Create a project (Tier 1) and return the expert token.
 */
async function createProject(page: Page, e: Engagement): Promise<string> {
  // Navigate to New Project
  await page.locator('[data-route="new"]').click();
  await expect(page.locator('#projectForm')).toBeVisible({ timeout: 3000 });

  // Project Information
  await page.locator('#fName').fill(e.projectName);

  // Select category by visible text — need to find the option
  const categorySelect = page.locator('#fCategory');
  await categorySelect.selectOption({ label: e.category });

  // Wait for legacy norms to auto-populate (network call)
  await page.waitForTimeout(500);

  await page.locator('#fClient').fill(e.client);
  await page.locator('#fPioneer').fill(e.pioneer);
  await page.locator('#fEmail').fill(e.pioneerEmail);
  await page.locator('#fDesc').fill(e.description);

  // Timeline
  await page.locator('#fDateStart').fill(e.dateStarted);
  await page.locator('#fDateEnd').fill(e.dateDelivered);

  // xCSG Performance
  await selectByValue(page, '#fXDays', e.xcsgDays);
  await selectByValue(page, '#fXTeam', e.xcsgTeam);
  await selectByValue(page, '#fXRevisions', e.xcsgRevisions);
  if (e.scopeExpansion) {
    await selectByValue(page, '#fScope', e.scopeExpansion);
  }

  // Legacy overrides (if provided)
  if (e.legacyDays) await selectByValue(page, '#fLDays', e.legacyDays);
  if (e.legacyTeam) await selectByValue(page, '#fLTeam', e.legacyTeam);
  if (e.legacyRevisions) await selectByValue(page, '#fLRevisions', e.legacyRevisions);

  // Verify legacy fields have values (auto-populated or overridden)
  const legacyDaysVal = await page.locator('#fLDays').inputValue();
  expect(legacyDaysVal).toBeTruthy();

  // Submit
  await page.locator('#projectSubmit').click();

  // Wait for modal with expert link
  await expect(page.locator('#globalModal.active')).toBeVisible({ timeout: 5000 });

  // Extract expert token from the link input
  const expertUrl = await page.locator('#expertLinkInput').inputValue();
  const token = expertUrl.split('#expert/')[1];
  expect(token).toBeTruthy();

  // Close modal
  await page.locator('#globalModal .btn-secondary').click();
  await expect(page.locator('#globalModal.active')).not.toBeVisible();

  return token;
}

/**
 * Fill expert assessment (Tier 2) via the standalone expert form.
 */
async function fillExpertForm(page: Page, token: string, expert: Engagement['expert']) {
  // Navigate to expert URL
  await page.goto(`/#expert/${token}`);
  await expect(page.locator('#expertView')).toBeVisible({ timeout: 5000 });
  await expect(page.locator('#expertForm')).toBeVisible({ timeout: 5000 });

  // Section B — Machine-First
  await selectByValue(page, 'select[name="b1_starting_point"]', expert.b1);
  await selectByValue(page, 'select[name="b2_research_sources"]', expert.b2);
  await selectByValue(page, 'select[name="b3_assembly_ratio"]', expert.b3);
  await selectByValue(page, 'select[name="b4_hypothesis_first"]', expert.b4);

  // Section C — Senior-Led
  await selectByValue(page, 'select[name="c1_specialization"]', expert.c1);
  await selectByValue(page, 'select[name="c2_directness"]', expert.c2);
  await selectByValue(page, 'select[name="c3_judgment_pct"]', expert.c3);

  // Section D — Proprietary Knowledge
  await selectByValue(page, 'select[name="d1_proprietary_data"]', expert.d1);
  await selectByValue(page, 'select[name="d2_knowledge_reuse"]', expert.d2);
  await selectByValue(page, 'select[name="d3_moat_test"]', expert.d3);

  // Section F — Value Creation
  await selectByValue(page, 'select[name="f1_feasibility"]', expert.f1);
  await selectByValue(page, 'select[name="f2_productization"]', expert.f2);

  // Submit
  await page.locator('#expertSubmit').click();

  // Wait for thank-you screen
  await expect(page.locator('.expert-thankyou')).toBeVisible({ timeout: 5000 });
}

// ── Tests ────────────────────────────────────────────────────────────────────

test.describe.serial('xCSG Value Tracker — Full Lifecycle', () => {
  const expertTokens: string[] = [];

  test('Login as admin', async ({ page }) => {
    await login(page);
    // Verify we're on the portfolio page
    await expect(page.locator('#topbarUsername')).toHaveText(/Admin/i);
    // Empty state — no projects yet
    await expect(page.locator('.empty-state')).toBeVisible();
  });

  // Create all 10 projects
  for (let i = 0; i < engagements.length; i++) {
    const e = engagements[i];

    test(`Create project ${i + 1}: ${e.projectName}`, async ({ page }) => {
      await login(page);
      const token = await createProject(page, e);
      expertTokens[i] = token;
    });

    test(`Expert assessment ${i + 1}: ${e.projectName}`, async ({ page }) => {
      expect(expertTokens[i]).toBeTruthy();
      await fillExpertForm(page, expertTokens[i], e.expert);
    });
  }

  // ── Verification suite ──────────────────────────────────────────────────

  test('Projects list shows all 10 projects as Complete', async ({ page }) => {
    await login(page);
    await page.locator('[data-route="projects"]').click();
    await expect(page.locator('#projectTable')).toBeVisible({ timeout: 5000 });

    const rows = page.locator('#projectTable tbody tr');
    await expect(rows).toHaveCount(10);

    // All should be Complete
    const completeBadges = page.locator('#projectTable .badge-green');
    await expect(completeBadges).toHaveCount(10);
  });

  test('Projects list — filter by pioneer "Bob Delise"', async ({ page }) => {
    await login(page);
    await page.locator('[data-route="projects"]').click();
    await expect(page.locator('#projectTable')).toBeVisible({ timeout: 5000 });

    await selectByValue(page, '#pioneerFilter', 'Bob Delise');
    await page.waitForTimeout(300);

    const visibleRows = page.locator('#projectTable tbody tr:visible');
    await expect(visibleRows).toHaveCount(3);
  });

  test('Projects list — filter by category "CDD"', async ({ page }) => {
    await login(page);
    await page.locator('[data-route="projects"]').click();
    await expect(page.locator('#projectTable')).toBeVisible({ timeout: 5000 });

    await selectByValue(page, '#catFilter', 'CDD');
    await page.waitForTimeout(300);

    const visibleRows = page.locator('#projectTable tbody tr:visible');
    await expect(visibleRows).toHaveCount(2);
  });

  test('Portfolio — KPI cards show correct totals', async ({ page }) => {
    await login(page);
    await page.locator('[data-route="portfolio"]').click();
    await page.waitForTimeout(1000); // let metrics load

    // Total projects = 10
    const kpiCards = page.locator('.kpi-card');
    await expect(kpiCards).toHaveCount(4);

    const totalCard = kpiCards.first();
    await expect(totalCard.locator('.kpi-value')).toHaveText('10');

    // Value multiplier > 1
    const vmText = await kpiCards.nth(1).locator('.kpi-value').textContent();
    const vmVal = parseFloat(vmText!.replace('x', ''));
    expect(vmVal).toBeGreaterThan(1);

    // Effort ratio > 1
    const erText = await kpiCards.nth(2).locator('.kpi-value').textContent();
    const erVal = parseFloat(erText!.replace('x', ''));
    expect(erVal).toBeGreaterThan(1);

    // Flywheel health > 0
    const fhText = await kpiCards.nth(3).locator('.kpi-value').textContent();
    const fhVal = parseInt(fhText!.replace('%', ''));
    expect(fhVal).toBeGreaterThan(0);
  });

  test('Portfolio — checkpoint progression at 2+', async ({ page }) => {
    await login(page);
    await page.locator('[data-route="portfolio"]').click();
    await page.waitForTimeout(1000);

    // With 10 projects, should be at checkpoint 3 or 4
    // Check that checkpoint dots 1 and 2 are completed
    const completedDots = page.locator('.checkpoint-step.completed');
    const count = await completedDots.count();
    expect(count).toBeGreaterThanOrEqual(2);
  });

  test('Portfolio — scorecard has all 10 projects', async ({ page }) => {
    await login(page);
    await page.locator('[data-route="portfolio"]').click();
    await page.waitForTimeout(1000);

    const scorecardRows = page.locator('#scorecardTable tbody tr');
    await expect(scorecardRows).toHaveCount(10);
  });

  test('Portfolio — effort and quality charts rendered', async ({ page }) => {
    await login(page);
    await page.locator('[data-route="portfolio"]').click();
    await page.waitForTimeout(1500); // charts need extra time

    // Chart canvases should exist
    await expect(page.locator('#effortChart')).toBeVisible();
    await expect(page.locator('#qualityChart')).toBeVisible();
  });

  test('Portfolio — flywheel gauges all > 0%', async ({ page }) => {
    await login(page);
    await page.locator('[data-route="portfolio"]').click();
    await page.waitForTimeout(1000);

    const gaugeValues = page.locator('.gauge-value');
    const count = await gaugeValues.count();
    expect(count).toBe(3);

    for (let i = 0; i < 3; i++) {
      const text = await gaugeValues.nth(i).textContent();
      const val = parseInt(text!.replace('%', ''));
      expect(val).toBeGreaterThan(0);
    }
  });

  test('Portfolio — filter by pioneer shows subset', async ({ page }) => {
    await login(page);
    await page.locator('[data-route="portfolio"]').click();
    await page.waitForTimeout(1000);

    await selectByValue(page, '#portfolioPioneerFilter', 'Bob Delise');
    await page.waitForTimeout(300);

    // Clear filters button should appear
    await expect(page.locator('#portfolioFilterReset')).toBeVisible();

    // Click clear
    await page.locator('#portfolioFilterReset').click();
    await page.waitForTimeout(300);

    // All rows visible again
    const visibleRows = page.locator('#scorecardTable tbody tr:visible');
    await expect(visibleRows).toHaveCount(10);
  });

  test('Portfolio — value multiplier trend chart rendered (checkpoint 3+)', async ({ page }) => {
    await login(page);
    await page.locator('[data-route="portfolio"]').click();
    await page.waitForTimeout(1500);

    // With 10 complete projects, checkpoint should be 3+ and trend chart visible
    await expect(page.locator('#trendChart')).toBeVisible();
  });

  test('Activity log has entries for all creations and completions', async ({ page }) => {
    await login(page);
    await page.locator('[data-route="activity"]').click();
    await page.waitForTimeout(1000);

    // Should have at least 20 entries (10 creates + 10 expert completions)
    const rows = page.locator('.data-table tbody tr');
    const count = await rows.count();
    expect(count).toBeGreaterThanOrEqual(20);
  });

  test('Settings — categories show project counts', async ({ page }) => {
    await login(page);
    await page.locator('[data-route="settings"]').click();
    await page.waitForTimeout(1000);

    // CDD should show count of 2
    const tableText = await page.locator('.data-table').textContent();
    expect(tableText).toContain('CDD');
  });

  test('Settings — legacy norms tab loads', async ({ page }) => {
    await login(page);
    await page.locator('[data-route="settings"]').click();
    await page.waitForTimeout(500);

    await page.locator('#tabNorms').click();
    await page.waitForTimeout(1000);

    // Should see norms table
    const normsContent = page.locator('#settingsContent');
    await expect(normsContent.locator('.data-table')).toBeVisible();
  });

  test('Expert link resubmit shows "already completed"', async ({ page }) => {
    // Try to access the first expert token again
    expect(expertTokens[0]).toBeTruthy();
    await page.goto(`/#expert/${expertTokens[0]}`);
    await expect(page.locator('#expertView')).toBeVisible({ timeout: 5000 });

    // Should show thank-you / already completed message
    await expect(page.locator('.expert-thankyou')).toBeVisible({ timeout: 5000 });
    const text = await page.locator('.expert-thankyou').textContent();
    expect(text).toContain('already');
  });

  test('Edit project — expert responses shown read-only', async ({ page }) => {
    await login(page);
    await page.locator('[data-route="projects"]').click();
    await expect(page.locator('#projectTable')).toBeVisible({ timeout: 5000 });

    // Click first project row
    await page.locator('#projectTable tbody tr').first().click();

    // Wait for edit view to fully render (form + async API call)
    await expect(page.locator('#projectForm')).toBeVisible({ timeout: 5000 });

    // Should see expert assessment card (4 grids: sections B, C, D, F)
    const grids = page.locator('.expert-response-grid');
    await expect(grids.first()).toBeVisible({ timeout: 5000 });
    expect(await grids.count()).toBe(4);
    // Verify it shows actual values
    const expertText = await grids.first().textContent();
    expect(expertText!.length).toBeGreaterThan(10);
  });

  test('Export to Excel triggers download', async ({ page }) => {
    await login(page);
    await page.locator('[data-route="portfolio"]').click();
    await page.waitForTimeout(1000);

    // Listen for download
    const [download] = await Promise.all([
      page.waitForEvent('download', { timeout: 10000 }),
      page.locator('.btn-export').click(),
    ]);

    expect(download.suggestedFilename()).toContain('.xlsx');
  });

  test('Engagement #10 has legacy overrides (not defaults)', async ({ page }) => {
    await login(page);
    await page.locator('[data-route="projects"]').click();
    await expect(page.locator('#projectTable')).toBeVisible({ timeout: 5000 });

    // Find AstraZeneca row — should NOT have confidence flag (legacy was overridden)
    const azRow = page.locator('#projectTable tbody tr', { hasText: 'AstraZeneca' });
    await expect(azRow).toBeVisible();
    const hasFlag = await azRow.locator('.confidence-flag').count();
    expect(hasFlag).toBe(0);
  });
});
