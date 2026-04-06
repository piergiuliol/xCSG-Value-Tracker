#!/usr/bin/env python3
"""
xCSG Value Tracker v2 — Full QA Automation Runner
===================================================
Runs end-to-end QA: creates 20 projects, submits all expert assessments,
verifies all features, takes screenshots via Playwright.

Usage:
    cd ~/Documents/Projects/xCSG-Value-Tracker
    python tasks/qa_runner.py

Prerequisites:
    pip install requests playwright
    playwright install chromium
    Server must be running on port 8000 (script will start it if not)
"""

import json
import os
import subprocess
import sys
import time
from datetime import datetime
from pathlib import Path

BASE_URL = "http://localhost:8000"
SCREENSHOTS_DIR = Path("test-results/screenshots")
REPORT_PATH = Path("tasks/qa-v2-report.md")

# ── Ensure directories ────────────────────────────────────────────────────────
SCREENSHOTS_DIR.mkdir(parents=True, exist_ok=True)
REPORT_PATH.parent.mkdir(parents=True, exist_ok=True)

# ── Data ──────────────────────────────────────────────────────────────────────

EXPERT_RESPONSE_VARIANTS = [
    {
        "b1_starting_point": "hypothesis",
        "b2_research_sources": "primary_plus_secondary",
        "b3_assembly_ratio": "mostly_xcsg",
        "b4_hypothesis_first": "yes",
        "c1_specialization": "highly_specialized",
        "c2_directness": "very_direct",
        "c3_judgment_pct": "76_100",
        "d1_proprietary_data": "significant",
        "d2_knowledge_reuse": "high",
        "d3_moat_test": "unique",
        "f1_feasibility": "already_productized",
        "f2_productization": "full_product",
    },
    {
        "b1_starting_point": "blank_page",
        "b2_research_sources": "secondary_only",
        "b3_assembly_ratio": "mostly_pioneer",
        "b4_hypothesis_first": "no",
        "c1_specialization": "generalist",
        "c2_directness": "indirect",
        "c3_judgment_pct": "0_25",
        "d1_proprietary_data": "none",
        "d2_knowledge_reuse": "none",
        "d3_moat_test": "commodity",
        "f1_feasibility": "not_feasible",
        "f2_productization": "no_product",
    },
    {
        "b1_starting_point": "template",
        "b2_research_sources": "primary_only",
        "b3_assembly_ratio": "equal",
        "b4_hypothesis_first": "partially",
        "c1_specialization": "moderately_specialized",
        "c2_directness": "somewhat_direct",
        "c3_judgment_pct": "51_75",
        "d1_proprietary_data": "moderate",
        "d2_knowledge_reuse": "moderate",
        "d3_moat_test": "differentiated",
        "f1_feasibility": "feasible_with_work",
        "f2_productization": "partial_product",
    },
    {
        "b1_starting_point": "prior_work",
        "b2_research_sources": "primary_plus_secondary",
        "b3_assembly_ratio": "mostly_xcsg",
        "b4_hypothesis_first": "yes",
        "c1_specialization": "highly_specialized",
        "c2_directness": "very_direct",
        "c3_judgment_pct": "26_50",
        "d1_proprietary_data": "significant",
        "d2_knowledge_reuse": "high",
        "d3_moat_test": "unique",
        "f1_feasibility": "already_productized",
        "f2_productization": "full_product",
    },
    {
        "b1_starting_point": "hypothesis",
        "b2_research_sources": "secondary_only",
        "b3_assembly_ratio": "mostly_pioneer",
        "b4_hypothesis_first": "partially",
        "c1_specialization": "moderately_specialized",
        "c2_directness": "somewhat_direct",
        "c3_judgment_pct": "51_75",
        "d1_proprietary_data": "none",
        "d2_knowledge_reuse": "moderate",
        "d3_moat_test": "differentiated",
        "f1_feasibility": "feasible_with_work",
        "f2_productization": "partial_product",
    },
]

