import { test, expect, Page } from '@playwright/test';

/**
 * Multi-Pioneer E2E test: creates 5 projects with varied pioneer configs
 * totalling 20 expert survey submissions, then validates dashboard,
 * monitoring, and project detail views.
 */

const BASE = 'http://localhost:8077';
const jsErrors: string[] = [];

// ── Survey answer profiles (exact option strings from schema.py) ──────────

interface SurveyPayload {
  b1_starting_point: string;
  b2_research_sources: string;
  b3_assembly_ratio: string;
  b4_hypothesis_first: string;
  b5_ai_survival: string;
  b6_data_analysis_split: string;
  c1_specialization: string;
  c2_directness: string;
  c3_judgment_pct: string;
  c6_self_assessment: string;
  c7_analytical_depth: string;
  c8_decision_readiness: string;
  d1_proprietary_data: string;
  d2_knowledge_reuse: string;
  d3_moat_test: string;
  e1_client_decision: string;
  f1_feasibility: string;
  f2_productization: string;
  g1_reuse_intent: string;
  l1_legacy_working_days: number;
  l2_legacy_team_size: string;
  l3_legacy_revision_depth: string;
  l4_legacy_scope_expansion: string;
  l5_legacy_client_reaction: string;
  l6_legacy_b2_sources: string;
  l7_legacy_c1_specialization: string;
  l8_legacy_c2_directness: string;
  l9_legacy_c3_judgment: string;
  l10_legacy_d1_proprietary: string;
  l11_legacy_d2_reuse: string;
  l12_legacy_d3_moat: string;
  l13_legacy_c7_depth: string;
  l14_legacy_c8_decision: string;
  l15_legacy_e1_decision: string;
  l16_legacy_b6_data: string;
}

const STRONG: SurveyPayload = {
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
  d3_moat_test: 'No \u2014 proprietary inputs decisive',
  e1_client_decision: 'Yes \u2014 informed a specific decision',
  f1_feasibility: 'Not feasible',
  f2_productization: 'Yes largely as-is',
  g1_reuse_intent: 'Yes without hesitation',
  l1_legacy_working_days: 15,
  l2_legacy_team_size: '3',
  l3_legacy_revision_depth: 'Major rework',
  l4_legacy_scope_expansion: 'No',
  l5_legacy_client_reaction: 'Met expectations',
  l6_legacy_b2_sources: 'A few targeted sources (2-4)',
  l7_legacy_c1_specialization: 'Generalist',
  l8_legacy_c2_directness: 'Expert reviewed only',
  l9_legacy_c3_judgment: '<25%',
  l10_legacy_d1_proprietary: 'No',
  l11_legacy_d2_reuse: 'No built from scratch',
  l12_legacy_d3_moat: 'Yes \u2014 all inputs publicly available',
  l13_legacy_c7_depth: 'Adequate',
  l14_legacy_c8_decision: 'Needs significant additional work',
  l15_legacy_e1_decision: 'No',
  l16_legacy_b6_data: '>75% on data',
};

const MODERATE: SurveyPayload = {
  b1_starting_point: 'Mixed',
  b2_research_sources: 'Multiple sources across domains (5-10)',
  b3_assembly_ratio: '50-75%',
  b4_hypothesis_first: 'Hybrid',
  b5_ai_survival: '50-75%',
  b6_data_analysis_split: '25-50%',
  c1_specialization: 'Adjacent expertise',
  c2_directness: 'Expert co-authored',
  c3_judgment_pct: '50-75%',
  c6_self_assessment: 'Somewhat better',
  c7_analytical_depth: 'Strong',
  c8_decision_readiness: 'Yes with minor caveats',
  d1_proprietary_data: 'Yes',
  d2_knowledge_reuse: 'Yes provided useful starting context',
  d3_moat_test: 'Partially \u2014 they would miss key insights',
  e1_client_decision: 'Yes \u2014 referenced in internal discussions',
  f1_feasibility: 'Feasible but at 2x+ the cost and time',
  f2_productization: 'Yes with moderate customization',
  g1_reuse_intent: 'Yes with reservations',
  l1_legacy_working_days: 10,
  l2_legacy_team_size: '2',
  l3_legacy_revision_depth: 'Moderate rework',
  l4_legacy_scope_expansion: 'No',
  l5_legacy_client_reaction: 'Met expectations',
  l6_legacy_b2_sources: 'A few targeted sources (2-4)',
  l7_legacy_c1_specialization: 'Adjacent expertise',
  l8_legacy_c2_directness: 'Expert co-authored',
  l9_legacy_c3_judgment: '25-50%',
  l10_legacy_d1_proprietary: 'No',
  l11_legacy_d2_reuse: 'No built from scratch',
  l12_legacy_d3_moat: 'Partially \u2014 they would miss key insights',
  l13_legacy_c7_depth: 'Strong',
  l14_legacy_c8_decision: 'Yes with minor caveats',
  l15_legacy_e1_decision: 'Yes \u2014 referenced in internal discussions',
  l16_legacy_b6_data: '50-75%',
};

