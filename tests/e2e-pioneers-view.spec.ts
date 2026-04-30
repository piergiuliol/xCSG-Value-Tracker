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

// Create a pioneer via the API (logged-in admin token in sessionStorage).
// Returns the new pioneer's id. Used by tests that need a fresh row to
// operate on without depending on a sibling test's state.
async function createPioneerViaApi(page: Page, name: string, email?: string): Promise<number> {
  return await page.evaluate(async ({ name, email }) => {
    const tok = sessionStorage.getItem('xcsg_token');
    const r = await fetch('/api/pioneers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tok}` },
      body: JSON.stringify({ name, email: email || null }),
    });
    const j = await r.json();
    return j.id as number;
  }, { name, email });
}

async function deletePioneerViaApi(page: Page, id: number): Promise<void> {
  await page.evaluate(async (id) => {
    const tok = sessionStorage.getItem('xcsg_token');
    await fetch(`/api/pioneers/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${tok}` },
    });
  }, id);
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
    await page.click('[data-testid="add-pioneer-save"]');

    // Wait for index refresh — table should now contain the new pioneer.
    await page.waitForFunction(() => {
      const cont = document.getElementById('pioneersTableContainer');
      return cont && /View Test Pia/.test(cont.textContent || '');
    }, { timeout: 5000 });
  });

  test('admin opens a pioneer detail, edits, then deletes', async ({ page }) => {
    await loginAs(page, 'admin', 'AliraAdmin2026!');

    // Self-contained: create a fresh pioneer rather than relying on test 1's
    // "View Test Pia" row. Unique email so a stale row doesn't collide.
    const stamp = Date.now();
    const seedName = `Edit Flow Pia ${stamp}`;
    const seedEmail = `edit-flow-pia-${stamp}@example.com`;
    const pioneerId = await createPioneerViaApi(page, seedName, seedEmail);

    await openPioneersIndex(page);

    // Wait for the seeded pioneer to be visible in the table.
    await page.waitForFunction((needle) => {
      const cont = document.getElementById('pioneersTableContainer');
      return !!(cont && cont.textContent && cont.textContent.includes(needle));
    }, seedName, { timeout: 5000 });

    // Open detail by exact-match text click.
    await page.click(`text=${seedName}`);
    await page.waitForSelector('h1', { timeout: 5000 });
    await expect(page.locator('h1')).toContainText(seedName);

    // Edit modal — scoped to the detail-page Edit button.
    await page.click('[data-testid="pioneer-detail-edit"]');
    await page.waitForSelector('#editPioneerName', { timeout: 5000 });
    const renamed = `${seedName} (renamed)`;
    await page.fill('#editPioneerName', renamed);
    await page.click('[data-testid="edit-pioneer-save"]');
    await page.waitForSelector('h1', { timeout: 5000 });
    await expect(page.locator('h1')).toContainText(renamed);

    // Delete (confirms via window.confirm — Playwright auto-accepts).
    page.once('dialog', d => d.accept());
    await page.click('[data-testid="pioneer-detail-delete"]');
    await page.waitForFunction(() => window.location.hash === '#pioneers', { timeout: 5000 });

    // Best-effort cleanup in case the test failed before the delete click.
    try { await deletePioneerViaApi(page, pioneerId); } catch (_) { /* already gone */ }
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