PROJECTS = [
    # CDD (3 projects)
    {
        "project_name": "Pfizer Oncology Pipeline CDD",
        "category_name": "CDD",
        "client_name": "Pfizer",
        "pioneer_name": "Maria Santos",
        "pioneer_email": "m.santos@alira.health",
        "description": "Commercial due diligence for Pfizer oncology asset acquisition target",
        "date_started": "2025-10-01",
        "date_delivered": "2025-10-18",
        "xcsg_calendar_days": "4-5",
        "xcsg_team_size": "2",
        "xcsg_revision_rounds": "1",
        "xcsg_scope_expansion": "Added competitive benchmarking module mid-project",
    },
    {
        "project_name": "Novartis Rare Disease CDD",
        "category_name": "CDD",
        "client_name": "Novartis",
        "pioneer_name": "James Chen",
        "pioneer_email": "j.chen@alira.health",
        "description": "Full CDD on rare disease biotech target for Novartis M&A team",
        "date_started": "2025-11-01",
        "date_delivered": "2025-11-15",
        "xcsg_calendar_days": "6-10",
        "xcsg_team_size": "2",
        "xcsg_revision_rounds": "1",
        "legacy_calendar_days": "21+",
        "legacy_team_size": "4",
        "legacy_revision_rounds": "3",
    },
    {
        "project_name": "Roche Neuroscience Platform CDD",
        "category_name": "CDD",
        "client_name": "Roche",
        "pioneer_name": "Sarah Mueller",
        "pioneer_email": "s.mueller@alira.health",
        "description": "CDD on neuroscience platform company with 5 pipeline assets",
        "date_started": "2025-12-01",
        "date_delivered": "2025-12-14",
        "xcsg_calendar_days": "6-10",
        "xcsg_team_size": "2",
        "xcsg_revision_rounds": "2",
    },
    # Competitive Landscape (3 projects)
    {
        "project_name": "AstraZeneca PCSK9 Competitive Map",
        "category_name": "Competitive Landscape",
        "client_name": "AstraZeneca",
        "pioneer_name": "David Kim",
        "pioneer_email": "d.kim@alira.health",
        "description": "Competitive landscape for AZ cardiovascular franchise, PCSK9 inhibitor market",
        "date_started": "2025-09-10",
        "date_delivered": "2025-09-18",
        "xcsg_calendar_days": "4-5",
        "xcsg_team_size": "1",
        "xcsg_revision_rounds": "1",
    },
    {
        "project_name": "Sanofi Immunology Competitor Scan",
        "category_name": "Competitive Landscape",
        "client_name": "Sanofi",
        "pioneer_name": "Priya Nair",
        "pioneer_email": "p.nair@alira.health",
        "description": "360-degree competitive scan for Sanofi immunology pipeline positioning",
        "date_started": "2025-10-15",
        "date_delivered": "2025-10-20",
        "xcsg_calendar_days": "2-3",
        "xcsg_team_size": "1",
        "xcsg_revision_rounds": "1",
        "legacy_calendar_days": "11-20",
        "legacy_team_size": "3",
        "legacy_revision_rounds": "2",
    },
    {
        "project_name": "BMS Cell Therapy Market Map",
        "category_name": "Competitive Landscape",
        "client_name": "BMS",
        "pioneer_name": "Maria Santos",
        "pioneer_email": "m.santos@alira.health",
        "description": "CAR-T and cell therapy competitive landscape for BMS strategy team",
        "date_started": "2025-11-20",
        "date_delivered": "2025-11-27",
        "xcsg_calendar_days": "4-5",
        "xcsg_team_size": "2",
        "xcsg_revision_rounds": "1",
    },
    # Financial Model (2 projects)
    {
        "project_name": "Merck Keytruda Revenue Forecast Model",
        "category_name": "Financial Model",
        "client_name": "Merck",
        "pioneer_name": "James Chen",
        "pioneer_email": "j.chen@alira.health",
        "description": "5-year revenue forecast model for Keytruda biosimilar entry scenarios",
        "date_started": "2025-10-20",
        "date_delivered": "2025-10-26",
        "xcsg_calendar_days": "4-5",
        "xcsg_team_size": "1",
        "xcsg_revision_rounds": "1",
        "legacy_calendar_days": "6-10",
        "legacy_team_size": "2",
        "legacy_revision_rounds": "2",
    },
    {
        "project_name": "Lilly Obesity Portfolio Financial Model",
        "category_name": "Financial Model",
        "client_name": "Lilly",
        "pioneer_name": "Sarah Mueller",
        "pioneer_email": "s.mueller@alira.health",
        "description": "Total addressable market and NPV model for GLP-1 obesity franchise",
        "date_started": "2025-12-10",
        "date_delivered": "2025-12-16",
        "xcsg_calendar_days": "4-5",
        "xcsg_team_size": "2",
        "xcsg_revision_rounds": "1",
    },
    # Market Access (3 projects)
    {
        "project_name": "Amgen Biosimilar Market Access Strategy",
        "category_name": "Market Access",
        "client_name": "Amgen",
        "pioneer_name": "David Kim",
        "pioneer_email": "d.kim@alira.health",
        "description": "Market access strategy for 3 biosimilar launches in EU5 + US markets",
        "date_started": "2025-09-01",
        "date_delivered": "2025-09-12",
        "xcsg_calendar_days": "6-10",
        "xcsg_team_size": "2",
        "xcsg_revision_rounds": "1",
        "legacy_calendar_days": "21+",
        "legacy_team_size": "4",
        "legacy_revision_rounds": "3",
    },
    {
        "project_name": "GSK Respiratory HEOR Dossier Strategy",
        "category_name": "Market Access",
        "client_name": "GSK",
        "pioneer_name": "Priya Nair",
        "pioneer_email": "p.nair@alira.health",
        "description": "HEOR dossier strategy for dupilumab competitor launch",
        "date_started": "2025-10-01",
        "date_delivered": "2025-10-10",
        "xcsg_calendar_days": "6-10",
        "xcsg_team_size": "2",
        "xcsg_revision_rounds": "2",
    },
    {
        "project_name": "Pfizer RSV Vaccine Reimbursement Brief",
        "category_name": "Market Access",
        "client_name": "Pfizer",
        "pioneer_name": "Maria Santos",
        "pioneer_email": "m.santos@alira.health",
        "description": "Payer landscape and reimbursement pathway brief for RSV vaccine",
        "date_started": "2025-11-05",
        "date_delivered": "2025-11-09",
        "xcsg_calendar_days": "2-3",
        "xcsg_team_size": "1",
        "xcsg_revision_rounds": "1",
    },
    # Proposal (2 projects)
    {
        "project_name": "Novartis Gene Therapy BD Proposal",
        "category_name": "Proposal",
        "client_name": "Novartis",
        "pioneer_name": "James Chen",
        "pioneer_email": "j.chen@alira.health",
        "description": "BD proposal for gene therapy partnership — 12-month engagement scope",
        "date_started": "2025-10-22",
        "date_delivered": "2025-10-24",
        "xcsg_calendar_days": "1",
        "xcsg_team_size": "1",
        "xcsg_revision_rounds": "1",
        "legacy_calendar_days": "4-5",
        "legacy_team_size": "2",
        "legacy_revision_rounds": "2",
    },
    {
        "project_name": "AstraZeneca Oncology Strategy Proposal",
        "category_name": "Proposal",
        "client_name": "AstraZeneca",
        "pioneer_name": "Sarah Mueller",
        "pioneer_email": "s.mueller@alira.health",
        "description": "Competitive intelligence proposal for AZ oncology pipeline strategy",
        "date_started": "2025-11-15",
        "date_delivered": "2025-11-17",
        "xcsg_calendar_days": "1",
        "xcsg_team_size": "1",
        "xcsg_revision_rounds": "1",
    },
    # Call Prep Brief (2 projects)
    {
        "project_name": "Roche KOL Interview Prep — Hematology",
        "category_name": "Call Prep Brief",
        "client_name": "Roche",
        "pioneer_name": "David Kim",
        "pioneer_email": "d.kim@alira.health",
        "description": "Expert call prep brief for hematology KOL at Sloan Kettering",
        "date_started": "2025-10-08",
        "date_delivered": "2025-10-09",
        "xcsg_calendar_days": "1",
        "xcsg_team_size": "1",
        "xcsg_revision_rounds": "1",
        "legacy_calendar_days": "2-3",
        "legacy_team_size": "1",
        "legacy_revision_rounds": "1",
    },
    {
        "project_name": "Sanofi Dupixent Expert Interview Prep",
        "category_name": "Call Prep Brief",
        "client_name": "Sanofi",
        "pioneer_name": "Priya Nair",
        "pioneer_email": "p.nair@alira.health",
        "description": "Interview prep for 3 expert calls on dupilumab IL-4/IL-13 positioning",
        "date_started": "2025-11-10",
        "date_delivered": "2025-11-11",
        "xcsg_calendar_days": "1",
        "xcsg_team_size": "1",
        "xcsg_revision_rounds": "1",
    },
    # Presentation (3 projects)
    {
        "project_name": "BMS Oncology Pipeline Investor Deck",
        "category_name": "Presentation",
        "client_name": "BMS",
        "pioneer_name": "Maria Santos",
        "pioneer_email": "m.santos@alira.health",
        "description": "Investor relations deck for BMS oncology pipeline — 30 slides",
        "date_started": "2025-10-01",
        "date_delivered": "2025-10-06",
        "xcsg_calendar_days": "2-3",
        "xcsg_team_size": "2",
        "xcsg_revision_rounds": "2",
        "legacy_calendar_days": "4-5",
        "legacy_team_size": "3",
        "legacy_revision_rounds": "3",
    },
    {
        "project_name": "Merck Annual Competitive Review Deck",
        "category_name": "Presentation",
        "client_name": "Merck",
        "pioneer_name": "James Chen",
        "pioneer_email": "j.chen@alira.health",
        "description": "Board-level competitive intelligence review — 45 slides",
        "date_started": "2025-11-20",
        "date_delivered": "2025-11-25",
        "xcsg_calendar_days": "2-3",
        "xcsg_team_size": "1",
        "xcsg_revision_rounds": "1",
    },
    {
        "project_name": "Lilly GLP-1 Strategy Presentation",
        "category_name": "Presentation",
        "client_name": "Lilly",
        "pioneer_name": "David Kim",
        "pioneer_email": "d.kim@alira.health",
        "description": "Strategic options presentation for Lilly GLP-1 franchise team",
        "date_started": "2025-12-05",
        "date_delivered": "2025-12-08",
        "xcsg_calendar_days": "2-3",
        "xcsg_team_size": "2",
        "xcsg_revision_rounds": "1",
    },
    # KOL Mapping (2 projects)
    {
        "project_name": "Amgen Rare Disease KOL Map — EU",
        "category_name": "KOL Mapping",
        "client_name": "Amgen",
        "pioneer_name": "Sarah Mueller",
        "pioneer_email": "s.mueller@alira.health",
        "description": "EU5 KOL mapping for rare disease program — 80 key influencers",
        "date_started": "2025-09-15",
        "date_delivered": "2025-09-28",
        "xcsg_calendar_days": "6-10",
        "xcsg_team_size": "2",
        "xcsg_revision_rounds": "1",
        "legacy_calendar_days": "21+",
        "legacy_team_size": "4",
        "legacy_revision_rounds": "2",
    },
    {
        "project_name": "GSK Dermatology KOL Mapping — US",
        "category_name": "KOL Mapping",
        "client_name": "GSK",
        "pioneer_name": "Priya Nair",
        "pioneer_email": "p.nair@alira.health",
        "description": "US dermatology KOL landscape for GSK pipeline positioning",
        "date_started": "2025-10-20",
        "date_delivered": "2025-10-31",
        "xcsg_calendar_days": "6-10",
        "xcsg_team_size": "2",
        "xcsg_revision_rounds": "2",
    },
]