const WEAK: SurveyPayload = {
  b1_starting_point: 'From blank page',
  b2_research_sources: 'A few targeted sources (2-4)',
  b3_assembly_ratio: '<25%',
  b4_hypothesis_first: 'Discovery-first',
  b5_ai_survival: '<25%',
  b6_data_analysis_split: '>75% on data',
  c1_specialization: 'Generalist',
  c2_directness: 'Expert reviewed only',
  c3_judgment_pct: '<25%',
  c6_self_assessment: 'Comparable',
  c7_analytical_depth: 'Adequate',
  c8_decision_readiness: 'Needs significant additional work',
  d1_proprietary_data: 'No',
  d2_knowledge_reuse: 'No built from scratch',
  d3_moat_test: 'Yes \u2014 all inputs publicly available',
  e1_client_decision: 'No',
  f1_feasibility: 'Feasible at similar cost',
  f2_productization: 'No fully bespoke',
  g1_reuse_intent: 'No \u2014 legacy would have been better',
  l1_legacy_working_days: 8,
  l2_legacy_team_size: '2',
  l3_legacy_revision_depth: 'Cosmetic only',
  l4_legacy_scope_expansion: 'No',
  l5_legacy_client_reaction: 'Met expectations',
  l6_legacy_b2_sources: 'Multiple sources across domains (5-10)',
  l7_legacy_c1_specialization: 'Deep specialist',
  l8_legacy_c2_directness: 'Expert authored',
  l9_legacy_c3_judgment: '>75% judgment',
  l10_legacy_d1_proprietary: 'Yes',
  l11_legacy_d2_reuse: 'Yes directly reused and extended',
  l12_legacy_d3_moat: 'No \u2014 proprietary inputs decisive',
  l13_legacy_c7_depth: 'Exceptional',
  l14_legacy_c8_decision: 'Yes without caveats',
  l15_legacy_e1_decision: 'Yes \u2014 informed a specific decision',
  l16_legacy_b6_data: '<25% on data',
};

// Cycle profiles for variety
const PROFILES = [STRONG, MODERATE, WEAK];

// ── Project definitions ──────────────────────────────────────────────────────

interface PioneerDef {
  name: string;
  email: string;
}

interface ProjectDef {
  name: string;
  categoryId: number;     // 1=Landscape, 2=Competitive Intel, 3=Regulatory, 4=Drug Pricing, 5=Market Access
  client: string;
  stage: string;
  pulse: string;
  team: string;
  revisions: string;
  legDays: string;
  legTeam: string;
  legRevs: string;
  pioneers: PioneerDef[];
  defaultRounds: number;
  showPrevious: boolean;
}

