import { test, expect, Page } from '@playwright/test';

/**
 * Realistic E2E test: creates 20 projects across categories with varied
 * expert survey responses, then runs full QA/QC on dashboard, metrics,
 * norms, scaling gates, and project detail views.
 */

const BASE = 'http://localhost:8077';
const jsErrors: string[] = [];

// ── 20 realistic projects ──────────────────────────────────────────────
const PROJECTS = [
  // High performers (xCSG clearly better)
  { name: 'Oncology CDD — BioGenix',       cat: 1,  pioneer: 'Dr. Sarah Chen',    client: 'BioGenix',         stage: 'Active engagement',             pulse: 'Exceeded expectations', team: '2', revisions: '1', legDays: '8', legTeam: '3',  legRevs: '3',  profile: 'strong' },
  { name: 'NASH Market Access Strategy',    cat: 5,  pioneer: 'Dr. Sarah Chen',    client: 'Vertex Pharma',    stage: 'Active engagement',             pulse: 'Exceeded expectations', team: '2', revisions: '0', legDays: '15', legTeam: '5', legRevs: '4', profile: 'strong' },
  { name: 'Gene Therapy Pricing Model',     cat: 4,  pioneer: 'Dr. Marco Rivera',  client: 'Novaris Bio',      stage: 'Active engagement',             pulse: 'Exceeded expectations', team: '3', revisions: '1', legDays: '15', legTeam: '5', legRevs: '3',  profile: 'strong' },
  { name: 'Rare Disease Landscape',         cat: 7,  pioneer: 'Dr. Anika Patel',   client: 'Orphan Therapeutics', stage: 'New business (pre-mandate)',  pulse: 'Exceeded expectations', team: '1', revisions: '0', legDays: '8', legTeam: '2',  legRevs: '2',  profile: 'strong' },
  { name: 'ADC Pipeline Competitive Intel', cat: 7,  pioneer: 'Dr. Sarah Chen',    client: 'AbbVie',           stage: 'Active engagement',             pulse: 'Exceeded expectations', team: '2', revisions: '1', legDays: '8', legTeam: '3',  legRevs: '3',  profile: 'strong' },

  // Good performers (solid advantage)
  { name: 'Cardio CDD — HeartFirst',        cat: 1,  pioneer: 'Dr. Marco Rivera',  client: 'HeartFirst',       stage: 'Active engagement',             pulse: 'Met expectations',      team: '2', revisions: '1', legDays: '8', legTeam: '3',  legRevs: '2',  profile: 'good' },
  { name: 'Obesity Market Research',         cat: 10, pioneer: 'Dr. Anika Patel',   client: 'GLP Sciences',     stage: 'Active engagement',             pulse: 'Exceeded expectations', team: '2', revisions: '1', legDays: '8', legTeam: '3',  legRevs: '3',  profile: 'good' },
  { name: 'Immuno-Oncology HEOR',           cat: 8,  pioneer: 'Dr. James Okoro',   client: 'MedImmune',        stage: 'Active engagement',             pulse: 'Met expectations',      team: '3', revisions: '2', legDays: '15', legTeam: '5', legRevs: '4', profile: 'good' },
  { name: 'Biosimilar Reg Strategy',        cat: 11, pioneer: 'Dr. Marco Rivera',  client: 'Sandoz',           stage: 'Active engagement',             pulse: 'Exceeded expectations', team: '2', revisions: '1', legDays: '8', legTeam: '3',  legRevs: '2',  profile: 'good' },
  { name: 'CNS Portfolio Assessment',       cat: 3,  pioneer: 'Dr. Anika Patel',   client: 'NeuroVida',        stage: 'Post-engagement (follow-on)',   pulse: 'Met expectations',      team: '2', revisions: '1', legDays: '8', legTeam: '3',  legRevs: '2',  profile: 'good' },

  // Average performers (marginal or parity)
  { name: 'Diabetes New Product Strategy',  cat: 6,  pioneer: 'Dr. James Okoro',   client: 'InsuTech',         stage: 'New business (pre-mandate)',    pulse: 'Met expectations',      team: '3', revisions: '2', legDays: '8', legTeam: '3',  legRevs: '2',  profile: 'average' },
  { name: 'Autoimmune CDD — ImmunoRx',      cat: 1,  pioneer: 'Dr. Li Wei',        client: 'ImmunoRx',         stage: 'Active engagement',             pulse: 'Met expectations',      team: '2', revisions: '2', legDays: '5', legTeam: '2',  legRevs: '2',  profile: 'average' },
  { name: 'Ophthalmology Strategic Plan',   cat: 2,  pioneer: 'Dr. James Okoro',   client: 'VisionCorp',       stage: 'Active engagement',             pulse: 'Met expectations',      team: '3', revisions: '2', legDays: '8', legTeam: '3',  legRevs: '3',  profile: 'average' },
  { name: 'Respiratory Market Access',      cat: 5,  pioneer: 'Dr. Li Wei',        client: 'AirWay Bio',       stage: 'Post-engagement (follow-on)',   pulse: 'Met expectations',      team: '2', revisions: '2', legDays: '5', legTeam: '3',  legRevs: '2',  profile: 'average' },
  { name: 'Dermatology Transaction Advisory', cat: 9, pioneer: 'Dr. Anika Patel',  client: 'DermaCo',          stage: 'New business (pre-mandate)',    pulse: 'Met expectations',      team: '2', revisions: '1', legDays: '5', legTeam: '2',  legRevs: '2',  profile: 'average' },

  // Below-average performers (xCSG weak or parity)
  { name: 'Hepatology CDD — LiverGen',      cat: 1,  pioneer: 'Dr. Li Wei',        client: 'LiverGen',         stage: 'Active engagement',             pulse: 'Below expectations',    team: '3', revisions: '3', legDays: '5', legTeam: '3',  legRevs: '2',  profile: 'weak' },
  { name: 'Hematology Pricing Review',      cat: 4,  pioneer: 'Dr. James Okoro',   client: 'BloodTech',        stage: 'Active engagement',             pulse: 'Met expectations',      team: '3', revisions: '3', legDays: '5', legTeam: '2',  legRevs: '2',  profile: 'weak' },
  { name: 'Neurology Market Research',      cat: 10, pioneer: 'Dr. Li Wei',        client: 'BrainWave',        stage: 'Active engagement',             pulse: 'Below expectations',    team: '2', revisions: '3', legDays: '5', legTeam: '2',  legRevs: '2',  profile: 'weak' },

  // Mixed / edge cases
  { name: 'Pediatric HEOR Study',           cat: 8,  pioneer: 'Dr. Sarah Chen',    client: 'KidHealth',        stage: 'New business (pre-mandate)',    pulse: 'Exceeded expectations', team: '3', revisions: '2', legDays: '15', legTeam: '5', legRevs: '4', profile: 'good' },
  { name: 'Women\'s Health CDD',            cat: 1,  pioneer: 'Dr. Anika Patel',   client: 'FemBio',           stage: 'Post-engagement (follow-on)',   pulse: 'Exceeded expectations', team: '1', revisions: '0', legDays: '8', legTeam: '2',  legRevs: '2',  profile: 'strong' },
];