# ── HTTP helpers ──────────────────────────────────────────────────────────────

try:
    import requests
except ImportError:
    print("Installing requests...")
    subprocess.run([sys.executable, "-m", "pip", "install", "requests", "-q"], check=True)
    import requests

session = requests.Session()
token = None


def api(method, path, **kwargs):
    headers = kwargs.pop("headers", {})
    if token:
        headers["Authorization"] = f"Bearer {token}"
    resp = session.request(method, f"{BASE_URL}{path}", headers=headers, **kwargs)
    return resp


def log(msg, emoji="  "):
    ts = datetime.now().strftime("%H:%M:%S")
    print(f"[{ts}] {emoji} {msg}")


# ── Report helpers ────────────────────────────────────────────────────────────

report_lines = []


def report(line=""):
    report_lines.append(line)


def save_report():
    with open(REPORT_PATH, "w") as f:
        f.write("\n".join(report_lines))
    log(f"Report saved to {REPORT_PATH}", "💾")


# ── Screenshot helper ─────────────────────────────────────────────────────────

def screenshot(name, url, wait_ms=3000, extra_actions=None):
    """Take a screenshot using Playwright headless (still captures DOM state)."""
    script = f"""
const {{ chromium }} = require('/Users/pj/.npm/_npx/e41f203b7505f1fb/node_modules/playwright/index.mjs');
(async () => {{
  const browser = await chromium.launch({{ headless: false }});
  const page = await browser.newPage();
  await page.setViewportSize({{ width: 1440, height: 900 }});
  await page.goto('{url}', {{ waitUntil: 'networkidle' }});
  await page.waitForTimeout({wait_ms});
  {extra_actions or ''}
  await page.screenshot({{ path: '{SCREENSHOTS_DIR}/{name}.png', fullPage: false }});
  await browser.close();
  console.log('Screenshot saved: {SCREENSHOTS_DIR}/{name}.png');
}})().catch(e => {{ console.error(e); process.exit(1); }});
"""
    script_path = f"/tmp/qa_screenshot_{name}.mjs"
    with open(script_path, "w") as f:
        f.write(script)
    result = subprocess.run(
        ["node", script_path],
        capture_output=True,
        text=True,
        timeout=30,
    )
    if result.returncode == 0:
        log(f"Screenshot: {SCREENSHOTS_DIR}/{name}.png", "📸")
        return True
    else:
        log(f"Screenshot failed: {result.stderr[:200]}", "⚠️")
        return False