const PROJECTS: ProjectDef[] = [
  {
    // Project 1: 4 pioneers x 1 round = 4 surveys
    name: 'Market Landscape Analysis',
    categoryId: 1,
    client: 'Novartis',
    stage: 'Active engagement',
    pulse: 'Exceeded expectations',
    team: '3',
    revisions: '1',
    legDays: '12',
    legTeam: '4',
    legRevs: '3',
    pioneers: [
      { name: 'Alice Chen', email: 'alice@test.com' },
      { name: 'Bob Martinez', email: 'bob@test.com' },
      { name: 'Carol Wu', email: 'carol@test.com' },
      { name: 'Diana Okafor', email: 'diana@test.com' },
    ],
    defaultRounds: 1,
    showPrevious: false,
  },
  {
    // Project 2: 3 pioneers x 2 rounds = 6 surveys
    name: 'Competitive Intelligence Report',
    categoryId: 2,
    client: 'Roche',
    stage: 'Active engagement',
    pulse: 'Met expectations',
    team: '2',
    revisions: '2',
    legDays: '15',
    legTeam: '5',
    legRevs: '4',
    pioneers: [
      { name: 'Eve Patel', email: 'eve@test.com' },
      { name: 'Frank Nguyen', email: 'frank@test.com' },
      { name: 'Grace Kim', email: 'grace@test.com' },
    ],
    defaultRounds: 2,
    showPrevious: false,
  },
  {
    // Project 3: 1 pioneer x 3 rounds = 3 surveys (show_previous ON)
    name: 'Regulatory Strategy',
    categoryId: 3,
    client: 'Pfizer',
    stage: 'Post-engagement (follow-on)',
    pulse: 'Exceeded expectations',
    team: '2',
    revisions: '1',
    legDays: '10',
    legTeam: '3',
    legRevs: '2',
    pioneers: [
      { name: 'Hank Rivera', email: 'hank@test.com' },
    ],
    defaultRounds: 3,
    showPrevious: true,
  },
  {
    // Project 4: 4 pioneers x 1 round = 4 surveys
    name: 'Drug Pricing Analysis',
    categoryId: 4,
    client: 'AstraZeneca',
    stage: 'New business (pre-mandate)',
    pulse: 'Met expectations',
    team: '4',
    revisions: '2',
    legDays: '14',
    legTeam: '5',
    legRevs: '3',
    pioneers: [
      { name: 'Ivy Zhang', email: 'ivy@test.com' },
      { name: 'Jack Thompson', email: 'jack@test.com' },
      { name: 'Kate Sullivan', email: 'kate@test.com' },
      { name: 'Leo Fernandez', email: 'leo@test.com' },
    ],
    defaultRounds: 1,
    showPrevious: false,
  },
  {
    // Project 5: 3 pioneers x 1 round = 3 surveys
    name: 'Market Access Assessment',
    categoryId: 5,
    client: 'Sanofi',
    stage: 'Active engagement',
    pulse: 'Exceeded expectations',
    team: '2',
    revisions: '0',
    legDays: '8',
    legTeam: '3',
    legRevs: '2',
    pioneers: [
      { name: 'Maya Johnson', email: 'maya@test.com' },
      { name: 'Noah Williams', email: 'noah@test.com' },
      { name: 'Olivia Brown', email: 'olivia@test.com' },
    ],
    defaultRounds: 1,
    showPrevious: false,
  },
];

// Total expected: 4 + 6 + 3 + 4 + 3 = 20 surveys

// ── Date generator ──────────────────────────────────────────────────────────

function projectDates(idx: number): { start: string; end: string } {
  const base = new Date('2026-01-15');
  base.setDate(base.getDate() + idx * 14);
  const end = new Date(base);
  end.setDate(end.getDate() + 7 + idx * 2);
  return {
    start: base.toISOString().slice(0, 10),
    end: end.toISOString().slice(0, 10),
  };
}

// ── Helper: fill a survey via the UI (used for first few) ────────────────

async function fillSurveyViaUI(page: Page, token: string, profile: SurveyPayload): Promise<void> {
  await page.goto(BASE + '/#assess/' + token);
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
        const value = (profile as any)[f.key];
        if (value !== undefined) {
          await sel.selectOption({ label: value });
        }
      } else {
        const numVal = (profile as any)[f.key];
        if (numVal !== undefined) {
          await sel.fill(String(numVal));
          await sel.evaluate(el => el.dispatchEvent(new Event('input', { bubbles: true })));
        }
      }
      await page.waitForTimeout(20);
    }
  }

  // Verify submit button is enabled
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
    console.log(`  UI fill: submit disabled, empty fields: ${empty.join(', ')}`);
  }
  expect(disabled).toBe(false);

  await btn.click();
  await expect(page.locator('#expertContent h2')).toHaveText(/Thank You|Assessment Complete|Round \d+ of \d+ Complete/, { timeout: 15000 });
}

// ── Helper: submit survey via API (faster for bulk) ──────────────────────

async function submitSurveyViaAPI(page: Page, token: string, profile: SurveyPayload): Promise<void> {
  const response = await page.request.post(`${BASE}/api/expert/${token}`, {
    data: profile,
  });
  expect(response.status()).toBe(201);
}

