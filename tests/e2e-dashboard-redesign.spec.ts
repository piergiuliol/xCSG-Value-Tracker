import { test, expect, request, Page } from '@playwright/test';

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
 * projects have already been seeded (see tests/seed_20_projects.py). The
 * seed only submits one pioneer's survey per project, leaving projects in
 * 'partial' status. The client-side `_computeLocalMetrics` only aggregates
 * projects with status === 'complete', so we submit the remaining pioneer
 * rounds in `beforeAll` to get every project to 'complete'. This is what
 * production data looks like once surveys are actually finished.
 */

const ADMIN = { username: 'admin', password: 'AliraAdmin2026!' };

const STRONG_SURVEY = {
  b1_starting_point: 'From AI draft',
  b2_research_sources: 'Broad systematic synthesis (10+)',
  b3_assembly_ratio: '>75% AI',
  b4_hypothesis_first: 'Hypothesis-first',
  b5_ai_survival: '>75%',
  b6_data_analysis_split: '<25% on data',
  c1_specialization: 'Deep specialist',
  c2_directness: 'Expert authored',
  c3_judgment_pct: '>75% judgment',
  c6_self_assessment: 'Significantly better',
  c7_analytical_depth: 'Exceptional',
  c8_decision_readiness: 'Yes without caveats',
  d1_proprietary_data: 'Yes',
  d2_knowledge_reuse: 'Yes directly reused and extended',
  d3_moat_test: 'No — proprietary inputs decisive',
  e1_client_decision: 'Yes — informed a specific decision',
  f1_feasibility: 'Not feasible',
  f2_productization: 'Yes largely as-is',
  g1_reuse_intent: 'Yes without hesitation',
  l1_legacy_working_days: 30,
  l2_legacy_team_size: '4+',
  l3_legacy_revision_depth: 'Major rework',
  l4_legacy_scope_expansion: 'Yes',
  l5_legacy_client_reaction: 'Met expectations',
  l6_legacy_b2_sources: 'A few targeted sources (2-4)',
  l7_legacy_c1_specialization: 'Generalist',
  l8_legacy_c2_directness: 'Expert reviewed only',
  l9_legacy_c3_judgment: '25-50%',
  l10_legacy_d1_proprietary: 'No',
  l11_legacy_d2_reuse: 'No built from scratch',
  l12_legacy_d3_moat: 'Yes — all inputs publicly available',
  l13_legacy_c7_depth: 'Adequate',
  l14_legacy_c8_decision: 'Needs significant additional work',
  l15_legacy_e1_decision: 'Too early to tell',
  l16_legacy_b6_data: '50-75%',
};

test.beforeAll(async () => {
  // Ensure every seeded project is `complete` (i.e. every pioneer/round has a response).
  // The seed script only submits a single pioneer's round, leaving status='partial',
  // which would zero-out client-side `_computeLocalMetrics`.
  const api = await request.newContext({ baseURL: 'http://localhost:8077' });

  const loginResp = await api.post('/api/auth/login', {
    data: { username: ADMIN.username, password: ADMIN.password },
  });
  const { access_token } = await loginResp.json();
  const headers = { Authorization: `Bearer ${access_token}` };

  const projects = await (await api.get('/api/projects', { headers })).json();

  for (const pSummary of projects) {
    const proj = await (await api.get(`/api/projects/${pSummary.id}`, { headers })).json();
    for (const pioneer of proj.pioneers || []) {
      if ((pioneer.response_count ?? 0) >= ((pioneer.total_rounds ?? 1) || 1)) continue;
      for (const round of pioneer.rounds || []) {
        if (round.status === 'complete') continue;
        if (!round.token) continue;
        await api.post(`/api/expert/${round.token}`, { data: STRONG_SURVEY });
      }
    }
  }
  await api.dispose();
});

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
    await page.waitForTimeout(300);

    // Open Practice popover and tick the first checkbox
    await page.click('.filter-chip[data-filter="practices"]');
    await page.waitForSelector('.filter-popover');
    await page.locator('.filter-popover input[type="checkbox"]').first().check();
    await page.waitForTimeout(400);

    const filteredTotal = await page.evaluate(() => applyFilters(_projectsCache).length);
    expect(filteredTotal).toBeLessThan(fullTotal);
    expect(filteredTotal).toBeGreaterThan(0);
  });

  test('filter state persists across reload', async ({ page }) => {
    await login(page);
    await page.goto('/#portfolio');
    await page.waitForSelector('.filter-bar', { timeout: 15_000 });

    await page.click('.filter-chip[data-filter="clear"]');
    await page.waitForTimeout(300);

    await page.click('.filter-chip[data-filter="practices"]');
    await page.waitForSelector('.filter-popover');
    await page.locator('.filter-popover input[type="checkbox"]').first().check();
    await page.waitForTimeout(400);

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
    await page.waitForTimeout(500);

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
    await page.waitForTimeout(500);

    const tileCount = await page.locator('.metric-tile').count();
    expect(tileCount).toBe(12);

    const emDash = await page.locator('.metric-tile-value:has-text("—")').count();
    expect(emDash).toBe(0);

    for (const id of ['overview', 'trends', 'breakdowns', 'signals']) {
      await page.click(`.tab[data-tab="${id}"]`);
      await page.waitForTimeout(900);

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
            // HTML-rendered cards (gates track + portfolio table) populate their
            // own #id host element with raw HTML instead of mounting a canvas.
            if (type === 'track_scaling_gates' || type === 'table_portfolio') {
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