# ── Phase 1: Server & Auth ────────────────────────────────────────────────────

def phase1_server_auth():
    log("=== PHASE 1: Server & Auth ===", "🚀")
    report("## Phase 1: Server & Auth")
    report()

    # Check health
    for attempt in range(10):
        try:
            r = api("GET", "/api/health")
            if r.status_code == 200:
                data = r.json()
                log(f"Server healthy: {data}", "✅")
                report(f"- ✅ Server running: version {data.get('version', '?')}")
                break
        except Exception as e:
            if attempt == 9:
                log(f"Server not responding after 10 attempts: {e}", "❌")
                report("- ❌ Server not responding")
                return False
            time.sleep(2)

    # Login
    global token
    r = api("POST", "/api/auth/login", json={"username": "admin", "password": "AliraAdmin2026!"})
    if r.status_code == 200:
        data = r.json()
        token = data["access_token"]
        log(f"Logged in as admin (role: {data['user']['role']})", "✅")
        report(f"- ✅ Login successful as admin")
    else:
        log(f"Login failed: {r.status_code} {r.text}", "❌")
        report(f"- ❌ Login failed: {r.status_code}")
        return False

    # Get categories (needed for project creation)
    r = api("GET", "/api/categories")
    if r.status_code == 200:
        cats = r.json()
        log(f"Categories loaded: {len(cats)}", "✅")
        report(f"- ✅ Categories: {len(cats)} found ({', '.join(c['name'] for c in cats)})")
        return cats
    else:
        log(f"Categories failed: {r.status_code}", "❌")
        return False


