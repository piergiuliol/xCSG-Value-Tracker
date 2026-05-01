import { test, expect, Page, request as pwRequest } from '@playwright/test';

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
 * Verifies the five-tab dashboard (Overview/Trends/Breakdowns/Economics/Signals),
 * the global filter bar (rescope + persistence), client/server metric parity,
 * and that every KPI tile and every chart container renders non-empty.
 *
 * Each test seeds its own dataset via the API (the Playwright config wipes the
 * DB once at startup, so we must seed in beforeEach since the suite runs
 * alongside others that mutate state).
 */

const BASE = 'http://localhost:8077';
const ADMIN = { username: 'admin', password: 'AliraAdmin2026!' };

async function login(page: Page) {
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  await page.fill('#loginUsername', ADMIN.username);
  await page.fill('#loginPassword', ADMIN.password);
  await page.click('#loginBtn');
  await expect(page.locator('#appShell')).toBeVisible({ timeout: 10_000 });
}

async function adminApiContext() {
  const ctx = await pwRequest.newContext({ baseURL: BASE });
  const r = await ctx.post('/api/auth/login', {
    data: { username: 'admin', password: 'AliraAdmin2026!' },
  });
  const tok = (await r.json()).access_token;
  return await pwRequest.newContext({
    baseURL: BASE,
    extraHTTPHeaders: { Authorization: `Bearer ${tok}`, 'Content-Type': 'application/json' },
  });
}

async function wipeProjects(api: any) {
  const projs = await (await api.get('/api/projects')).json();
  for (const p of projs) {
    await api.delete(`/api/projects/${p.id}`);
  }
}

const STRONG = {
  b1_starting_point: 'From AI draft', b2_research_sources: 'Broad systematic synthesis (10+)',
  b3_assembly_ratio: '>75% AI', b4_hypothesis_first: 'Hypothesis-first', b5_ai_survival: '>75%',
  b6_data_analysis_split: '<25% on data', c1_specialization: 'Deep specialist', c2_directness: 'Expert authored',
  c3_judgment_pct: '>75% judgment', c6_self_assessment: 'Significantly better', c7_analytical_depth: 'Exceptional',
  c8_decision_readiness: 'Yes without caveats', d1_proprietary_data: 'Yes', d2_knowledge_reuse: 'Yes directly reused and extended',
  d3_moat_test: 'No — proprietary inputs decisive', e1_client_decision: 'Yes — informed a specific decision',
  f1_feasibility: 'Not feasible', f2_productization: 'Yes largely as-is', g1_reuse_intent: 'Yes without hesitation',
  l1_legacy_working_days: 30, l3_legacy_revision_depth: 'Major rework', l4_legacy_scope_expansion: 'Yes',
  l5_legacy_client_reaction: 'Met expectations', l6_legacy_b2_sources: 'A few targeted sources (2-4)',
  l7_legacy_c1_specialization: 'Generalist', l8_legacy_c2_directness: 'Expert reviewed only',
  l9_legacy_c3_judgment: '25-50%', l10_legacy_d1_proprietary: 'No', l11_legacy_d2_reuse: 'No built from scratch',
  l12_legacy_d3_moat: 'Yes — all inputs publicly available', l13_legacy_c7_depth: 'Adequate',
  l14_legacy_c8_decision: 'Needs significant additional work', l15_legacy_e1_decision: 'Too early to tell',
  l16_legacy_b6_data: '50-75%',
};

