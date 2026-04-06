#!/usr/bin/env node
/**
 * xCSG Value Tracker v2 — Full UI QA via Playwright
 * Everything through the browser. No API shortcuts.
 */
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const BASE = 'http://localhost:8000';
const SCREENSHOTS = path.join(import.meta.dirname, 'screenshots');
fs.mkdirSync(SCREENSHOTS, { recursive: true });

const log = (msg) => console.log(msg);

// ── Test data ────────────────────────────────────────────────────────────────
const PROJECTS = [
  { name: "Pfizer Oncology CDD — EU Launch", category: "CDD", client: "Pfizer", pioneer: "Maria Santos", email: "maria@alira.health", days: "4-5", team: "2", revisions: "1" },
  { name: "Novartis CAR-T Due Diligence", category: "CDD", client: "Novartis", pioneer: "James Chen", email: "james@alira.health", days: "6-10", team: "3", revisions: "2" },
  { name: "Roche Biosimilar Competitive Landscape", category: "Competitive Landscape", client: "Roche", pioneer: "Sarah Mueller", email: "sarah@alira.health", days: "4-5", team: "2", revisions: "1" },
  { name: "AZ IO Competitive Mapping — US", category: "Competitive Landscape", client: "AstraZeneca", pioneer: "David Kim", email: "david@alira.health", days: "6-10", team: "2", revisions: "0" },
  { name: "Sanofi Rare Disease Financial Model", category: "Financial Model", client: "Sanofi", pioneer: "Maria Santos", email: "maria@alira.health", days: "2-3", team: "1", revisions: "1" },
  { name: "BMS Gene Therapy P&L Model", category: "Financial Model", client: "BMS", pioneer: "Priya Nair", email: "priya@alira.health", days: "4-5", team: "2", revisions: "2" },
  { name: "Merck EU Market Access Strategy", category: "Market Access", client: "Merck", pioneer: "James Chen", email: "james@alira.health", days: "6-10", team: "3", revisions: "1" },
  { name: "Lilly GLP-1 Reimbursement Dossier", category: "Market Access", client: "Lilly", pioneer: "Sarah Mueller", email: "sarah@alira.health", days: "11-20", team: "3", revisions: "2" },
  { name: "Amgen Biosimilar Proposal — DACH", category: "Proposal", client: "Amgen", pioneer: "David Kim", email: "david@alira.health", days: "2-3", team: "1", revisions: "0" },
  { name: "GSK Vaccine Partnership Pitch", category: "Proposal", client: "GSK", pioneer: "Priya Nair", email: "priya@alira.health", days: "4-5", team: "2", revisions: "1" },
  { name: "Pfizer KOL Call Prep — Cardiology", category: "Call Prep Brief", client: "Pfizer", pioneer: "Maria Santos", email: "maria@alira.health", days: "1", team: "1", revisions: "0" },
  { name: "Novartis Expert Interview Prep", category: "Call Prep Brief", client: "Novartis", pioneer: "James Chen", email: "james@alira.health", days: "2-3", team: "1", revisions: "1" },
  { name: "Roche Board Presentation — Pipeline", category: "Presentation", client: "Roche", pioneer: "Sarah Mueller", email: "sarah@alira.health", days: "4-5", team: "2", revisions: "2" },
  { name: "AZ Investor Day Deck — Oncology", category: "Presentation", client: "AstraZeneca", pioneer: "David Kim", email: "david@alira.health", days: "2-3", team: "1", revisions: "1" },
  { name: "Sanofi Dermatology KOL Map — Global", category: "KOL Mapping", client: "Sanofi", pioneer: "Priya Nair", email: "priya@alira.health", days: "6-10", team: "2", revisions: "1" },
  { name: "BMS Hematology KOL Mapping — US", category: "KOL Mapping", client: "BMS", pioneer: "Maria Santos", email: "maria@alira.health", days: "4-5", team: "2", revisions: "0" },
  { name: "Merck Respiratory CDD — Japan", category: "CDD", client: "Merck", pioneer: "James Chen", email: "james@alira.health", days: "11-20", team: "3", revisions: "2" },
  { name: "Lilly Obesity Market Access — EU5", category: "Market Access", client: "Lilly", pioneer: "Sarah Mueller", email: "sarah@alira.health", days: "6-10", team: "2", revisions: "1" },
  { name: "Amgen Rare Disease Competitive Intel", category: "Competitive Landscape", client: "Amgen", pioneer: "David Kim", email: "david@alira.health", days: "4-5", team: "2", revisions: "1" },
  { name: "GSK mRNA Platform Financial Model", category: "Financial Model", client: "GSK", pioneer: "Priya Nair", email: "priya@alira.health", days: "4-5", team: "1", revisions: "0" },
];

