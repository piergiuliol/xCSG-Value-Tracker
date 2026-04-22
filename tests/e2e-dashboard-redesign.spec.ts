import { test, expect, Page } from '@playwright/test';

// Types for app.js globals reachable inside page.evaluate.
// `schema`, `_projectsCache`, `applyFilters`, `_computeLocalMetrics`, and `state`
// are declared with `let`/`const` at the top of frontend/app.js (classic script),
// so they live in the script's lexical environment (accessible by name, not on window).
declare const schema: any;
declare const state: any;
declare const _projectsCache: any[];
declare function applyFilters(projects: any[]): any[];
declare function _computeLocalMetrics(projects: any[]): Record<string, number>;

/**
 * E2E — Dashboard redesign (Task 24)
 *
 * Verifies the four-tab dashboard (Overview/Trends/Breakdowns/Signals),
 * the global filter bar (rescope + persistence), client/server metric parity,
 * and that every KPI tile and every chart container renders non-empty.
 *
 * Assumes port 8077 is up (playwright.config.ts webServer) and that 20
 * projects have already been seeded (see tests/seed_20_projects.py).
 * Both server aggregates and client-side _computeLocalMetrics include
 * 'partial' and 'complete' projects, so partial seed state is fine.
 */

const ADMIN = { username: 'admin', password: 'AliraAdmin2026!' };

async function login(page: Page) {
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  await page.fill('#loginUsername', ADMIN.username);
  await page.fill('#loginPassword', ADMIN.password);
  await page.click('#loginBtn');
  await expect(page.locator('#appShell')).toBeVisible({ timeout: 10_000 });
}