// Survey answer profiles — maps profile name → option index per section
// Index is 0-based into the options array (0 = best, last = worst for most fields)
type Profile = { [key: string]: number };
const PROFILES: { [name: string]: Profile } = {
  strong: {
    b1_starting_point: 0, b2_research_sources: 3, b3_assembly_ratio: 0, b4_hypothesis_first: 0,
    b5_ai_survival: 0, b6_data_analysis_split: 0,
    c1_specialization: 0, c2_directness: 0, c3_judgment_pct: 0,
    c6_self_assessment: 0, c7_analytical_depth: 0, c8_decision_readiness: 0,
    d1_proprietary_data: 0, d2_knowledge_reuse: 0, d3_moat_test: 0,
    e1_client_decision: 0, f1_feasibility: 0, f2_productization: 0, g1_reuse_intent: 0,
    // Legacy: weaker than xCSG
    l1_legacy_working_days: 18, l2_legacy_team_size: 2, l3_legacy_revision_depth: 2,
    l4_legacy_scope_expansion: 1, l5_legacy_client_reaction: 1,
    l6_legacy_b2_sources: 0, l7_legacy_c1_specialization: 1, l8_legacy_c2_directness: 2,
    l9_legacy_c3_judgment: 2, l10_legacy_d1_proprietary: 1, l11_legacy_d2_reuse: 2,
    l12_legacy_d3_moat: 2, l13_legacy_c7_depth: 2, l14_legacy_c8_decision: 2,
    l15_legacy_e1_decision: 2, l16_legacy_b6_data: 3,
  },
  good: {
    b1_starting_point: 0, b2_research_sources: 2, b3_assembly_ratio: 1, b4_hypothesis_first: 0,
    b5_ai_survival: 1, b6_data_analysis_split: 1,
    c1_specialization: 0, c2_directness: 0, c3_judgment_pct: 1,
    c6_self_assessment: 1, c7_analytical_depth: 1, c8_decision_readiness: 0,
    d1_proprietary_data: 0, d2_knowledge_reuse: 0, d3_moat_test: 1,
    e1_client_decision: 0, f1_feasibility: 0, f2_productization: 1, g1_reuse_intent: 0,
    l1_legacy_working_days: 14, l2_legacy_team_size: 2, l3_legacy_revision_depth: 2,
    l4_legacy_scope_expansion: 1, l5_legacy_client_reaction: 1,
    l6_legacy_b2_sources: 0, l7_legacy_c1_specialization: 1, l8_legacy_c2_directness: 1,
    l9_legacy_c3_judgment: 1, l10_legacy_d1_proprietary: 1, l11_legacy_d2_reuse: 1,
    l12_legacy_d3_moat: 1, l13_legacy_c7_depth: 1, l14_legacy_c8_decision: 1,
    l15_legacy_e1_decision: 1, l16_legacy_b6_data: 2,
  },
  average: {
    b1_starting_point: 1, b2_research_sources: 1, b3_assembly_ratio: 1, b4_hypothesis_first: 1,
    b5_ai_survival: 2, b6_data_analysis_split: 2,
    c1_specialization: 1, c2_directness: 1, c3_judgment_pct: 1,
    c6_self_assessment: 2, c7_analytical_depth: 2, c8_decision_readiness: 1,
    d1_proprietary_data: 0, d2_knowledge_reuse: 1, d3_moat_test: 1,
    e1_client_decision: 1, f1_feasibility: 2, f2_productization: 1, g1_reuse_intent: 1,
    l1_legacy_working_days: 10, l2_legacy_team_size: 1, l3_legacy_revision_depth: 1,
    l4_legacy_scope_expansion: 1, l5_legacy_client_reaction: 1,
    l6_legacy_b2_sources: 1, l7_legacy_c1_specialization: 1, l8_legacy_c2_directness: 1,
    l9_legacy_c3_judgment: 1, l10_legacy_d1_proprietary: 1, l11_legacy_d2_reuse: 1,
    l12_legacy_d3_moat: 1, l13_legacy_c7_depth: 2, l14_legacy_c8_decision: 1,
    l15_legacy_e1_decision: 2, l16_legacy_b6_data: 1,
  },
  weak: {
    b1_starting_point: 2, b2_research_sources: 0, b3_assembly_ratio: 2, b4_hypothesis_first: 2,
    b5_ai_survival: 3, b6_data_analysis_split: 2,
    c1_specialization: 1, c2_directness: 2, c3_judgment_pct: 2,
    c6_self_assessment: 3, c7_analytical_depth: 2, c8_decision_readiness: 2,
    d1_proprietary_data: 1, d2_knowledge_reuse: 2, d3_moat_test: 2,
    e1_client_decision: 3, f1_feasibility: 3, f2_productization: 2, g1_reuse_intent: 2,
    l1_legacy_working_days: 7, l2_legacy_team_size: 1, l3_legacy_revision_depth: 1,
    l4_legacy_scope_expansion: 1, l5_legacy_client_reaction: 1,
    l6_legacy_b2_sources: 1, l7_legacy_c1_specialization: 0, l8_legacy_c2_directness: 0,
    l9_legacy_c3_judgment: 0, l10_legacy_d1_proprietary: 0, l11_legacy_d2_reuse: 0,
    l12_legacy_d3_moat: 0, l13_legacy_c7_depth: 1, l14_legacy_c8_decision: 0,
    l15_legacy_e1_decision: 0, l16_legacy_b6_data: 0,
  },
};

