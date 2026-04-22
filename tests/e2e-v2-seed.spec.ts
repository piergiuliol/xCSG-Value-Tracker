import { test, expect, Page } from '@playwright/test';

const BASE = 'http://localhost:8077';

// ─────────────────────────────────────────────────────────────────────────────
// 20 real-world projects across 9 practices, 3 outcome profiles.
// Uses explicit xcsg_calendar_days so xCSG delivery is realistically short
// compared to legacy working-days, producing meaningful metric ratios.
// ─────────────────────────────────────────────────────────────────────────────

type Profile = 'strong' | 'balanced' | 'weak';

interface ProjectSpec {
  name: string;
  client: string;
  categoryName: string;
  practiceCode: string;   // must be allowed for the category by the M2M seed
  team: string;           // xCSG team size
  xcsgDays: number;       // xCSG working days (the actual delivery effort, not calendar span)
  revs: string;
  dateStart: string;
  dateEnd: string;
  revDepth: 'No revisions needed' | 'Cosmetic only' | 'Moderate rework' | 'Major rework';
  scope: 'Yes expanded scope' | 'Yes new engagement' | 'No' | 'Not yet delivered';
  pulse: 'Exceeded expectations' | 'Met expectations' | 'Below expectations' | 'Not yet received';
  stage: 'New business (pre-mandate)' | 'Active engagement' | 'Post-engagement (follow-on)';
  pioneers: [string, string];
  profile: Profile;
}

// Profile → realistic (xcsgDays, legacy_days, legacy_team)
// Strong:  xCSG is 3-5× faster, higher quality
// Balanced: xCSG is 1.5-2× faster, moderate gain
// Weak:    xCSG roughly matches legacy

