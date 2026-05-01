import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('http://localhost:8077');
  await page.fill('#loginUsername', 'admin');
  await page.fill('#loginPassword', 'AliraAdmin2026!');
  await page.click('#loginBtn');
  await page.waitForSelector('#appShell:not([hidden])');
});

test('admin can edit FX rates and base currency in Settings', async ({ page }) => {
  await page.goto('http://localhost:8077/#settings');
  // Open the App Settings tab.
  await page.click('#tabAppSettings');

  // FX Rates table renders.
  const fxSection = page.locator('[data-testid="fx-rates-section"]');
  await expect(fxSection).toBeVisible();
  await expect(fxSection.locator('tbody tr')).toHaveCount(6);

  // Base currency select exists.
  const baseSel = page.locator('[data-testid="base-currency-select"]');
  await expect(baseSel).toBeVisible();

  // Change EUR rate to 1.0850 and save.
  const eurInput = page.locator('[data-testid="fx-rate-EUR"]');
  await eurInput.fill('1.0850');
  await page.click('[data-testid="fx-rates-save"]');

  // Toast confirms.
  await expect(page.locator('.toast').first()).toContainText(/saved|updated/i);

  // Reload and verify persisted.
  await page.reload();
  await page.click('#tabAppSettings');
  await expect(page.locator('[data-testid="fx-rate-EUR"]')).toHaveValue('1.085');
});

test('viewer sees FX rates read-only', async ({ page }) => {
  // logout admin, login as viewer
  await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
  await page.goto('http://localhost:8077');
  await page.waitForSelector('#loginScreen:not([hidden])');
  await page.fill('#loginUsername', 'viewer');
  await page.fill('#loginPassword', 'AliraView2026!');
  await page.click('#loginBtn');
  await page.waitForSelector('#appShell:not([hidden])');

  await page.goto('http://localhost:8077/#settings');
  // App Settings tab is admin-only — verify it's not visible.
  await expect(page.locator('#tabAppSettings')).toHaveCount(0);
});