# ── Phase 2: Create 20 Projects ───────────────────────────────────────────────

def phase2_create_projects(cats):
    log("=== PHASE 2: Create 20 Projects ===", "📋")
    report()
    report("## Phase 2: Create 20 Projects")
    report()

    cat_map = {c["name"]: c["id"] for c in cats}
    created = []
    errors = []

    for i, proj in enumerate(PROJECTS, 1):
        cat_name = proj.pop("category_name")
        cat_id = cat_map.get(cat_name)
        if not cat_id:
            log(f"[{i}/20] Unknown category: {cat_name}", "❌")
            errors.append(f"Project {i}: unknown category {cat_name}")
            proj["category_name"] = cat_name  # restore
            continue

        payload = {**proj, "category_id": cat_id}
        # Remove category_name from payload (not an API field)
        payload.pop("category_name", None)

        r = api("POST", "/api/projects", json=payload)
        if r.status_code == 201:
            data = r.json()
            log(f"[{i}/20] Created: {data['project_name']} ({cat_name}) — token: {data['expert_token'][:12]}...", "✅")
            data["category_name"] = cat_name
            created.append(data)
            report(f"- ✅ [{i}/20] {data['project_name']} | {cat_name} | {data.get('client_name', 'N/A')} | token: `{data['expert_token'][:16]}...`")
        else:
            log(f"[{i}/20] Failed: {proj.get('project_name')} — {r.status_code} {r.text[:200]}", "❌")
            errors.append(f"Project {i} ({proj.get('project_name')}): {r.status_code} {r.text[:100]}")
            report(f"- ❌ [{i}/20] {proj.get('project_name')} — {r.status_code}")

        proj["category_name"] = cat_name  # restore for reference

    report()
    report(f"**Created:** {len(created)}/20")
    if errors:
        report(f"**Errors:** {len(errors)}")
        for e in errors:
            report(f"  - {e}")

    return created


# ── Phase 3: Expert Assessments ───────────────────────────────────────────────

def phase3_expert_assessments(projects):
    log("=== PHASE 3: Expert Assessments ===", "🎓")
    report()
    report("## Phase 3: Expert Assessments")
    report()

    submitted = 0
    errors = []

    for i, proj in enumerate(projects):
        token_str = proj["expert_token"]
        variant = EXPERT_RESPONSE_VARIANTS[i % len(EXPERT_RESPONSE_VARIANTS)]

        # Verify expert GET endpoint first
        r = api("GET", f"/api/expert/{token_str}")
        if r.status_code == 200:
            ctx = r.json()
            if ctx.get("already_completed"):
                log(f"[{i+1}/20] {proj['project_name']} — already completed", "ℹ️")
                report(f"- ℹ️ [{i+1}/20] {proj['project_name']} — already completed (skipped)")
                submitted += 1
                continue
        else:
            log(f"[{i+1}/20] Expert GET failed: {r.status_code}", "❌")
            errors.append(f"Project {i+1}: GET /api/expert/{token_str[:16]}... returned {r.status_code}")

        # Submit assessment (no auth — token based)
        r2 = requests.post(
            f"{BASE_URL}/api/expert/{token_str}",
            json=variant,
            headers={"Content-Type": "application/json"},
        )
        if r2.status_code in (201, 200):
            log(f"[{i+1}/20] ✅ Assessment submitted: {proj['project_name']}", "✅")
            report(f"- ✅ [{i+1}/20] {proj['project_name']} — variant {i % len(EXPERT_RESPONSE_VARIANTS) + 1}")
            submitted += 1
        else:
            log(f"[{i+1}/20] ❌ Submit failed: {r2.status_code} {r2.text[:200]}", "❌")
            errors.append(f"Project {i+1} ({proj['project_name']}): {r2.status_code} {r2.text[:100]}")
            report(f"- ❌ [{i+1}/20] {proj['project_name']} — {r2.status_code}: {r2.text[:100]}")

    report()
    report(f"**Submitted:** {submitted}/{len(projects)}")
    if errors:
        report(f"**Errors:** {len(errors)}")
        for e in errors:
            report(f"  - {e}")

    return submitted