const PROJECTS: ProjectSpec[] = [
  // RAM (4)
  { name: '510(k) Submission — CardioFlow Valve',  client: 'Medtronic',       categoryName: '510(k)',                               practiceCode: 'RAM', team: '3', xcsgDays: 7,  revs: '2', dateStart: '2026-01-15', dateEnd: '2026-02-05', revDepth: 'Moderate rework',     scope: 'No',                 pulse: 'Exceeded expectations', stage: 'Post-engagement (follow-on)', pioneers: ['Dr. Elena Rossi', 'Marco Bianchi'], profile: 'strong' },
  { name: 'PMA Pathway — NeuroMonitor',             client: 'Abbott',          categoryName: 'PMA',                                  practiceCode: 'RAM', team: '5', xcsgDays: 22, revs: '3', dateStart: '2025-10-01', dateEnd: '2025-11-28', revDepth: 'Major rework',        scope: 'Yes expanded scope', pulse: 'Met expectations',      stage: 'Active engagement',           pioneers: ['Julia Varga',     'Kenji Tanaka'], profile: 'balanced' },
  { name: 'De Novo — DiaSense',                     client: 'DiaSense',        categoryName: 'De Novo',                              practiceCode: 'RAM', team: '2', xcsgDays: 6,  revs: '1', dateStart: '2026-02-01', dateEnd: '2026-02-20', revDepth: 'Cosmetic only',       scope: 'No',                 pulse: 'Exceeded expectations', stage: 'Active engagement',           pioneers: ['Sarah Chen',      'Luca Conti'],  profile: 'strong' },
  { name: 'EU MDR Gap Analysis — OrthoPro',         client: 'OrthoPro',        categoryName: 'Gap Analysis',                         practiceCode: 'RAM', team: '2', xcsgDays: 4,  revs: '0', dateStart: '2026-02-15', dateEnd: '2026-02-26', revDepth: 'No revisions needed', scope: 'No',                 pulse: 'Met expectations',      stage: 'Active engagement',           pioneers: ['Anika Patel',     'Tomasz Nowak'], profile: 'balanced' },

  // MAP (3)
  { name: 'Early MA Dossier — OncoNext',            client: 'Roche',           categoryName: 'Early Market Access',                  practiceCode: 'MAP', team: '4', xcsgDays: 10, revs: '1', dateStart: '2026-01-10', dateEnd: '2026-02-02', revDepth: 'Cosmetic only',       scope: 'No',                 pulse: 'Exceeded expectations', stage: 'Active engagement',           pioneers: ['Priya Shah',      'Aisha Patel'], profile: 'strong' },
  { name: 'HEOR Model — RareBio',                   client: 'RareBio',         categoryName: 'Health Economics (e.g., HEOR Modelling like CE, BIM)', practiceCode: 'MAP', team: '3', xcsgDays: 18, revs: '2', dateStart: '2025-12-01', dateEnd: '2026-01-15', revDepth: 'Moderate rework', scope: 'No', pulse: 'Met expectations', stage: 'Post-engagement (follow-on)', pioneers: ['Carlos Mendez',  'Sofia Rivera'], profile: 'balanced' },
  { name: 'Payer Value Story — AlzMed',             client: 'AlzMed',          categoryName: 'Payer Value Story Payer Objection Handler', practiceCode: 'MAP', team: '3', xcsgDays: 12, revs: '2', dateStart: '2026-01-20', dateEnd: '2026-02-18', revDepth: 'Moderate rework', scope: 'Yes expanded scope', pulse: 'Met expectations', stage: 'Active engagement', pioneers: ['Fatima Yusuf',   'Raj Kapoor'], profile: 'balanced' },

  // NPS (2)
  { name: 'Brand Strategy Refresh — NeuroSphere',   client: 'Bristol Myers',   categoryName: 'Brand Strategy',                       practiceCode: 'NPS', team: '3', xcsgDays: 24, revs: '3', dateStart: '2025-11-15', dateEnd: '2026-01-20', revDepth: 'Major rework',        scope: 'Yes expanded scope', pulse: 'Below expectations',     stage: 'Post-engagement (follow-on)', pioneers: ['Natalie Wong',    'Hugo Meyer'],  profile: 'weak' },
  { name: 'NPP — Immuno-Oncology Launch',           client: 'Merck',           categoryName: 'New Product Planning/Strategy',        practiceCode: 'NPS', team: '4', xcsgDays: 16, revs: '2', dateStart: '2026-01-05', dateEnd: '2026-02-20', revDepth: 'Moderate rework',     scope: 'No',                 pulse: 'Met expectations',      stage: 'Active engagement',           pioneers: ['Dr. Ines Correia','Ben Schneider'],profile: 'balanced' },

  // MCD (3)
  { name: 'CDD — CNS Therapeutics Inc.',            client: 'KKR',             categoryName: 'Commercial Due Diligence',             practiceCode: 'MCD', team: '5', xcsgDays: 8,  revs: '1', dateStart: '2026-02-01', dateEnd: '2026-02-20', revDepth: 'Cosmetic only',       scope: 'No',                 pulse: 'Exceeded expectations', stage: 'Post-engagement (follow-on)', pioneers: ['Alex Voinov',     'Mei-Lin Chang'],profile: 'strong' },
  { name: 'Opportunity Assessment — Rare GI',       client: 'GI Therapeutics', categoryName: 'Opportunity Assessment (Market and/ or Product) (e.g., market landscape analysis, market research, opportunity assessment)', practiceCode: 'MCD', team: '3', xcsgDays: 12, revs: '2', dateStart: '2025-12-10', dateEnd: '2026-01-15', revDepth: 'Moderate rework', scope: 'No', pulse: 'Met expectations', stage: 'Post-engagement (follow-on)', pioneers: ['Diego Alvarez',  'Yuki Sato'],    profile: 'balanced' },
  { name: 'Portfolio Prioritization — MidPharma',   client: 'MidPharma',       categoryName: 'Portfolio Management/ TA & Indication Prioritization', practiceCode: 'MCD', team: '4', xcsgDays: 9,  revs: '1', dateStart: '2026-01-22', dateEnd: '2026-02-15', revDepth: 'Cosmetic only', scope: 'No', pulse: 'Exceeded expectations', stage: 'Active engagement',           pioneers: ['Isabelle Laurent','Tom Fischer'], profile: 'strong' },

  // RWE (2)
  { name: 'Retrospective RWE — DiabetES Cohort',    client: 'Sanofi',          categoryName: 'Retrospective study',                  practiceCode: 'RWE', team: '2', xcsgDays: 15, revs: '2', dateStart: '2026-01-08', dateEnd: '2026-02-18', revDepth: 'Moderate rework',     scope: 'No',                 pulse: 'Met expectations',      stage: 'Active engagement',           pioneers: ['Léa Dubois',      'Ravi Kumar'],  profile: 'balanced' },
  { name: 'RWE Data Analysis — Long COVID',         client: 'AstraZeneca',     categoryName: 'Data analysis',                        practiceCode: 'RWE', team: '3', xcsgDays: 10, revs: '1', dateStart: '2026-02-01', dateEnd: '2026-02-25', revDepth: 'Cosmetic only',       scope: 'No',                 pulse: 'Exceeded expectations', stage: 'Active engagement',           pioneers: ['Chiara Romano',   'Peter Lindqvist'], profile: 'strong' },

  // RAP (3) — one uses the "Regulatory Strategy" category which is allowed under RAM+RAP; we pick RAP
  { name: 'MAA Submission — CardiaX',               client: 'Novartis',        categoryName: 'MAA/NDA',                              practiceCode: 'RAP', team: '5', xcsgDays: 20, revs: '2', dateStart: '2025-11-01', dateEnd: '2026-01-10', revDepth: 'Moderate rework',     scope: 'No',                 pulse: 'Met expectations',      stage: 'Post-engagement (follow-on)', pioneers: ['Dr. Hans Meyer',  'Sofia Rivera'],profile: 'balanced' },
  { name: 'IND — GeneRise',                         client: 'GeneRise',        categoryName: 'IND and IND Related',                  practiceCode: 'RAP', team: '3', xcsgDays: 30, revs: '4', dateStart: '2025-09-01', dateEnd: '2026-01-10', revDepth: 'Major rework',        scope: 'Yes expanded scope', pulse: 'Below expectations',     stage: 'Post-engagement (follow-on)', pioneers: ['Dr. Olga Petrova','Marcus König'], profile: 'weak' },
  { name: 'Reg Strategy — RareEye (RAP)',           client: 'RareEye',         categoryName: 'Regulatory Strategy',                  practiceCode: 'RAP', team: '2', xcsgDays: 5,  revs: '0', dateStart: '2026-02-10', dateEnd: '2026-02-22', revDepth: 'No revisions needed', scope: 'No',                 pulse: 'Exceeded expectations', stage: 'Active engagement',           pioneers: ['Ashley Park',     'Lucia Martinez'],profile: 'strong' },

  // PEN (1)
  { name: 'Patient Journey — Rare Disease X',       client: 'PatientsFirst',   categoryName: 'Patient Journey Definition',           practiceCode: 'PEN', team: '2', xcsgDays: 7,  revs: '1', dateStart: '2026-01-30', dateEnd: '2026-02-15', revDepth: 'Cosmetic only',       scope: 'No',                 pulse: 'Met expectations',      stage: 'Active engagement',           pioneers: ['Maya Greene',     'Daniel Ortiz'],profile: 'balanced' },

  // TAD (1)
  { name: 'Sell-Side M&A — BioAurora',              client: 'BioAurora',       categoryName: 'Sell-Side M&A',                        practiceCode: 'TAD', team: '6', xcsgDays: 12, revs: '1', dateStart: '2025-12-15', dateEnd: '2026-01-20', revDepth: 'Cosmetic only',       scope: 'No',                 pulse: 'Not yet received',       stage: 'Active engagement',           pioneers: ['Ethan Cole',      'Emma Russo'],  profile: 'strong' },

  // CLI (1)
  { name: 'Full-Service Trial — OncoRx Ph2',        client: 'OncoRx',          categoryName: 'Full Service Trial - Clinical Operations', practiceCode: 'CLI', team: '6', xcsgDays: 25, revs: '2', dateStart: '2025-10-20', dateEnd: '2026-01-05', revDepth: 'Moderate rework', scope: 'No', pulse: 'Not yet received', stage: 'Active engagement', pioneers: ['Dr. Anil Rao',   'Grace Okoye'], profile: 'balanced' },
];

