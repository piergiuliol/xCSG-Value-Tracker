import { test, expect, Page } from '@playwright/test';

const BASE = 'http://localhost:8077';

async function loginAs(page: Page, username: string, password: string) {
  await page.goto(BASE);
  await page.fill('#loginUsername', username);
  await page.fill('#loginPassword', password);
  await page.click('#loginBtn');
  await page.waitForSelector('#appShell:not([hidden])', { timeout: 10000 });
}

async function openPioneersIndex(page: Page) {
  await page.evaluate(() => { window.location.hash = '#pioneers'; });
  await page.waitForSelector('#pioneersTableContainer', { timeout: 5000 });
}

test.describe('Pioneers view', () => {
  test('admin opens index, adds a pioneer via modal, sees it in the table', async ({ page }) => {
    await loginAs(page, 'admin', 'AliraAdmin2026!');
    await openPioneersIndex(page);

    // Click the "+ Add Pioneer" button.
    await page.click('button:has-text("Add Pioneer")');
    // Modal opens.
    await page.waitForSelector('#addPioneerName', { timeout: 5000 });
    await page.fill('#addPioneerName', 'View Test Pia');
    await page.fill('#addPioneerEmail', 'view-test-pia@example.com');
    await page.fill('#addPioneerNotes', 'Test pioneer created in E2E');
    await page.click('button:has-text("Save")');

    // Wait for index refresh — table should now contain the new pioneer.
    await page.waitForFunction(() => {
      const cont = document.getElementById('pioneersTableContainer');
      return cont && /View Test Pia/.test(cont.textContent || '');
    }, { timeout: 5000 });
  });

  test('admin opens a pioneer detail, edits, then deletes', async ({ page }) => {
    await loginAs(page, 'admin', 'AliraAdmin2026!');
    await openPioneersIndex(page);

    // Wait for table to contain the pioneer created in the prior test.
    await page.waitForFunction(() => {
      const cont = document.getElementById('pioneersTableContainer');
      return cont && /View Test Pia/.test(cont.textContent || '');
    }, { timeout: 5000 });

    // Click the row for "View Test Pia".
    await page.click('text=View Test Pia');
    await page.waitForSelector('h1', { timeout: 5000 });
    await expect(page.locator('h1')).toContainText('View Test Pia');

    // Edit modal.
    await page.click('button:has-text("Edit")');
    await page.waitForSelector('#editPioneerName', { timeout: 5000 });
    await page.fill('#editPioneerName', 'View Test Pia (renamed)');
    await page.click('button:has-text("Save")');
    await page.waitForSelector('h1', { timeout: 5000 });
    await expect(page.locator('h1')).toContainText('View Test Pia (renamed)');

    // Delete (confirms via window.confirm — Playwright auto-accepts).
    page.once('dialog', d => d.accept());
    await page.click('button:has-text("Delete")');
    await page.waitForFunction(() => window.location.hash === '#pioneers', { timeout: 5000 });
  });

  test('viewer sees the index but no Add Pioneer button', async ({ page }) => {
    await loginAs(page, 'viewer', 'AliraView2026!');
    await openPioneersIndex(page);
    expect(await page.locator('button:has-text("Add Pioneer")').count()).toBe(0);
  });

  test('CSV download from index triggers a file', async ({ page }) => {
    await loginAs(page, 'admin', 'AliraAdmin2026!');
    await openPioneersIndex(page);

    const downloadPromise = page.waitForEvent('download', { timeout: 10000 });
    await page.click('text=Download CSV');
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe('pioneers.csv');
  });
});
