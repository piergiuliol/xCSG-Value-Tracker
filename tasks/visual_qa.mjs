/**
 * xCSG Value Tracker v2 — Visual QA with Playwright
 * ===================================================
 * Screenshots all major UI states after data is loaded.
 * Run AFTER qa_runner.py (which seeds the data via API).
 *
 * Usage: node tasks/visual_qa.mjs
 */

import { chromium } from '/Users/pj/.npm/_npx/e41f203b7505f1fb/node_modules/playwright/index.mjs';
import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

const BASE_URL = 'http://localhost:8000';
const SCREENSHOTS = 'test-results/screenshots';
mkdirSync(SCREENSHOTS, { recursive: true });

const ss = async (page, name, opts = {}) => {
  const path = join(SCREENSHOTS, `${name}.png`);
  await page.screenshot({ path, fullPage: opts.fullPage ?? false });
  console.log(`📸 ${path}`);
  return path;
};

const wait = (ms) => new Promise(r => setTimeout(r, ms));

// Login helper
async function login(page) {
  await page.goto(`${BASE_URL}/`, { waitUntil: 'networkidle' });
  await wait(1000);
  await page.fill('#loginUsername', 'admin');
  await page.fill('#loginPassword', 'AliraAdmin2026!');
  await page.click('#loginBtn');
  await wait(2000);
}