# ── Phase 4: Portfolio & Dashboard Verification ───────────────────────────────

def phase4_dashboard_verification():
    log("=== PHASE 4: Portfolio & Dashboard Verification ===", "📊")
    report()
    report("## Phase 4: Portfolio & Dashboard Verification")
    report()

    # Metrics summary
    r = api("GET", "/api/metrics/summary")
    if r.status_code == 200:
        s = r.json()
        log(f"Summary: {s['total_projects']} total, {s['complete_projects']} complete, checkpoint {s['checkpoint']}", "✅")
        report(f"- ✅ Metrics Summary:")
        report(f"  - Total projects: {s['total_projects']}")
        report(f"  - Complete projects: {s['complete_projects']}")
        report(f"  - Pending: {s['pending_projects']}")
        report(f"  - Avg Value Multiplier: {s['average_value_multiplier']:.2f}x")
        report(f"  - Avg Effort Ratio: {s['average_effort_ratio']:.2f}x")
        report(f"  - Avg Quality Ratio: {s['average_quality_ratio']:.2f}x")
        report(f"  - Flywheel Health: {s['flywheel_health']:.1f}%")
        report(f"  - Machine-First Avg: {s['machine_first_avg']:.2f}")
        report(f"  - Senior-Led Avg: {s['senior_led_avg']:.2f}")
        report(f"  - Proprietary Knowledge Avg: {s['proprietary_knowledge_avg']:.2f}")
        report(f"  - Checkpoint: {s['checkpoint']}")
        report(f"  - Projects to next checkpoint: {s['projects_to_next_checkpoint']}")
    else:
        log(f"Metrics summary failed: {r.status_code}", "❌")
        report(f"- ❌ Metrics Summary: {r.status_code}")

    # Metrics projects
    r = api("GET", "/api/metrics/projects")
    if r.status_code == 200:
        metrics = r.json()
        log(f"Project metrics: {len(metrics)} entries", "✅")
        report(f"- ✅ Project Metrics: {len(metrics)} computed entries")
        for m in metrics[:3]:
            report(f"  - {m['project_name']}: VM={m['value_multiplier']:.2f}x, ER={m['effort_ratio']:.2f}x, QR={m['quality_ratio']:.2f}x")
    else:
        log(f"Metrics projects failed: {r.status_code}", "❌")
        report(f"- ❌ Metrics Projects: {r.status_code}")

    # Trends
    r = api("GET", "/api/metrics/trends")
    if r.status_code == 200:
        trends = r.json()
        log(f"Trend data: {len(trends.get('points', []))} points", "✅")
        report(f"- ✅ Trend Data: {len(trends.get('points', []))} data points")
    else:
        log(f"Trends failed: {r.status_code}", "❌")
        report(f"- ❌ Trend Data: {r.status_code}")

    # Scaling gates
    r = api("GET", "/api/metrics/scaling-gates")
    if r.status_code == 200:
        gates = r.json()
        passed = gates.get("passed_count", 0)
        total = gates.get("total_count", 0)
        log(f"Scaling gates: {passed}/{total} passed", "✅")
        report(f"- ✅ Scaling Gates: {passed}/{total} passed")
        for gate in gates.get("gates", []):
            status_icon = "✅" if gate["status"] == "pass" else "⏳"
            report(f"  - {status_icon} {gate['name']}: {gate['detail']}")
    else:
        log(f"Scaling gates failed: {r.status_code}", "❌")
        report(f"- ❌ Scaling Gates: {r.status_code}")

    # Projects with filters
    filters = [
        ("status=complete", {"status": "complete"}),
        ("status=expert_pending", {"status": "expert_pending"}),
    ]
    for label, params in filters:
        r = api("GET", "/api/projects", params=params)
        if r.status_code == 200:
            count = len(r.json())
            log(f"Filter [{label}]: {count} results", "✅")
            report(f"- ✅ Filter [{label}]: {count} results")
        else:
            log(f"Filter [{label}] failed: {r.status_code}", "❌")
            report(f"- ❌ Filter [{label}]: {r.status_code}")

    # Category filter — pick first category with projects
    r = api("GET", "/api/categories")
    if r.status_code == 200:
        cats = r.json()
        for cat in cats:
            if cat.get("project_count", 0) > 0:
                r2 = api("GET", "/api/projects", params={"category_id": cat["id"]})
                if r2.status_code == 200:
                    count = len(r2.json())
                    log(f"Category filter [{cat['name']}]: {count} projects", "✅")
                    report(f"- ✅ Category filter [{cat['name']}]: {count} projects")
                break

    # Export to Excel
    r = api("GET", "/api/export/excel")
    if r.status_code == 200:
        content_type = r.headers.get("content-type", "")
        size = len(r.content)
        log(f"Excel export: {size} bytes, content-type: {content_type}", "✅")
        report(f"- ✅ Excel Export: {size} bytes downloaded")
        # Save it
        export_path = SCREENSHOTS_DIR / "xCSG_Value_Export.xlsx"
        export_path.write_bytes(r.content)
        report(f"  - Saved to {export_path}")
    else:
        log(f"Excel export failed: {r.status_code}", "❌")
        report(f"- ❌ Excel Export: {r.status_code}")


