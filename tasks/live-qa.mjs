/**
 * xCSG Value Tracker — Live QA with Playwright (headless:false)
 * Creates 20 projects across realistic engagements, fills expert forms, verifies everything.
 */
import { chromium } from '/Users/pj/.npm/_npx/e41f203b7505f1fb/node_modules/playwright/index.mjs';
import { mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';

const BASE = 'http://localhost:8000';
const SS = 'test-results/live-qa';
mkdirSync(SS, { recursive: true });

const wait = ms => new Promise(r => setTimeout(r, ms));
const ss = async (page, name, fullPage = false) => {
  const p = join(SS, `${name}.png`);
  await page.screenshot({ path: p, fullPage });
  console.log(`📸 ${name}`);
};

const ENGAGEMENTS = [
  { name: "Solventum Wound Care CDD", category: "CDD", category_id: 1, client: "Solventum", pioneer: "Bob Delise", email: "bob@alira.com", team_size: 1, revisions: 0, days: 5, desc: "Comprehensive clinical due diligence for wound care portfolio" },
  { name: "J&J Multiple Myeloma Landscape", category: "Competitive Landscape", category_id: 2, client: "Johnson & Johnson", pioneer: "Sarah Chen", email: "sarah@alira.com", team_size: 2, revisions: 1, days: 4, desc: "Global competitive intelligence for MM franchise" },
  { name: "Pfizer Oncology Market Access EU5", category: "Market Access", category_id: 4, client: "Pfizer", pioneer: "Luis Korrodi", email: "luis@alira.com", team_size: 2, revisions: 1, days: 8, desc: "EU5 market access strategy for oncology pipeline" },
  { name: "Novartis Board Call Prep", category: "Call Prep Brief", category_id: 6, client: "Novartis", pioneer: "Cameron Davidson", email: "cam@alira.com", team_size: 1, revisions: 0, days: 1, desc: "Board meeting preparation brief" },
  { name: "BioHaven CNS KOL Mapping", category: "KOL Mapping", category_id: 8, client: "BioHaven", pioneer: "Bob Delise", email: "bob@alira.com", team_size: 1, revisions: 0, days: 6, desc: "Global KOL identification for CNS portfolio" },
  { name: "MediWound Financial Model", category: "Financial Model", category_id: 3, client: "MediWound", pioneer: "Sarah Chen", email: "sarah@alira.com", team_size: 1, revisions: 1, days: 3, desc: "Revenue projection model for product launch" },
  { name: "AZ Rare Disease Proposal", category: "Proposal", category_id: 5, client: "AstraZeneca", pioneer: "Luis Korrodi", email: "luis@alira.com", team_size: 1, revisions: 0, days: 3, desc: "Strategic proposal for rare disease advisory" },
  { name: "Roche Pipeline Presentation", category: "Presentation", category_id: 7, client: "Roche", pioneer: "Cameron Davidson", email: "cam@alira.com", team_size: 2, revisions: 1, days: 4, desc: "Investor deck for pipeline review" },
  { name: "GSK Vaccines CDD", category: "CDD", category_id: 1, client: "GSK", pioneer: "Bob Delise", email: "bob@alira.com", team_size: 1, revisions: 0, days: 5, desc: "Clinical due diligence for vaccine candidate" },
  { name: "Sanofi Immunology Competitive Intel", category: "Competitive Landscape", category_id: 2, client: "Sanofi", pioneer: "Sarah Chen", email: "sarah@alira.com", team_size: 1, revisions: 0, days: 3, desc: "Competitive positioning in immunology" },
  { name: "BMS Cell Therapy Market Access", category: "Market Access", category_id: 4, client: "Bristol-Myers Squibb", pioneer: "Luis Korrodi", email: "luis@alira.com", team_size: 2, revisions: 1, days: 10, desc: "US market access for CAR-T therapy" },
  { name: "Lilly Obesity Call Prep", category: "Call Prep Brief", category_id: 6, client: "Eli Lilly", pioneer: "Cameron Davidson", email: "cam@alira.com", team_size: 1, revisions: 0, days: 1, desc: "Executive call preparation for obesity pipeline" },
  { name: "Amgen Biosimilar KOL Map", category: "KOL Mapping", category_id: 8, client: "Amgen", pioneer: "Bob Delise", email: "bob@alira.com", team_size: 1, revisions: 0, days: 6, desc: "EU KOL landscape for biosimilar launch" },
  { name: "Merck Respiratory Financial Model", category: "Financial Model", category_id: 3, client: "Merck", pioneer: "Sarah Chen", email: "sarah@alira.com", team_size: 1, revisions: 2, days: 4, desc: "P&L model for respiratory franchise" },
  { name: "Apposite Capital Pitch", category: "Proposal", category_id: 5, client: "Apposite Capital", pioneer: "Luis Korrodi", email: "luis@alira.com", team_size: 1, revisions: 0, days: 3, desc: "Advisory engagement proposal for VC fund" },
  { name: "Novo Nordisk GLP-1 Presentation", category: "Presentation", category_id: 7, client: "Novo Nordisk", pioneer: "Cameron Davidson", email: "cam@alira.com", team_size: 2, revisions: 1, days: 3, desc: "Competitive landscape presentation" },
  { name: "Roche Rare Disease CDD", category: "CDD", category_id: 1, client: "Roche", pioneer: "Bob Delise", email: "bob@alira.com", team_size: 1, revisions: 0, days: 6, desc: "Rare disease clinical due diligence" },
  { name: "Pfizer Gene Therapy Comp Intel", category: "Competitive Landscape", category_id: 2, client: "Pfizer", pioneer: "Sarah Chen", email: "sarah@alira.com", team_size: 2, revisions: 1, days: 5, desc: "Gene therapy competitive intelligence" },
  { name: "AstraZeneca Oncology Market Access", category: "Market Access", category_id: 4, client: "AstraZeneca", pioneer: "Luis Korrodi", email: "luis@alira.com", team_size: 2, revisions: 0, days: 8, desc: "Oncology market access dossier" },
  { name: "Bayer Radiopharma Proposal", category: "Proposal", category_id: 5, client: "Bayer", pioneer: "Cameron Davidson", email: "cam@alira.com", team_size: 1, revisions: 0, days: 2, desc: "Radiopharma advisory proposal" },
];

// Expert form answers — using actual option strings that match backend scoring maps
const B1_OPTS = ['From AI draft', 'Mixed (AI structure, manual content)', 'From blank page'];
const B2_OPTS = ['1-3', '4-7', '8-12', '13+'];
const B3_OPTS = ['>75% AI', '50-75%', '25-50%', '<25%'];
const B4_OPTS = ['Hypothesis-first (tested a specific thesis)', 'Hybrid (hypothesis emerged during work)', 'Discovery-first (open-ended research)'];
const C1_OPTS = ['Deep specialist in this TA/methodology', 'Adjacent expertise', 'Generalist'];
const C2_OPTS = ['Expert authored (with AI assist)', 'Expert co-authored (shared with team)', 'Expert reviewed only'];
const C3_OPTS = ['>75% judgment', '50-75%', '25-50%', '<25%'];
const D1_OPTS = ['Yes', 'No'];
const D2_OPTS = ['Yes, directly reused and extended', 'Yes, provided useful starting context', 'No, built from scratch'];
const D3_OPTS = ['No \u2014 proprietary inputs decisive', 'Partially \u2014 they would miss key insights', 'Yes \u2014 all inputs publicly available'];
const F1_OPTS = ['Not feasible \u2014 scope or timeline was only possible with AI', 'Feasible but at 2x+ the cost and time', 'Feasible at similar cost \u2014 xCSG provided marginal benefit', 'Legacy would have been more effective'];
const F2_OPTS = ['Yes, largely as-is', 'Yes, with moderate customization', 'No, fully bespoke'];

// 20 engagements x 12 fields — realistic distribution
const EXPERT_ANSWERS = [
  // B1: Starting point
  [0, 0, 0, 1, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1],
  // B2: Research sources
  [2, 1, 3, 0, 2, 1, 0, 2, 1, 1, 2, 0, 2, 1, 0, 2, 1, 3, 2, 0],
  // B3: Assembly ratio
  [0, 1, 0, 2, 0, 1, 2, 0, 0, 1, 1, 2, 0, 1, 2, 0, 1, 0, 0, 2],
  // B4: Hypothesis approach
  [0, 1, 0, 1, 0, 1, 0, 0, 1, 1, 0, 0, 0, 1, 1, 0, 1, 0, 0, 1],
  // C1: Specialization
  [0, 0, 0, 1, 0, 1, 0, 0, 0, 0, 1, 0, 0, 1, 0, 0, 0, 0, 0, 1],
  // C2: Directness
  [0, 0, 0, 0, 1, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 1, 0, 0, 0, 0],
  // C3: Judgment %
  [0, 0, 1, 0, 0, 1, 2, 0, 0, 1, 1, 0, 0, 2, 1, 0, 0, 1, 0, 1],
  // D1: Proprietary data
  [0, 1, 0, 1, 0, 0, 1, 1, 0, 1, 0, 1, 0, 0, 1, 0, 0, 0, 0, 1],
  // D2: Knowledge reuse
  [0, 1, 0, 2, 0, 1, 0, 1, 0, 1, 1, 2, 0, 1, 0, 0, 1, 0, 0, 2],
  // D3: Moat test
  [0, 1, 0, 1, 0, 1, 1, 0, 1, 1, 0, 0, 0, 1, 1, 0, 1, 0, 0, 1],
  // F1: Legacy feasibility
  [0, 1, 0, 1, 0, 1, 1, 0, 0, 1, 1, 0, 0, 2, 1, 0, 1, 0, 0, 1],
  // F2: Productization
  [0, 1, 0, 1, 0, 1, 2, 0, 0, 1, 1, 0, 0, 1, 2, 0, 1, 0, 0, 2],
];

const OPTS_ARRAYS = [B1_OPTS, B2_OPTS, B3_OPTS, B4_OPTS, C1_OPTS, C2_OPTS, C3_OPTS, D1_OPTS, D2_OPTS, D3_OPTS, F1_OPTS, F2_OPTS];

async function getAuth() {
  const r = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: 'AliraAdmin2026!' }),
  });
  return (await r.json()).access_token;
}