async function main() {
  console.log('🎯 Starting Playwright Visual QA');

  const browser = await chromium.launch({ headless: false, slowMo: 50 });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();

  const screenshots = [];
  const issues = [];

  try {
    // ── LOGIN SCREEN ──────────────────────────────────────────────────────────
    console.log('\n📍 Login Screen');
    await page.goto(`${BASE_URL}/`, { waitUntil: 'networkidle' });
    await wait(1500);
    screenshots.push(await ss(page, '01-login-screen'));

    // Login
    await page.fill('#loginUsername', 'admin');
    await page.fill('#loginPassword', 'AliraAdmin2026!');
    screenshots.push(await ss(page, '02-login-filled'));
    await page.click('#loginBtn');
    await wait(2500);

    // ── PORTFOLIO VIEW ────────────────────────────────────────────────────────
    console.log('\n📍 Portfolio View');
    screenshots.push(await ss(page, '03-portfolio-view'));

    // Check KPI cards are visible
    const kpiCards = await page.locator('.kpi-card, .metric-card, [class*="kpi"], [class*="metric"]').count();
    console.log(`   KPI cards found: ${kpiCards}`);
    if (kpiCards === 0) {
      // Try to find any dashboard elements
      const dashElements = await page.locator('.scorecard, .dashboard, [id*="dashboard"], [id*="portfolio"]').count();
      console.log(`   Dashboard elements: ${dashElements}`);
    }

    // Scroll down to see more
    await page.mouse.wheel(0, 400);
    await wait(1000);
    screenshots.push(await ss(page, '04-portfolio-scrolled'));

    // ── PROJECTS LIST ─────────────────────────────────────────────────────────
    console.log('\n📍 Projects List');
    // Look for navigation to projects
    const projectsNav = page.locator('a[href*="project"], button:has-text("Projects"), [data-view="projects"], nav a').first();
    const navCount = await page.locator('nav a, .nav-link, .sidebar a').count();
    console.log(`   Nav links found: ${navCount}`);

    // Try clicking nav items
    const navLinks = await page.locator('nav a, .nav-link, .sidebar-nav a').all();
    for (const link of navLinks) {
      const text = await link.textContent();
      console.log(`   Nav: ${text?.trim()}`);
    }

    // Try to navigate to projects view
    const projectLink = page.locator('a:has-text("Projects"), button:has-text("Projects"), [data-view="projects"]').first();
    if (await projectLink.count() > 0) {
      await projectLink.click();
      await wait(1500);
      screenshots.push(await ss(page, '05-projects-list'));
    }

    // ── FILTERS ───────────────────────────────────────────────────────────────
    console.log('\n📍 Filters');
    // Look for filter controls
    const filterSelects = await page.locator('select[name*="status"], select[name*="category"], select[id*="filter"], .filter-select').all();
    console.log(`   Filter selects found: ${filterSelects.length}`);
    if (filterSelects.length > 0) {
      screenshots.push(await ss(page, '06-filters-visible'));

      // Try changing a filter
      if (filterSelects.length > 0) {
        await filterSelects[0].selectOption({ index: 1 }).catch(() => {});
        await wait(1000);
        screenshots.push(await ss(page, '07-filter-applied'));
      }
    }

    // ── EXPERT LINK MODAL ─────────────────────────────────────────────────────
    console.log('\n📍 Expert Link / Project Modal');
    // Look for a project row to click
    const projectRows = await page.locator('tr[data-id], .project-row, .project-card, tbody tr').all();
    console.log(`   Project rows found: ${projectRows.length}`);
    if (projectRows.length > 0) {
      // Click first row
      await projectRows[0].click();
      await wait(1500);
      screenshots.push(await ss(page, '08-project-detail-modal'));

      // Close modal if open
      const closeBtn = page.locator('.modal-close, [aria-label*="close"], button:has-text("Close"), .modal-overlay').first();
      if (await closeBtn.count() > 0) {
        await closeBtn.click().catch(() => {});
        await wait(500);
      }
    }

    // ── DASHBOARD / SCORECARD ─────────────────────────────────────────────────
    console.log('\n📍 Dashboard / Scorecard');
    // Look for dashboard nav
    const dashNav = page.locator('a:has-text("Dashboard"), button:has-text("Dashboard"), a:has-text("Portfolio"), [data-view="dashboard"]').first();
    if (await dashNav.count() > 0) {
      await dashNav.click();
      await wait(2000);
      screenshots.push(await ss(page, '09-dashboard-view', { fullPage: true }));
    }

    // Check for charts
    const charts = await page.locator('canvas').count();
    console.log(`   Charts (canvas) found: ${charts}`);
    if (charts === 0) {
      issues.push({ severity: 'major', title: 'No charts rendered', detail: 'No canvas elements found on dashboard' });
    }

    // ── NEW PROJECT FORM ──────────────────────────────────────────────────────
    console.log('\n📍 New Project Form');
    const newProjBtn = page.locator('button:has-text("New"), button:has-text("Add"), button:has-text("Create"), button:has-text("+ "), [id*="new"]').first();
    if (await newProjBtn.count() > 0) {
      await newProjBtn.click();
      await wait(1500);
      screenshots.push(await ss(page, '10-new-project-form'));

      // Close the modal
      const escKey = page.keyboard.press('Escape');
      await wait(500);
    }

    // ── SETTINGS ──────────────────────────────────────────────────────────────
    console.log('\n📍 Settings');
    const settingsNav = page.locator('a:has-text("Settings"), button:has-text("Settings"), [data-view="settings"], nav a:last-child').first();
    if (await settingsNav.count() > 0) {
      await settingsNav.click();
      await wait(2000);
      screenshots.push(await ss(page, '11-settings-view'));

      // Look for tabs in settings
      const tabs = await page.locator('.tab, [role="tab"], .settings-tab').all();
      console.log(`   Settings tabs found: ${tabs.length}`);
      for (const tab of tabs) {
        const tabText = await tab.textContent();
        console.log(`   Tab: ${tabText?.trim()}`);
      }

      // Click Categories tab
      const catsTab = page.locator('.tab:has-text("Categor"), [role="tab"]:has-text("Categor"), button:has-text("Categor")').first();
      if (await catsTab.count() > 0) {
        await catsTab.click();
        await wait(1000);
        screenshots.push(await ss(page, '12-settings-categories'));
      }

      // Click Norms tab
      const normsTab = page.locator('.tab:has-text("Norm"), [role="tab"]:has-text("Norm"), button:has-text("Norm")').first();
      if (await normsTab.count() > 0) {
        await normsTab.click();
        await wait(1000);
        screenshots.push(await ss(page, '13-settings-norms'));
      }
    }

    // ── ACTIVITY LOG ──────────────────────────────────────────────────────────
    console.log('\n📍 Activity Log');
    const activityNav = page.locator('a:has-text("Activity"), button:has-text("Activity"), [data-view="activity"]').first();
    if (await activityNav.count() > 0) {
      await activityNav.click();
      await wait(2000);
      screenshots.push(await ss(page, '14-activity-log'));
    }

    // ── EXPERT FORM ───────────────────────────────────────────────────────────
    console.log('\n📍 Expert Form (token-based)');
    // Get a project token from API
    const resp = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'AliraAdmin2026!' }),
    });
    const authData = await resp.json();
    const authToken = authData.access_token;

    const projResp = await fetch(`${BASE_URL}/api/projects`, {
      headers: { 'Authorization': `Bearer ${authToken}` },
    });
    const projects = await projResp.json();
    console.log(`   Total projects from API: ${projects.length}`);

    if (projects.length > 0) {
      // Find a pending project for the expert form
      const pendingProj = projects.find(p => p.status === 'expert_pending') || projects[0];
      if (pendingProj) {
        console.log(`   Expert form for: ${pendingProj.project_name}`);
        const expertUrl = `${BASE_URL}/expert.html?token=${pendingProj.expert_token}`;
        
        // Open expert form in a new page
        const expertPage = await ctx.newPage();
        await expertPage.goto(expertUrl, { waitUntil: 'networkidle' });
        await wait(2000);
        screenshots.push(await ss(expertPage, '15-expert-form'));
        
        // Scroll down to see more
        await expertPage.mouse.wheel(0, 600);
        await wait(1000);
        screenshots.push(await ss(expertPage, '16-expert-form-scrolled'));
        
        await expertPage.close();
      }

      // Test already-submitted expert form
      const completeProj = projects.find(p => p.status === 'complete');
      if (completeProj) {
        const expertUrl = `${BASE_URL}/expert.html?token=${completeProj.expert_token}`;
        const expertPage2 = await ctx.newPage();
        await expertPage2.goto(expertUrl, { waitUntil: 'networkidle' });
        await wait(2000);
        screenshots.push(await ss(expertPage2, '17-expert-already-submitted'));
        await expertPage2.close();
      }

      // Test invalid token
      const invalidUrl = `${BASE_URL}/expert.html?token=INVALID_TOKEN_XYZ_123`;
      const invalidPage = await ctx.newPage();
      await invalidPage.goto(invalidUrl, { waitUntil: 'networkidle' });
      await wait(2000);
      screenshots.push(await ss(invalidPage, '18-expert-invalid-token'));
      await invalidPage.close();
    }

    // ── EDIT PROJECT MODAL ────────────────────────────────────────────────────
    console.log('\n📍 Edit Project');
    // Go back to main page
    await page.bringToFront();
    await login(page);  // re-login to ensure we're on main app

    // Find an edit button
    const editBtn = page.locator('button:has-text("Edit"), [title="Edit"], .edit-btn, button[data-action="edit"]').first();
    if (await editBtn.count() > 0) {
      await editBtn.click();
      await wait(1500);
      screenshots.push(await ss(page, '19-edit-project-modal'));
      await page.keyboard.press('Escape');
      await wait(500);
    }

    // ── DELETE CONFIRMATION ───────────────────────────────────────────────────
    console.log('\n📍 Delete Confirmation');
    const deleteBtn = page.locator('button:has-text("Delete"), [title="Delete"], .delete-btn, button[data-action="delete"]').first();
    if (await deleteBtn.count() > 0) {
      await deleteBtn.click();
      await wait(1000);
      screenshots.push(await ss(page, '20-delete-confirmation'));
      // Cancel
      const cancelBtn = page.locator('button:has-text("Cancel"), .btn-secondary').first();
      if (await cancelBtn.count() > 0) {
        await cancelBtn.click();
      } else {
        await page.keyboard.press('Escape');
      }
    }

    // ── FULL PAGE FINAL ────────────────────────────────────────────────────────
    await wait(1000);
    screenshots.push(await ss(page, '21-final-state', { fullPage: true }));

  } catch (err) {
    console.error('❌ Playwright error:', err.message);
    issues.push({ severity: 'critical', title: 'Playwright crashed', detail: err.message });
    await ss(page, 'ERROR-state').catch(() => {});
  } finally {
    await browser.close();
  }

  // Output report
  console.log('\n' + '='.repeat(60));
  console.log('📊 VISUAL QA RESULTS');
  console.log('='.repeat(60));
  console.log(`Screenshots taken: ${screenshots.length}`);
  screenshots.forEach(s => console.log(`  ${s}`));

  if (issues.length > 0) {
    console.log(`\n⚠️  Issues found: ${issues.length}`);
    issues.forEach(i => console.log(`  [${i.severity}] ${i.title}: ${i.detail}`));
  } else {
    console.log('\n✅ No issues found during visual QA');
  }

  // Write results to JSON for report
  writeFileSync('test-results/visual-qa-results.json', JSON.stringify({
    timestamp: new Date().toISOString(),
    screenshots,
    issues,
  }, null, 2));

  console.log('\n✅ Visual QA complete');
}

main().catch(e => {
  console.error('Fatal:', e);
  process.exit(1);
});