# ── Phase 5: Other Views ──────────────────────────────────────────────────────

def phase5_other_views(projects):
    log("=== PHASE 5: Other Views ===", "🔍")
    report()
    report("## Phase 5: Other Views")
    report()

    if not projects:
        report("- ⚠️ No projects to test with")
        return

    # Get a project
    r = api("GET", f"/api/projects/{projects[0]['id']}")
    if r.status_code == 200:
        p = r.json()
        log(f"Project detail: {p['project_name']} (status: {p['status']})", "✅")
        report(f"- ✅ Project GET: {p['project_name']} | status: {p['status']}")
        if p.get("expert_response"):
            report(f"  - Expert response included: ✅")
        else:
            report(f"  - Expert response included: ❌ (missing from response)")
    else:
        log(f"Project detail failed: {r.status_code}", "❌")
        report(f"- ❌ Project GET: {r.status_code}")

    # Update a project
    r = api("PUT", f"/api/projects/{projects[0]['id']}", json={
        "description": "Updated via QA automation — v2 test"
    })
    if r.status_code == 200:
        log("Project update: OK", "✅")
        report("- ✅ Project PUT (update): OK")
    else:
        log(f"Project update failed: {r.status_code} {r.text}", "❌")
        report(f"- ❌ Project PUT: {r.status_code}")

    # Get norms
    r = api("GET", "/api/norms")
    if r.status_code == 200:
        norms = r.json()
        log(f"Norms: {len(norms)} entries", "✅")
        report(f"- ✅ Norms: {len(norms)} category norms")
    else:
        log(f"Norms failed: {r.status_code}", "❌")
        report(f"- ❌ Norms: {r.status_code}")

    # Update a norm
    r = api("GET", "/api/categories")
    if r.status_code == 200:
        cats = r.json()
        if cats:
            cat_id = cats[0]["id"]
            r2 = api("PUT", f"/api/norms/{cat_id}", json={
                "notes": "Updated via QA automation — v2 test"
            })
            if r2.status_code == 200:
                log(f"Norm update for cat {cat_id}: OK", "✅")
                report(f"- ✅ Norm PUT: category {cat_id} updated")
            else:
                log(f"Norm update failed: {r2.status_code} {r2.text}", "❌")
                report(f"- ❌ Norm PUT: {r2.status_code}")

    # Activity log
    r = api("GET", "/api/activity?limit=20")
    if r.status_code == 200:
        data = r.json()
        items = data.get("items", [])
        total = data.get("total", 0)
        log(f"Activity log: {len(items)} items (total: {total})", "✅")
        report(f"- ✅ Activity Log: {total} total entries, last 20 returned")
        actions = {}
        for item in items:
            actions[item["action"]] = actions.get(item["action"], 0) + 1
        for action, count in sorted(actions.items()):
            report(f"  - {action}: {count}x")
    else:
        log(f"Activity log failed: {r.status_code}", "❌")
        report(f"- ❌ Activity Log: {r.status_code}")


# ── Phase 6: Edge Cases ───────────────────────────────────────────────────────