function surveyPayload(profile: Profile) {
  if (profile === 'strong') {
    return {
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
  }
  if (profile === 'balanced') {
    return {
      b1_starting_point: 'Mixed',
      b2_research_sources: 'Multiple sources across domains (5-10)',
      b3_assembly_ratio: '50-75%',
      b4_hypothesis_first: 'Hybrid',
      b5_ai_survival: '50-75%',
      b6_data_analysis_split: '25-50%',
      c1_specialization: 'Deep specialist',
      c2_directness: 'Expert co-authored',
      c3_judgment_pct: '50-75%',
      c6_self_assessment: 'Somewhat better',
      c7_analytical_depth: 'Strong',
      c8_decision_readiness: 'Yes with minor caveats',
      d1_proprietary_data: 'Yes',
      d2_knowledge_reuse: 'Yes provided useful starting context',
      d3_moat_test: 'Partially — they would miss key insights',
      e1_client_decision: 'Yes — referenced in internal discussions',
      f1_feasibility: 'Feasible but at 2x+ the cost and time',
      f2_productization: 'Yes with moderate customization',
      g1_reuse_intent: 'Yes with reservations',
      l1_legacy_working_days: 20,
      l2_legacy_team_size: '3',
      l3_legacy_revision_depth: 'Moderate rework',
      l4_legacy_scope_expansion: 'No',
      l5_legacy_client_reaction: 'Met expectations',
      l6_legacy_b2_sources: 'A few targeted sources (2-4)',
      l7_legacy_c1_specialization: 'Adjacent expertise',
      l8_legacy_c2_directness: 'Expert reviewed only',
      l9_legacy_c3_judgment: '25-50%',
      l10_legacy_d1_proprietary: 'No',
      l11_legacy_d2_reuse: 'Yes provided useful starting context',
      l12_legacy_d3_moat: 'Yes — all inputs publicly available',
      l13_legacy_c7_depth: 'Adequate',
      l14_legacy_c8_decision: 'Yes with minor caveats',
      l15_legacy_e1_decision: 'Yes — referenced in internal discussions',
      l16_legacy_b6_data: '50-75%',
    };
  }
  // weak
  return {
    b1_starting_point: 'From blank page',
    b2_research_sources: 'A few targeted sources (2-4)',
    b3_assembly_ratio: '25-50%',
    b4_hypothesis_first: 'Discovery-first',
    b5_ai_survival: '25-50%',
    b6_data_analysis_split: '50-75%',
    c1_specialization: 'Adjacent expertise',
    c2_directness: 'Expert co-authored',
    c3_judgment_pct: '25-50%',
    c6_self_assessment: 'Comparable',
    c7_analytical_depth: 'Adequate',
    c8_decision_readiness: 'Needs significant additional work',
    d1_proprietary_data: 'No',
    d2_knowledge_reuse: 'No built from scratch',
    d3_moat_test: 'Yes — all inputs publicly available',
    e1_client_decision: 'Too early to tell',
    f1_feasibility: 'Feasible at similar cost',
    f2_productization: 'No fully bespoke',
    g1_reuse_intent: 'Yes with reservations',
    l1_legacy_working_days: 12,
    l2_legacy_team_size: '2',
    l3_legacy_revision_depth: 'Cosmetic only',
    l4_legacy_scope_expansion: 'No',
    l5_legacy_client_reaction: 'Exceeded expectations',
    l6_legacy_b2_sources: 'Multiple sources across domains (5-10)',
    l7_legacy_c1_specialization: 'Deep specialist',
    l8_legacy_c2_directness: 'Expert authored',
    l9_legacy_c3_judgment: '50-75%',
    l10_legacy_d1_proprietary: 'Yes',
    l11_legacy_d2_reuse: 'Yes directly reused and extended',
    l12_legacy_d3_moat: 'Partially — they would miss key insights',
    l13_legacy_c7_depth: 'Strong',
    l14_legacy_c8_decision: 'Yes with minor caveats',
    l15_legacy_e1_decision: 'Yes — informed a specific decision',
    l16_legacy_b6_data: '25-50%',
  };
}

async function login(page: Page) {
  await page.goto(BASE);
  await page.waitForSelector('#loginScreen', { state: 'visible' });
  await page.fill('#loginUsername', 'admin');
  await page.fill('#loginPassword', 'AliraAdmin2026!');
  await page.click('#loginBtn');
  await page.waitForSelector('#appShell', { state: 'visible' });
}

test.describe.serial('20-project real-world seed + metric verification (v2: M2M + realistic days)', () => {
  let page: Page;

  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  });

  test.afterAll(async () => { await page.close(); });

  test('01 — Login', async () => {
    await login(page);
    await expect(page).toHaveURL(/.*#portfolio/);
  });

  test('02 — Seed 20 projects via API (respecting M2M pair rules)', async () => {
    const result = await page.evaluate(async (projects) => {
      const token = sessionStorage.getItem('xcsg_token');
      const hdr = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
      const cats = await (await fetch(`/api/categories`, { headers: hdr })).json();
      const pracs = await (await fetch(`/api/practices`, { headers: hdr })).json();
      const catByName: Record<string, any> = {};
      cats.forEach((c: any) => { catByName[c.name] = c; });
      const pracByCode: Record<string, number> = {};
      pracs.forEach((p: any) => { pracByCode[p.code] = p.id; });

      const ids: number[] = [];
      for (const p of projects) {
        const cat = catByName[p.categoryName];
        if (!cat) throw new Error(`Unknown category: ${p.categoryName}`);
        if (!pracByCode[p.practiceCode]) throw new Error(`Unknown practice: ${p.practiceCode}`);
        const allowed = cat.practices.map((x: any) => x.code);
        if (!allowed.includes(p.practiceCode)) {
          throw new Error(`Practice ${p.practiceCode} not allowed for category ${p.categoryName}. Allowed: ${allowed}`);
        }
        const body = {
          project_name: p.name,
          category_id: cat.id,
          practice_id: pracByCode[p.practiceCode],
          client_name: p.client,
          engagement_stage: p.stage,
          client_pulse: p.pulse,
          date_started: p.dateStart,
          date_delivered: p.dateEnd,
          working_days: p.xcsgDays,  // explicit xCSG working days
          xcsg_team_size: p.team,
          xcsg_revision_rounds: p.revs,
          revision_depth: p.revDepth,
          xcsg_scope_expansion: p.scope,
          pioneers: p.pioneers.map((n: string) => ({
            name: n,
            email: n.toLowerCase().replace(/[^a-z0-9]+/g, '.').replace(/^\.+|\.+$/g, '') + '@alira.health',
          })),
        };
        const r = await fetch(`/api/projects`, { method: 'POST', headers: hdr, body: JSON.stringify(body) });
        if (!r.ok) throw new Error(`Failed to create ${p.name}: ${r.status} ${await r.text()}`);
        const j = await r.json();
        ids.push(j.id);
      }
      return { ids, catCount: cats.length, pracCount: pracs.length };
    }, PROJECTS);

    console.log(`[SEED] created ${result.ids.length} projects (categories=${result.catCount}, practices=${result.pracCount})`);
    expect(result.ids.length).toBe(20);
    expect(result.catCount).toBe(79);
    expect(result.pracCount).toBe(11);
  });

  test('03 — Projects list shows all 20 (visual)', async () => {
    await page.goto(`${BASE}/#projects`);
    await page.waitForSelector('#projectTable tbody tr');
    await page.waitForTimeout(500);
    const rowCount = await page.locator('#projectTable tbody tr').count();
    expect(rowCount).toBe(20);
    await page.screenshot({ fullPage: true, path: 'v2b-seed-projects-list.png' });
    await page.waitForTimeout(1000);
  });

  test('04 — Submit expert surveys (1 pioneer per project)', async () => {
    const profilesByProjectName: Record<string, Profile> = {};
    PROJECTS.forEach(p => { profilesByProjectName[p.name] = p.profile; });

    const submitted = await page.evaluate(async ({ profileMap, strong, balanced, weak }) => {
      const token = sessionStorage.getItem('xcsg_token');
      const hdr = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
      const projects = await (await fetch(`/api/projects`, { headers: hdr })).json();
      let count = 0;
      for (const p of projects) {
        const profile = (profileMap as Record<string, string>)[p.project_name];
        const body = profile === 'strong' ? strong : profile === 'weak' ? weak : balanced;
        const tok = p.pioneers?.[0]?.rounds?.[0]?.token;
        if (!tok) continue;
        const r = await fetch(`/api/expert/${tok}`, { method: 'POST', headers: hdr, body: JSON.stringify(body) });
        if (r.ok) count++;
      }
      return count;
    }, {
      profileMap: profilesByProjectName,
      strong: surveyPayload('strong'),
      balanced: surveyPayload('balanced'),
      weak: surveyPayload('weak'),
    });

    console.log(`[SURVEY] submitted=${submitted} / 20`);
    expect(submitted).toBe(20);
  });

  test('05 — Dashboard metrics populated (non-null)', async () => {
    await page.goto(`${BASE}/#portfolio`);
    await page.waitForSelector('.dashboard-section');
    await page.waitForTimeout(2000);

    const metrics = await page.evaluate(async () => {
      const tok = sessionStorage.getItem('xcsg_token');
      const r = await fetch(`/api/metrics/summary`, { headers: { Authorization: `Bearer ${tok}` } });
      return r.json();
    });
    console.log('[METRICS] summary:', JSON.stringify(metrics, null, 2));

    expect(metrics.total_projects).toBe(20);
    expect(metrics.complete_projects + metrics.pending_projects).toBe(20);
    expect(metrics.average_effort_ratio).toBeGreaterThan(1);  // xCSG should be meaningfully faster
    expect(metrics.average_quality_score).toBeGreaterThan(0);
    expect(metrics.average_productivity_ratio).not.toBeNull();
    expect(metrics.machine_first_avg).toBeGreaterThan(1);
    expect(metrics.senior_led_avg).toBeGreaterThan(1);
    expect(metrics.proprietary_knowledge_avg).toBeGreaterThan(1);

    await page.screenshot({ fullPage: true, path: 'v2b-seed-dashboard.png' });
  });

  test('06 — By Practice chart has 9 bars', async () => {
    const byPractice = await page.evaluate(async () => {
      const tok = sessionStorage.getItem('xcsg_token');
      const r = await fetch(`/api/projects`, { headers: { Authorization: `Bearer ${tok}` } });
      const rows = await r.json();
      const groups: Record<string, number> = {};
      rows.forEach((p: any) => { groups[p.practice_code || 'None'] = (groups[p.practice_code || 'None'] || 0) + 1; });
      return groups;
    });
    console.log('[DATA] project count by practice:', JSON.stringify(byPractice, null, 2));
    expect(Object.keys(byPractice).length).toBe(9);
  });

  test('07 — Scaling gates: at least 3 pass', async () => {
    const gates = await page.evaluate(async () => {
      const tok = sessionStorage.getItem('xcsg_token');
      const r = await fetch(`/api/metrics/scaling-gates`, { headers: { Authorization: `Bearer ${tok}` } });
      return r.json();
    });
    console.log('[METRICS] scaling gates:');
    gates.gates.forEach((g: any) => console.log(`  [${g.status.toUpperCase().padEnd(7)}] ${g.name}: ${g.detail}`));
    expect(gates.gates.find((g: any) => g.name === 'Multi-engagement').status).toBe('pass');
    expect(gates.passed_count).toBeGreaterThanOrEqual(3);
  });

  test('08 — Filter projects list by practice RAM → 4 rows', async () => {
    await page.goto(`${BASE}/#projects`);
    await page.waitForSelector('#practiceFilter');
    await page.selectOption('#practiceFilter', 'RAM');
    await page.waitForTimeout(500);
    const visibleRows = await page.locator('#projectTable tbody tr:not([style*="display: none"])').count();
    expect(visibleRows).toBe(4);
    await page.screenshot({ path: 'v2b-seed-ram-filter.png' });
  });

  test('09 — Settings > Practices shows 11 practices with project counts summing to 20', async () => {
    await page.goto(`${BASE}/#settings`);
    await page.waitForSelector('#tabPractices');
    await page.click('#tabPractices');
    await page.waitForSelector('.data-table tbody tr');
    const rowCount = await page.locator('.data-table tbody tr').count();
    expect(rowCount).toBe(11);
    const total = await page.evaluate(() => {
      const rows = document.querySelectorAll('.data-table tbody tr');
      let sum = 0;
      rows.forEach(r => {
        const cells = r.querySelectorAll('td');
        sum += parseInt(cells[3]?.textContent || '0');
      });
      return sum;
    });
    expect(total).toBe(20);
    await page.screenshot({ fullPage: true, path: 'v2b-seed-practices-tab.png' });
  });

  test('10 — M2M rule: Regulatory Strategy / MCD is rejected', async () => {
    const result = await page.evaluate(async () => {
      const tok = sessionStorage.getItem('xcsg_token');
      const hdr = { 'Content-Type': 'application/json', Authorization: `Bearer ${tok}` };
      const cats = await (await fetch(`/api/categories`, { headers: hdr })).json();
      const pracs = await (await fetch(`/api/practices`, { headers: hdr })).json();
      const regStrat = cats.find((c: any) => c.name === 'Regulatory Strategy');
      const mcd = pracs.find((p: any) => p.code === 'MCD');
      const body = {
        project_name: 'illegal pair', category_id: regStrat.id, practice_id: mcd.id,
        xcsg_team_size: '2', xcsg_revision_rounds: '1',
        pioneers: [{ name: 'x' }],
      };
      const r = await fetch(`/api/projects`, { method: 'POST', headers: hdr, body: JSON.stringify(body) });
      return { status: r.status, body: await r.text() };
    });
    console.log('[M2M] illegal pair response:', result.status, result.body.slice(0, 120));
    expect(result.status).toBe(400);
    expect(result.body).toContain('not allowed for this category');
  });
});
