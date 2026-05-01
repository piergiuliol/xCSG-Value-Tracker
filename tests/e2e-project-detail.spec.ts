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
  for (const p of projs) await api.delete(`/api/projects/${p.id}`);
  const pioneers = await (await api.get('/api/pioneers')).json();
  for (const p of pioneers) {
    if ((p.email || '').startsWith('e2e-pdv-')) await api.delete(`/api/pioneers/${p.id}`);
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

async function seedProject(api) {
  const cats = await (await api.get('/api/categories')).json();
  const practices = await (await api.get('/api/practices')).json();
  const pmap: Record<string, number> = {};
  practices.forEach((p: any) => { pmap[p.code] = p.id; });
  const mapCat = cats.find((c: any) => (c.practices || []).some((p: any) => p.code === 'MAP'));
  if (!mapCat) throw new Error('No MAP-eligible category');

  const body = {
    project_name: 'E2E Project Detail Test',
    category_id: mapCat.id, practice_id: pmap['MAP'],
    engagement_revenue: 100000, currency: 'USD', xcsg_pricing_model: 'Fixed fee',
    date_started: '2026-01-15', date_delivered: '2026-02-10',
    working_days: 10, xcsg_team_size: '2', xcsg_revision_rounds: '1',
    engagement_stage: 'Active engagement',
    pioneers: [{ first_name: 'E2E', last_name: 'PdvPioneer', email: 'e2e-pdv-1@example.com', total_rounds: 1 }],
    legacy_team: [{ role_name: 'Senior', count: 2, day_rate: 1500 }],
  };
  const r = await api.post('/api/projects', { data: body });
  if (r.status() !== 201) throw new Error(`create failed: ${r.status()} ${await r.text()}`);
  const proj = await r.json();
  const tok = proj.pioneers[0].expert_token;
  const sr = await api.post(`/api/expert/${tok}`, { data: STRONG });
  if (sr.status() !== 201) throw new Error(`survey failed: ${sr.status()} ${await sr.text()}`);
  return proj.id;
}

test.beforeEach(async () => {
  const api = await adminApiContext();
  await wipeProjects(api);
});

test('admin sees project detail page populated', async ({ page }) => {
  const api = await adminApiContext();
  const projectId = await seedProject(api);

  await loginAs(page, 'admin', 'AliraAdmin2026!');
  await page.goto(`${BASE}/#project/${projectId}`);

  // Detail container is rendered.
  const detail = page.locator('[data-testid="project-detail"]');
  await expect(detail).toBeVisible({ timeout: 10000 });

  // Header shows project name.
  await expect(detail.locator('h1')).toContainText('E2E Project Detail Test');

  // Edit button visible for admin.
  await expect(page.locator('[data-testid="project-detail-edit"]')).toBeVisible();

  // 5 performance chips render in the header Performance section.
  const chips = page.locator('[data-testid="project-performance-chips"] .assessment-metric-chip');
  await expect(chips).toHaveCount(5);

  // Spec + Pioneers cards present.
  await expect(page.locator('[data-testid="project-spec-card"]')).toBeVisible();
  await expect(page.locator('[data-testid="project-pioneers-card"]')).toBeVisible();

  // Economics + Legacy Team cards present.
  await expect(page.locator('.economics-card').first()).toBeVisible();
  await expect(page.locator('[data-testid="project-legacy-team-card"]')).toBeVisible();

  // Expert Responses card with one row.
  const responses = page.locator('[data-testid="project-responses-card"]');
  await expect(responses).toBeVisible();
  await expect(responses.locator('tbody tr')).toHaveCount(1);

  // 2 charts (Radar + Disprove) — Timeline only on multi-round.
  await expect(page.locator('[data-testid="project-chart-radar"]')).toBeVisible();
  await expect(page.locator('[data-testid="project-chart-disprove"]')).toBeVisible();
});

test('click-through from #projects routes to #project/{id}', async ({ page }) => {
  const api = await adminApiContext();
  const projectId = await seedProject(api);

  await loginAs(page, 'admin', 'AliraAdmin2026!');
  await page.goto(`${BASE}/#projects`);

  // Entire row is clickable (cursor:pointer + onclick on the <tr>).
  const row = page.locator('table#projectTable tbody tr').filter({ hasText: 'E2E Project Detail Test' });
  await expect(row).toBeVisible({ timeout: 10000 });
  await row.click();

  await expect(page).toHaveURL(new RegExp(`#project/${projectId}$`));
  await expect(page.locator('[data-testid="project-detail"]')).toBeVisible();
});

test('viewer can view detail but cannot see Edit button', async ({ page }) => {
  const api = await adminApiContext();
  const projectId = await seedProject(api);

  await loginAs(page, 'viewer', 'AliraView2026!');
  await page.goto(`${BASE}/#project/${projectId}`);

  await expect(page.locator('[data-testid="project-detail"]')).toBeVisible({ timeout: 10000 });
  await expect(page.locator('[data-testid="project-detail-edit"]')).toHaveCount(0);
});