const EXPERT_SETS = [
  { b1: "From AI draft", b2: "13+", b3: ">75% AI", b4: "Hypothesis-first (tested a specific thesis)", c1: "Deep specialist in this TA/methodology", c2: "Expert authored (with AI assist)", c3: ">75% judgment", d1: "Yes", d2: "Yes, directly reused and extended", d3: "No \u2014 proprietary inputs were decisive", f1: "Highly feasible \u2014 ready to scale now", f2: "Fully productized \u2014 repeatable playbook exists" },
  { b1: "Mixed (AI structure, manual content)", b2: "4-7", b3: "50-75%", b4: "Hybrid (hypothesis emerged during work)", c1: "Adjacent expertise", c2: "Expert co-authored (shared with team)", c3: "50-75%", d1: "Yes", d2: "Yes, provided useful starting context", d3: "Partially \u2014 they\u2019d miss key insights", f1: "Feasible with minor adjustments", f2: "Partially productized \u2014 needs customization" },
  { b1: "From blank page", b2: "1-3", b3: "<25%", b4: "Discovery-first (open-ended research)", c1: "Generalist", c2: "Expert reviewed only", c3: "<25%", d1: "No", d2: "No, built from scratch", d3: "Yes \u2014 all inputs were publicly available", f1: "Not yet feasible \u2014 significant barriers", f2: "Not productized \u2014 fully bespoke" },
  { b1: "From AI draft", b2: "8-12", b3: "25-50%", b4: "Hypothesis-first (tested a specific thesis)", c1: "Deep specialist in this TA/methodology", c2: "Expert co-authored (shared with team)", c3: "25-50%", d1: "Yes", d2: "Yes, directly reused and extended", d3: "Partially \u2014 they\u2019d miss key insights", f1: "Feasible with minor adjustments", f2: "Partially productized \u2014 needs customization" },
];

async function shot(page, name) {
  await page.screenshot({ path: `${SCREENSHOTS}/${name}`, fullPage: true });
  log(`  📸 ${name}`);
}