// Date generator: projects spread over last 6 months
function projectDates(idx: number): { start: string; end: string } {
  const base = new Date('2025-10-15');
  base.setDate(base.getDate() + idx * 9); // ~9 days apart
  const end = new Date(base);
  end.setDate(end.getDate() + 5 + Math.floor(idx % 5) * 3);
  return {
    start: base.toISOString().slice(0, 10),
    end: end.toISOString().slice(0, 10),
  };
}

test.describe.serial('Realistic 20-project E2E + QA/QC', () => {
  let page: Page;
  const tokens: string[] = [];

  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    page.on('pageerror', (err) => jsErrors.push(err.message));
    page.on('console', (msg) => {
      if (msg.type() === 'error') jsErrors.push(`Console: ${msg.text()}`);
    });
  });

  test.afterAll(async () => { await page.close(); });

  // ─── LOGIN ─────────────────────────────────────────────────────────────
  test('Login', async () => {
    await page.goto(BASE);
    await page.waitForLoadState('networkidle');
    await page.fill('#loginUsername', 'admin');
    await page.fill('#loginPassword', 'AliraAdmin2026!');
    await page.click('#loginBtn');
    await expect(page.locator('#appShell')).toBeVisible({ timeout: 10000 });
  });

  // ─── CREATE 20 PROJECTS ────────────────────────────────────────────────
  test('Create 20 realistic projects', { timeout: 120_000 }, async () => {
    for (let i = 0; i < PROJECTS.length; i++) {
      const p = PROJECTS[i];
      const dates = projectDates(i);

      await page.goto(BASE + '/#new');
      await expect(page.locator('#projectForm')).toBeVisible({ timeout: 10000 });

      await page.fill('#fName', p.name);
      await page.selectOption('#fCategory', String(p.cat));
      // Category change auto-populates #fPractice (each seeded category has one
      // allowed practice; the form auto-selects it when only one is valid).

      // Pioneer assignment is a separate sub-form now — fill the first
      // pioneer row that renderNewProject() pre-creates.
      const firstPioneerRow = page.locator('#pioneersContainer .pioneer-row').first();
      await firstPioneerRow.locator('.pioneer-name').fill(p.pioneer);

      await page.fill('#fClient', p.client);
      await page.selectOption('#fStage', p.stage);
      await page.selectOption('#fPulse', p.pulse);

      await page.fill('#fDateStart', dates.start);
      await page.fill('#fDateEnd', dates.end);

      await page.fill('#fXTeam', p.team);
      await page.fill('#fRevisions', p.revisions);

      await page.fill('#fLDays', p.legDays);
      await page.fill('#fLTeam', p.legTeam);
      await page.fill('#fLRevisions', p.legRevs);

      await page.click('#projectForm button[type="submit"]');
      await expect(page.locator('.modal-overlay.active')).toBeVisible({ timeout: 8000 });

      // Extract expert token
      const expertLink = await page.locator('#expertLinkInput').inputValue();
      const match = expertLink.match(/#(?:expert|assess)\/(.+)$/);
      expect(match).not.toBeNull();
      tokens.push(match![1]);

      await page.click('.modal-card .btn-secondary');
      await page.waitForTimeout(300);
    }

    expect(tokens.length).toBe(20);
    console.log(`✓ Created ${tokens.length} projects`);
  });

  // ─── SUBMIT 20 EXPERT SURVEYS ──────────────────────────────────────────
  test('Submit 20 expert surveys with varied profiles', { timeout: 600_000 }, async () => {
    for (let i = 0; i < tokens.length; i++) {
      const profile = PROFILES[PROJECTS[i].profile];

      // Navigate to expert form — use full page load to avoid stale state
      await page.goto(BASE + '/#assess/' + tokens[i]);
      await page.waitForLoadState('domcontentloaded');

      // Wait for expert form to load
      await expect(page.locator('.context-title')).toBeVisible({ timeout: 20000 });

      // Get all section headers
      const sections = await page.locator('.accordion-header[data-section]').evaluateAll(
        els => els.map(el => el.getAttribute('data-section'))
      );

      for (const sec of sections) {
        // Open the accordion section
        await page.click(`.accordion-header[data-section="${sec}"]`);
        await page.waitForTimeout(200);

        // Get all fields in this section
        const fields = await page.locator(`.accordion-field[data-section="${sec}"]`).evaluateAll(
          els => els.map(el => ({
            key: el.getAttribute('data-key')!,
            tag: el.tagName,
          }))
        );

        for (const f of fields) {
          const sel = page.locator(`.accordion-field[data-key="${f.key}"]`);
          await sel.scrollIntoViewIfNeeded({ timeout: 5000 });

          if (f.tag === 'SELECT') {
            const optIdx = profile[f.key] ?? 0;
            await sel.selectOption({ index: optIdx + 1 });
          } else {
            const numVal = profile[f.key] ?? 10;
            await sel.fill(String(numVal));
            await sel.evaluate(el => el.dispatchEvent(new Event('input', { bubbles: true })));
          }
          await page.waitForTimeout(20);
        }
      }

      // Submit
      await page.waitForTimeout(300);
      const btn = page.locator('#expertSubmitBtn');
      const disabled = await btn.isDisabled();
      if (disabled) {
        const empty = await page.evaluate(() => {
          const e: string[] = [];
          document.querySelectorAll('.accordion-field').forEach((el: any) => {
            if (!el.value || el.value === '') e.push(el.getAttribute('data-key'));
          });
          return e;
        });
        console.log(`⚠ Project ${i}: submit disabled, empty fields: ${empty.join(', ')}`);
      }
      expect(disabled).toBe(false);

      await btn.click();
      await expect(page.locator('#expertContent h2')).toHaveText(/Thank You|Already Submitted/, { timeout: 10000 });

      if ((i + 1) % 5 === 0) console.log(`  ✓ Submitted ${i + 1}/${tokens.length} surveys`);
    }
  });

  // ─── QA: DASHBOARD LOADS WITH CHARTS ───────────────────────────────────
  test('QA: Dashboard renders with data', { timeout: 30_000 }, async () => {
    // Re-login (expert view cleared auth)
    await page.goto(BASE);
    await page.waitForLoadState('networkidle');
    if (await page.locator('#loginScreen').isVisible()) {
      await page.fill('#loginUsername', 'admin');
      await page.fill('#loginPassword', 'AliraAdmin2026!');
      await page.click('#loginBtn');
      await expect(page.locator('#appShell')).toBeVisible({ timeout: 10000 });
    }

    await page.goto(BASE + '/#portfolio');
    await page.waitForTimeout(2000);

    const mc = page.locator('#mainContent');

    // Hero section shows 20 completed
    const heroText = await mc.locator('.hero-meta').textContent();
    expect(heroText).toContain('20');

    // KPI tiles exist and have values (not all "—")
    const kpiValues = await mc.locator('.metric-tile-value').allTextContents();
    expect(kpiValues.length).toBeGreaterThanOrEqual(8);
    const realValues = kpiValues.filter(v => v.trim() !== '—');
    expect(realValues.length).toBeGreaterThanOrEqual(6);
    console.log('  KPI values:', kpiValues.join(', '));

    // Charts are rendered (ECharts creates canvas elements inside divs).
    // The dashboard is now organized into tabs (overview / trends / breakdowns /
    // signals) — only the active tab's charts are mounted as canvases. The
    // default Overview tab currently has 2 charts; across all tabs the schema
    // defines ~16 chart cards. Assert there are at least a couple rendered and
    // that explainer cards exist across tabs.
    await page.waitForTimeout(2000); // allow charts to render
    const chartCanvases = await page.locator('.chart-body canvas').count();
    console.log(`  Chart canvases rendered: ${chartCanvases}`);
    expect(chartCanvases).toBeGreaterThanOrEqual(2);

    // Explainer text exists under charts (across all tabs)
    const explainers = await mc.locator('.chart-card-explain').count();
    expect(explainers).toBeGreaterThanOrEqual(4);

    // Portfolio table + scaling gates live on the "Signals & Gates" tab in the
    // redesigned dashboard — click through to assert those still render.
    await page.locator('.tab-bar .tab', { hasText: /Signals/ }).click();
    await page.waitForTimeout(800);

    const tableRows = await mc.locator('.portfolio-table tbody tr').count();
    expect(tableRows).toBe(20);

    // Scaling gates section exists
    await expect(mc.locator('.gates-track')).toBeVisible();
    const gateCards = await mc.locator('.gate-card').count();
    expect(gateCards).toBe(7);
    const passedGates = await mc.locator('.gate-pass').count();
    console.log(`  Scaling gates passed: ${passedGates}/7`);
  });

  // ─── QA: METRICS ACCURACY ──────────────────────────────────────────────
  test('QA: Metrics are computed and varied', { timeout: 30_000 }, async () => {
    // Fetch projects via API for numeric validation
    const data = await page.evaluate(async () => {
      const token = sessionStorage.getItem('xcsg_token');
      const res = await fetch('/api/projects', { headers: { Authorization: `Bearer ${token}` } });
      return res.json();
    });

    expect(data.length).toBe(20);

    // All projects should have metrics (all have expert responses)
    const withMetrics = data.filter((p: any) => p.metrics !== null);
    expect(withMetrics.length).toBe(20);

    // Check that metrics are varied (not all identical)
    const speeds = withMetrics.map((p: any) => p.metrics.delivery_speed).filter((v: any) => v != null);
    const qualities = withMetrics.map((p: any) => p.metrics.output_quality).filter((v: any) => v != null);
    const advantages = withMetrics.map((p: any) => p.metrics.productivity_ratio).filter((v: any) => v != null);

    expect(speeds.length).toBeGreaterThanOrEqual(15);
    expect(qualities.length).toBeGreaterThanOrEqual(15);
    expect(advantages.length).toBeGreaterThanOrEqual(15);

    // Scores should NOT all be the same
    const uniqueSpeeds = new Set(speeds.map((s: number) => Math.round(s * 100)));
    const uniqueQualities = new Set(qualities.map((q: number) => Math.round(q * 100)));
    expect(uniqueSpeeds.size).toBeGreaterThan(1);
    expect(uniqueQualities.size).toBeGreaterThan(1);

    console.log(`  Speed range: ${Math.min(...speeds).toFixed(2)}x – ${Math.max(...speeds).toFixed(2)}x`);
    console.log(`  Quality range: ${Math.min(...qualities).toFixed(2)} – ${Math.max(...qualities).toFixed(2)}`);
    console.log(`  Advantage range: ${Math.min(...advantages).toFixed(2)}x – ${Math.max(...advantages).toFixed(2)}x`);

    // Strong projects should have higher quality scores than weak
    const strongNames = new Set(PROJECTS.filter(p => p.profile === 'strong').map(p => p.name));
    const weakNames = new Set(PROJECTS.filter(p => p.profile === 'weak').map(p => p.name));
    const strongQuality = data.filter((p: any) => strongNames.has(p.project_name)).map((p: any) => p.metrics?.quality_score).filter(Boolean);
    const weakQuality = data.filter((p: any) => weakNames.has(p.project_name)).map((p: any) => p.metrics?.quality_score).filter(Boolean);
    const strongQualityAvg = strongQuality.reduce((a: number, b: number) => a + b, 0) / strongQuality.length;
    const weakQualityAvg = weakQuality.reduce((a: number, b: number) => a + b, 0) / weakQuality.length;
    console.log(`  Strong avg quality: ${strongQualityAvg.toFixed(2)}, Weak avg quality: ${weakQualityAvg.toFixed(2)}`);
    expect(strongQualityAvg).toBeGreaterThan(weakQualityAvg);

    // Flywheel scores should exist
    const flywheels = withMetrics.map((p: any) => p.metrics.machine_first_score).filter((v: any) => v != null);
    expect(flywheels.length).toBeGreaterThanOrEqual(10);

    // Reuse intent scores should be varied
    const reuse = withMetrics.map((p: any) => p.metrics.reuse_intent_score).filter((v: any) => v != null);
    const uniqueReuse = new Set(reuse);
    expect(uniqueReuse.size).toBeGreaterThan(1);
    console.log(`  Reuse intent unique values: ${[...uniqueReuse].join(', ')}`);
  });

  // ─── QA: DASHBOARD METRICS API ─────────────────────────────────────────
  test('QA: Dashboard metrics API returns valid aggregates', async () => {
    const dashboard = await page.evaluate(async () => {
      const token = sessionStorage.getItem('xcsg_token');
      const res = await fetch('/api/dashboard/metrics', { headers: { Authorization: `Bearer ${token}` } });
      return res.json();
    });

    expect(dashboard.complete_projects).toBe(20);
    expect(dashboard.total_projects).toBe(20);

    // Aggregates should be non-zero
    expect(dashboard.average_effort_ratio).toBeGreaterThan(0);
    expect(dashboard.average_quality_score).toBeGreaterThan(0);
    expect(dashboard.average_advantage || dashboard.average_outcome_rate_ratio).toBeGreaterThan(0);

    // Flywheel averages
    expect(dashboard.machine_first_avg).toBeGreaterThan(0);
    expect(dashboard.senior_led_avg).toBeGreaterThan(0);
    expect(dashboard.proprietary_knowledge_avg).toBeGreaterThan(0);

    // Signal metrics
    expect(dashboard.reuse_intent_avg).toBeGreaterThan(0);
    expect(dashboard.client_pulse_avg).toBeGreaterThan(0);

    // Scaling gates
    expect(dashboard.scaling_gates).toBeDefined();
    expect(dashboard.scaling_gates.length).toBe(7);

    console.log('  Dashboard aggregates:');
    console.log(`    Effort ratio: ${dashboard.average_effort_ratio}`);
    console.log(`    Quality: ${dashboard.average_quality_score}`);
    console.log(`    Advantage: ${dashboard.average_advantage || dashboard.average_outcome_rate_ratio}`);
    console.log(`    Flywheel: MF=${dashboard.machine_first_avg} SL=${dashboard.senior_led_avg} PK=${dashboard.proprietary_knowledge_avg}`);
    console.log(`    Reuse intent: ${dashboard.reuse_intent_avg}, Client pulse: ${dashboard.client_pulse_avg}`);

    const passed = dashboard.scaling_gates.filter((g: any) => g.status === 'pass').length;
    console.log(`    Scaling gates: ${passed}/7 passed`);
    for (const g of dashboard.scaling_gates) {
      console.log(`      ${g.status === 'pass' ? '✓' : '✗'} ${g.name}: ${g.detail}`);
    }
  });

  // ─── QA: NORMS TAB ─────────────────────────────────────────────────────
  test('QA: Norms tab renders with computed metrics', { timeout: 15_000 }, async () => {
    await page.goto(BASE + '/#norms');
    await page.waitForTimeout(2000);

    const mc = page.locator('#mainContent');
    await expect(mc.locator('table')).toBeVisible({ timeout: 8000 });

    // Table should have rows with real data
    const rows = await mc.locator('.data-table tbody tr').count();
    expect(rows).toBeGreaterThan(0);
    console.log(`  Norms table rows: ${rows}`);

    // Check that at least some cells have numeric values (not all "—")
    const cells = await mc.locator('.data-table tbody td').allTextContents();
    const numericCells = cells.filter(c => /\d/.test(c));
    expect(numericCells.length).toBeGreaterThan(5);

    // Verify via API
    const normsData = await page.evaluate(async () => {
      const token = sessionStorage.getItem('xcsg_token');
      const res = await fetch('/api/norms/aggregates', { headers: { Authorization: `Bearer ${token}` } });
      return res.json();
    });

    expect(normsData.length).toBeGreaterThan(0);
    for (const row of normsData) {
      expect(row.category_name).toBeTruthy();
      expect(row.completed_surveys).toBeGreaterThan(0);
      if (row.avg_effort_ratio != null) {
        expect(row.avg_effort_ratio).toBeGreaterThan(0);
      }
      console.log(`  ${row.category_name}: speed=${row.avg_effort_ratio}x quality=${row.avg_quality_ratio}x productivity=${row.avg_productivity}x (${row.completed_surveys} surveys)`);
    }
  });

  // ─── QA: PROJECT DETAIL WITH EXPERT ASSESSMENT ─────────────────────────
  test('QA: Project detail shows expert assessment', { timeout: 30_000 }, async () => {
    // Navigate directly to first project edit view
    await page.goto(BASE + '/#edit/1');
    await page.waitForTimeout(3000);

    const mc = page.locator('#mainContent');

    // Should show the edit form with the pioneer rounds table
    await expect(mc.locator('#projectForm')).toBeVisible();
    await expect(mc.locator('.pioneer-rounds-table')).toBeVisible();

    // The expert assessment banner is no longer inlined on the edit view; it
    // opens in a modal when the completed-round chip (R1 ✓) is clicked.
    const doneChip = mc.locator('.round-chip-clickable').first();
    await expect(doneChip).toBeVisible({ timeout: 5000 });
    await doneChip.click();

    const modal = page.locator('.modal-overlay.active');
    await expect(modal).toBeVisible({ timeout: 5000 });
    await expect(modal.locator('.assessment-overall-banner')).toBeVisible({ timeout: 5000 });

    const assessmentText = (await modal.textContent()) || '';
    expect(assessmentText).toContain('xCSG Score');
    expect(assessmentText).toContain('Effort Ratio');
    expect(assessmentText).toContain('Quality Score');

    // Section cards should be present in the modal
    const sectionCards = await modal.locator('.assessment-section-card').count();
    expect(sectionCards).toBeGreaterThanOrEqual(3); // B, C, D at minimum
    console.log(`  Assessment section cards: ${sectionCards}`);

    // Close the modal so it doesn't interfere with subsequent tests
    const closeBtn = modal.locator('button', { hasText: 'Close' }).first();
    if (await closeBtn.isVisible()) await closeBtn.click();
  });

  // ─── QA: FILTER / SLICER WORKS ─────────────────────────────────────────
  test('QA: Dashboard category filter works', { timeout: 15_000 }, async () => {
    await page.goto(BASE + '/#portfolio');
    await page.waitForTimeout(2000);

    // Click a category chip (CDD should have 5 projects)
    const cddChip = page.locator('.filter-chip', { hasText: 'CDD' });
    if (await cddChip.isVisible()) {
      await cddChip.click();
      await page.waitForTimeout(1000);

      // Table should now show fewer rows
      const rows = await page.locator('.portfolio-table tbody tr').count();
      expect(rows).toBeLessThan(20);
      expect(rows).toBeGreaterThan(0);
      console.log(`  CDD filter: ${rows} rows`);

      // Click All to reset
      await page.locator('.filter-chip', { hasText: 'All' }).click();
      await page.waitForTimeout(1000);
      const allRows = await page.locator('.portfolio-table tbody tr').count();
      expect(allRows).toBe(20);
    }
  });

  // ─── QA: ALL ROUTES RENDER ─────────────────────────────────────────────
  test('QA: All navigation routes render without errors', { timeout: 20_000 }, async () => {
    const routes = ['#portfolio', '#projects', '#norms', '#settings', '#activity'];
    for (const hash of routes) {
      await page.evaluate((h) => { window.location.hash = h; }, hash);
      await page.waitForTimeout(1500);
      const content = await page.locator('#mainContent').textContent();
      expect((content || '').trim().length).toBeGreaterThan(0);
      console.log(`  ✓ ${hash} rendered (${content!.length} chars)`);
    }
  });

  // ─── QA: JS ERROR CHECK ────────────────────────────────────────────────
  test('QA: No JavaScript errors during entire run', async () => {
    const realErrors = jsErrors.filter(e =>
      !e.includes('422') && !e.includes('favicon') && !e.includes('404')
    );
    if (realErrors.length > 0) {
      console.log('⚠️ JS Errors:', realErrors);
    }
    expect(realErrors.length).toBe(0);
  });
});
