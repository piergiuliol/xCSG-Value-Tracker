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

// API helpers — use the admin token already in sessionStorage post-login.
async function findPioneerIdByEmail(page: Page, email: string): Promise<number | null> {
  return await page.evaluate(async (em) => {
    const tok = sessionStorage.getItem('xcsg_token');
    const r = await fetch('/api/pioneers', {
      headers: { Authorization: `Bearer ${tok}` },
    });
    const list = await r.json();
    const hit = (list || []).find((p: any) => (p.email || '').toLowerCase() === em.toLowerCase());
    return hit ? hit.id : null;
  }, email);
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

async function findPioneerIdByName(page: Page, first: string, last: string): Promise<number | null> {
  return await page.evaluate(async ({ first, last }) => {
    const tok = sessionStorage.getItem('xcsg_token');
    const r = await fetch('/api/pioneers', {
      headers: { Authorization: `Bearer ${tok}` },
    });
    const list = await r.json();
    const hit = (list || []).find((p: any) =>
      (p.first_name || '').toLowerCase() === first.toLowerCase()
      && (p.last_name || '').toLowerCase() === last.toLowerCase()
    );
    return hit ? hit.id : null;
  }, { first, last });
}

test.describe('Pioneer Title + Home Practice', () => {
  test('admin creates a pioneer via Add modal with Title + Home Practice — appears in index columns + detail badges', async ({ page }) => {
    await loginAs(page, 'admin', 'AliraAdmin2026!');
    await openPioneersIndex(page);

    const stamp = Date.now();
    const firstName = 'TitleTest';
    const lastName = `HomePractice${stamp}`;
    const email = `title-test-${stamp}@example.com`;

    // Open Add Pioneer modal.
    await page.click('button:has-text("Add Pioneer")');
    await page.waitForSelector('#addPioneerFirstName', { timeout: 5000 });
    await page.fill('#addPioneerFirstName', firstName);
    await page.fill('#addPioneerLastName', lastName);
    await page.fill('#addPioneerEmail', email);

    // Title — pick "Principal" from the schema-derived allowlist.
    await page.selectOption('[data-testid="addPioneerTitle"]', { label: 'Principal' });

    // Home Practice — pick "MAP" by visible code.
    await page.selectOption('[data-testid="addPioneerHomePractice"]', { label: 'MAP' });

    await page.click('[data-testid="add-pioneer-save"]');

    // Index refresh — confirm the new row carries Title=Principal + Home Practice=MAP.
    await page.waitForFunction((needle) => {
      const cont = document.getElementById('pioneersTableContainer');
      return !!(cont && cont.textContent && cont.textContent.includes(needle));
    }, lastName, { timeout: 5000 });

    // Locate the row and assert its Title + Home Practice cells.
    const row = page.locator(`tr:has-text("${lastName}")`).first();
    await expect(row).toContainText('Principal');
    await expect(row).toContainText('MAP');

    // Open detail by clicking the last-name cell.
    await page.click(`text=${lastName}`);
    await page.waitForSelector('[data-testid="pioneer-detail-badges"]', { timeout: 5000 });
    await expect(page.locator('[data-testid="pioneer-title-badge"]')).toContainText('Principal');
    await expect(page.locator('[data-testid="pioneer-home-practice-badge"]')).toContainText('MAP');

    // Cleanup so re-runs don't pile up.
    const pid = await findPioneerIdByEmail(page, email);
    if (pid != null) {
      try { await deletePioneerViaApi(page, pid); } catch { /* best-effort */ }
    }
  });

  test('Title filter chip narrows the index correctly', async ({ page }) => {
    await loginAs(page, 'admin', 'AliraAdmin2026!');
    await openPioneersIndex(page);

    // Wait for any seeded pioneer to render so the index is populated.
    await page.waitForFunction(() => {
      const cont = document.getElementById('pioneersTableContainer');
      return !!(cont && cont.querySelectorAll('tbody tr').length > 0);
    }, { timeout: 10000 });

    // Capture the unfiltered row count.
    const allCount = await page.locator('#pioneersTableContainer tbody tr').count();
    expect(allCount).toBeGreaterThan(1);

    // Click the "Principal" Title filter chip (lives in the dedicated container).
    const principalChip = page.locator('#pioneersTitleFilter button.pioneers-filter-chip', { hasText: 'Principal' });
    await expect(principalChip).toHaveCount(1);
    await principalChip.click();

    // Filtered count should be strictly fewer rows than the full set, and every
    // remaining row should contain "Principal".
    await page.waitForFunction((before) => {
      const cont = document.getElementById('pioneersTableContainer');
      const rows = cont?.querySelectorAll('tbody tr') || [];
      return rows.length > 0 && rows.length < before;
    }, allCount, { timeout: 5000 });

    const filteredCount = await page.locator('#pioneersTableContainer tbody tr').count();
    expect(filteredCount).toBeGreaterThan(0);
    expect(filteredCount).toBeLessThan(allCount);

    // Every remaining row must show "Principal" in its Title column.
    const titles = await page.locator('#pioneersTableContainer tbody tr').evaluateAll((rows) => {
      // Title column is the 4th cell (Last name | First name | Email | Title | ...).
      return rows.map((r) => (r.querySelectorAll('td')[3]?.textContent || '').trim());
    });
    for (const t of titles) {
      expect(t).toContain('Principal');
    }
  });

  test('migration applied: Aaron Grandy shows Title=Principal + Home Practice=MAP badge on detail page', async ({ page }) => {
    await loginAs(page, 'admin', 'AliraAdmin2026!');

    const pid = await findPioneerIdByName(page, 'Aaron', 'Grandy');
    expect(pid, 'Aaron Grandy should be present in seeded pioneers').not.toBeNull();

    await page.evaluate((id) => { window.location.hash = `#pioneer/${id}`; }, pid);
    await page.waitForSelector('[data-testid="pioneer-detail-badges"]', { timeout: 5000 });

    await expect(page.locator('[data-testid="pioneer-title-badge"]')).toContainText('Principal');
    await expect(page.locator('[data-testid="pioneer-home-practice-badge"]')).toContainText('MAP');
  });
});
