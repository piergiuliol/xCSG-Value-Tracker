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
async function createPioneerViaApi(page: Page, fullName: string, email?: string): Promise<number> {
  // Split full name into first + last on first whitespace.
  const idx = fullName.indexOf(' ');
  const first_name = idx >= 0 ? fullName.slice(0, idx) : fullName;
  const last_name = idx >= 0 ? fullName.slice(idx + 1) : '';
  return await page.evaluate(async ({ first_name, last_name, email }) => {
    const tok = sessionStorage.getItem('xcsg_token');
    const r = await fetch('/api/pioneers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tok}` },
      body: JSON.stringify({ first_name, last_name, email: email || null }),
    });
    const j = await r.json();
    return j.id as number;
  }, { first_name, last_name, email });
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
    // Modal opens — first/last name inputs are split.
    await page.waitForSelector('#addPioneerFirstName', { timeout: 5000 });
    await page.fill('#addPioneerFirstName', 'View');
    await page.fill('#addPioneerLastName', 'TestPia');
    await page.fill('#addPioneerEmail', 'view-test-pia@example.com');
    await page.fill('#addPioneerNotes', 'Test pioneer created in E2E');
    await page.click('[data-testid="add-pioneer-save"]');

    // Wait for index refresh — table should now contain both name parts.
    await page.waitForFunction(() => {
      const cont = document.getElementById('pioneersTableContainer');
      const txt = cont?.textContent || '';
      return cont && /TestPia/.test(txt) && /View/.test(txt);
    }, { timeout: 5000 });
  });

  test('admin opens a pioneer detail, edits, then deletes', async ({ page }) => {
    await loginAs(page, 'admin', 'AliraAdmin2026!');

    // Self-contained: create a fresh pioneer rather than relying on test 1's
    // "View Test Pia" row. Unique email so a stale row doesn't collide.
    const stamp = Date.now();
    const firstName = 'Edit';
    const lastName = `Flow Pia ${stamp}`;
    const seedName = `${firstName} ${lastName}`;
    const seedEmail = `edit-flow-pia-${stamp}@example.com`;
    const pioneerId = await createPioneerViaApi(page, seedName, seedEmail);

    await openPioneersIndex(page);

    // Wait for the seeded pioneer's last name to be visible in the table.
    await page.waitForFunction((needle) => {
      const cont = document.getElementById('pioneersTableContainer');
      return !!(cont && cont.textContent && cont.textContent.includes(needle));
    }, lastName, { timeout: 5000 });

    // Open detail by clicking the last-name cell (last name is the <strong>
    // tag in the leftmost column post-split).
    await page.click(`text=${lastName}`);
    await page.waitForSelector('h1', { timeout: 5000 });
    await expect(page.locator('h1')).toContainText(seedName);

    // Edit modal — scoped to the detail-page Edit button.
    await page.click('[data-testid="pioneer-detail-edit"]');
    await page.waitForSelector('#editPioneerLastName', { timeout: 5000 });
    const renamedLast = `${lastName} (renamed)`;
    await page.fill('#editPioneerLastName', renamedLast);
    await page.click('[data-testid="edit-pioneer-save"]');
    await page.waitForSelector('h1', { timeout: 5000 });
    await expect(page.locator('h1')).toContainText(renamedLast);

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