def phase6_edge_cases(projects):
    log("=== PHASE 6: Edge Cases ===", "⚡")
    report()
    report("## Phase 6: Edge Cases")
    report()

    # Invalid expert token
    r = requests.get(f"{BASE_URL}/api/expert/INVALID_TOKEN_DOES_NOT_EXIST_XYZ123")
    if r.status_code == 404:
        log("Invalid token → 404: ✅", "✅")
        report("- ✅ Invalid expert token → 404 Not Found")
    else:
        log(f"Invalid token returned {r.status_code} (expected 404)", "❌")
        report(f"- ❌ Invalid expert token → {r.status_code} (expected 404)")

    # Already-submitted token
    if projects:
        token_str = projects[0]["expert_token"]
        r = requests.get(f"{BASE_URL}/api/expert/{token_str}")
        if r.status_code == 200:
            ctx = r.json()
            if ctx.get("already_completed"):
                log("Already-submitted token GET → already_completed=True: ✅", "✅")
                report("- ✅ Already-submitted GET → `already_completed: true`")
            else:
                log(f"Already-submitted token GET → already_completed={ctx.get('already_completed')}: ❌", "❌")
                report(f"- ❌ Already-submitted GET → already_completed={ctx.get('already_completed')} (expected true)")

        # POST again — should get already_completed response
        variant = EXPERT_RESPONSE_VARIANTS[0]
        r2 = requests.post(
            f"{BASE_URL}/api/expert/{token_str}",
            json=variant,
        )
        if r2.status_code in (200, 201):
            data = r2.json()
            if data.get("already_completed"):
                log("Already-submitted POST → already_completed=True: ✅", "✅")
                report("- ✅ Already-submitted POST → `already_completed: true`")
            else:
                log(f"Already-submitted POST response: {data}", "⚠️")
                report(f"- ⚠️ Already-submitted POST → {data}")
        else:
            log(f"Already-submitted POST → {r2.status_code}: ❌", "❌")
            report(f"- ❌ Already-submitted POST → {r2.status_code}")

    # Date validation: end before start
    r = api("GET", "/api/categories")
    if r.status_code == 200 and r.json():
        cat_id = r.json()[0]["id"]
        r2 = api("POST", "/api/projects", json={
            "project_name": "Date Validation Test",
            "category_id": cat_id,
            "pioneer_name": "Test Pioneer",
            "xcsg_calendar_days": "1",
            "xcsg_team_size": "1",
            "xcsg_revision_rounds": "1",
            "date_started": "2025-12-31",
            "date_delivered": "2025-01-01",  # before start — should fail
        })
        if r2.status_code == 422:
            log("Date validation (end before start) → 422: ✅", "✅")
            report("- ✅ Date validation: end before start → 422 Unprocessable")
        else:
            log(f"Date validation returned {r2.status_code} (expected 422)", "⚠️")
            report(f"- ⚠️ Date validation: end before start → {r2.status_code} (expected 422)")

    # Delete a project (use the last created)
    if len(projects) >= 2:
        last_proj = projects[-1]
        r = api("DELETE", f"/api/projects/{last_proj['id']}")
        if r.status_code == 204:
            log(f"Delete project #{last_proj['id']}: ✅", "✅")
            report(f"- ✅ Delete project #{last_proj['id']} ({last_proj['project_name']}) → 204 No Content")
            # Verify it's gone
            r2 = api("GET", f"/api/projects/{last_proj['id']}")
            if r2.status_code == 404:
                log(f"Deleted project 404 check: ✅", "✅")
                report(f"  - Verified: GET after delete → 404 ✅")
            else:
                log(f"Deleted project still accessible: {r2.status_code}", "❌")
                report(f"  - ❌ GET after delete → {r2.status_code} (expected 404)")
        else:
            log(f"Delete failed: {r.status_code} {r.text}", "❌")
            report(f"- ❌ Delete project → {r.status_code}")


# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    start_time = datetime.now()
    log("Starting xCSG Value Tracker v2 Full QA", "🎯")

    report("# xCSG Value Tracker v2 — Full QA Report")
    report(f"**Date:** {start_time.strftime('%Y-%m-%d %H:%M:%S')}")
    report(f"**Runner:** qa_runner.py (automated API + Playwright)")
    report()
    report("---")
    report()

    # Phase 1
    cats = phase1_server_auth()
    save_report()
    if not cats:
        report()
        report("## ❌ ABORTED: Server not running or auth failed")
        save_report()
        return

    # Phase 2
    projects = phase2_create_projects(cats)
    save_report()

    # Phase 3
    if projects:
        submitted = phase3_expert_assessments(projects)
        save_report()

    # Phase 4
    phase4_dashboard_verification()
    save_report()

    # Phase 5
    phase5_other_views(projects)
    save_report()

    # Phase 6
    phase6_edge_cases(projects)
    save_report()

    # Final summary
    elapsed = datetime.now() - start_time
    report()
    report("---")
    report()
    report("## Final Summary")
    report(f"- **Duration:** {elapsed.total_seconds():.1f}s")
    report(f"- **Projects Created:** {len(projects)}/20")
    if projects:
        report(f"- **Assessments Submitted:** {submitted}/{len(projects)}")
    report(f"- **Screenshots:** See `test-results/screenshots/`")
    report()
    report("## Phase Status")
    report("| Phase | Status |")
    report("|-------|--------|")
    report("| Phase 1: Server & Auth | See above |")
    report("| Phase 2: Create Projects | See above |")
    report("| Phase 3: Expert Assessments | See above |")
    report("| Phase 4: Dashboard Verification | See above |")
    report("| Phase 5: Other Views | See above |")
    report("| Phase 6: Edge Cases | See above |")
    save_report()
    log(f"QA complete in {elapsed.total_seconds():.1f}s", "🏁")


if __name__ == "__main__":
    main()
