import { test, expect, Page } from '@playwright/test';

const ADMIN = { username: 'admin', password: 'AliraAdmin2026!' };

async function login(page: Page) {
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  await page.fill('#loginUsername', ADMIN.username);
  await page.fill('#loginPassword', ADMIN.password);
  await page.click('#loginBtn');
  await expect(page.locator('#appShell')).toBeVisible({ timeout: 10_000 });
}

test.describe('Notes feature', () => {
  test('notes page renders and lists notes', async ({ page }) => {
    await login(page);
    await page.goto('/#notes');
    await page.waitForSelector('.notes-feed, .notes-empty', { timeout: 10_000 });
    // If the seed has notes already (post-commit-1 this is possible), feed should have cards.
    // Otherwise the empty-state should show.
    const hasFeed = await page.locator('.notes-feed').count();
    const hasEmpty = await page.locator('.notes-empty').count();
    expect(hasFeed + hasEmpty).toBeGreaterThan(0);
  });

  test('filter bar narrows results', async ({ page }) => {
    await login(page);
    await page.goto('/#notes');
    await page.waitForSelector('.notes-filter-bar', { timeout: 10_000 });
    // Type something in search — may return 0 cards, that's fine
    await page.fill('#notesSearch', 'definitely-not-a-real-note-xyz123');
    await page.waitForTimeout(500);
    const cards = await page.locator('.notes-card').count();
    expect(cards).toBe(0);
  });

  test('sidebar has Notes item', async ({ page }) => {
    await login(page);
    await page.goto('/#portfolio');
    await page.waitForSelector('.nav-item', { timeout: 10_000 });
    const notesNav = await page.locator('.nav-item[data-route="notes"], a[href="#notes"], .nav-item:has-text("Notes")').count();
    expect(notesNav).toBeGreaterThan(0);
  });
});