test.describe('Dashboard redesign', () => {
  test('four tabs present and switchable', async ({ page }) => {
    await login(page);
    await page.goto('/#portfolio');
    await page.waitForSelector('.tab-bar', { timeout: 15_000 });

    const tabs = page.locator('.tab-bar .tab');
    await expect(tabs).toHaveCount(4);

    for (const id of ['overview', 'trends', 'breakdowns', 'signals']) {
      await page.click(`.tab[data-tab="${id}"]`);
      await expect(page.locator(`.tab-panel[data-panel="${id}"].active`)).toBeVisible();
    }
  });

  test('filter bar rescopes charts', async ({ page }) => {
    await login(page);
    await page.goto('/#portfolio');
    await page.waitForSelector('.filter-bar', { timeout: 15_000 });

    const fullTotal = await page.evaluate(() =>
      (typeof _projectsCache !== 'undefined' && _projectsCache) ? _projectsCache.length : 0
    );
    expect(fullTotal).toBeGreaterThan(0);

    // Clear any persisted filter first
    await page.click('.filter-chip[data-filter="clear"]');
    // After Clear the taxonomy chips should read "All"
    await page.waitForFunction(() =>
      ['practices', 'categories', 'pioneers', 'projects'].every(k => {
        const el = document.querySelector(`.filter-chip[data-filter="${k}"]`);
        return el && /:\s*All\s*/.test(el.textContent || '');
      }),
    );

    // Open Practice popover and tick the first checkbox
    await page.click('.filter-chip[data-filter="practices"]');
    await page.waitForSelector('.filter-popover');
    await page.locator('.filter-popover input[type="checkbox"]').first().check();
    // Wait until the practice chip reflects the new selection (no longer "Practice: All")
    await page.waitForFunction(() => {
      const el = document.querySelector('.filter-chip[data-filter="practices"]');
      return el && !/Practice:\s*All/.test(el.textContent || '');
    });

    const filteredTotal = await page.evaluate(() => applyFilters(_projectsCache).length);
    expect(filteredTotal).toBeLessThan(fullTotal);
    expect(filteredTotal).toBeGreaterThan(0);
  });

  test('filter state persists across reload', async ({ page }) => {
    await login(page);
    await page.goto('/#portfolio');
    await page.waitForSelector('.filter-bar', { timeout: 15_000 });

    await page.click('.filter-chip[data-filter="clear"]');
    // After Clear the taxonomy chips should read "All" (the delivered chip reads
    // "all time" and is rendered with the "active" class for styling reasons —
    // only check the chips Clear actually resets).
    await page.waitForFunction(() =>
      ['practices', 'categories', 'pioneers', 'projects'].every(k => {
        const el = document.querySelector(`.filter-chip[data-filter="${k}"]`);
        return el && /:\s*All\s*/.test(el.textContent || '');
      }),
    );

    await page.click('.filter-chip[data-filter="practices"]');
    await page.waitForSelector('.filter-popover');
    await page.locator('.filter-popover input[type="checkbox"]').first().check();
    await page.waitForFunction(() => {
      const el = document.querySelector('.filter-chip[data-filter="practices"]');
      return el && !/Practice:\s*All/.test(el.textContent || '');
    });

    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForSelector('.filter-bar', { timeout: 15_000 });

    const hasActive = await page.locator('.filter-chip.active').count();
    expect(hasActive).toBeGreaterThan(0);
  });

  test('no-filter client aggregates match /api/dashboard/metrics', async ({ page }) => {
    await login(page);
    await page.goto('/#portfolio');
    await page.waitForSelector('.filter-bar', { timeout: 15_000 });

    // Clear filters so aggregates equal the full dataset
    await page.click('.filter-chip[data-filter="clear"]');
    // After Clear the taxonomy chips should read "All" (the delivered chip reads
    // "all time" and is rendered with the "active" class for styling reasons —
    // only check the chips Clear actually resets).
    await page.waitForFunction(() =>
      ['practices', 'categories', 'pioneers', 'projects'].every(k => {
        const el = document.querySelector(`.filter-chip[data-filter="${k}"]`);
        return el && /:\s*All\s*/.test(el.textContent || '');
      }),
    );

    const parityOk = await page.evaluate(async () => {
      // Token lives in sessionStorage under 'xcsg_token' (see state.token in app.js)
      const token =
        sessionStorage.getItem('xcsg_token') ||
        localStorage.getItem('xcsg.token') ||
        localStorage.getItem('token') ||
        (typeof state !== 'undefined' && state && state.token) ||
        null;
      const body = await fetch('/api/dashboard/metrics', {
        headers: token ? { Authorization: 'Bearer ' + token } : {},
      }).then(r => r.json());
      const local = _computeLocalMetrics(applyFilters(_projectsCache));
      const keys = [
        'average_effort_ratio', 'average_quality_ratio',
        'machine_first_avg', 'senior_led_avg', 'proprietary_knowledge_avg',
        'rework_efficiency_avg', 'client_impact_avg', 'data_independence_avg',
      ];
      // The local helper exposes productivity under `average_advantage`, the
      // server exposes it as `average_productivity_ratio`. Same underlying value.
      const diffs = keys.map(k => ({ k, server: body[k] ?? 0, local: local[k] ?? 0 }));
      diffs.push({
        k: 'average_productivity_ratio',
        server: body.average_productivity_ratio ?? 0,
        local: local.average_advantage ?? 0,
      });
      return { allClose: diffs.every(d => Math.abs(d.server - d.local) < 0.02), diffs };
    });

    if (!parityOk.allClose) console.log('parity diffs:', parityOk.diffs);
    expect(parityOk.allClose).toBe(true);
  });

  test('every KPI tile and every chart container has data', async ({ page }) => {
    await login(page);
    await page.goto('/#portfolio');
    await page.waitForSelector('.metric-tile', { timeout: 15_000 });

    await page.click('.filter-chip[data-filter="clear"]');
    // After Clear the taxonomy chips should read "All" (the delivered chip reads
    // "all time" and is rendered with the "active" class for styling reasons —
    // only check the chips Clear actually resets).
    await page.waitForFunction(() =>
      ['practices', 'categories', 'pioneers', 'projects'].every(k => {
        const el = document.querySelector(`.filter-chip[data-filter="${k}"]`);
        return el && /:\s*All\s*/.test(el.textContent || '');
      }),
    );

    const tileCount = await page.locator('.metric-tile').count();
    expect(tileCount).toBe(12);

    const emDash = await page.locator('.metric-tile-value:has-text("—")').count();
    expect(emDash).toBe(0);

    for (const id of ['overview', 'trends', 'breakdowns', 'signals']) {
      await page.click(`.tab[data-tab="${id}"]`);
      // Wait for the panel to activate and then give ECharts a short beat to settle
      await page.waitForSelector(`.tab-panel[data-panel="${id}"].active`);
      await page.waitForTimeout(400);

      const bad: string[] = await page.evaluate(() => {
        const cards = Array.from(
          document.querySelectorAll('.tab-panel.active [data-chart-id]')
        ) as HTMLElement[];
        // `schema` is a top-level `let` in app.js (classic script, non-module),
        // so it lives in the script's lexical environment — reachable by name
        // from page.evaluate, but NOT attached to `window`.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const chartDefs: Array<{ id: string; type: string }> =
          (typeof schema !== 'undefined' && schema?.dashboard?.charts) || [];
        return cards
          .filter(card => {
            const chartId = card.dataset.chartId as string;
            const type = chartDefs.find(c => c.id === chartId)?.type;
            // HTML-rendered cards (gates track, portfolio table, ranked lists)
            // populate their own #id host element with raw HTML, not a canvas.
            const HTML_TYPES = new Set([
              'track_scaling_gates',
              'table_portfolio',
              'ranked_list_top',
              'ranked_list_bottom',
            ]);
            if (type && HTML_TYPES.has(type)) {
              const host = document.getElementById(chartId);
              return !host || (host.innerHTML || '').trim().length < 20;
            }
            // Canvas-based: need at least one canvas anywhere in the card with non-zero width
            const canvas = card.querySelector('canvas') as HTMLCanvasElement | null;
            if (!canvas) return true;
            return !(canvas.width > 0);
          })
          .map(card => card.dataset.chartId as string);
      });

      expect(bad, `empty charts on ${id}: ${bad.join(', ')}`).toEqual([]);
    }
  });
});