// Seed enough projects across multiple practices/categories to populate
// every chart on every tab. The redesign test asserts no empty charts and
// non-em-dash KPI tiles, both of which need at least one completed survey
// per dimension (effort, quality, flywheel scores, etc).
async function seedDashboardProjects(api: any) {
  const cats = await (await api.get('/api/categories')).json();
  const practices = await (await api.get('/api/practices')).json();
  const pmap: Record<string, number> = {};
  practices.forEach((p: any) => { pmap[p.code] = p.id; });

  // Pick 3 distinct (category, practice) pairs to seed variety into Breakdowns charts.
  const pairs = [
    { practice: 'MAP', team: '3', days: 10, revs: '1', start: '2026-01-10', end: '2026-02-02' },
    { practice: 'RAM', team: '2', days: 7,  revs: '1', start: '2026-01-15', end: '2026-02-05' },
    { practice: 'MCD', team: '4', days: 8,  revs: '1', start: '2026-02-01', end: '2026-02-20' },
  ];

  let i = 0;
  for (const pair of pairs) {
    const cat = cats.find((c: any) => (c.practices || []).some((p: any) => p.code === pair.practice));
    if (!cat) throw new Error(`No ${pair.practice}-eligible category`);
    const body = {
      project_name: `E2E Dash ${pair.practice} ${++i}`,
      category_id: cat.id,
      practice_id: pmap[pair.practice],
      client_name: `Client ${i}`,
      engagement_revenue: 100000 + i * 25000,
      currency: 'USD',
      xcsg_pricing_model: 'Fixed fee',
      date_started: pair.start,
      date_delivered: pair.end,
      working_days: pair.days,
      xcsg_team_size: pair.team,
      xcsg_revision_rounds: pair.revs,
      revision_depth: 'Cosmetic only',
      xcsg_scope_expansion: 'No',
      client_pulse: 'Exceeded expectations',
      engagement_stage: 'Active engagement',
      // date_expected_delivered is needed for the synthetic "On-Time Delivery"
      // KPI tile. Without it the tile renders an em-dash and the
      // "no em-dash on overview" assertion fires.
      date_expected_delivered: pair.end,
      pioneers: [{
        first_name: 'Dash', last_name: `Pia${i}`,
        email: `dash-pia-${i}@example.com`, total_rounds: 1,
      }],
      legacy_team: [{ role_name: 'Senior', count: 2, day_rate: 1500 }],
    };
    const r = await api.post('/api/projects', { data: body });
    if (r.status() !== 201) throw new Error(`create failed: ${r.status()} ${await r.text()}`);
    const proj = await r.json();
    const tok = proj.pioneers[0].expert_token;
    const sr = await api.post(`/api/expert/${tok}`, { data: STRONG });
    if (sr.status() !== 201) throw new Error(`survey failed: ${sr.status()} ${await sr.text()}`);
  }
}

test.beforeEach(async () => {
  const api = await adminApiContext();
  await wipeProjects(api);
  await seedDashboardProjects(api);
});

test.describe('Dashboard redesign', () => {
  test('all tabs present and switchable', async ({ page }) => {
    await login(page);
    await page.goto('/#portfolio');
    await page.waitForSelector('.tab-bar', { timeout: 15_000 });

    const tabs = page.locator('.tab-bar .tab');
    // 5 tabs after the Economics tab was added (Phase 2): overview, trends,
    // breakdowns, economics, signals. See backend/schema.py DASHBOARD_CONFIG.tabs.
    await expect(tabs).toHaveCount(5);

    for (const id of ['overview', 'trends', 'breakdowns', 'economics', 'signals']) {
      await page.click(`.tab-bar .tab[data-tab="${id}"]`);
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

    // The 12 overview KPI tiles live in the .metrics-grid that sits ABOVE the
    // tab shell (see app.js _renderDashboardView). The Economics summary card
    // and the Economics tab deep view also render .metric-tile elements, so we
    // scope to tiles NOT inside #tabContainer.
    const overviewTiles = page.locator('#mainContent > .metrics-grid > .metric-tile');
    await expect(overviewTiles).toHaveCount(12);

    const emDash = await page.locator(
      '#mainContent > .metrics-grid > .metric-tile .metric-tile-value:has-text("—")',
    ).count();
    expect(emDash).toBe(0);

    for (const id of ['overview', 'trends', 'breakdowns', 'economics', 'signals']) {
      await page.click(`.tab-bar .tab[data-tab="${id}"]`);
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