// ══════════════════════════════════════════════════════════════════════════════
// TESTS
// ══════════════════════════════════════════════════════════════════════════════

test.describe.serial('Multi-Pioneer E2E: 5 projects, 20 surveys', () => {
  let page: Page;

  // projectId -> { projectId, pioneers: [{ name, token, totalRounds }] }
  interface PioneerInfo { name: string; token: string; totalRounds: number }
  interface ProjectInfo { projectId: number; pioneers: PioneerInfo[] }
  const createdProjects: ProjectInfo[] = [];

  // Track how many UI surveys vs API surveys we do
  let uiSurveyCount = 0;

  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    page.on('pageerror', (err) => jsErrors.push(err.message));
    page.on('console', (msg) => {
      if (msg.type() === 'error') jsErrors.push(`Console: ${msg.text()}`);
    });
  });

  test.afterAll(async () => { await page.close(); });

  // ─── LOGIN ────────────────────────────────────────────────────────────────
  test('Login as admin', async () => {
    await page.goto(BASE);
    await page.waitForLoadState('networkidle');
    await page.fill('#loginUsername', 'admin');
    await page.fill('#loginPassword', 'AliraAdmin2026!');
    await page.click('#loginBtn');
    await expect(page.locator('#appShell')).toBeVisible({ timeout: 10000 });
    console.log('  Logged in as admin');
  });

  // ─── CREATE 5 PROJECTS WITH MULTI-PIONEER CONFIGS ─────────────────────────
  test('Create 5 projects with varied pioneer configurations', { timeout: 120_000 }, async () => {
    for (let i = 0; i < PROJECTS.length; i++) {
      const p = PROJECTS[i];
      const dates = projectDates(i);

      await page.goto(BASE + '/#new');
      await expect(page.locator('#projectForm')).toBeVisible({ timeout: 10000 });

      // Fill basic project info
      await page.fill('#fName', p.name);
      await page.selectOption('#fCategory', String(p.categoryId));
      await page.fill('#fClient', p.client);
      await page.selectOption('#fStage', p.stage);
      await page.selectOption('#fPulse', p.pulse);

      // Dates
      await page.fill('#fDateStart', dates.start);
      await page.fill('#fDateEnd', dates.end);

      // xCSG performance
      await page.fill('#fXTeam', p.team);
      await page.fill('#fRevisions', p.revisions);

      // Legacy baseline
      await page.fill('#fLDays', p.legDays);
      await page.fill('#fLTeam', p.legTeam);
      await page.fill('#fLRevisions', p.legRevs);

      // Configure pioneers: first row already exists, fill it then add more
      const pioneerContainer = page.locator('#pioneersContainer');
      const existingRows = await pioneerContainer.locator('.pioneer-row').count();

      // Fill the first pioneer in the existing row
      const firstRow = pioneerContainer.locator('.pioneer-row').first();
      await firstRow.locator('.pioneer-name').fill(p.pioneers[0].name);
      await firstRow.locator('.pioneer-email').fill(p.pioneers[0].email);
      if (p.pioneers[0].name && p.defaultRounds > 1) {
        // Per-pioneer rounds field (leave empty to use project default)
      }

      // Add additional pioneer rows
      for (let pi = 1; pi < p.pioneers.length; pi++) {
        await page.click('#addPioneerBtn');
        await page.waitForTimeout(200);
        const rows = pioneerContainer.locator('.pioneer-row');
        const newRow = rows.nth(pi);
        await newRow.locator('.pioneer-name').fill(p.pioneers[pi].name);
        await newRow.locator('.pioneer-email').fill(p.pioneers[pi].email);
      }

      // Set default rounds and show_previous
      await page.fill('#fDefaultRounds', String(p.defaultRounds));
      await page.selectOption('#fShowPrevious', p.showPrevious ? '1' : '0');

      // Submit project
      await page.click('#projectForm button[type="submit"]');
      await expect(page.locator('.modal-overlay.active')).toBeVisible({ timeout: 10000 });

      // Close the modal
      await page.waitForTimeout(500);
      // For multi-pioneer projects the modal shows a list of links; for single it shows an input
      await page.locator('.modal-card .btn-secondary, .modal-card .btn-primary').last().click();
      await page.waitForTimeout(300);

      // Fetch project details via API to get pioneer tokens
      const authToken = await page.evaluate(() => sessionStorage.getItem('xcsg_token'));
      const projectsResponse = await page.request.get(`${BASE}/api/projects`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      const allProjects = await projectsResponse.json();
      const created = allProjects.find((proj: any) => proj.project_name === p.name);
      expect(created).toBeTruthy();

      const projectPioneers: PioneerInfo[] = (created.pioneers || []).map((pi: any) => ({
        name: pi.name || pi.pioneer_name,
        token: pi.expert_token,
        totalRounds: pi.total_rounds || p.defaultRounds,
      }));

      expect(projectPioneers.length).toBe(p.pioneers.length);

      createdProjects.push({
        projectId: created.id,
        pioneers: projectPioneers,
      });

      console.log(`  Created P${i + 1}: "${p.name}" with ${projectPioneers.length} pioneers, ${p.defaultRounds} round(s)`);
    }

    expect(createdProjects.length).toBe(5);
    const totalSurveys = createdProjects.reduce(
      (sum, cp) => sum + cp.pioneers.reduce((ps, pi) => ps + pi.totalRounds, 0),
      0
    );
    console.log(`  Total expected surveys: ${totalSurveys}`);
    expect(totalSurveys).toBe(20);
  });

  // ─── FILL 20 SURVEYS (3 via UI, 17 via API) ──────────────────────────────
  test('Fill first 3 surveys via UI (visual flow)', { timeout: 300_000 }, async () => {
    // Do the first 3 surveys through the full UI so the user sees the visual flow.
    // Project 1, Pioneer 1 (Alice) - STRONG profile
    const p1Alice = createdProjects[0].pioneers[0];
    console.log(`  UI Survey 1: ${p1Alice.name} (STRONG)`);
    await fillSurveyViaUI(page, p1Alice.token, STRONG);
    uiSurveyCount++;

    // Project 1, Pioneer 2 (Bob) - MODERATE profile
    const p1Bob = createdProjects[0].pioneers[1];
    console.log(`  UI Survey 2: ${p1Bob.name} (MODERATE)`);
    await fillSurveyViaUI(page, p1Bob.token, MODERATE);
    uiSurveyCount++;

    // Project 2, Pioneer 1 Round 1 (Eve) - WEAK profile
    const p2Eve = createdProjects[1].pioneers[0];
    console.log(`  UI Survey 3: ${p2Eve.name} Round 1 (WEAK)`);
    await fillSurveyViaUI(page, p2Eve.token, WEAK);
    uiSurveyCount++;

    console.log(`  Completed ${uiSurveyCount} UI-based surveys`);
  });

  test('Fill remaining 17 surveys via API', { timeout: 120_000 }, async () => {
    let apiCount = 0;

    // Track which surveys are already done:
    // P1: Alice(done), Bob(done), Carol(pending), Diana(pending) - 1 round each
    // P2: Eve R1(done), Eve R2(pending), Frank R1+R2(pending), Grace R1+R2(pending) - 2 rounds each
    // P3: Hank R1, R2, R3 (all pending) - 3 rounds
    // P4: Ivy, Jack, Kate, Leo (all pending) - 1 round each
    // P5: Maya, Noah, Olivia (all pending) - 1 round each

    // P1 remaining: Carol (WEAK), Diana (STRONG)
    const p1 = createdProjects[0];
    await submitSurveyViaAPI(page, p1.pioneers[2].token, WEAK);
    apiCount++;
    console.log(`  API ${apiCount}: ${p1.pioneers[2].name} - WEAK`);

    await submitSurveyViaAPI(page, p1.pioneers[3].token, STRONG);
    apiCount++;
    console.log(`  API ${apiCount}: ${p1.pioneers[3].name} - STRONG`);

    // P2: Eve R2 (MODERATE), Frank R1 (STRONG) + R2 (MODERATE), Grace R1 (WEAK) + R2 (STRONG)
    const p2 = createdProjects[1];
    await submitSurveyViaAPI(page, p2.pioneers[0].token, MODERATE);  // Eve Round 2
    apiCount++;
    console.log(`  API ${apiCount}: ${p2.pioneers[0].name} R2 - MODERATE`);

    await submitSurveyViaAPI(page, p2.pioneers[1].token, STRONG);    // Frank Round 1
    apiCount++;
    console.log(`  API ${apiCount}: ${p2.pioneers[1].name} R1 - STRONG`);

    await submitSurveyViaAPI(page, p2.pioneers[1].token, MODERATE);  // Frank Round 2
    apiCount++;
    console.log(`  API ${apiCount}: ${p2.pioneers[1].name} R2 - MODERATE`);

    await submitSurveyViaAPI(page, p2.pioneers[2].token, WEAK);      // Grace Round 1
    apiCount++;
    console.log(`  API ${apiCount}: ${p2.pioneers[2].name} R1 - WEAK`);

    await submitSurveyViaAPI(page, p2.pioneers[2].token, STRONG);    // Grace Round 2
    apiCount++;
    console.log(`  API ${apiCount}: ${p2.pioneers[2].name} R2 - STRONG`);

    // P3: Hank R1 (STRONG), R2 (MODERATE), R3 (WEAK) — show_previous ON
    const p3 = createdProjects[2];
    await submitSurveyViaAPI(page, p3.pioneers[0].token, STRONG);    // Hank Round 1
    apiCount++;
    console.log(`  API ${apiCount}: ${p3.pioneers[0].name} R1 - STRONG`);

    await submitSurveyViaAPI(page, p3.pioneers[0].token, MODERATE);  // Hank Round 2
    apiCount++;
    console.log(`  API ${apiCount}: ${p3.pioneers[0].name} R2 - MODERATE`);

    await submitSurveyViaAPI(page, p3.pioneers[0].token, WEAK);      // Hank Round 3
    apiCount++;
    console.log(`  API ${apiCount}: ${p3.pioneers[0].name} R3 - WEAK`);

    // P4: Ivy (STRONG), Jack (MODERATE), Kate (WEAK), Leo (STRONG)
    const p4 = createdProjects[3];
    await submitSurveyViaAPI(page, p4.pioneers[0].token, STRONG);
    apiCount++;
    console.log(`  API ${apiCount}: ${p4.pioneers[0].name} - STRONG`);

    await submitSurveyViaAPI(page, p4.pioneers[1].token, MODERATE);
    apiCount++;
    console.log(`  API ${apiCount}: ${p4.pioneers[1].name} - MODERATE`);

    await submitSurveyViaAPI(page, p4.pioneers[2].token, WEAK);
    apiCount++;
    console.log(`  API ${apiCount}: ${p4.pioneers[2].name} - WEAK`);

    await submitSurveyViaAPI(page, p4.pioneers[3].token, STRONG);
    apiCount++;
    console.log(`  API ${apiCount}: ${p4.pioneers[3].name} - STRONG`);

    // P5: Maya (MODERATE), Noah (STRONG), Olivia (WEAK)
    const p5 = createdProjects[4];
    await submitSurveyViaAPI(page, p5.pioneers[0].token, MODERATE);
    apiCount++;
    console.log(`  API ${apiCount}: ${p5.pioneers[0].name} - MODERATE`);

    await submitSurveyViaAPI(page, p5.pioneers[1].token, STRONG);
    apiCount++;
    console.log(`  API ${apiCount}: ${p5.pioneers[1].name} - STRONG`);

    await submitSurveyViaAPI(page, p5.pioneers[2].token, WEAK);
    apiCount++;
    console.log(`  API ${apiCount}: ${p5.pioneers[2].name} - WEAK`);

    expect(apiCount).toBe(17);
    console.log(`  Total surveys: ${uiSurveyCount} UI + ${apiCount} API = ${uiSurveyCount + apiCount}`);
  });

  // ─── DASHBOARD VERIFICATION ───────────────────────────────────────────────
  test('Dashboard shows data for all 5 projects', { timeout: 30_000 }, async () => {
    // Re-login (expert view may have cleared session)
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

    // KPI tiles should have real values
    const kpiValues = await mc.locator('.metric-tile-value').allTextContents();
    expect(kpiValues.length).toBeGreaterThanOrEqual(6);
    const realValues = kpiValues.filter(v => v.trim() !== '\u2014');
    expect(realValues.length).toBeGreaterThanOrEqual(4);
    console.log('  KPI values:', kpiValues.join(', '));

    // Charts rendered (ECharts creates canvas inside divs)
    await page.waitForTimeout(2000);
    const chartCanvases = await page.locator('.chart-body canvas').count();
    console.log(`  Chart canvases: ${chartCanvases}`);
    expect(chartCanvases).toBeGreaterThanOrEqual(3);

    // Portfolio table should have 5 projects
    const tableRows = await mc.locator('.portfolio-table tbody tr').count();
    expect(tableRows).toBe(5);
    console.log(`  Portfolio table rows: ${tableRows}`);

    // Scaling gates section
    const gateCards = await mc.locator('.gate-card').count();
    if (gateCards > 0) {
      console.log(`  Scaling gates: ${gateCards} cards`);
    }
  });

  // ─── MONITORING PAGE VERIFICATION ─────────────────────────────────────────
  test('Monitoring page shows all projects with correct counts', { timeout: 30_000 }, async () => {
    await page.goto(BASE + '/#monitoring');
    await page.waitForTimeout(2000);

    const mc = page.locator('#mainContent');

    // Should have a monitoring table
    await expect(mc.locator('#monitoringTable')).toBeVisible({ timeout: 10000 });

    // Table should have 5 rows (one per project)
    const rows = await mc.locator('#monitoringTable tbody tr').count();
    expect(rows).toBe(5);
    console.log(`  Monitoring rows: ${rows}`);

    // Verify via API
    const authToken = await page.evaluate(() => sessionStorage.getItem('xcsg_token'));
    const monResponse = await page.request.get(`${BASE}/api/monitoring`, {
      headers: { Authorization: `Bearer ${authToken}` },
    });
    const monData = await monResponse.json();

    expect(monData.total_projects).toBe(5);
    console.log(`  Monitoring API: ${monData.total_projects} projects, ${monData.total_pending_responses} pending`);

    // Check each project's response counts
    for (const proj of monData.projects) {
      console.log(`    ${proj.project_name}: ${proj.responses_completed}/${proj.responses_expected} responses, ${proj.pioneer_count} pioneers, status: ${proj.status}`);
      // All projects should be complete (all rounds filled)
      expect(proj.responses_completed).toBe(proj.responses_expected);
    }

    // Completion rate should be 100%
    expect(monData.completion_rate).toBe(100);
  });

  // ─── PROJECT DETAIL WITH PIONEER TABLE ────────────────────────────────────
  test('Project detail shows pioneer table with response data', { timeout: 30_000 }, async () => {
    // Check Project 2 (Competitive Intelligence) which has 3 pioneers x 2 rounds
    const p2Id = createdProjects[1].projectId;
    await page.goto(BASE + `/#edit/${p2Id}`);
    await page.waitForTimeout(3000);

    const mc = page.locator('#mainContent');

    // Project form should be visible
    await expect(mc.locator('#projectForm')).toBeVisible();

    // Pioneer table should be rendered
    const pioneerTableRows = await mc.locator('.data-table tbody tr').count();
    console.log(`  Pioneer table rows for P2: ${pioneerTableRows}`);
    // Should have 3 pioneer rows
    expect(pioneerTableRows).toBeGreaterThanOrEqual(3);

    // Page should contain pioneer-related content
    const pageText = await mc.textContent();
    expect(pageText).toContain('Copy Link');
    console.log('  Pioneer table with Copy Link buttons visible');
  });

  // ─── VERIFY METRICS VIA API ───────────────────────────────────────────────
  test('API returns valid metrics for all projects', { timeout: 30_000 }, async () => {
    const authToken = await page.evaluate(() => sessionStorage.getItem('xcsg_token'));
    const projectsRes = await page.request.get(`${BASE}/api/projects`, {
      headers: { Authorization: `Bearer ${authToken}` },
    });
    const projects = await projectsRes.json();
    expect(projects.length).toBe(5);

    // All should have metrics (all have completed responses)
    const withMetrics = projects.filter((p: any) => p.metrics !== null);
    expect(withMetrics.length).toBe(5);

    for (const p of withMetrics) {
      console.log(`  ${p.project_name}: speed=${p.metrics.delivery_speed?.toFixed(2)}x quality=${p.metrics.output_quality?.toFixed(2)}x value_gain=${p.metrics.productivity_ratio?.toFixed(2)}x`);
      expect(p.metrics.delivery_speed).toBeGreaterThan(0);
      expect(p.metrics.quality_score).toBeGreaterThan(0);
    }

    // Metrics should be varied (different profiles yield different scores)
    const qualities = withMetrics.map((p: any) => p.metrics.quality_score);
    const uniqueQualities = new Set(qualities.map((q: number) => Math.round(q * 100)));
    expect(uniqueQualities.size).toBeGreaterThan(1);
    console.log(`  Unique quality scores: ${uniqueQualities.size}`);

    // Dashboard aggregates
    const dashRes = await page.request.get(`${BASE}/api/dashboard/metrics`, {
      headers: { Authorization: `Bearer ${authToken}` },
    });
    const dash = await dashRes.json();
    expect(dash.complete_projects).toBe(5);
    expect(dash.average_effort_ratio).toBeGreaterThan(0);
    expect(dash.average_quality_score).toBeGreaterThan(0);
    expect(dash.machine_first_avg).toBeGreaterThan(0);
    expect(dash.senior_led_avg).toBeGreaterThan(0);
    expect(dash.proprietary_knowledge_avg).toBeGreaterThan(0);
    console.log(`  Dashboard: effort=${dash.average_effort_ratio} quality=${dash.average_quality_score} MF=${dash.machine_first_avg} SL=${dash.senior_led_avg} PK=${dash.proprietary_knowledge_avg}`);
  });

  // ─── MULTI-ROUND VERIFICATION ─────────────────────────────────────────────
  test('Multi-round pioneer has correct response count', { timeout: 15_000 }, async () => {
    // Verify Project 3 (Regulatory Strategy) — Hank with 3 rounds
    const p3Id = createdProjects[2].projectId;
    const authToken = await page.evaluate(() => sessionStorage.getItem('xcsg_token'));

    const p3Res = await page.request.get(`${BASE}/api/projects/${p3Id}`, {
      headers: { Authorization: `Bearer ${authToken}` },
    });
    const p3 = await p3Res.json();

    expect(p3.pioneers.length).toBe(1);
    const hank = p3.pioneers[0];
    expect(hank.response_count).toBe(3);
    console.log(`  Hank (3-round pioneer): ${hank.response_count}/3 responses, last_round=${hank.last_round}`);
    expect(hank.last_round).toBe(3);

    // Verify Project 2 (Competitive Intelligence) — 3 pioneers x 2 rounds
    const p2Id = createdProjects[1].projectId;
    const p2Res = await page.request.get(`${BASE}/api/projects/${p2Id}`, {
      headers: { Authorization: `Bearer ${authToken}` },
    });
    const p2 = await p2Res.json();

    expect(p2.pioneers.length).toBe(3);
    for (const pi of p2.pioneers) {
      expect(pi.response_count).toBe(2);
      console.log(`  ${pi.name || pi.pioneer_name}: ${pi.response_count}/2 responses`);
    }

    // Total responses across all projects
    let totalResponses = 0;
    for (const cp of createdProjects) {
      const res = await page.request.get(`${BASE}/api/projects/${cp.projectId}`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      const proj = await res.json();
      totalResponses += proj.response_count || 0;
    }
    console.log(`  Total responses across all projects: ${totalResponses}`);
    expect(totalResponses).toBe(20);
  });

  // ─── ALL ROUTES RENDER ────────────────────────────────────────────────────
  test('All navigation routes render without errors', { timeout: 20_000 }, async () => {
    const routes = ['#portfolio', '#projects', '#norms', '#monitoring', '#settings', '#activity'];
    for (const hash of routes) {
      await page.evaluate((h) => { window.location.hash = h; }, hash);
      await page.waitForTimeout(1500);
      const content = await page.locator('#mainContent').textContent();
      expect((content || '').trim().length).toBeGreaterThan(0);
      console.log(`  ${hash}: rendered (${content!.length} chars)`);
    }
  });

  // ─── JS ERROR CHECK ──────────────────────────────────────────────────────
  test('No JavaScript errors during entire run', async () => {
    const realErrors = jsErrors.filter(e =>
      !e.includes('422') && !e.includes('favicon') && !e.includes('404')
    );
    if (realErrors.length > 0) {
      console.log('  JS Errors:', realErrors);
    }
    expect(realErrors.length).toBe(0);
  });
});