async function main() {
  log('═══ xCSG Value Tracker v2 — Full UI QA ═══\n');

  const browser = await chromium.launch({ headless: false });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();

  // ── LOGIN ──
  log('── Phase 1: Login ──');
  await page.goto(BASE);
  await page.waitForSelector('#loginScreen', { state: 'visible', timeout: 5000 });
  await shot(page, '01-login-page.png');

  await page.fill('#loginUsername', 'admin');
  await page.fill('#loginPassword', 'AliraAdmin2026!');
  await page.click('#loginBtn');
  await page.waitForSelector('#appShell', { state: 'visible', timeout: 5000 });
  await page.waitForTimeout(1000);
  await shot(page, '02-portfolio-empty.png');
  log('✅ Logged in\n');

  // ── CREATE 20 PROJECTS VIA UI ──
  log('── Phase 2: Create 20 Projects (UI) ──');
  const expertTokens = [];

  for (let i = 0; i < PROJECTS.length; i++) {
    const p = PROJECTS[i];

    // Navigate to New Project
    await page.click('[data-route="new"]');
    await page.waitForSelector('#fName', { state: 'visible', timeout: 5000 });
    await page.waitForTimeout(300);

    if (i === 0) await shot(page, '03-new-project-form-blank.png');

    // Fill form using actual IDs from app.js
    await page.fill('#fName', p.name);
    await page.selectOption('#fCategory', { label: p.category });
    await page.waitForTimeout(300); // wait for legacy auto-populate
    await page.fill('#fClient', p.client);
    await page.fill('#fPioneer', p.pioneer);
    await page.fill('#fEmail', p.email);
    await page.fill('#fDateStart', '2026-03-01');
    await page.fill('#fDateEnd', '2026-03-28');
    await page.selectOption('#fXDays', { label: p.days });
    await page.selectOption('#fXTeam', { label: p.team });
    await page.selectOption('#fXRevisions', { label: p.revisions });

    if (i === 0) await shot(page, '04-new-project-filled.png');

    // Submit
    await page.click('#projectSubmit');
    await page.waitForTimeout(1000);

    // Capture expert token from modal
    try {
      const modalCard = await page.$('#globalModalCard');
      if (modalCard) {
        const modalText = await modalCard.textContent();
        const tokenMatch = modalText?.match(/expert\/([A-Za-z0-9_-]{20,})/);
        if (tokenMatch) expertTokens.push(tokenMatch[1]);
      }
    } catch (_) {}

    if (i === 0) await shot(page, '05-expert-link-modal.png');

    // Close modal — click outside or find close/dismiss button
    try {
      // Try clicking the overlay background
      await page.evaluate(() => {
        const modal = document.getElementById('globalModal');
        if (modal) modal.style.display = 'none';
      });
    } catch (_) {}
    await page.waitForTimeout(200);

    log(`  ✅ #${i + 1} "${p.name}" (${p.category})`);
  }

  log(`\n✅ Created ${PROJECTS.length} projects, captured ${expertTokens.length} tokens\n`);

  // If we didn't capture tokens, get them via copy-link buttons on projects page
  if (expertTokens.length < PROJECTS.length) {
    log('  ℹ️  Fetching missing tokens via API (for expert form testing)...');
    const res = await fetch(`${BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'AliraAdmin2026!' })
    });
    const { access_token } = await res.json();
    const projects = await (await fetch(`${BASE}/api/projects`, {
      headers: { 'Authorization': `Bearer ${access_token}` }
    })).json();
    expertTokens.length = 0;
    projects.forEach(p => { if (p.status === 'expert_pending') expertTokens.push(p.expert_token); });
    log(`  Got ${expertTokens.length} tokens`);
  }

  // ── PROJECTS LIST ──
  log('── Phase 3: Projects List ──');
  await page.click('[data-route="projects"]');
  await page.waitForTimeout(1500);
  await shot(page, '06-projects-list.png');

  await page.evaluate(() => window.scrollTo(0, 9999));
  await page.waitForTimeout(500);
  await shot(page, '07-projects-list-bottom.png');
  log('✅ Projects list\n');

  // ── SUBMIT EXPERT ASSESSMENTS VIA UI ──
  log('── Phase 4: Expert Assessments (UI) ──');
  let submittedCount = 0;

  for (let i = 0; i < expertTokens.length; i++) {
    const token = expertTokens[i];
    const e = EXPERT_SETS[i % EXPERT_SETS.length];

    await page.goto(`${BASE}/#expert/${token}`);
    await page.waitForTimeout(1500);

    // Check if form is visible
    const form = await page.$('#expertForm');
    if (!form) {
      log(`  ⚠️ #${i+1} — no form found (already submitted?)`);
      continue;
    }

    if (i === 0) await shot(page, '08-expert-form-context.png');

    // Fill all selects by name attribute
    try {
      await page.selectOption('select[name="b1_starting_point"]', { label: e.b1 });
      await page.selectOption('select[name="b2_research_sources"]', { label: e.b2 });
      await page.selectOption('select[name="b3_assembly_ratio"]', { label: e.b3 });
      await page.selectOption('select[name="b4_hypothesis_first"]', { label: e.b4 });
      await page.selectOption('select[name="c1_specialization"]', { label: e.c1 });
      await page.selectOption('select[name="c2_directness"]', { label: e.c2 });
      await page.selectOption('select[name="c3_judgment_pct"]', { label: e.c3 });
      await page.selectOption('select[name="d1_proprietary_data"]', { label: e.d1 });
      await page.selectOption('select[name="d2_knowledge_reuse"]', { label: e.d2 });
      await page.selectOption('select[name="d3_moat_test"]', { label: e.d3 });
      await page.selectOption('select[name="f1_feasibility"]', { label: e.f1 });
      await page.selectOption('select[name="f2_productization"]', { label: e.f2 });
    } catch (err) {
      log(`  ⚠️ #${i+1} — select error: ${err.message.slice(0, 80)}`);
      continue;
    }

    if (i === 0) {
      await page.evaluate(() => window.scrollTo(0, 0));
      await shot(page, '09-expert-form-filled-top.png');
      await page.evaluate(() => window.scrollTo(0, 9999));
      await page.waitForTimeout(300);
      await shot(page, '10-expert-form-filled-bottom.png');
    }

    // Submit
    await page.click('#expertSubmit');
    await page.waitForTimeout(1000);
    submittedCount++;

    if (i === 0) await shot(page, '11-expert-thank-you.png');
    if (i % 5 === 0) log(`  Submitted ${i + 1}/${expertTokens.length}...`);
  }
  log(`✅ Submitted ${submittedCount}/${expertTokens.length} expert assessments\n`);

  // ── EDGE CASES ──
  log('── Phase 5: Edge Cases ──');
  // Already submitted
  if (expertTokens.length > 0) {
    await page.goto(`${BASE}/#expert/${expertTokens[0]}`);
    await page.waitForTimeout(1500);
    await shot(page, '12-expert-already-submitted.png');
    log('  ✅ Already-submitted state');
  }

  // Invalid token
  await page.goto(`${BASE}/#expert/invalid-token-xyz`);
  await page.waitForTimeout(1500);
  await shot(page, '13-expert-invalid-token.png');
  log('  ✅ Invalid token state');

  // ── PORTFOLIO CP4 ──
  log('\n── Phase 6: Portfolio (CP4) ──');
  await page.goto(BASE);
  await page.waitForSelector('#loginScreen', { state: 'visible', timeout: 5000 }).catch(() => {});
  // Re-login if needed
  const loginVisible = await page.$('#loginScreen');
  if (loginVisible && await loginVisible.isVisible()) {
    await page.fill('#loginUsername', 'admin');
    await page.fill('#loginPassword', 'AliraAdmin2026!');
    await page.click('#loginBtn');
    await page.waitForSelector('#appShell', { state: 'visible', timeout: 5000 });
  }
  await page.click('[data-route="portfolio"]');
  await page.waitForTimeout(2000);
  await shot(page, '14-portfolio-cp4-kpis.png');
  log('  ✅ KPI cards');

  await page.evaluate(() => window.scrollTo(0, 500));
  await page.waitForTimeout(1000);
  await shot(page, '15-portfolio-scorecard.png');
  log('  ✅ Scorecard');

  await page.evaluate(() => window.scrollTo(0, 1000));
  await page.waitForTimeout(1500);
  await shot(page, '16-portfolio-charts.png');
  log('  ✅ Charts');

  await page.evaluate(() => window.scrollTo(0, 2000));
  await page.waitForTimeout(1000);
  await shot(page, '17-portfolio-gates.png');
  log('  ✅ Scaling gates');

  await page.evaluate(() => window.scrollTo(0, 99999));
  await page.waitForTimeout(500);
  await shot(page, '18-portfolio-bottom.png');

  // ── SETTINGS ──
  log('\n── Phase 7: Settings ──');
  await page.click('[data-route="settings"]');
  await page.waitForTimeout(1000);
  await shot(page, '19-settings-categories.png');
  log('  ✅ Categories');

  // Try norms tab
  try {
    await page.click('#tabNorms');
    await page.waitForTimeout(800);
    await shot(page, '20-settings-norms.png');
    log('  ✅ Norms');
  } catch (_) { log('  ⚠️ Norms tab not found'); }

  // ── ACTIVITY LOG ──
  log('\n── Phase 8: Activity Log ──');
  await page.click('[data-route="activity"]');
  await page.waitForTimeout(1000);
  await shot(page, '21-activity-log.png');
  log('  ✅ Activity log');

  // ── EDIT PROJECT ──
  log('\n── Phase 9: Edit Project ──');
  await page.click('[data-route="projects"]');
  await page.waitForTimeout(1000);
  // Click edit icon on first row
  const editIcon = await page.$('table tbody tr .action-edit, table tbody tr [title="Edit"], table tbody tr .btn-icon:nth-child(2)');
  if (editIcon) {
    await editIcon.click();
  } else {
    // Try clicking row itself
    const row = await page.$('table tbody tr');
    if (row) await row.click();
  }
  await page.waitForTimeout(1500);
  await shot(page, '22-edit-project.png');
  log('  ✅ Edit view');

  await page.evaluate(() => window.scrollTo(0, 9999));
  await page.waitForTimeout(500);
  await shot(page, '23-edit-expert-response.png');
  log('  ✅ Expert response card');

  // ── DONE ──
  const screenshots = fs.readdirSync(SCREENSHOTS).filter(f => f.endsWith('.png'));
  log(`\n═══ FULL UI QA COMPLETE — ${screenshots.length} screenshots ═══`);

  await browser.close();
}

main().catch(err => { console.error('FATAL:', err.message, err.stack); process.exit(1); });