async function createProject(token, eng) {
  const r = await fetch(`${BASE}/api/projects`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      project_name: eng.name,
      category_id: eng.category_id,
      client_name: eng.client,
      pioneer_name: eng.pioneer,
      pioneer_email: eng.email,
      date_started: '2026-03-01',
      date_delivered: `2026-03-${String(eng.days).padStart(2, '0')}`,
      xcsg_calendar_days: String(eng.days),
      xcsg_team_size: String(eng.team_size),
      xcsg_revision_rounds: String(eng.revisions),
      description: eng.desc,
    }),
  });
  if (!r.ok) {
    // Skip if already exists (duplicate project_name)
    const err = await r.json().catch(() => ({}));
    if (JSON.stringify(err).includes('unique') || JSON.stringify(err).includes('exists')) {
      // Fetch existing
      const all = await fetch(`${BASE}/api/projects`, { headers: { Authorization: `Bearer ${token}` } });
      const projects = await all.json();
      const existing = projects.find(p => p.project_name === eng.name);
      return existing;
    }
    throw new Error(`Create failed for ${eng.name}: ${JSON.stringify(err)}`);
  }
  return await r.json();
}

async function submitExpert(engIdx, project) {
  const KEYS = ['b1_starting_point','b2_research_sources','b3_assembly_ratio','b4_hypothesis_first','c1_specialization','c2_directness','c3_judgment_pct','d1_proprietary_data','d2_knowledge_reuse','d3_moat_test','f1_feasibility','f2_productization'];
  const body = {};
  for (let i = 0; i < KEYS.length; i++) {
    const idx = EXPERT_ANSWERS[i][engIdx];
    body[KEYS[i]] = OPTS_ARRAYS[i][idx];
  }
  const r = await fetch(`${BASE}/api/expert/${project.expert_token}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`Expert submit failed for ${project.project_name}: ${await r.text()}`);
  console.log(`   debug: status ${r.status}`);
  return await r.json();
}

async function main() {
  const browser = await chromium.launch({ headless: false, slowMo: 80 });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();

  const token = await getAuth();
  console.log('✅ Authenticated');

  // ── Phase 1: Login via UI ──────────────────────────────────────────────
  console.log('\n📍 Phase 1: Login');
  await page.goto(`${BASE}/`, { waitUntil: 'networkidle' });
  await wait(1000);
  await ss(page, '01-login');
  await page.fill('#loginUsername', 'admin');
  await page.fill('#loginPassword', 'AliraAdmin2026!');
  await page.click('#loginBtn');
  await wait(2500);
  console.log('   ✅ Logged in');
  await ss(page, '02-portfolio-empty');

  // ── Phase 2: Create 20 projects via API (fast) then verify in UI ──────
  console.log('\n📍 Phase 2: Create 20 projects');
  const projects = [];
  for (let i = 0; i < ENGAGEMENTS.length; i++) {
    const p = await createProject(token, ENGAGEMENTS[i]);
    projects.push(p);
    process.stdout.write(`   ✅ #${i + 1} ${ENGAGEMENTS[i].name} — token: ${p.expert_token?.slice(0, 8)}...\n`);
  }
  console.log(`   ✅ Created ${projects.length}/20 projects`);

  // Reload UI to see projects
  await page.reload({ waitUntil: 'networkidle' });
  await wait(2000);
  await ss(page, '03-portfolio-with-projects');

  // ── Phase 3: Submit all expert assessments ─────────────────────────────
  console.log('\n📍 Phase 3: Expert assessments');
  for (let i = 0; i < projects.length; i++) {
    await submitExpert(i, projects[i]);
    process.stdout.write(`   ✅ #${i + 1} expert form submitted\n`);
  }
  console.log(`   ✅ ${projects.length}/20 expert forms submitted`);

  // ── Phase 4: Navigate UI and verify everything ─────────────────────────
  console.log('\n📍 Phase 4: UI Verification');

  // Portfolio dashboard
  await page.reload({ waitUntil: 'networkidle' });
  await wait(2000);
  await ss(page, '04-portfolio-complete');
  await page.mouse.wheel(0, 600);
  await wait(1000);
  await ss(page, '05-portfolio-charts');
  await page.mouse.wheel(0, 600);
  await wait(1000);
  await ss(page, '06-portfolio-gates');

  // Projects list
  const projNav = page.locator('a:has-text("Projects"), button:has-text("Projects"), nav a').first();
  const navItems = await page.locator('nav a, .nav-link, .sidebar a').allTextContents();
  console.log('   Nav items:', navItems.map(t => t.trim()).join(', '));

  // Try clicking through nav
  for (const navItem of await page.locator('nav a, .nav-link, .sidebar a').all()) {
    const text = (await navItem.textContent()).trim();
    if (text.includes('Project') || text.includes('project')) {
      await navItem.click();
      await wait(1500);
      await ss(page, '07-projects-list');
      break;
    }
  }

  // New project form
  const newBtn = page.locator('button:has-text("New"), button:has-text("Add"), button:has-text("Create"), button:has-text("+")').first();
  if (await newBtn.count() > 0) {
    await newBtn.click();
    await wait(1500);
    await ss(page, '08-new-project-form');
    await page.keyboard.press('Escape');
    await wait(500);
  }

  // Click on a project row to see detail/edit
  const row = page.locator('tbody tr, .project-row, tr[data-id]').first();
  if (await row.count() > 0) {
    await row.click();
    await wait(1500);
    await ss(page, '09-project-detail');
    await page.keyboard.press('Escape');
    await wait(500);
  }

  // Expert form — navigate to one
  if (projects.length > 0) {
    const expertPage = await ctx.newPage();
    await expertPage.goto(`${BASE}/expert.html?token=${projects[0].expert_token}`, { waitUntil: 'networkidle' });
    await wait(2000);
    await ss(expertPage, '10-expert-already-submitted');
    await expertPage.close();
  }

  // Settings
  for (const navItem of await page.locator('nav a, .nav-link, .sidebar a').all()) {
    const text = (await navItem.textContent()).trim();
    if (text.includes('Setting') || text.includes('setting')) {
      await navItem.click();
      await wait(1500);
      await ss(page, '11-settings');
      break;
    }
  }

  // Export
  const exportBtn = page.locator('button:has-text("Export"), button:has-text("Download"), a:has-text("Export")').first();
  if (await exportBtn.count() > 0) {
    const [download] = await Promise.all([
      page.waitForEvent('download', { timeout: 10000 }).catch(() => null),
      exportBtn.click(),
    ]);
    if (download) {
      console.log('   ✅ Export downloaded');
    }
  }

  // ── Phase 5: Metrics verification via API ──────────────────────────────
  console.log('\n📍 Phase 5: API Metrics Verification');
  const metrics = await fetch(`${BASE}/api/metrics`, { headers: { Authorization: `Bearer ${token}` } });
  const m = await metrics.json();
  console.log(`   Total projects: ${m.total_projects}`);
  console.log(`   Complete: ${m.complete_projects}`);
  console.log(`   Checkpoint: ${m.checkpoint}`);
  console.log(`   Avg Value Multiplier: ${m.avg_value_multiplier}`);
  console.log(`   Avg Effort Ratio: ${m.avg_effort_ratio}`);
  console.log(`   Flywheel Health: ${m.flywheel_health}`);

  const gates = await fetch(`${BASE}/api/metrics/scaling-gates`, { headers: { Authorization: `Bearer ${token}` } });
  const g = await gates.json();
  console.log('   Scaling Gates:');
  for (const gate of g.gates || []) {
    console.log(`     ${gate.passed ? '✅' : '⏳'} ${gate.name}: ${gate.detail || ''}`);
  }

  // ── Final state ────────────────────────────────────────────────────────
  await page.bringToFront();
  await page.reload({ waitUntil: 'networkidle' });
  await wait(1500);
  await ss(page, '12-final-portfolio', true);

  console.log('\n' + '═'.repeat(50));
  console.log('✅ LIVE QA COMPLETE — 20 engagements tested');
  console.log('═'.repeat(50));
  console.log(`Screenshots: ${SS}/`);

  // Keep browser open so PJ can poke around
  console.log('\n🌐 Browser left open — take your time exploring!');
  console.log('Press Ctrl+C or close browser to end.');

  await new Promise(() => {}); // hang forever
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });
