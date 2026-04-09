#!/usr/bin/env python3
"""
Seed 15 engagements for xCSG Value Tracker V2 QA testing.
Flushes database first, then creates 15 projects with expert assessments.
"""
import json
import sys
import requests

BASE = "http://localhost:8765"

# ── Helpers ───────────────────────────────────────────────────────────────────

def login(username="admin", password="AliraAdmin2026!"):
    r = requests.post(f"{BASE}/api/auth/login", json={"username": username, "password": password})
    r.raise_for_status()
    return r.json()["access_token"]

def auth_headers(token):
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}

# ── Category mapping ──────────────────────────────────────────────────────────
# The running app uses project_categories table. We need to get IDs.
# V2 spec says 11 categories but the running app has 8 deliverable-type categories.
# We'll use whatever exists and map accordingly.

CATEGORY_MAP = {}  # filled dynamically

def load_categories(token):
    r = requests.get(f"{BASE}/api/categories", headers=auth_headers(token))
    cats = r.json()
    for c in cats:
        CATEGORY_MAP[c["name"].lower()] = c["id"]
    print(f"  Loaded {len(cats)} categories: {list(CATEGORY_MAP.keys())}")
    return CATEGORY_MAP

def get_cat_id(name):
    key = name.lower()
    if key in CATEGORY_MAP:
        return CATEGORY_MAP[key]
    # Try partial match
    for k, v in CATEGORY_MAP.items():
        if key in k or k in key:
            return v
    print(f"  WARNING: Category '{name}' not found, using first category")
    return list(CATEGORY_MAP.values())[0]

# ── Flush DB ──────────────────────────────────────────────────────────────────

def flush_db(token):
    """Delete all projects."""
    r = requests.get(f"{BASE}/api/projects?limit=200", headers=auth_headers(token))
    data = r.json()
    projects = data if isinstance(data, list) else data.get("items", [])
    print(f"  Found {len(projects)} projects to delete...")
    for p in projects:
        dr = requests.delete(f"{BASE}/api/projects/{p['id']}", headers=auth_headers(token))
        if dr.status_code == 204:
            pass
        else:
            print(f"  WARNING: Failed to delete project {p['id']}: {dr.status_code}")
    print(f"  Deleted {len(projects)} projects")

# ── Engagement data ───────────────────────────────────────────────────────────

# revision_depth -> xcsg_revision_rounds mapping (app still uses revision_rounds internally)
def rd_to_rounds(rd):
    return {"No revisions": "0", "No revisions needed": "0", "Cosmetic only": "1", "Moderate rework": "2", "Major rework": "3+"}.get(rd, "0")

def worse_revision_depth(rd):
    """Return a worse legacy revision depth."""
    order = ["No revisions needed", "Cosmetic only", "Moderate rework", "Major rework"]
    idx = order.index(rd) if rd in order else 0
    return order[min(idx + 1, len(order) - 1)]

ENGAGEMENTS = [
    {
        "project_name": "Oncology CDD - Pfizer",
        "category": "CDD",
        "pioneer": "Dr. Rossi",
        "client": "Pfizer Oncology",
        "working_days": 5, "team_size": "2",
        "revision_depth": "No revisions needed",
        "revenue": 120000,
        "stage": "Active engagement",
        "scope_expansion": "Yes expanded scope",
        "client_pulse": "Exceeded expectations",
        "b1": "From AI draft", "b2": "8-12", "b3": ">75% AI", "b4": "Hypothesis-first",
        "b5": ">75%", "c1": "Deep specialist", "c2": "Expert authored", "c3": ">75% judgment",
        "c6": "Significantly better", "d1": "Yes", "d2": "Yes directly reused and extended",
        "d3": "No — proprietary inputs decisive", "f1": "Not feasible", "f2": "Yes largely as-is",
        "g1": "Yes without hesitation",
        "l_days": 15, "l_team": "3",
    },
    {
        "project_name": "Oncology CDD - Novartis",
        "category": "CDD",
        "pioneer": "Dr. Chen",
        "client": "Novartis",
        "working_days": 8, "team_size": "3",
        "revision_depth": "Cosmetic only",
        "revenue": 95000,
        "stage": "Active engagement",
        "scope_expansion": "Yes new engagement",
        "client_pulse": "Met expectations",
        "b1": "From AI draft", "b2": "8-12", "b3": "50-75%", "b4": "Hypothesis-first",
        "b5": "50-75%", "c1": "Deep specialist", "c2": "Expert authored", "c3": ">75% judgment",
        "c6": "Somewhat better", "d1": "Yes", "d2": "Yes directly reused and extended",
        "d3": "No — proprietary inputs decisive", "f1": "Not feasible", "f2": "Yes largely as-is",
        "g1": "Yes without hesitation",
        "l_days": 18, "l_team": "4",
    },
    {
        "project_name": "Market Access - Roche",
        "category": "Market Access Strategy",
        "pioneer": "Dr. Müller",
        "client": "Roche",
        "working_days": 6, "team_size": "2",
        "revision_depth": "Cosmetic only",
        "revenue": 85000,
        "stage": "Active engagement",
        "scope_expansion": "Yes expanded scope",
        "client_pulse": "Exceeded expectations",
        "b1": "From AI draft", "b2": "8-12", "b3": ">75% AI", "b4": "Hypothesis-first",
        "b5": ">75%", "c1": "Adjacent expertise", "c2": "Expert authored", "c3": ">75% judgment",
        "c6": "Significantly better", "d1": "Yes", "d2": "Yes provided useful starting context",
        "d3": "No — proprietary inputs decisive", "f1": "Not feasible", "f2": "Yes largely as-is",
        "g1": "Yes without hesitation",
        "l_days": 14, "l_team": "3",
    },
    {
        "project_name": "Pricing Strategy - AstraZeneca",
        "category": "Pricing & Reimbursement",
        "pioneer": "Dr. Patel",
        "client": "AstraZeneca",
        "working_days": 4, "team_size": "1",
        "revision_depth": "No revisions needed",
        "revenue": 65000,
        "stage": "New business (pre-mandate)",
        "scope_expansion": "No",
        "client_pulse": "Met expectations",
        "b1": "Mixed", "b2": "4-7", "b3": "50-75%", "b4": "Hybrid",
        "b5": "50-75%", "c1": "Deep specialist", "c2": "Expert co-authored", "c3": "50-75%",
        "c6": "Somewhat better", "d1": "Yes", "d2": "Yes provided useful starting context",
        "d3": "Partially — they would miss key insights", "f1": "Feasible but at 2x+ the cost and time", "f2": "Yes with moderate customization",
        "g1": "Yes with reservations",
        "l_days": 10, "l_team": "2",
    },
    {
        "project_name": "Strategic Plan - Sanofi",
        "category": "New Product Strategy",
        "pioneer": "Dr. Kim",
        "client": "Sanofi",
        "working_days": 10, "team_size": "3",
        "revision_depth": "Moderate rework",
        "revenue": 150000,
        "stage": "Active engagement",
        "scope_expansion": "Yes expanded scope",
        "client_pulse": "Exceeded expectations",
        "b1": "From AI draft", "b2": "8-12", "b3": ">75% AI", "b4": "Hypothesis-first",
        "b5": ">75%", "c1": "Deep specialist", "c2": "Expert authored", "c3": ">75% judgment",
        "c6": "Significantly better", "d1": "Yes", "d2": "Yes directly reused and extended",
        "d3": "No — proprietary inputs decisive", "f1": "Not feasible", "f2": "Yes largely as-is",
        "g1": "Yes without hesitation",
        "l_days": 22, "l_team": "4",
    },
    {
        "project_name": "Rare Disease CDD - GSK",
        "category": "CDD",
        "pioneer": "Dr. Santos",
        "client": "GSK",
        "working_days": 7, "team_size": "2",
        "revision_depth": "Cosmetic only",
        "revenue": 110000,
        "stage": "Active engagement",
        "scope_expansion": "No",
        "client_pulse": "Met expectations",
        "b1": "From AI draft", "b2": "8-12", "b3": ">75% AI", "b4": "Hypothesis-first",
        "b5": "25-50%", "c1": "Deep specialist", "c2": "Expert authored", "c3": ">75% judgment",
        "c6": "Comparable", "d1": "Yes", "d2": "Yes provided useful starting context",
        "d3": "Partially — they would miss key insights", "f1": "Feasible but at 2x+ the cost and time", "f2": "Yes with moderate customization",
        "g1": "Yes without hesitation",
        "l_days": 16, "l_team": "3",
    },
    {
        "project_name": "HEOR Evidence Package - Bayer",
        "category": "Evidence Generation & HEOR",
        "pioneer": "Dr. Johansson",
        "client": "Bayer",
        "working_days": 12, "team_size": "4",
        "revision_depth": "Moderate rework",
        "revenue": 200000,
        "stage": "Active engagement",
        "scope_expansion": "Yes expanded scope",
        "client_pulse": "Met expectations",
        "b1": "From AI draft", "b2": "8-12", "b3": "50-75%", "b4": "Hypothesis-first",
        "b5": "Did not use AI draft", "c1": "Adjacent expertise", "c2": "Expert co-authored", "c3": "50-75%",
        "c6": "Somewhat better", "d1": "Yes", "d2": "Yes provided useful starting context",
        "d3": "Partially — they would miss key insights", "f1": "Feasible but at 2x+ the cost and time", "f2": "Yes with moderate customization",
        "g1": "Yes with reservations",
        "l_days": 25, "l_team": "4",
    },
    {
        "project_name": "Transaction DD - Novo Nordisk",
        "category": "Transaction Advisory",
        "pioneer": "Dr. Lee",
        "client": "Novo Nordisk",
        "working_days": 3, "team_size": "1",
        "revision_depth": "No revisions needed",
        "revenue": 80000,
        "stage": "Active engagement",
        "scope_expansion": "No",
        "client_pulse": "Met expectations",
        "b1": "Mixed", "b2": "4-7", "b3": "<25%", "b4": "Discovery-first",
        "b5": "<25%", "c1": "Generalist", "c2": "Expert co-authored", "c3": "50-75%",
        "c6": "Comparable", "d1": "No", "d2": "No built from scratch",
        "d3": "Yes — all inputs publicly available", "f1": "Feasible at similar cost", "f2": "No fully bespoke",
        "g1": "No — legacy would have been worse",
        "l_days": 5, "l_team": "2",
    },
    {
        "project_name": "Regulatory Strategy - Amgen",
        "category": "Regulatory Strategy",
        "pioneer": "Dr. Dubois",
        "client": "Amgen",
        "working_days": 5, "team_size": "2",
        "revision_depth": "Cosmetic only",
        "revenue": 75000,
        "stage": "Active engagement",
        "scope_expansion": "Yes new engagement",
        "client_pulse": "Exceeded expectations",
        "b1": "From AI draft", "b2": "8-12", "b3": ">75% AI", "b4": "Hypothesis-first",
        "b5": "50-75%", "c1": "Deep specialist", "c2": "Expert authored", "c3": ">75% judgment",
        "c6": "Significantly better", "d1": "Yes", "d2": "Yes directly reused and extended",
        "d3": "No — proprietary inputs decisive", "f1": "Not feasible", "f2": "Yes largely as-is",
        "g1": "Yes without hesitation",
        "l_days": 12, "l_team": "3",
    },
    {
        "project_name": "Market Research - Takeda",
        "category": "Market Research",
        "pioneer": "Dr. Tanaka",
        "client": "Takeda",
        "working_days": 4, "team_size": "2",
        "revision_depth": "No revisions needed",
        "revenue": 60000,
        "stage": "Post-engagement (follow-on)",
        "scope_expansion": "No",
        "client_pulse": "Met expectations",
        "b1": "From AI draft", "b2": "8-12", "b3": ">75% AI", "b4": "Hypothesis-first",
        "b5": ">75%", "c1": "Adjacent expertise", "c2": "Expert authored", "c3": ">75% judgment",
        "c6": "Somewhat better", "d1": "Yes", "d2": "Yes provided useful starting context",
        "d3": "Partially — they would miss key insights", "f1": "Feasible but at 2x+ the cost and time", "f2": "Yes with moderate customization",
        "g1": "Yes without hesitation",
        "l_days": 10, "l_team": "2",
    },
    {
        "project_name": "NPS Strategy - MSD",
        "category": "New Product Strategy",
        "pioneer": "Dr. Anderson",
        "client": "MSD",
        "working_days": 8, "team_size": "3",
        "revision_depth": "Moderate rework",
        "revenue": 130000,
        "stage": "Active engagement",
        "scope_expansion": "Yes expanded scope",
        "client_pulse": "Exceeded expectations",
        "b1": "From AI draft", "b2": "8-12", "b3": "50-75%", "b4": "Hypothesis-first",
        "b5": "50-75%", "c1": "Deep specialist", "c2": "Expert authored", "c3": ">75% judgment",
        "c6": "Significantly better", "d1": "Yes", "d2": "Yes directly reused and extended",
        "d3": "No — proprietary inputs decisive", "f1": "Not feasible", "f2": "Yes largely as-is",
        "g1": "Yes without hesitation",
        "l_days": 20, "l_team": "4",
    },
    {
        "project_name": "CI Landscape - Merck KGaA",
        "category": "Strategic Surveillance & Competitive Intelligence",
        "pioneer": "Dr. Fernández",
        "client": "Merck KGaA",
        "working_days": 3, "team_size": "1",
        "revision_depth": "No revisions needed",
        "revenue": 50000,
        "stage": "New business (pre-mandate)",
        "scope_expansion": "No",
        "client_pulse": "Met expectations",
        "b1": "Mixed", "b2": "4-7", "b3": "<25%", "b4": "Discovery-first",
        "b5": "<25%", "c1": "Generalist", "c2": "Expert reviewed only", "c3": "<25%",
        "c6": "Somewhat worse", "d1": "No", "d2": "No built from scratch",
        "d3": "Yes — all inputs publicly available", "f1": "Feasible at similar cost", "f2": "No fully bespoke",
        "g1": "Yes with reservations",
        "l_days": 4, "l_team": "2",
    },
    {
        "project_name": "Portfolio Review - Boehringer",
        "category": "Portfolio Management & Opportunity Assessment",
        "pioneer": "Dr. Weber",
        "client": "Boehringer",
        "working_days": 6, "team_size": "2",
        "revision_depth": "Cosmetic only",
        "revenue": 90000,
        "stage": "Active engagement",
        "scope_expansion": "Yes new engagement",
        "client_pulse": "Exceeded expectations",
        "b1": "From AI draft", "b2": "8-12", "b3": ">75% AI", "b4": "Hypothesis-first",
        "b5": ">75%", "c1": "Deep specialist", "c2": "Expert authored", "c3": ">75% judgment",
        "c6": "Significantly better", "d1": "Yes", "d2": "Yes directly reused and extended",
        "d3": "No — proprietary inputs decisive", "f1": "Not feasible", "f2": "Yes largely as-is",
        "g1": "Yes without hesitation",
        "l_days": 14, "l_team": "3",
    },
    {
        "project_name": "Oncology CDD - Lilly",
        "category": "CDD",
        "pioneer": "Dr. Park",
        "client": "Lilly",
        "working_days": 9, "team_size": "3",
        "revision_depth": "Moderate rework",
        "revenue": 140000,
        "stage": "Active engagement",
        "scope_expansion": "No",
        "client_pulse": "Below expectations",
        "b1": "From blank page", "b2": "4-7", "b3": "<25%", "b4": "Discovery-first",
        "b5": "25-50%", "c1": "Deep specialist", "c2": "Expert authored", "c3": "50-75%",
        "c6": "Comparable", "d1": "No", "d2": "No built from scratch",
        "d3": "Yes — all inputs publicly available", "f1": "Feasible at similar cost", "f2": "No fully bespoke",
        "g1": "No — legacy would have been worse",
        "l_days": 18, "l_team": "4",
    },
    {
        "project_name": "Market Access - Teva",
        "category": "Market Access Strategy",
        "pioneer": "Dr. Lombardi",
        "client": "Teva",
        "working_days": 5, "team_size": "2",
        "revision_depth": "No revisions needed",
        "revenue": 70000,
        "stage": "Active engagement",
        "scope_expansion": "No",
        "client_pulse": "Met expectations",
        "b1": "From AI draft", "b2": "8-12", "b3": ">75% AI", "b4": "Hypothesis-first",
        "b5": ">75%", "c1": "Deep specialist", "c2": "Expert authored", "c3": ">75% judgment",
        "c6": "Significantly better", "d1": "Yes", "d2": "Yes directly reused and extended",
        "d3": "No — proprietary inputs decisive", "f1": "Not feasible", "f2": "Yes largely as-is",
        "g1": "Yes without hesitation",
        "l_days": 12, "l_team": "3",
    },
]

def build_expert_payload(e):
    """Build the expert response from engagement data."""
    l_rd = worse_revision_depth(e["revision_depth"])
    return {
        "b1_starting_point": e["b1"],
        "b2_research_sources": e["b2"],
        "b3_assembly_ratio": e["b3"],
        "b4_hypothesis_first": e["b4"],
        "b5_ai_survival": e["b5"],
        "b6_data_analysis_split": e.get("b6", "25-50%"),
        "c1_specialization": e["c1"],
        "c2_directness": e["c2"],
        "c3_judgment_pct": e["c3"],
        "c6_self_assessment": e["c6"],
        "c7_analytical_depth": e.get("c7", "Strong"),
        "c8_decision_readiness": e.get("c8", "Yes with minor caveats"),
        "d1_proprietary_data": e["d1"],
        "d2_knowledge_reuse": e["d2"],
        "d3_moat_test": e["d3"],
        "e1_client_decision": e.get("e1", "Yes — referenced in internal discussions"),
        "f1_feasibility": e["f1"],
        "f2_productization": e["f2"],
        "g1_reuse_intent": e["g1"],
        "l1_legacy_working_days": e["l_days"],
        "l2_legacy_team_size": e["l_team"],
        "l3_legacy_revision_depth": l_rd,
        "l4_legacy_scope_expansion": "No",
        "l5_legacy_client_reaction": "Met expectations",
        "l6_legacy_b2_sources": "4-7",
        "l7_legacy_c1_specialization": "Generalist",
        "l8_legacy_c2_directness": "Expert reviewed only",
        "l9_legacy_c3_judgment": "25-50%",
        "l10_legacy_d1_proprietary": "No",
        "l11_legacy_d2_reuse": "No built from scratch",
        "l12_legacy_d3_moat": "Yes — all inputs publicly available",
        "l13_legacy_c7_depth": e.get("l13", "Adequate"),
        "l14_legacy_c8_decision": e.get("l14", "Needs significant additional work"),
        "l15_legacy_e1_decision": e.get("l15", "Yes — referenced in internal discussions"),
        "l16_legacy_b6_data": e.get("l16", ">75% on data"),
    }

# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    print("=== SEED: 15 Engagements ===\n")
    
    # 1. Login
    print("1. Logging in...")
    token = login()
    headers = auth_headers(token)
    
    # 2. Load categories
    print("2. Loading categories...")
    load_categories(token)
    
    # 3. Flush DB
    print("3. Flushing database...")
    flush_db(token)
    
    # 4. Create projects and submit expert assessments
    print("\n4. Creating 15 projects + expert assessments...\n")
    results = []
    
    for i, e in enumerate(ENGAGEMENTS, 1):
        cat_id = get_cat_id(e["category"])
        
        # Create project
        payload = {
            "project_name": e["project_name"],
            "category_id": cat_id,
            "pioneer_name": e["pioneer"],
            "client_name": e["client"],
            "engagement_stage": e["stage"],
            "date_started": f"2026-01-{(i*2):02d}",
            "date_delivered": f"2026-01-{(i*2 + e['working_days']):02d}",
            "working_days": e["working_days"],
            "xcsg_team_size": e["team_size"],
            "xcsg_revision_rounds": rd_to_rounds(e["revision_depth"]),
            "revision_depth": e["revision_depth"],
            "xcsg_scope_expansion": e["scope_expansion"],
            "engagement_revenue": e["revenue"],
            "client_pulse": e["client_pulse"],
        }
        
        r = requests.post(f"{BASE}/api/projects", headers=headers, json=payload)
        if r.status_code not in (200, 201):
            print(f"  FAIL [{i}] {e['project_name']}: {r.status_code} {r.text[:100]}")
            results.append({"name": e["project_name"], "error": r.text[:100]})
            continue
        
        proj = r.json()
        expert_token = proj.get("expert_token")
        if not expert_token:
            print(f"  FAIL [{i}] {e['project_name']}: no expert_token")
            results.append({"name": e["project_name"], "error": "no expert_token"})
            continue
        
        # Submit expert assessment (no auth needed)
        expert_data = build_expert_payload(e)
        er = requests.post(f"{BASE}/api/expert/{expert_token}", json=expert_data)
        if er.status_code not in (200, 201):
            print(f"  FAIL [{i}] {e['project_name']} expert: {er.status_code} {er.text[:100]}")
            results.append({"name": e["project_name"], "expert_error": er.text[:100]})
            continue
        
        print(f"  OK [{i:2d}] {e['project_name']:<45s} cat={e['category']:<15s} days={e['working_days']} team={e['team_size']} rev={e['revision_depth']}")
        results.append({
            "name": e["project_name"],
            "category": e["category"],
            "working_days": e["working_days"],
            "team_size": e["team_size"],
            "revision_depth": e["revision_depth"],
            "g1": e["g1"],
            "l_days": e["l_days"],
            "l_team": e["l_team"],
        })
    
    # 5. Summary
    print(f"\n=== SEED COMPLETE: {len(results)} projects created ===\n")
    
    # Get dashboard metrics
    r = requests.get(f"{BASE}/api/dashboard/metrics", headers=headers)
    if r.status_code == 200:
        m = r.json()
        print("Dashboard Metrics:")
        print(f"  Total projects:        {m.get('total_projects', m.get('total_projects', '?'))}")
        print(f"  Completed:             {m.get('complete_projects', m.get('completed_count', '?'))}")
        print(f"  Avg effort ratio:      {m.get('average_effort_ratio', '?')}")
        print(f"  Avg quality score:     {m.get('average_quality_score', '?')}")
        print(f"  Avg outcome rate ratio:{m.get('average_outcome_rate_ratio', '?')}")
        print(f"  Reuse intent rate:     {m.get('reuse_intent_rate', m.get('reuse_intent_avg', '?'))}%")
    
    # Get scaling gates
    r = requests.get(f"{BASE}/api/metrics/scaling-gates", headers=headers)
    if r.status_code == 200:
        sg = r.json()
        print("\nScaling Gates:")
        for g in sg.get("gates", []):
            print(f"  [{g['status'].upper():6s}] Gate {g['id']}: {g['name']:<25s} — {g['detail']}")
        print(f"\n  Passed: {sg.get('passed_count', 0)}/{sg.get('total_count', '?')}")
    
    # Get per-project metrics
    r = requests.get(f"{BASE}/api/metrics/projects", headers=headers)
    if r.status_code == 200:
        metrics = r.json()
        print(f"\nPer-Project Metrics ({len(metrics)} projects):")
        for pm in metrics:
            name = pm.get("project_name", "?")
            er = pm.get("effort_ratio", "?")
            qs = pm.get("quality_score", "?")
            orr = pm.get("outcome_rate_ratio", "?")
            print(f"  {name:<45s} effort_ratio={er}  quality={qs}  outcome_rate_ratio={orr}")

if __name__ == "__main__":
    main()
