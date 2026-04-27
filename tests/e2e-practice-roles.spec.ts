import { test, expect, Page } from '@playwright/test';

const BASE = 'http://localhost:8077';

// ── Helper: log in as a given user ────────────────────────────────────────────
async function login(page: Page, username: string, password: string) {
  await page.goto(BASE);
  await page.waitForLoadState('networkidle');
  if (await page.locator('#loginScreen').isVisible()) {
    await page.fill('#loginUsername', username);
    await page.fill('#loginPassword', password);
    await page.click('#loginBtn');
    await expect(page.locator('#appShell')).toBeVisible({ timeout: 10000 });
  }
}

// ── Helper: navigate to Settings → Practices tab ─────────────────────────────
async function goToPracticesTab(page: Page) {
  await page.evaluate(() => { window.location.hash = '#settings'; });
  // Wait for the settings tabs to render
  await page.waitForSelector('#tabPractices', { timeout: 8000 });
  await page.click('#tabPractices');
  // Wait for the practices table to load
  await page.waitForSelector('.data-table tbody tr', { timeout: 8000 });
}

test.describe('Practice roles & rates', () => {
  // ── TEST 1: Admin can add roles to a practice and they persist ────────────
  test('admin adds roles to a practice and they persist', async ({ page }) => {
    await login(page, 'admin', 'AliraAdmin2026!');
    await goToPracticesTab(page);

    // Open the first practice's edit modal (pencil icon).
    const firstRowEdit = page.locator('.data-table tbody tr').first().locator('button[title="Edit"]');
    await firstRowEdit.click();

    // Wait for the roles section inside the modal.
    await page.waitForSelector('#rolesTableBody', { timeout: 5000 });

    // Clear any existing roles so the test starts clean.
    const existingRemoveButtons = page.locator('#rolesTableBody .role-remove');
    const existingCount = await existingRemoveButtons.count();
    for (let i = existingCount - 1; i >= 0; i--) {
      await existingRemoveButtons.nth(i).click();
    }

    // Click "+ Add role" twice and fill the rows.
    await page.click('#addRoleRowBtn');
    await page.click('#addRoleRowBtn');

    const rows = page.locator('.role-row');
    await expect(rows).toHaveCount(2);

    await rows.nth(0).locator('.role-name').fill('Senior Partner E2E');
    await rows.nth(0).locator('.role-rate').fill('1500');
    await rows.nth(0).locator('.role-currency').selectOption('EUR');

    await rows.nth(1).locator('.role-name').fill('Analyst E2E');
    await rows.nth(1).locator('.role-rate').fill('600');
    await rows.nth(1).locator('.role-currency').selectOption('EUR');

    // Save the modal.
    await page.click('button:has-text("Save")');

    // Modal overlay loses .active class after save.
    await page.waitForFunction(
      () => !document.getElementById('globalModal')?.classList.contains('active'),
      null,
      { timeout: 6000 },
    );

    // Reopen the same practice's edit modal to verify persistence.
    await firstRowEdit.click();
    await page.waitForSelector('#rolesTableBody', { timeout: 5000 });

    // Both rows persist.
    await expect(page.locator('.role-row')).toHaveCount(2);
    await expect(page.locator('.role-row').nth(0).locator('.role-name')).toHaveValue(/Senior Partner E2E/);
    await expect(page.locator('.role-row').nth(1).locator('.role-name')).toHaveValue(/Analyst E2E/);

    // Cleanup: clear the roles back to empty before closing.
    await page.locator('.role-remove').nth(0).click();
    await page.locator('.role-remove').nth(0).click();
    await page.click('button:has-text("Save")');

    // Wait for modal to close again.
    await page.waitForFunction(
      () => !document.getElementById('globalModal')?.classList.contains('active'),
      null,
      { timeout: 6000 },
    );
  });

  // ── TEST 2: Non-admin cannot see the edit-practice pencil ─────────────────
  test('non-admin cannot edit practice roles', async ({ page }) => {
    // Log in as analyst (pmo) — no admin privileges.
    await login(page, 'pmo', 'AliraPMO2026!');
    await goToPracticesTab(page);

    // The Actions column (and its Edit pencil) is only rendered for admins.
    // For non-admin users the column is entirely absent from the table.
    await expect(
      page.locator('.data-table tbody tr').first().locator('button[title="Edit"]'),
    ).toHaveCount(0);

    // Additionally confirm no Actions column header is present.
    await expect(page.locator('.data-table thead th:has-text("Actions")')).toHaveCount(0);
  });
});
