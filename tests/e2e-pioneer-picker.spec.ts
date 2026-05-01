import { test, expect } from '@playwright/test';
import { inlineCreatePioneer } from './test-helpers';

const BASE = 'http://localhost:8077';

async function loginAs(page: import('@playwright/test').Page, username: string, password: string) {
  await page.goto(BASE);
  await page.fill('#loginUsername', username);
  await page.fill('#loginPassword', password);
  await page.click('#loginBtn');
  await page.waitForSelector('#appShell:not([hidden])', { timeout: 10000 });
}

async function openNewProjectForm(page: import('@playwright/test').Page) {
  await page.evaluate(() => { window.location.hash = '#new'; });
  // Wait for the form's pioneer row to appear (the picker is rendered there).
  await page.waitForSelector('.pioneer-row .pioneer-picker', { timeout: 5000 });
}

test.describe('Pioneer picker', () => {
  test('admin inline-creates a new pioneer from the project form', async ({ page }) => {
    await loginAs(page, 'admin', 'AliraAdmin2026!');
    await openNewProjectForm(page);

    const row = page.locator('.pioneer-row').first();
    await inlineCreatePioneer(page, '.pioneer-row', 'Picker Pia', 'picker-pia-1@example.com');

    // Picker now has the pioneer's id as its value.
    const selectedValue = await row.locator('.pioneer-picker').inputValue();
    expect(selectedValue).toMatch(/^\d+$/); // numeric pioneer_id
  });

  test('admin can pick an existing pioneer (created by a prior test)', async ({ page }) => {
    await loginAs(page, 'admin', 'AliraAdmin2026!');
    await openNewProjectForm(page);

    const row = page.locator('.pioneer-row').first();
    const optsTexts = await row.locator('.pioneer-picker option').allTextContents();
    expect(optsTexts.some(t => /Picker Pia/.test(t))).toBe(true);
  });

  test('analyst can inline-create a pioneer', async ({ page }) => {
    await loginAs(page, 'pmo', 'AliraPMO2026!');
    await openNewProjectForm(page);

    await inlineCreatePioneer(page, '.pioneer-row', 'Analyst Pia', 'analyst-pia@example.com');
    const selectedValue = await page.locator('.pioneer-row').first().locator('.pioneer-picker').inputValue();
    expect(selectedValue).toMatch(/^\d+$/);
  });

  test('viewer cannot reach the project form (sees no #new route)', async ({ page }) => {
    await loginAs(page, 'viewer', 'AliraView2026!');
    await page.evaluate(() => { window.location.hash = '#new'; });
    // The form should not be reachable — viewer's nav should redirect or show denied.
    // Check that the pioneer-picker element is NOT present.
    await page.waitForTimeout(500);
    const pickerCount = await page.locator('.pioneer-row .pioneer-picker').count();
    expect(pickerCount).toBe(0);
  });

  test('find-or-create dedupes by case-insensitive email', async ({ page }) => {
    await loginAs(page, 'admin', 'AliraAdmin2026!');

    // Create pioneer with one email.
    await openNewProjectForm(page);
    await inlineCreatePioneer(page, '.pioneer-row', 'Dup Pia', 'dup-pia@example.com');
    const id1 = await page.locator('.pioneer-row').first().locator('.pioneer-picker').inputValue();

    // Open another project form, try to inline-create with same email different case.
    await openNewProjectForm(page);
    await inlineCreatePioneer(page, '.pioneer-row', 'Different Name', 'DUP-PIA@EXAMPLE.COM');
    const id2 = await page.locator('.pioneer-row').first().locator('.pioneer-picker').inputValue();

    // Same id — find-or-create returned existing record.
    expect(id2).toBe(id1);
  });

  test('canceling the inline-create form reverts to the picker', async ({ page }) => {
    await loginAs(page, 'admin', 'AliraAdmin2026!');
    await openNewProjectForm(page);

    const row = page.locator('.pioneer-row').first();

    // Open inline form.
    await row.locator('.pioneer-picker').selectOption('__new__');
    await page.waitForSelector('.pioneer-row .pioneer-inline-first-name', { timeout: 5000 });

    // Click Cancel.
    await row.locator('.pioneer-inline-cancel').click();

    // Picker should be visible again (no inline form).
    await page.waitForSelector('.pioneer-row .pioneer-picker', { timeout: 5000 });
    expect(await row.locator('.pioneer-inline-first-name').count()).toBe(0);
    expect(await row.locator('.pioneer-inline-last-name').count()).toBe(0);
  });
});
