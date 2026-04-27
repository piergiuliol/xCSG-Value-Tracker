import { test, expect, Page } from '@playwright/test';

const BASE = 'http://localhost:8077';

// ── Helper: log in as admin ────────────────────────────────────────────────────
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

// ── Helper: wait for globalModal to lose .active class ────────────────────────
async function waitForModalClose(page: Page) {
  await page.waitForFunction(
    () => !document.getElementById('globalModal')?.classList.contains('active'),
    null,
    { timeout: 6000 },
  );
}

// ── Helper: navigate to Settings → Practices tab ──────────────────────────────
async function goToPracticesTab(page: Page) {
  await page.evaluate(() => { window.location.hash = '#settings'; });
  await page.waitForSelector('#tabPractices', { timeout: 8000 });
  await page.click('#tabPractices');
  await page.waitForSelector('.data-table tbody tr', { timeout: 8000 });
}

// ── Helper: clear all role rows in the currently-open practice modal ──────────
async function clearAllRoleRows(page: Page) {
  const removeButtons = page.locator('#rolesTableBody .role-remove');
  const count = await removeButtons.count();
  // Remove in reverse order so indices don't shift under us.
  for (let i = count - 1; i >= 0; i--) {
    await removeButtons.nth(i).click();
  }
  // Confirm the body is empty.
  await expect(page.locator('#rolesTableBody .role-remove')).toHaveCount(0);
}

test.describe('Pioneer role picker pre-fills day-rate', () => {
  // ────────────────────────────────────────────────────────────────────────────
  // THE STRATEGY
  //
  // We use the "RWE" practice, which is available under the category
  // "Evidence Generation Strategy" (which also allows "MAP").  Having two
  // practices in that category means the user must explicitly pick RWE from
  // the dropdown, which fires a DOM `change` event on #fPractice — this is
  // exactly what triggers `refreshPioneerRoleSelects()` in app.js.
  //
  // Flow:
  //   1. Settings → Practices → find the RWE row → edit → add "Senior PHASE2B"
  //      role at €1 500/day → save.
  //   2. #new project → select category "Evidence Generation Strategy" →
  //      select practice "RWE" (fires change) → wait for role picker to list
  //      "Senior PHASE2B" → select it → assert day-rate pre-fills to 1500.
  //   3. Cleanup: remove the test role from RWE and save.
  // ────────────────────────────────────────────────────────────────────────────

  test('selecting a role pre-fills the day-rate input', async ({ page }) => {
    await login(page);

    // ── STEP 1: Add a test role to the RWE practice ──────────────────────────
    await goToPracticesTab(page);

    // Locate the RWE row by its code cell text.
    const rweRow = page.locator('.data-table tbody tr', { has: page.locator('td:first-child strong', { hasText: 'RWE' }) });
    await expect(rweRow).toBeVisible({ timeout: 5000 });

    const rweEditBtn = rweRow.locator('button[title="Edit"]');
    await rweEditBtn.click();
    await page.waitForSelector('#rolesTableBody', { timeout: 5000 });

    // Clear any pre-existing roles (keeps test idempotent).
    await clearAllRoleRows(page);

    // Add one test role.
    await page.click('#addRoleRowBtn');
    const newRow = page.locator('.role-row').first();
    await newRow.locator('.role-name').fill('Senior PHASE2B');
    await newRow.locator('.role-rate').fill('1500');
    await newRow.locator('.role-currency').selectOption('EUR');

    await page.click('button:has-text("Save")');
    await waitForModalClose(page);

    // ── STEP 2: Create a new project and verify the picker pre-fills ─────────
    await page.evaluate(() => { window.location.hash = '#new'; });
    await expect(page.locator('#projectForm')).toBeVisible({ timeout: 10000 });

    // First select the category — "Evidence Generation Strategy" maps to both
    // MAP and RWE, so #fPractice will show a dropdown (not auto-select).
    await page.selectOption('#fCategory', { label: 'Evidence Generation Strategy' });

    // Wait for #fPractice to be populated with options (category change is sync).
    await page.waitForFunction(
      () => {
        const sel = document.getElementById('fPractice') as HTMLSelectElement | null;
        return sel && Array.from(sel.options).some(o => o.textContent?.includes('RWE'));
      },
      null,
      { timeout: 5000 },
    );

    // Explicitly selecting RWE fires the `change` event on #fPractice, which
    // calls refreshPioneerRoleSelects() (async fetch from /practices/{id}/roles).
    await page.selectOption('#fPractice', { label: 'RWE' });

    // Wait for the async role fetch to complete and populate the pioneer-role select.
    await page.waitForFunction(
      () => {
        const sel = document.querySelector('.pioneer-role') as HTMLSelectElement | null;
        return sel && Array.from(sel.options).some(o => /Senior PHASE2B/.test(o.textContent || ''));
      },
      null,
      { timeout: 8000 },
    );

    // Select the test role by value (the option value equals the role_name).
    // selectOption does not accept a regex for label, so use the string value directly.
    await page.locator('.pioneer-role').first().selectOption({ value: 'Senior PHASE2B' });

    // Assert the day-rate input is pre-filled with 1500.
    const rateInput = page.locator('.pioneer-day-rate').first();
    await expect(rateInput).toHaveValue('1500');

    // ── STEP 3: Cleanup — remove the test role from RWE ──────────────────────
    await goToPracticesTab(page);
    await rweEditBtn.click();
    await page.waitForSelector('#rolesTableBody', { timeout: 5000 });

    await clearAllRoleRows(page);
    await page.click('button:has-text("Save")');
    await waitForModalClose(page);
  });
});
