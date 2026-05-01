import { test, expect, request as pwRequest } from '@playwright/test';

const BASE = 'http://localhost:8077';

async function loginAs(page, username: string, password: string) {
  await page.goto(BASE);
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.fill('#loginUsername', username);
  await page.fill('#loginPassword', password);
  await page.click('#loginBtn');
  await page.waitForSelector('#appShell:not([hidden])');
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

async function wipeProjects(api) {
  const projs = await (await api.get('/api/projects')).json();
  for (const p of projs) {
    await api.delete(`/api/projects/${p.id}`);
  }
  // Pioneers don't cascade — wipe e2e ones too.
  const pioneers = await (await api.get('/api/pioneers')).json();
  for (const p of pioneers) {
    if ((p.email || '').startsWith('e2e-tab-')) {
      await api.delete(`/api/pioneers/${p.id}`);
    }
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

async function seedTwoProjects(api) {
  const cats = await (await api.get('/api/categories')).json();
  const practices = await (await api.get('/api/practices')).json();
  const pmap: Record<string, number> = {};
  practices.forEach((p: any) => { pmap[p.code] = p.id; });
  const mapCat = cats.find((c: any) => (c.practices || []).some((p: any) => p.code === 'MAP'));
  if (!mapCat) throw new Error('No MAP-eligible category');
  const ramCat = cats.find((c: any) => (c.practices || []).some((p: any) => p.code === 'RAM'));
  if (!ramCat) throw new Error('No RAM-eligible category');

  const legacyTeam = [{ role_name: 'Senior', count: 2, day_rate: 1500 }];

  const bodies = [
    {
      project_name: 'E2E Tab USD', category_id: mapCat.id, practice_id: pmap['MAP'],
      engagement_revenue: 100000, currency: 'USD', xcsg_pricing_model: 'Fixed fee',
      date_started: '2026-01-15', date_delivered: '2026-02-10',
      working_days: 10, xcsg_team_size: '2', xcsg_revision_rounds: '1',
      engagement_stage: 'Active engagement',
      pioneers: [{ first_name: 'E2E', last_name: 'TabA', email: 'e2e-tab-a@example.com', total_rounds: 1 }],
      legacy_team: legacyTeam,
    },
    {
      project_name: 'E2E Tab EUR', category_id: ramCat.id, practice_id: pmap['RAM'],
      engagement_revenue: 200000, currency: 'EUR', xcsg_pricing_model: 'Time & materials',
      date_started: '2026-01-20', date_delivered: '2026-02-15',
      working_days: 12, xcsg_team_size: '2', xcsg_revision_rounds: '1',
      engagement_stage: 'Active engagement',
      pioneers: [{ first_name: 'E2E', last_name: 'TabB', email: 'e2e-tab-b@example.com', total_rounds: 1 }],
      legacy_team: legacyTeam,
    },
  ];
  for (const body of bodies) {
    const r = await api.post('/api/projects', { data: body });
    if (r.status() !== 201) throw new Error(`create failed: ${r.status()} ${await r.text()}`);
    const proj = await r.json();
    const tok = proj.pioneers[0].expert_token;
    const sr = await api.post(`/api/expert/${tok}`, { data: STRONG });
    if (sr.status() !== 201) throw new Error(`survey failed: ${sr.status()} ${await sr.text()}`);
  }
  // Make sure EUR rate is 1.10 so totals are deterministic.
  await api.put('/api/fx-rates', { data: {
    base_currency: 'USD',
    rates: [{ currency_code: 'EUR', rate_to_base: 1.10 }],
  }});
}

test.beforeEach(async () => {
  const api = await adminApiContext();
  await wipeProjects(api);
});

test('admin sees Economics tab populated with deep view', async ({ page }) => {
  const api = await adminApiContext();
  await seedTwoProjects(api);

  await loginAs(page, 'admin', 'AliraAdmin2026!');
  await page.goto(`${BASE}/#portfolio`);

  // Click the Economics tab.
  const econTab = page.locator('.tab-bar .tab[data-tab="economics"]');
  await expect(econTab).toBeVisible({ timeout: 10000 });
  await econTab.click();

  // Deep view is rendered.
  const tabContent = page.locator('[data-testid="economics-tab-content"]');
  await expect(tabContent).toBeVisible();

  // Hero tile row (6 tiles).
  await expect(tabContent.locator('.metrics-grid').first().locator('.metric-tile')).toHaveCount(6);

  // Per-practice table is present and has at least 2 data rows (MAP + RAM).
  const practiceTable = page.locator('[data-testid="economics-by-practice-table"]');
  await expect(practiceTable).toBeVisible();
  await expect(practiceTable.locator('tbody tr')).toHaveCount(2);

  // Currency mix shows USD and EUR sub-tiles.
  await expect(page.locator('[data-testid="currency-tile-USD"]')).toBeVisible();
  await expect(page.locator('[data-testid="currency-tile-EUR"]')).toBeVisible();

  // 4 chart containers exist with the right IDs.
  await expect(page.locator('#economics_pricing_mix')).toBeVisible();
  await expect(page.locator('#economics_pioneer_productivity')).toBeVisible();
  await expect(page.locator('#economics_quarterly_revenue_full')).toBeVisible();
  await expect(page.locator('#economics_quarterly_productivity')).toBeVisible();
});

test('tab round-trip preserves Overview Summary card and Economics tab', async ({ page }) => {
  const api = await adminApiContext();
  await seedTwoProjects(api);

  await loginAs(page, 'admin', 'AliraAdmin2026!');
  await page.goto(`${BASE}/#portfolio`);

  // Overview Summary card is visible by default (PR2).
  await expect(page.locator('[data-testid="economics-summary-card"]')).toBeVisible({ timeout: 10000 });

  // Switch to Economics — deep view appears.
  await page.locator('.tab-bar .tab[data-tab="economics"]').click();
  await expect(page.locator('[data-testid="economics-tab-content"]')).toBeVisible();

  // Switch back to Overview — Summary card still works (re-init must have run).
  await page.locator('.tab-bar .tab[data-tab="overview"]').click();
  await expect(page.locator('[data-testid="economics-summary-card"]')).toBeVisible();

  // Switch back to Economics again to verify the deep view re-inits cleanly.
  await page.locator('.tab-bar .tab[data-tab="economics"]').click();
  await expect(page.locator('[data-testid="economics-tab-content"]')).toBeVisible();
  await expect(page.locator('#economics_pricing_mix')).toBeVisible();
});

test('viewer sees Economics tab content (read-only role)', async ({ page }) => {
  const api = await adminApiContext();
  await seedTwoProjects(api);

  await loginAs(page, 'viewer', 'AliraView2026!');
  await page.goto(`${BASE}/#portfolio`);
  await page.locator('.tab-bar .tab[data-tab="economics"]').click();
  await expect(page.locator('[data-testid="economics-tab-content"]')).toBeVisible({ timeout: 10000 });
  await expect(page.locator('[data-testid="economics-by-practice-table"]')).toBeVisible();
});
