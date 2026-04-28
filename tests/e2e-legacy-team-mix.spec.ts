import { test, expect } from '@playwright/test';

const BASE = 'http://localhost:8077';

// ── Helper: wait for globalModal to lose .active class ────────────────────────
async function waitForModalClose(page: import('@playwright/test').Page) {
  await page.waitForFunction(
    () => !document.getElementById('globalModal')?.classList.contains('active'),
    null,
    { timeout: 6000 },
  );
}

test.describe('Legacy team mix', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(BASE);
    await page.fill('#loginUsername', 'admin');
    await page.fill('#loginPassword', 'AliraAdmin2026!');
    await page.click('#loginBtn');
    await page.waitForSelector('#appShell:not([hidden])', { timeout: 10000 });
  });

  test('admin enters legacy team mix and rate auto-displays from catalog', async ({ page }) => {
    // ── STEP 1: Add a role to RWE practice catalog (EUR). ───────────────────
    await page.evaluate(() => { window.location.hash = '#settings'; });
    await page.waitForSelector('#tabPractices', { timeout: 8000 });
    await page.click('#tabPractices');
    await page.waitForSelector('.data-table tbody tr', { timeout: 8000 });

    // Locate the RWE row by its code cell text.
    const rweRow = page.locator('.data-table tbody tr', {
      has: page.locator('td:first-child strong', { hasText: 'RWE' }),
    });
    await expect(rweRow).toBeVisible({ timeout: 5000 });

    const rweEditBtn = rweRow.locator('button[title="Edit"]');
    await rweEditBtn.click();
    await page.waitForSelector('#rolesTableBody', { timeout: 5000 });

    // Clear pre-existing rows (keeps test idempotent).
    const removeButtons = page.locator('#rolesTableBody .role-remove');
    const count = await removeButtons.count();
    for (let i = count - 1; i >= 0; i--) {
      await removeButtons.nth(i).click();
    }
    await expect(page.locator('#rolesTableBody .role-remove')).toHaveCount(0);

    // Add one test role.
    await page.click('#addRoleRowBtn');
    const newRoleRow = page.locator('.role-row').first();
    await newRoleRow.locator('.role-name').fill('Senior LT');
    await newRoleRow.locator('.role-rate').fill('1500');
    await newRoleRow.locator('.role-currency').selectOption('EUR');

    await page.click('button:has-text("Save")');
    await waitForModalClose(page);

    // ── STEP 2: New Project — pick a category that exposes RWE. ─────────────
    await page.evaluate(() => { window.location.hash = '#new'; });
    await page.waitForSelector('#projectForm', { timeout: 10000 });

    // "Evidence Generation Strategy" exposes both MAP and RWE in #fPractice.
    await page.selectOption('#fCategory', { label: 'Evidence Generation Strategy' });

    // Wait for #fPractice to offer RWE.
    await page.waitForFunction(
      () => {
        const sel = document.getElementById('fPractice') as HTMLSelectElement | null;
        return sel && Array.from(sel.options).some(o => o.textContent?.includes('RWE'));
      },
      null,
      { timeout: 5000 },
    );

    // Selecting RWE fires a change event which triggers refreshLegacyTeamRolePickers
    // (and also refreshPioneerRoleSelects). The roles fetch is async.
    await page.selectOption('#fPractice', { label: 'RWE' });

    // Wait for the async role fetch to complete — the role picker in legacyTeamBody
    // will be populated after the practice changes.
    await page.waitForSelector('#legacyTeamBody', { timeout: 5000 });

    // ── STEP 3: Add a legacy team mix row. ──────────────────────────────────
    await page.click('#addLegacyTeamRowBtn');
    const ltRow = page.locator('.legacy-team-row').first();

    // Wait for the role option to appear in the dropdown
    // (role data is fetched async when practice changes).
    await page.waitForFunction(
      () => {
        const sel = document.querySelector('.lt-role') as HTMLSelectElement | null;
        return sel && Array.from(sel.options).some(o => o.textContent?.includes('Senior LT'));
      },
      null,
      { timeout: 8000 },
    );

    // Pick the role — option value equals the role_name string.
    await ltRow.locator('.lt-role').selectOption({ value: 'Senior LT' });
    await ltRow.locator('.lt-count').fill('2');

    // ── STEP 4: Verify the rate column auto-displays the catalog rate. ───────
    await expect(ltRow.locator('.lt-rate')).toContainText('1500');

    // ── STEP 5: Cleanup — remove the test role from RWE catalog. ────────────
    await page.evaluate(() => { window.location.hash = '#settings'; });
    await page.waitForSelector('#tabPractices', { timeout: 8000 });
    await page.click('#tabPractices');
    await page.waitForSelector('.data-table tbody tr', { timeout: 8000 });

    await rweEditBtn.click();
    await page.waitForSelector('#rolesTableBody', { timeout: 5000 });

    const cleanupBtns = page.locator('#rolesTableBody .role-remove');
    const cleanupCount = await cleanupBtns.count();
    for (let i = cleanupCount - 1; i >= 0; i--) {
      await cleanupBtns.nth(i).click();
    }
    await expect(page.locator('#rolesTableBody .role-remove')).toHaveCount(0);

    await page.click('button:has-text("Save")');
    await waitForModalClose(page);
  });
});
