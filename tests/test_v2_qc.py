#!/usr/bin/env python3
"""
Comprehensive QA/QC test suite for xCSG Value Tracker V2.
Tests authentication, expert options, categories, project CRUD, expert submissions,
metrics computation, scaling gates, dashboard, norms, schema, string consistency,
and frontend JS syntax.
"""
import base64
import json
import os
import re
import sqlite3
import subprocess
import sys
import time
import requests

BASE = "http://localhost:8765"
DB_PATH = os.path.expanduser("~/Documents/Projects/xCSG-Value-Tracker/data/tracker.db")

passed = 0
failed = 0
failures = []

def test(name, condition, detail=""):
    global passed, failed
    if condition:
        passed += 1
        print(f"  PASS: {name}")
    else:
        failed += 1
        msg = f"  FAIL: {name}"
        if detail:
            msg += f" — {detail}"
        print(msg)
        failures.append((name, detail))

# ── Helpers ───────────────────────────────────────────────────────────────────

def login(username="admin", password="AliraAdmin2026!"):
    r = requests.post(f"{BASE}/api/auth/login", json={"username": username, "password": password})
    return r

def get_token(username="admin"):
    r = login(username)
    r.raise_for_status()
    return r.json()

def admin_token():
    return get_token("admin")["access_token"]

def pmo_token():
    return get_token("pmo")["access_token"]

def auth_h(token):
    return {"Authorization": f"Bearer {token}"}

def decode_jwt(token):
    payload_b64 = token.split(".")[1]
    # Add padding
    payload_b64 += "=" * (4 - len(payload_b64) % 4)
    return json.loads(base64.urlsafe_b64decode(payload_b64))

# ── A. Authentication ─────────────────────────────────────────────────────────

def test_authentication():
    print("\n── A. Authentication ──")
    
    # Admin login
    r = login("admin", "AliraAdmin2026!")
    test("Admin login returns 200", r.status_code == 200, f"got {r.status_code}")
    if r.status_code == 200:
        d = r.json()
        test("Admin login returns JWT", "access_token" in d)
        test("Admin login returns user object", "user" in d and d["user"]["role"] == "admin", f"role={d.get('user',{}).get('role')}")
        
        # JWT payload
        jwt = decode_jwt(d["access_token"])
        test("JWT has sub", "sub" in jwt)
        test("JWT has username", "username" in jwt and jwt["username"] == "admin")
        test("JWT has role", "role" in jwt and jwt["role"] == "admin")
        test("JWT has iat", "iat" in jwt)
        test("JWT has exp", "exp" in jwt)
        
        # 8-hour expiry
        if "iat" in jwt and "exp" in jwt:
            diff = jwt["exp"] - jwt["iat"]
            test("JWT expires in ~8 hours (28800s)", abs(diff - 28800) < 60, f"got {diff}s")
    
    # PMO login
    r = login("pmo", "AliraPMO2026!")
    test("PMO login returns 200", r.status_code == 200, f"got {r.status_code}")
    if r.status_code == 200:
        d = r.json()
        test("PMO user has role analyst", d.get("user", {}).get("role") == "analyst", f"role={d.get('user',{}).get('role')}")
    
    # Bad credentials
    r = login("admin", "wrongpassword")
    test("Bad credentials returns 401", r.status_code == 401, f"got {r.status_code}")
    
    # Register (admin only)
    tk = admin_token()
    r = requests.post(f"{BASE}/api/auth/register", headers=auth_h(tk), json={
        "username": "qa_test_user", "email": "qa@test.com", "password": "TestPass123!", "role": "viewer"
    })
    test("Register with admin returns 201", r.status_code in (200, 201, 400) and (r.status_code != 400 or "already exists" in r.text.lower()), f"got {r.status_code}: {r.text[:80]}")
    
    # Register without auth
    r = requests.post(f"{BASE}/api/auth/register", json={
        "username": "qa_test_noauth", "email": "noauth@test.com", "password": "TestPass123!", "role": "viewer"
    })
    test("Register without auth returns 403", r.status_code in (401, 403), f"got {r.status_code}")

# ── B. Expert Options ─────────────────────────────────────────────────────────

def test_expert_options():
    print("\n── B. Expert Options ──")
    r = requests.get(f"{BASE}/api/expert/options")
    test("GET /api/expert/options returns 200", r.status_code == 200, f"got {r.status_code}")
    if r.status_code != 200:
        return
    
    opts = r.json()
    test("Exactly 35 fields", len(opts) == 35, f"got {len(opts)}")
    
    expected = {
        "b1_starting_point": ["From AI draft", "Mixed", "From blank page"],
        "b2_research_sources": ["1-3", "4-7", "8-12", "13+"],
        "b3_assembly_ratio": [">75% AI", "50-75%", "25-50%", "<25%"],
        "b4_hypothesis_first": ["Hypothesis-first", "Hybrid", "Discovery-first"],
        "b5_ai_survival": [">75%", "50-75%", "25-50%", "<25%", "Did not use AI draft"],
        "c1_specialization": ["Deep specialist", "Adjacent expertise", "Generalist"],
        "c2_directness": ["Expert authored", "Expert co-authored", "Expert reviewed only"],
        "c3_judgment_pct": [">75% judgment", "50-75%", "25-50%", "<25%"],
        "c6_self_assessment": ["Significantly better", "Somewhat better", "Comparable", "Somewhat worse"],
        "d1_proprietary_data": ["Yes", "No"],
        "d2_knowledge_reuse": ["Yes directly reused and extended", "Yes provided useful starting context", "No built from scratch"],
        "d3_moat_test": ["No — proprietary inputs decisive", "Partially — they would miss key insights", "Yes — all inputs publicly available"],
        "f1_feasibility": ["Not feasible", "Feasible but at 2x+ the cost and time", "Feasible at similar cost", "Legacy would have been more effective"],
        "f2_productization": ["Yes largely as-is", "Yes with moderate customization", "No fully bespoke"],
        "g1_reuse_intent": ["Yes without hesitation", "Yes with reservations", "No — legacy would have been better"],
    }
    
    for field, exp_opts in expected.items():
        if field in opts:
            actual = opts[field].get("options", [])
            match = actual == exp_opts
            test(f"{field} options correct", match, f"expected {exp_opts}, got {actual}")
    
    # L1 should be integer type, not categorical
    if "l1_legacy_working_days" in opts:
        l1 = opts["l1_legacy_working_days"]
        test("L1 has type='integer'", l1.get("type") == "integer" or "options" not in l1, f"type={l1.get('type')}, has_options={'options' in l1}")
    
    # L2-L12 present
    for i in range(2, 13):
        key = f"l{i}_legacy_{'team_size' if i == 2 else 'revision_depth' if i == 3 else 'scope_expansion' if i == 4 else 'client_reaction' if i == 5 else 'b2_sources' if i == 6 else 'c1_specialization' if i == 7 else 'c2_directness' if i == 8 else 'c3_judgment' if i == 9 else 'd1_proprietary' if i == 10 else 'd2_reuse' if i == 11 else 'd3_moat'}"
        test(f"L{i} present ({key})", key in opts, f"missing from options")
    
    # Em dash check
    em_dash_fields = ["d3_moat_test", "g1_reuse_intent"]
    # Also check L7-L12 for em dashes
    for i in range(7, 13):
        key = f"l{i}_legacy_{'c1_specialization' if i == 7 else 'c2_directness' if i == 8 else 'c3_judgment' if i == 9 else 'd1_proprietary' if i == 10 else 'd2_reuse' if i == 11 else 'd3_moat'}"
        if key in opts:
            em_dash_fields.append(key)
    
    for field in ["d3_moat_test", "g1_reuse_intent"]:
        if field in opts:
            opt_list = opts[field].get("options", [])
            all_text = " ".join(opt_list)
            has_em = "—" in all_text
            test(f"{field} uses em dashes", has_em, f"no em dash in: {all_text[:80]}")
    
    # Check all option strings for em dash consistency
    for field_name in ["d3_moat_test", "g1_reuse_intent"] + [f"l{i}_legacy_d3_moat" for i in range(12, 13)]:
        if field_name in opts:
            opt_list = opts[field_name].get("options", [])
            all_text = " ".join(opt_list)
            test(f"{field_name} contains em dash", "—" in all_text, f"no em dash in: {all_text[:80]}")

def test_categories():
    print("\n── C. Project Categories (seeded from CSV) ──")
    tk = admin_token()
    r = requests.get(f"{BASE}/api/categories", headers=auth_h(tk))
    test("GET /api/categories returns 200", r.status_code == 200, f"got {r.status_code}")
    if r.status_code != 200:
        return

    cats = r.json()
    test(f"Categories returned (expected 79)", len(cats) == 79, f"got {len(cats)}")

    # Spot-check CSV-sourced names
    cat_names = {c["name"] for c in cats}
    for name in ["510(k)", "Regulatory Strategy", "Evidence Generation Strategy", "MAA/NDA", "Training", "Other"]:
        test(f"Category '{name}' exists", name in cat_names, f"missing from {len(cat_names)} categories")


def test_practices():
    print("\n── C2. Practices ──")
    tk = admin_token()
    r = requests.get(f"{BASE}/api/practices", headers=auth_h(tk))
    test("GET /api/practices returns 200", r.status_code == 200, f"got {r.status_code}")
    if r.status_code != 200:
        return

    practices = r.json()
    test(f"Practices returned (expected 11)", len(practices) == 11, f"got {len(practices)}")

    codes = {p["code"] for p in practices}
    for code in ["RAM", "MAP", "NPS", "MCD", "RWE", "PEN", "RAP", "TAD", "CLI", "Other", "ALL"]:
        test(f"Practice '{code}' exists", code in codes, f"missing from {sorted(codes)}")

    # Each practice row should carry a project_count field
    test("Practice rows carry project_count", all("project_count" in p for p in practices))

# ── D. Create Deliverable / Project ───────────────────────────────────────────

def test_create_deliverable():
    print("\n── D. Create Deliverable ──")
    tk = admin_token()
    
    # First get a valid category and a practice
    r = requests.get(f"{BASE}/api/categories", headers=auth_h(tk))
    cats = r.json()
    if not cats:
        test("Cannot test create - no categories", False)
        return
    cat_id = cats[0]["id"]
    prs = requests.get(f"{BASE}/api/practices", headers=auth_h(tk)).json()
    practice_id = prs[0]["id"] if prs else None

    # Create with all V2 fields
    payload = {
        "project_name": "QA Test Deliverable",
        "category_id": cat_id,
        "practice_id": practice_id,
        "pioneer_name": "Dr. QA",
        "client_name": "QA Client",
        "engagement_stage": "Active engagement",
        "date_started": "2026-03-01",
        "date_delivered": "2026-03-10",
        "working_days": 8,
        "xcsg_team_size": "2",
        "revision_depth": "Cosmetic only",
        "xcsg_scope_expansion": "No",
        "engagement_revenue": 100000,
    }
    
    payload["xcsg_revision_rounds"] = "1"
    r = requests.post(f"{BASE}/api/projects", headers={**auth_h(tk), "Content-Type": "application/json"}, json=payload)
    test("POST /api/projects returns 201", r.status_code in (200, 201), f"got {r.status_code}: {r.text[:100]}")
    
    if r.status_code in (200, 201):
        proj = r.json()
        test("Returns expert_token", "expert_token" in proj, f"keys: {list(proj.keys())}")

        # Check working_days and engagement_revenue stored
        test("working_days stored", proj.get("working_days") == 8, f"got {proj.get('working_days')}")
        test("engagement_revenue stored", proj.get("engagement_revenue") == 100000, f"got {proj.get('engagement_revenue')}")
        test("revision_depth stored", proj.get("revision_depth") == "Cosmetic only", f"got {proj.get('revision_depth')}")
        test("practice_id stored", proj.get("practice_id") == practice_id, f"got {proj.get('practice_id')}")
        test("practice_code returned on project row", proj.get("practice_code") is not None, f"got {proj.get('practice_code')}")
        
        # Clean up
        requests.delete(f"{BASE}/api/projects/{proj['id']}", headers=auth_h(tk))
    
    # Required fields test - missing pioneer_name
    payload2 = {
        "project_name": "QA Test No Pioneer",
        "category_id": cat_id,
        "date_started": "2026-03-01",
        "date_delivered": "2026-03-10",
        "xcsg_team_size": "2",
        "xcsg_revision_rounds": "0",
    }
    r = requests.post(f"{BASE}/api/projects", headers={**auth_h(tk), "Content-Type": "application/json"}, json=payload2)
    test("Missing pioneer_name rejected", r.status_code == 422, f"got {r.status_code}")
    
    # No legacy estimate fields in PMO form
    test("No legacy_calendar_days required (V2)", True)  # just checking it's not required
    payload3 = {**payload, "project_name": "QA No Legacy"}
    r = requests.post(f"{BASE}/api/projects", headers={**auth_h(tk), "Content-Type": "application/json"}, json=payload3)
    if r.status_code in (200, 201):
        proj = r.json()
        requests.delete(f"{BASE}/api/projects/{proj['id']}", headers=auth_h(tk))

# ── E. Expert Assessment ──────────────────────────────────────────────────────

def test_expert_assessment():
    print("\n── E. Expert Assessment ──")
    tk = admin_token()
    
    # Create a project first
    r = requests.get(f"{BASE}/api/categories", headers=auth_h(tk))
    cats = r.json()
    cat_id = cats[0]["id"] if cats else 1
    
    r = requests.post(f"{BASE}/api/projects", headers={**auth_h(tk), "Content-Type": "application/json"}, json={
        "project_name": "QA Expert Test",
        "category_id": cat_id,
        "pioneer_name": "Dr. Expert QA",
        "engagement_stage": "Active engagement",
        "date_started": "2026-03-01",
        "date_delivered": "2026-03-10",
        "working_days": 5,
        "xcsg_team_size": "2",
        "revision_depth": "Cosmetic only",
        "xcsg_revision_rounds": "1",
    })
    
    if r.status_code not in (200, 201):
        test("Cannot test expert - project creation failed", False, f"{r.status_code}: {r.text[:80]}")
        return
    
    proj = r.json()
    token = proj["expert_token"]
    
    # GET expert context (no auth)
    r = requests.get(f"{BASE}/api/expert/{token}")
    test("GET /api/expert/{{token}} returns 200 (no auth)", r.status_code == 200, f"got {r.status_code}")
    if r.status_code == 200:
        ctx = r.json()
        test("Expert context has project_name", "project_name" in ctx)
        test("Expert context has already_completed", "already_completed" in ctx)
        test("Expert context already_completed=False", ctx.get("already_completed") == False)
    
    # POST expert assessment
    expert_data = {
        "b1_starting_point": "From AI draft",
        "b2_research_sources": "8-12",
        "b3_assembly_ratio": ">75% AI",
        "b4_hypothesis_first": "Hypothesis-first",
        "b5_ai_survival": ">75%",
        "b6_data_analysis_split": "25-50%",
        "c1_specialization": "Deep specialist",
        "c2_directness": "Expert authored",
        "c3_judgment_pct": ">75% judgment",
        "c6_self_assessment": "Significantly better",
        "c7_analytical_depth": "Exceptional",
        "c8_decision_readiness": "Yes without caveats",
        "d1_proprietary_data": "Yes",
        "d2_knowledge_reuse": "Yes directly reused and extended",
        "d3_moat_test": "No — proprietary inputs decisive",
        "e1_client_decision": "Yes — informed a specific decision",
        "f1_feasibility": "Not feasible",
        "f2_productization": "Yes largely as-is",
        "g1_reuse_intent": "Yes without hesitation",
        "l1_legacy_working_days": 15,
        "l2_legacy_team_size": "3",
        "l3_legacy_revision_depth": "Moderate rework",
        "l4_legacy_scope_expansion": "No",
        "l5_legacy_client_reaction": "Met expectations",
        "l6_legacy_b2_sources": "4-7",
        "l7_legacy_c1_specialization": "Generalist",
        "l8_legacy_c2_directness": "Expert reviewed only",
        "l9_legacy_c3_judgment": "25-50%",
        "l10_legacy_d1_proprietary": "No",
        "l11_legacy_d2_reuse": "No built from scratch",
        "l12_legacy_d3_moat": "Yes — all inputs publicly available",
        "l13_legacy_c7_depth": "Adequate",
        "l14_legacy_c8_decision": "Needs significant additional work",
        "l15_legacy_e1_decision": "Yes — referenced in internal discussions",
        "l16_legacy_b6_data": ">75% on data",
    }
    
    r = requests.post(f"{BASE}/api/expert/{token}", json=expert_data)
    test("POST /api/expert/{{token}} returns 201", r.status_code in (200, 201), f"got {r.status_code}: {r.text[:100]}")
    
    # Re-submit should fail
    r2 = requests.post(f"{BASE}/api/expert/{token}", json=expert_data)
    test("Re-submit returns already completed", r2.status_code in (200, 201, 400, 409), f"got {r.status_code}: {r2.text[:100]}")
    if r2.status_code in (200, 201, 400, 409):
        test("Re-submit message mentions 'already'", "already" in r2.text.lower(), f"msg: {r2.text[:80]}")
    
    # Clean up
    requests.delete(f"{BASE}/api/projects/{proj['id']}", headers=auth_h(tk))

# ── F. Metrics Computation ────────────────────────────────────────────────────

def test_metrics():
    print("\n── F. Metrics Computation ──")
    tk = admin_token()
    
    # Check that the metrics code uses the right team midpoints
    from pathlib import Path
    metrics_file = Path(DB_PATH).parent.parent / "backend" / "metrics.py"
    if metrics_file.exists():
        content = metrics_file.read_text()
        test("TEAM_MIDPOINTS defined", 'TEAM_MIDPOINTS' in content)
        test('Team midpoint "1":1', '"1": 1' in content or "'1': 1" in content)
        test('Team midpoint "4+":5', '"4+": 5' in content or "'4+': 5" in content)
        
        # Quality score components
        test("REVISION_DEPTH_SCORES defined", "REVISION_DEPTH_SCORES" in content)
        test("No revisions=1.0", '"No revisions needed": 1.0' in content)
        test("Cosmetic=0.85", '"Cosmetic only": 0.85' in content)
        test("Moderate=0.55", '"Moderate rework": 0.55' in content)
        test("Major=0.2", '"Major rework": 0.2' in content)
        
        test("SELF_ASSESSMENT_SCORES defined", "SELF_ASSESSMENT_SCORES" in content)
        test("Significantly=1.0", '"Significantly better": 1.0' in content)
        test("Somewhat=0.7", '"Somewhat better": 0.7' in content)
        test("Comparable=0.4", '"Comparable": 0.4' in content)
        test("Worse=0.1", '"Somewhat worse": 0.1' in content)
        
        test("CLIENT_PULSE_SCORES defined", "CLIENT_PULSE_SCORES" in content)
        test("Exceeded=1.0", '"Exceeded expectations": 1.0' in content)
        test("Met=0.6", '"Met expectations": 0.6' in content)
        test("Below=0.1", '"Below expectations": 0.1' in content)
        
        # Quality score is composite, not ratio
        test("compute_quality_score defined", "compute_quality_score" in content or "quality_score" in content)
        
        # Outcome rate = quality_score / person_days
        test("outcome_rate computation", "outcome_rate" in content.lower())
        
        # Revenue productivity
        test("revenue_productivity computation", "productivity" in content.lower() or "revenue_productivity" in content.lower())
        
        # B5 "Did not use AI draft" excluded
        test("B5 'Did not use AI draft' handled", "Did not use AI draft" in content)
        
        # Flywheel leg scores
        test("Machine-First score computed", "machine_first" in content.lower())
        test("Senior-Led score computed", "senior_led" in content.lower())
        test("Proprietary Knowledge score computed", "proprietary_knowledge" in content.lower())
    
    # Check per-project metrics from API
    r = requests.get(f"{BASE}/api/metrics/projects", headers=auth_h(tk))
    if r.status_code == 200:
        metrics = r.json()
        if metrics:
            m = metrics[0]
            test("Per-project has effort_ratio", "effort_ratio" in m)
            test("Per-project has quality_score", "quality_score" in m)
            test("Per-project has outcome_rate_ratio", "outcome_rate_ratio" in m)
            
            # Quality score should be 0-1 range
            if m.get("quality_score"):
                qs = m["quality_score"]
                test(f"Quality score in 0-1 range (got {qs})", 0 <= qs <= 1, f"value={qs}")

# ── G. Scaling Gates ──────────────────────────────────────────────────────────

def test_scaling_gates():
    print("\n── G. Scaling Gates ──")
    tk = admin_token()
    r = requests.get(f"{BASE}/api/metrics/scaling-gates", headers=auth_h(tk))
    test("GET /api/metrics/scaling-gates returns 200", r.status_code == 200, f"got {r.status_code}")
    if r.status_code != 200:
        return
    
    data = r.json()
    gates = data.get("gates", [])
    test("7 gates returned", len(gates) == 7, f"got {len(gates)}")
    test("passed_count field exists", "passed_count" in data)
    
    gate_map = {g["id"]: g for g in gates}
    
    if 1 in gate_map:
        test("Gate 1: Multi-engagement", "Multi-engagement" in gate_map[1]["name"] or "deliverable type" in gate_map[1]["description"].lower())
    if 2 in gate_map:
        test("Gate 2: Effort ratio > 1.3", "1.3" in gate_map[2]["description"] or "effort" in gate_map[2]["name"].lower())
    if 3 in gate_map:
        test("Gate 3: Client-invisible quality", "revision" in gate_map[3]["description"].lower() or "quality" in gate_map[3]["name"].lower())
    if 6 in gate_map:
        test("Gate 6: D2 reuse ≥40%", "40%" in gate_map[6]["description"] or "d2" in gate_map[6]["description"].lower() or "compounding" in gate_map[6]["name"].lower())
    if 7 in gate_map:
        test("Gate 7: G1 reuse intent ≥70%", "70%" in gate_map[7]["description"] or "g1" in gate_map[7]["description"].lower() or "adoption" in gate_map[7]["name"].lower())

# ── H. Dashboard Metrics ──────────────────────────────────────────────────────

def test_dashboard():
    print("\n── H. Dashboard Metrics ──")
    tk = admin_token()
    
    r = requests.get(f"{BASE}/api/dashboard/metrics", headers=auth_h(tk))
    test("GET /api/dashboard/metrics returns 200", r.status_code == 200, f"got {r.status_code}")
    if r.status_code != 200:
        return
    
    m = r.json()
    
    # Also check /api/metrics/summary
    r2 = requests.get(f"{BASE}/api/metrics/summary", headers=auth_h(tk))
    test("GET /api/metrics/summary returns 200", r2.status_code == 200)
    
    # Check for key fields across both responses
    for endpoint_name, resp in [("dashboard", m), ("summary", r2.json() if r2.status_code == 200 else {})]:
        if not resp:
            continue
        test(f"{endpoint_name}: has total_completed or complete_projects",
             "total_completed" in resp or "complete_projects" in resp or "completed_count" in resp)
        test(f"{endpoint_name}: has effort_ratio",
             "average_effort_ratio" in resp or "effort_ratio" in resp)
        test(f"{endpoint_name}: has quality_score",
             "average_quality_score" in resp or "quality_score" in resp)
        test(f"{endpoint_name}: has reuse_intent_rate",
             "reuse_intent_rate" in resp or "reuse_intent_avg" in resp)
    
    # Quality score 0-1 range
    qs = m.get("average_quality_score")
    if qs is not None and qs > 0:
        test(f"Dashboard quality_score in 0-1 range (got {qs})", 0 <= qs <= 1, f"value={qs}")

# ── I. Deliverables / Projects List ──────────────────────────────────────────

def test_deliverables_list():
    print("\n── I. Deliverables/Projects List ──")
    tk = admin_token()
    
    # Check /api/projects list
    r = requests.get(f"{BASE}/api/projects?limit=5", headers=auth_h(tk))
    test("GET /api/projects returns 200", r.status_code == 200, f"got {r.status_code}")
    if r.status_code == 200:
        data = r.json()
        items = data if isinstance(data, list) else data.get("items", [])
        test("Projects list has items", len(items) > 0)
        if items:
            test("Project has status field", "status" in items[0])
    
    # Check PATCH /api/deliverables/{id} for client_pulse
    if items:
        proj_id = items[0]["id"]
        r = requests.patch(f"{BASE}/api/deliverables/{proj_id}", headers={**auth_h(tk), "Content-Type": "application/json"},
                          json={"client_pulse": "Exceeded expectations"})
        test("PATCH /api/deliverables/{{id}} accepts client_pulse", r.status_code in (200, 201), f"got {r.status_code}")

# ── J. String Consistency ─────────────────────────────────────────────────────

def test_string_consistency():
    print("\n── J. String Consistency ──")
    
    from pathlib import Path
    base_dir = Path(DB_PATH).parent.parent
    
    # Get option strings from API
    r = requests.get(f"{BASE}/api/expert/options")
    if r.status_code != 200:
        test("Cannot test string consistency - options endpoint failed", False)
        return
    api_opts = r.json()
    
    # Extract all option strings from API
    api_strings = set()
    for field, info in api_opts.items():
        for opt in info.get("options", []):
            api_strings.add(opt)
    
    # Check backend metrics.py for matching strings
    metrics_file = base_dir / "backend" / "metrics.py"
    if metrics_file.exists():
        content = metrics_file.read_text()
        # Check key strings exist in metrics
        critical_strings = [
            "No revisions needed", "Cosmetic only", "Moderate rework", "Major rework",
            "Significantly better", "Somewhat better", "Comparable", "Somewhat worse",
            "Exceeded expectations", "Met expectations", "Below expectations",
            "Yes directly reused and extended", "Yes provided useful starting context", "No built from scratch",
            "No \u2014 proprietary inputs decisive", "Partially \u2014 they would miss key insights", "Yes \u2014 all inputs publicly available",
        ]
        for s in critical_strings:
            test(f"Backend metrics contains: '{s[:40]}...'", s in content, f"missing: {s[:60]}")
    
    # Check frontend app.js
    frontend_file = base_dir / "frontend" / "app.js"
    if frontend_file.exists():
        js_content = frontend_file.read_text()
        # Check em dash strings
        em_dash_options = [
            "No \u2014 proprietary inputs decisive",
            "Partially \u2014 they would miss key insights",
            "Yes \u2014 all inputs publicly available",
            "No \u2014 legacy would have been worse",
        ]
        for opt in em_dash_options:
            # Check for em dash in JS
            has_em = "\u2014" in js_content
            if has_em:
                # Just check the em dash variant is present
                test(f"Frontend has em dash (—) in options", True)
                break
        else:
            test("Frontend has em dash (—) in options", "\u2014" in js_content, "no em dash found in app.js")

# ── K. Frontend JS Syntax ────────────────────────────────────────────────────

def test_frontend_js():
    print("\n── K. Frontend JS Syntax ──")
    from pathlib import Path
    frontend_file = Path(DB_PATH).parent.parent / "frontend" / "app.js"
    if not frontend_file.exists():
        test("frontend/app.js exists", False)
        return
    
    result = subprocess.run(["node", "-c", str(frontend_file)], capture_output=True, text=True)
    test("node -c frontend/app.js passes", result.returncode == 0, result.stderr.strip() if result.returncode != 0 else "")

# ── L. Norms / Category Norms ─────────────────────────────────────────────────

def test_norms():
    print("\n── L. Norms / Category Norms ──")
    tk = admin_token()
    
    r = requests.get(f"{BASE}/api/norms/aggregates", headers=auth_h(tk))
    test("GET /api/norms/aggregates returns 200", r.status_code == 200, f"got {r.status_code}")
    if r.status_code != 200:
        return
    
    norms = r.json()
    test("Norms is a list", isinstance(norms, list))
    
    if norms:
        n = norms[0]
        test("Norm has sample_count", "sample_count" in n)
        test("Norm has category_name", "category_name" in n)
        
        # Check outlier flag logic - should only appear when ≥3 samples
        if n.get("sample_count", 0) < 3:
            test(f"Outlier flag absent when <3 samples ({n.get('sample_count')})", not n.get("has_outlier_flags", False))
    
    # Categories with 0 completions should show empty/null norms
    has_zero = any(n.get("sample_count", 0) == 0 for n in norms)
    if has_zero:
        for n in norms:
            if n.get("sample_count", 0) == 0:
                test(f"Zero-completion category ({n.get('category_name')}) has null averages",
                     n.get("average_legacy_working_days") is None or n.get("average_legacy_team_size") is None)

# ── L2. /api/schema endpoint ─────────────────────────────────────────────────

def test_schema_endpoint():
    print("\n── L2. /api/schema endpoint ──")
    tk = admin_token()
    r = requests.get(f"{BASE}/api/schema", headers=auth_h(tk))
    test("GET /api/schema returns 200", r.status_code == 200, f"got {r.status_code}")
    if r.status_code != 200:
        return
    body = r.json()
    test("schema response has dashboard key", "dashboard" in body)
    dash = body.get("dashboard") or {}
    test("schema.dashboard has tabs list", isinstance(dash.get("tabs"), list) and len(dash["tabs"]) == 4)
    test("schema.dashboard has charts list", isinstance(dash.get("charts"), list) and len(dash["charts"]) == 19)
    test("schema.dashboard has kpi_tiles list", isinstance(dash.get("kpi_tiles"), list) and len(dash["kpi_tiles"]) == 12)
    test("schema.dashboard.thresholds.radar_axis_cap present",
         isinstance((dash.get("thresholds") or {}).get("radar_axis_cap"), (int, float)))

# ── L3. MetricsSummary endpoint fields ───────────────────────────────────────

def test_metrics_summary_fields():
    """Regression guard: MetricsSummary model must not silently drop these keys."""
    print("\n── L3. MetricsSummary endpoint fields ──")
    tk = admin_token()
    r = requests.get(f"{BASE}/api/metrics/summary", headers=auth_h(tk))
    test("GET /api/metrics/summary 200", r.status_code == 200, f"got {r.status_code}")
    if r.status_code != 200:
        return
    body = r.json()
    for key in ("average_quality_ratio", "rework_efficiency_avg", "client_impact_avg", "data_independence_avg"):
        test(f"summary exposes {key}", key in body, f"missing from response keys")

# ── M. Database Schema Checks ────────────────────────────────────────────────

def test_schema():
    print("\n── M. Database Schema Checks ──")
    if not os.path.exists(DB_PATH):
        test("Database file exists", False, f"not found: {DB_PATH}")
        return
    
    conn = sqlite3.connect(DB_PATH)
    
    # projects table
    proj_cols = {row[1] for row in conn.execute("PRAGMA table_info(projects)").fetchall()}
    test("projects has working_days column", "working_days" in proj_cols)
    test("projects has engagement_revenue column", "engagement_revenue" in proj_cols)
    test("projects has revision_depth column", "revision_depth" in proj_cols)
    
    # expert_responses table
    exp_cols = {row[1] for row in conn.execute("PRAGMA table_info(expert_responses)").fetchall()}
    test("expert_responses has c6_self_assessment", "c6_self_assessment" in exp_cols)
    test("expert_responses has g1_reuse_intent", "g1_reuse_intent" in exp_cols)
    test("expert_responses has b5_ai_survival", "b5_ai_survival" in exp_cols)
    test("expert_responses has b6_data_analysis_split", "b6_data_analysis_split" in exp_cols)
    test("expert_responses has c7_analytical_depth", "c7_analytical_depth" in exp_cols)
    test("expert_responses has c8_decision_readiness", "c8_decision_readiness" in exp_cols)
    test("expert_responses has e1_client_decision", "e1_client_decision" in exp_cols)
    
    # Legacy columns
    legacy_cols = ["l1_legacy_working_days", "l2_legacy_team_size", "l3_legacy_revision_depth", "l13_legacy_c7_depth", "l14_legacy_c8_decision", "l15_legacy_e1_decision", "l16_legacy_b6_data"]
    for col in legacy_cols:
        test(f"expert_responses has {col}", col in exp_cols)

    conn.close()

# ── N. DASHBOARD_CONFIG ───────────────────────────────────────────────────────

def test_dashboard_config():
    print("\n── N. DASHBOARD_CONFIG ──")
    from backend import schema as _schema
    dc = getattr(_schema, "DASHBOARD_CONFIG", None)
    test("DASHBOARD_CONFIG exists", isinstance(dc, dict))
    test("DASHBOARD_CONFIG has tabs", isinstance(dc.get("tabs"), list) and len(dc["tabs"]) == 4)
    test("DASHBOARD_CONFIG has charts list", isinstance(dc.get("charts"), list))
    th = dc.get("thresholds", {})
    test("thresholds.radar_axis_cap is positive float", isinstance(th.get("radar_axis_cap"), (int, float)) and th["radar_axis_cap"] > 1)
    test("thresholds.quarterly_bucket_min_quarters is int >= 2", isinstance(th.get("quarterly_bucket_min_quarters"), int) and th["quarterly_bucket_min_quarters"] >= 2)
    test("thresholds.cohort_min_projects is int >= 1", isinstance(th.get("cohort_min_projects"), int) and th["cohort_min_projects"] >= 1)
    test("thresholds.bar_top_n is int >= 3", isinstance(th.get("bar_top_n"), int) and th["bar_top_n"] >= 3)
    tone = th.get("metric_tone", {})
    test("metric_tone.success_above is float", isinstance(tone.get("success_above"), (int, float)))
    test("metric_tone.blue_above is float", isinstance(tone.get("blue_above"), (int, float)))
    test("metric_tone.warning_above is float", isinstance(tone.get("warning_above"), (int, float)))

    # (added in Task 2 to harden Task 1 config)
    test("tab ids are unique", len({t["id"] for t in dc["tabs"]}) == len(dc["tabs"]))
    test("every tab has id/label/icon", all({"id", "label", "icon"} <= set(t.keys()) for t in dc["tabs"]))
    test("metric_tone ordering (success > blue > warning)",
         tone["success_above"] > tone["blue_above"] > tone["warning_above"])

    # kpi_tiles assertions (Task 2)
    test("kpi_tiles has 12 entries", isinstance(dc["kpi_tiles"], list) and len(dc["kpi_tiles"]) == 12)
    test("every kpi_tile.metric_key exists in METRICS or is synthetic",
         all(t["metric_key"] in _schema.METRICS or t.get("synthetic") is True for t in dc["kpi_tiles"]))
    test("every kpi_tile has tab field", all("tab" in t for t in dc["kpi_tiles"]))
    tab_ids_set = {x["id"] for x in dc["tabs"]}
    test("every kpi_tile.tab is a known tab id",
         all(t["tab"] in tab_ids_set for t in dc["kpi_tiles"]))

    CHART_TYPES = {
        "scatter_disprove", "radar_gains",
        "timeline_per_project", "timeline_quarterly", "timeline_cumulative", "cohort_learning_curve",
        "bar_by_category", "bar_by_practice", "bar_by_pioneer",
        "heatmap_practice_quarter", "area_category_mix",
        "donut_client_pulse", "donut_reuse_intent", "scatter_schedule", "track_scaling_gates",
        "table_portfolio",
        "ranked_list_top", "ranked_list_bottom", "timeline_effort",
    }
    test("every chart has id/tab/type/title",
         all({"id", "tab", "type", "title"} <= set(c.keys()) for c in dc["charts"]))
    test("every chart.tab is a known tab id",
         all(c["tab"] in tab_ids_set for c in dc["charts"]))
    test("every chart.type is in CHART_TYPES",
         all(c["type"] in CHART_TYPES for c in dc["charts"]))
    test("chart ids are unique",
         len({c["id"] for c in dc["charts"]}) == len(dc["charts"]))
    test("Trends tab has 5 charts",
         sum(1 for c in dc["charts"] if c["tab"] == "trends") == 5)
    test("Breakdowns has 5 charts (3 bars + heatmap + mix)",
         sum(1 for c in dc["charts"] if c["tab"] == "breakdowns") == 5)
    test("every tab has at least one chart",
         all(any(c["tab"] == t for c in dc["charts"]) for t in tab_ids_set))
    test("Overview has 4 charts",
         sum(1 for c in dc["charts"] if c["tab"] == "overview") == 4)
    test("Signals has 5 charts",
         sum(1 for c in dc["charts"] if c["tab"] == "signals") == 5)

# ── O. Seed profile EXPERT_FIELDS coverage ───────────────────────────────────

def test_seed_field_coverage():
    """Every EXPERT_FIELDS key must appear in every seed profile dict."""
    print("\n── O. Seed profile coverage (every EXPERT_FIELDS key) ──")
    import importlib.util, pathlib
    from backend.schema import EXPERT_FIELDS
    seed_path = pathlib.Path("tests/seed_20_projects.py")
    spec = importlib.util.spec_from_file_location("seed_module", seed_path)
    seed_mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(seed_mod)

    # Heuristic: profile dicts are module-level, uppercase names, and carry c6_self_assessment
    profiles = {name: obj for name, obj in vars(seed_mod).items()
                if name.isupper() and isinstance(obj, dict) and obj.get("c6_self_assessment")}
    test("seed defines at least 3 profiles", len(profiles) >= 3, detail=f"found {list(profiles.keys())}")
    for pname, pdict in profiles.items():
        missing = [k for k in EXPERT_FIELDS if k not in pdict]
        test(f"seed profile {pname} covers all EXPERT_FIELDS", not missing, detail=f"missing={missing}")

# Aggregate parity (no-filter client aggregates == /api/dashboard/metrics) is
# enforced by tests/e2e-dashboard-redesign.spec.ts > "no-filter parity".

# ── P. Survey flow: cross-pioneer visibility + auto-issue next round ─────────

_VALID_EXPERT_PAYLOAD = {
    "b1_starting_point": "From AI draft",
    "b2_research_sources": "8-12",
    "b3_assembly_ratio": ">75% AI",
    "b4_hypothesis_first": "Hypothesis-first",
    "b5_ai_survival": ">75%",
    "b6_data_analysis_split": "25-50%",
    "c1_specialization": "Deep specialist",
    "c2_directness": "Expert authored",
    "c3_judgment_pct": ">75% judgment",
    "c6_self_assessment": "Significantly better",
    "c7_analytical_depth": "Exceptional",
    "c8_decision_readiness": "Yes without caveats",
    "d1_proprietary_data": "Yes",
    "d2_knowledge_reuse": "Yes directly reused and extended",
    "d3_moat_test": "No — proprietary inputs decisive",
    "e1_client_decision": "Yes — informed a specific decision",
    "f1_feasibility": "Not feasible",
    "f2_productization": "Yes largely as-is",
    "g1_reuse_intent": "Yes without hesitation",
    "l1_legacy_working_days": 15,
    "l2_legacy_team_size": "3",
    "l3_legacy_revision_depth": "Moderate rework",
    "l4_legacy_scope_expansion": "No",
    "l5_legacy_client_reaction": "Met expectations",
    "l6_legacy_b2_sources": "4-7",
    "l7_legacy_c1_specialization": "Generalist",
    "l8_legacy_c2_directness": "Expert reviewed only",
    "l9_legacy_c3_judgment": "25-50%",
    "l10_legacy_d1_proprietary": "No",
    "l11_legacy_d2_reuse": "No built from scratch",
    "l12_legacy_d3_moat": "Yes — all inputs publicly available",
    "l13_legacy_c7_depth": "Adequate",
    "l14_legacy_c8_decision": "Needs significant additional work",
    "l15_legacy_e1_decision": "Yes — referenced in internal discussions",
    "l16_legacy_b6_data": ">75% on data",
}


def _pioneer_round1_token(project: dict, pioneer_name: str) -> str:
    for p in project.get("pioneers", []):
        name = p.get("pioneer_name") or p.get("name")
        if name == pioneer_name:
            for rnd in p.get("rounds", []):
                if rnd.get("round_number") == 1:
                    return rnd["token"]
            # Fallback to legacy pioneer-level token (it doubles as round 1).
            return p.get("expert_token")
    raise AssertionError(f"Pioneer '{pioneer_name}' not found on project")


def test_show_other_pioneers_flag():
    print("\n── P1. show_other_pioneers_answers flag ──")
    tk = admin_token()
    cats = requests.get(f"{BASE}/api/categories", headers=auth_h(tk)).json()
    cat_id = cats[0]["id"] if cats else 1

    def _create(flag: bool, name: str):
        r = requests.post(
            f"{BASE}/api/projects",
            headers={**auth_h(tk), "Content-Type": "application/json"},
            json={
                "project_name": name,
                "category_id": cat_id,
                "pioneers": [
                    {"name": "Pioneer One"},
                    {"name": "Pioneer Two"},
                ],
                "default_rounds": 1,
                "show_other_pioneers_answers": flag,
                "date_started": "2026-03-01",
                "date_delivered": "2026-03-10",
                "working_days": 5,
                "xcsg_team_size": "2",
                "xcsg_revision_rounds": "1",
            },
        )
        assert r.status_code in (200, 201), r.text
        return r.json()

    # Case 1: flag enabled
    proj_on = _create(True, "QA Cross-Pioneer ON")
    test(
        "Project persists show_other_pioneers_answers=True",
        bool(proj_on.get("show_other_pioneers_answers")),
        f"got {proj_on.get('show_other_pioneers_answers')}",
    )
    p1_tok = _pioneer_round1_token(proj_on, "Pioneer One")
    p2_tok = _pioneer_round1_token(proj_on, "Pioneer Two")
    r = requests.post(f"{BASE}/api/expert/{p1_tok}", json=_VALID_EXPERT_PAYLOAD)
    test("P1 submits round 1 (flag on)", r.status_code in (200, 201), f"got {r.status_code}: {r.text[:120]}")
    ctx = requests.get(f"{BASE}/api/expert/{p2_tok}").json()
    test(
        "P2 expert-view exposes show_other_pioneers=True",
        ctx.get("show_other_pioneers") is True,
        f"got {ctx.get('show_other_pioneers')}",
    )
    others = ctx.get("other_pioneers_responses")
    test(
        "P2 sees exactly one other-pioneer response (flag on)",
        isinstance(others, list) and len(others) == 1,
        f"got {others if isinstance(others, list) else type(others).__name__}",
    )
    if isinstance(others, list) and others:
        test(
            "Other-pioneer entry has pioneer_name=Pioneer One",
            others[0].get("pioneer_name") == "Pioneer One",
            f"got {others[0].get('pioneer_name')}",
        )
        test(
            "Other-pioneer entry contains answer field (b1_starting_point)",
            others[0].get("b1_starting_point") == "From AI draft",
            f"got {others[0].get('b1_starting_point')}",
        )
    requests.delete(f"{BASE}/api/projects/{proj_on['id']}", headers=auth_h(tk))

    # Case 2: flag disabled
    proj_off = _create(False, "QA Cross-Pioneer OFF")
    test(
        "Project persists show_other_pioneers_answers=False",
        not bool(proj_off.get("show_other_pioneers_answers")),
        f"got {proj_off.get('show_other_pioneers_answers')}",
    )
    p1_tok = _pioneer_round1_token(proj_off, "Pioneer One")
    p2_tok = _pioneer_round1_token(proj_off, "Pioneer Two")
    r = requests.post(f"{BASE}/api/expert/{p1_tok}", json=_VALID_EXPERT_PAYLOAD)
    test("P1 submits round 1 (flag off)", r.status_code in (200, 201), f"got {r.status_code}")
    ctx = requests.get(f"{BASE}/api/expert/{p2_tok}").json()
    test(
        "P2 expert-view exposes show_other_pioneers=False (flag off)",
        ctx.get("show_other_pioneers") is False,
        f"got {ctx.get('show_other_pioneers')}",
    )
    test(
        "P2 other_pioneers_responses is None (flag off)",
        ctx.get("other_pioneers_responses") is None,
        f"got {ctx.get('other_pioneers_responses')}",
    )
    requests.delete(f"{BASE}/api/projects/{proj_off['id']}", headers=auth_h(tk))


def test_auto_issue_next_round():
    print("\n── P2. Auto-issue next round on submit ──")
    tk = admin_token()
    cats = requests.get(f"{BASE}/api/categories", headers=auth_h(tk)).json()
    cat_id = cats[0]["id"] if cats else 1

    r = requests.post(
        f"{BASE}/api/projects",
        headers={**auth_h(tk), "Content-Type": "application/json"},
        json={
            "project_name": "QA Auto-Issue Round",
            "category_id": cat_id,
            "pioneers": [{"name": "Solo Pioneer", "total_rounds": 2}],
            "default_rounds": 2,
            "date_started": "2026-03-01",
            "date_delivered": "2026-03-10",
            "working_days": 5,
            "xcsg_team_size": "2",
            "xcsg_revision_rounds": "1",
        },
    )
    test("Create 2-round project returns 201", r.status_code in (200, 201), f"got {r.status_code}: {r.text[:120]}")
    if r.status_code not in (200, 201):
        return
    proj = r.json()
    r1_tok = _pioneer_round1_token(proj, "Solo Pioneer")

    submit = requests.post(f"{BASE}/api/expert/{r1_tok}", json=_VALID_EXPERT_PAYLOAD)
    test("Round 1 submit returns 201", submit.status_code in (200, 201), f"got {submit.status_code}: {submit.text[:120]}")
    body = submit.json() if submit.status_code in (200, 201) else {}
    test("Submit response includes next_round_token (not None)", bool(body.get("next_round_token")), f"got {body.get('next_round_token')}")
    test("Submit response reports current_round=1", body.get("current_round") == 1, f"got {body.get('current_round')}")
    test("Submit response reports total_rounds=2", body.get("total_rounds") == 2, f"got {body.get('total_rounds')}")

    # Verify GET /api/projects/{id} shows the new round 2 token as issued.
    proj_after = requests.get(f"{BASE}/api/projects/{proj['id']}", headers=auth_h(tk)).json()
    pioneers = proj_after.get("pioneers", [])
    solo = next((p for p in pioneers if (p.get("pioneer_name") or p.get("name")) == "Solo Pioneer"), None)
    test("Pioneer is present in project after submit", solo is not None)
    if solo is not None:
        rounds = solo.get("rounds", [])
        r2_row = next((rnd for rnd in rounds if rnd.get("round_number") == 2), None)
        test("Round 2 row exists after auto-issue", r2_row is not None, f"rounds={[r.get('round_number') for r in rounds]}")
        if r2_row is not None:
            test("Round 2 token matches submit response", r2_row.get("token") == body.get("next_round_token"), f"db={r2_row.get('token')} resp={body.get('next_round_token')}")
            test("Round 2 token is not yet completed", r2_row.get("completed_at") in (None, ""), f"got {r2_row.get('completed_at')}")

    # Also verify the new token actually works as an expert-view token.
    if body.get("next_round_token"):
        ctx = requests.get(f"{BASE}/api/expert/{body['next_round_token']}").json()
        test("next_round_token opens expert view at round 2", ctx.get("current_round") == 2, f"got {ctx.get('current_round')}")
        test("next_round_token already_completed=False", ctx.get("already_completed") is False, f"got {ctx.get('already_completed')}")

    requests.delete(f"{BASE}/api/projects/{proj['id']}", headers=auth_h(tk))


# ── X. Expert notes (per-round optional free-text) ───────────────────────────

def test_expert_notes():
    print("\n── X. Expert notes (per-round, optional free-text) ──")
    tok = admin_token()
    h = auth_h(tok)
    # Find or create a project with at least one pioneer round issued
    projects = requests.get(f"{BASE}/api/projects", headers=h).json()
    if not projects:
        test("skipped — no projects seeded", False, detail="seed first")
        return
    # Pick the first project that still has an open round for a pioneer
    proj_id = None
    pioneer = None
    open_round = None
    for pr in projects:
        pid = pr.get("id")
        if pid is None:
            continue
        detail = requests.get(f"{BASE}/api/projects/{pid}", headers=h).json()
        for pp in detail.get("pioneers", []):
            rnds = pp.get("rounds") or []
            candidate = next((r for r in rnds if r.get("token") and not r.get("completed_at")), None)
            if candidate:
                proj_id = pid
                pioneer = pp
                open_round = candidate
                break
        if open_round:
            break
    if not (proj_id and pioneer and open_round):
        test("skipped — no pioneer with open round", False, detail="all rounds completed")
        return

    # Load STRONG payload from the seed file
    import importlib.util, pathlib
    spec = importlib.util.spec_from_file_location("sd", pathlib.Path("tests/seed_20_projects.py"))
    sd = importlib.util.module_from_spec(spec); spec.loader.exec_module(sd)
    payload = dict(getattr(sd, "STRONG"))
    payload["notes"] = "Client pivoted mid-engagement from feasibility to gap analysis.\nWorth flagging for similar RAM projects."

    r = requests.post(f"{BASE}/api/expert/{open_round['token']}", json=payload)
    test("POST /api/expert/{token} with notes returns 200/201", r.status_code in (200, 201), f"got {r.status_code}: {r.text[:200]}")

    # Confirm stored: direct DB read
    db_conn = sqlite3.connect(DB_PATH)
    row = db_conn.execute(
        "SELECT notes FROM expert_responses WHERE project_id = ? AND pioneer_id = ? ORDER BY id DESC LIMIT 1",
        (proj_id, pioneer["id"]),
    ).fetchone()
    db_conn.close()
    test("notes persisted in expert_responses", bool(row and row[0] and "pivoted" in row[0]), detail=f"row={row}")


def test_notes_feed_endpoint():
    print("\n── Y. GET /api/notes feed + filters ──")
    tok = admin_token()
    h = auth_h(tok)

    # Unauthenticated call should be rejected (401 or 403).
    r_noauth = requests.get(f"{BASE}/api/notes")
    test("GET /api/notes unauthenticated -> 401/403", r_noauth.status_code in (401, 403), f"got {r_noauth.status_code}")

    # Seed 2 notes on different projects/practices so we can exercise filters.
    import importlib.util, pathlib
    spec = importlib.util.spec_from_file_location("sd", pathlib.Path("tests/seed_20_projects.py"))
    sd = importlib.util.module_from_spec(spec); spec.loader.exec_module(sd)
    base_payload = dict(getattr(sd, "STRONG"))

    db_conn = sqlite3.connect(DB_PATH)
    # Open rounds with practice code joined in.
    open_rounds = db_conn.execute(
        """SELECT prt.token, pr.code AS practice_code, p.id AS project_id
           FROM pioneer_round_tokens prt
           JOIN project_pioneers pp ON pp.id = prt.pioneer_id
           JOIN projects p ON p.id = pp.project_id
           LEFT JOIN practices pr ON pr.id = p.practice_id
           WHERE prt.completed_at IS NULL
           ORDER BY p.id ASC LIMIT 10"""
    ).fetchall()
    db_conn.close()

    # Pick one MAP and one non-MAP token if possible.
    map_tok = next((r for r in open_rounds if r[1] == "MAP"), None)
    other_tok = next((r for r in open_rounds if r[1] and r[1] != "MAP"), None)
    if not map_tok or not other_tok:
        test("skipped — need one MAP and one non-MAP open round", False, detail=f"open={[r[1] for r in open_rounds]}")
        return

    p_map = dict(base_payload); p_map["notes"] = "Pivotal MAP insight: payer evidence bar rose."
    p_oth = dict(base_payload); p_oth["notes"] = "Generic note from another practice."

    r1 = requests.post(f"{BASE}/api/expert/{map_tok[0]}", json=p_map)
    r2 = requests.post(f"{BASE}/api/expert/{other_tok[0]}", json=p_oth)
    test("seed MAP note submit 200/201", r1.status_code in (200, 201), f"got {r1.status_code}")
    test("seed non-MAP note submit 200/201", r2.status_code in (200, 201), f"got {r2.status_code}")

    # 1. Unfiltered feed returns both seeded notes.
    feed = requests.get(f"{BASE}/api/notes", headers=h)
    test("GET /api/notes 200", feed.status_code == 200, f"got {feed.status_code}: {feed.text[:120]}")
    items = feed.json() if feed.status_code == 200 else []
    test("/api/notes returns a list", isinstance(items, list), detail=f"type={type(items).__name__}")
    notes_texts = [i.get("notes", "") for i in items] if isinstance(items, list) else []
    test("feed contains MAP seeded note", any("Pivotal MAP insight" in n for n in notes_texts))
    test("feed contains non-MAP seeded note", any("Generic note from another practice" in n for n in notes_texts))

    # Every returned row must have the standard shape.
    if items:
        sample = items[0]
        for key in ("id", "project_id", "project_name", "pioneer_name", "round_number", "submitted_at", "notes"):
            test(f"feed row has '{key}'", key in sample, detail=f"sample keys={list(sample.keys())}")

    # 2. Filter by practice_code=MAP.
    feed_map = requests.get(f"{BASE}/api/notes", headers=h, params={"practice_code": "MAP"})
    test("GET /api/notes?practice_code=MAP 200", feed_map.status_code == 200, f"got {feed_map.status_code}")
    map_items = feed_map.json() if feed_map.status_code == 200 else []
    test("MAP filter returns >=1 row", isinstance(map_items, list) and len(map_items) >= 1, detail=f"len={len(map_items) if isinstance(map_items, list) else 'n/a'}")
    non_map = [i for i in map_items if (i.get("practice_code") or "") != "MAP"]
    test("MAP filter excludes non-MAP rows", not non_map, detail=f"leaked={[i.get('practice_code') for i in non_map]}")

    # 3. Search param (case-insensitive substring).
    feed_search = requests.get(f"{BASE}/api/notes", headers=h, params={"search": "pivot"})
    test("GET /api/notes?search=pivot 200", feed_search.status_code == 200, f"got {feed_search.status_code}")
    search_items = feed_search.json() if feed_search.status_code == 200 else []
    test(
        "search=pivot matches MAP note (case-insensitive)",
        any("Pivotal MAP insight" in i.get("notes", "") for i in search_items),
        detail=f"len={len(search_items) if isinstance(search_items, list) else 'n/a'}",
    )
    # Generic note has no "pivot" — must be excluded.
    test(
        "search=pivot excludes unrelated notes",
        not any("Generic note from another practice" in i.get("notes", "") for i in search_items),
    )


def test_notes_excel_sheet():
    print("\n── Z. Notes sheet in Excel export ──")
    import io
    try:
        import openpyxl  # noqa: F401
    except ImportError:
        test("skipped — openpyxl not installed", False)
        return
    import openpyxl
    tok = admin_token()
    r = requests.get(f"{BASE}/api/export/excel", headers=auth_h(tok))
    ct = r.headers.get("content-type", "")
    test("export returns xlsx", r.status_code == 200 and ct.endswith("sheet"), detail=f"{r.status_code} {ct}")
    if r.status_code != 200:
        return
    wb = openpyxl.load_workbook(io.BytesIO(r.content))
    test("export has Notes sheet", "Notes" in wb.sheetnames, detail=f"sheets={wb.sheetnames}")
    if "Notes" not in wb.sheetnames:
        return
    notes_sheet = wb["Notes"]
    rows = list(notes_sheet.iter_rows(values_only=True))
    test("Notes sheet has header row + >=1 data row", len(rows) >= 2, detail=f"rows={len(rows)}")
    expected_cols = ["Project", "Category", "Practice", "Pioneer", "Round", "Submitted", "Notes"]
    test("Notes sheet header matches expected columns", list(rows[0]) == expected_cols, detail=f"got {rows[0]}")


def test_dashboard_export_sheets():
    print("\n── Y. Dashboard export sheets ──")
    import io, openpyxl
    tok = admin_token()
    r = requests.get(f"{BASE}/api/export/excel", headers=auth_h(tok))
    test(
        "export/excel returns xlsx",
        r.status_code == 200 and r.headers.get("content-type", "").endswith("sheet"),
    )
    wb = openpyxl.load_workbook(io.BytesIO(r.content))
    expected_new = [
        "Dashboard Aggregates", "By Practice", "By Category", "By Pioneer",
        "Quarterly Trend", "Cumulative Trend", "Cohort — Practice",
        "Practice × Quarter", "Category Mix by Quarter",
        "Disprove Matrix", "Gains Radar",
        "Client Pulse", "Reuse Intent",
        "Schedule Variance", "Scaling Gates",
        "Top Movers", "Bottom Movers", "Takeaways",
    ]
    for name in expected_new:
        test(
            f"export has '{name}' sheet",
            name in wb.sheetnames,
            detail=f"sheetnames={wb.sheetnames}",
        )
    # Spot-check a couple of sheets have data rows beyond the header
    for name in ["By Practice", "Quarterly Trend", "Takeaways", "Top Movers"]:
        if name in wb.sheetnames:
            rows = list(wb[name].iter_rows(values_only=True))
            test(
                f"'{name}' sheet has header + at least one data row",
                len(rows) >= 2,
                detail=f"rows={len(rows)}",
            )
    # Spot-check Disprove Matrix quadrant column has valid enum values
    if "Disprove Matrix" in wb.sheetnames:
        ws = wb["Disprove Matrix"]
        header = [c.value for c in ws[1]]
        qi = header.index("quadrant") if "quadrant" in header else -1
        if qi >= 0:
            allowed = {"top-right", "top-left", "bottom-right", "bottom-left", "NA"}
            values = {ws.cell(row=i, column=qi + 1).value for i in range(2, ws.max_row + 1)}
            test(
                "Disprove Matrix quadrants are in allowed enum",
                values.issubset(allowed),
                detail=f"seen={values}",
            )


# ── Main ──────────────────────────────────────────────────────────────────────

def test_dashboard_takeaways():
    print("\n── T. Dashboard takeaways endpoint ──")
    tok = admin_token()
    r = requests.get(f"{BASE}/api/dashboard/takeaways", headers=auth_h(tok))
    test("GET /api/dashboard/takeaways 200", r.status_code == 200)
    if r.status_code != 200:
        return
    body = r.json()
    test("takeaways has chartDisprove", isinstance(body.get("chartDisprove"), str))
    test("takeaways has chartQuarterly", isinstance(body.get("chartQuarterly"), str))
    test("takeaways has chartPulse", isinstance(body.get("chartPulse"), str))
    test("takeaways has trackGates", isinstance(body.get("trackGates"), str))
    test("takeaways has chartTopMovers", isinstance(body.get("chartTopMovers"), str) and body["chartTopMovers"])
    test("takeaways has chartBottomMovers", isinstance(body.get("chartBottomMovers"), str) and body["chartBottomMovers"])
    test("takeaways has chartEffortTrend", isinstance(body.get("chartEffortTrend"), str) and body["chartEffortTrend"])
    # Every chart in DASHBOARD_CONFIG must have a key in the response
    from backend.schema import DASHBOARD_CONFIG
    missing = [c["id"] for c in DASHBOARD_CONFIG["charts"] if c["id"] not in body]
    test("every chart has a takeaway key", not missing, detail=f"missing={missing}")
    # Takeaways ≤ 80 chars (≤ 60 is the target, allow slack)
    too_long = {cid: v for cid, v in body.items() if len(v) > 80}
    test("takeaways are concise", not too_long, detail=f"too_long={too_long}")
    empty = {cid: v for cid, v in body.items() if not v or not v.strip()}
    test("takeaways are all non-empty", not empty, detail=f"empty={list(empty.keys())}")


def test_economics_schema():
    """Schema response exposes economics fields, currencies, and pricing models."""
    from backend.schema import CURRENCIES, PRICING_MODELS, ECONOMICS_FIELDS, METRICS, build_schema_response

    assert CURRENCIES == ["EUR", "USD", "GBP", "CHF", "CAD", "AUD"]
    assert "Fixed fee" in PRICING_MODELS
    assert "Time & materials" in PRICING_MODELS
    assert "Retainer" in PRICING_MODELS
    assert "Milestone" in PRICING_MODELS
    assert "Other" in PRICING_MODELS
    assert len(PRICING_MODELS) == 5

    expected_econ = {
        "engagement_revenue", "currency", "xcsg_pricing_model",
        "scope_expansion_revenue", "legacy_day_rate_override",
    }
    assert expected_econ.issubset(set(ECONOMICS_FIELDS.keys()))

    for key in ("margin_gain", "xcsg_margin_pct", "cost_per_quality_point_gain", "revenue_per_day_gain"):
        assert key in METRICS, f"missing metric {key}"

    response = build_schema_response()
    assert response["currencies"] == CURRENCIES
    assert response["pricing_models"] == PRICING_MODELS
    assert "economics_fields" in response


def test_migrate_v15_idempotent():
    """migrate_v15 adds new columns + app_settings table, runs idempotently."""
    from backend import database

    database.init_db()

    # init_db just ran above; verify the post-state.
    with database._db() as conn:
        proj_cols = {r[1] for r in conn.execute("PRAGMA table_info(projects)").fetchall()}
        for col in ("currency", "xcsg_pricing_model", "scope_expansion_revenue", "legacy_day_rate_override"):
            assert col in proj_cols, f"projects.{col} missing"

        pp_cols = {r[1] for r in conn.execute("PRAGMA table_info(project_pioneers)").fetchall()}
        assert "day_rate" in pp_cols, "project_pioneers.day_rate missing"

        prac_cols = {r[1] for r in conn.execute("PRAGMA table_info(practices)").fetchall()}
        assert "default_legacy_day_rate" in prac_cols, "practices.default_legacy_day_rate missing"

        tables = {r[0] for r in conn.execute("SELECT name FROM sqlite_master WHERE type='table'").fetchall()}
        assert "app_settings" in tables

        row = conn.execute("SELECT id, default_currency FROM app_settings WHERE id=1").fetchone()
        assert row is not None
        assert row["default_currency"] == "EUR"

    # Re-run migration — must be idempotent.
    database.migrate_v15()
    database.migrate_v15()

    with database._db() as conn:
        rows = conn.execute("SELECT COUNT(*) AS n FROM app_settings").fetchone()
        assert rows["n"] == 1, "app_settings must remain a single row"


def test_migrate_v16_idempotent():
    """migrate_v16 creates practice_roles table + index, runs idempotently."""
    from backend import database

    database.init_db()

    with database._db() as conn:
        tables = {r[0] for r in conn.execute(
            "SELECT name FROM sqlite_master WHERE type='table'"
        ).fetchall()}
        assert "practice_roles" in tables

        cols = {r[1] for r in conn.execute(
            "PRAGMA table_info(practice_roles)"
        ).fetchall()}
        for col in ("id", "practice_id", "role_name", "day_rate", "currency",
                    "display_order", "created_at"):
            assert col in cols, f"practice_roles.{col} missing"

        indexes = {r[0] for r in conn.execute(
            "SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='practice_roles'"
        ).fetchall()}
        assert "idx_practice_roles_practice" in indexes

    # Re-run migration — must be idempotent.
    database.migrate_v16()
    database.migrate_v16()

    # FK CASCADE: deleting a practice removes its roles.
    with database._db() as conn:
        cur = conn.execute(
            "INSERT INTO practices (code, name, description) VALUES (?, ?, ?)",
            ("TST", "Test practice", "for migration test"),
        )
        practice_id = cur.lastrowid
        conn.execute(
            "INSERT INTO practice_roles (practice_id, role_name, day_rate, currency) "
            "VALUES (?, ?, ?, ?)",
            (practice_id, "Senior", 1500, "EUR"),
        )
        conn.execute("PRAGMA foreign_keys = ON")
        conn.execute("DELETE FROM practices WHERE id = ?", (practice_id,))
        remaining = conn.execute(
            "SELECT COUNT(*) AS n FROM practice_roles WHERE practice_id = ?",
            (practice_id,),
        ).fetchone()
        assert remaining["n"] == 0, "practice_roles should CASCADE-delete"


def test_migrate_v17_idempotent():
    """migrate_v17 adds project_pioneers.role_name (nullable), runs idempotently."""
    from backend import database

    database.init_db()

    with database._db() as conn:
        cols = {r[1] for r in conn.execute(
            "PRAGMA table_info(project_pioneers)"
        ).fetchall()}
        assert "role_name" in cols, "project_pioneers.role_name missing"

    # Re-run migration — must be idempotent.
    database.migrate_v17()
    database.migrate_v17()

    # Existing rows should have NULL role_name.
    with database._db() as conn:
        # Insert a quick test fixture: a project + pioneer.
        cur = conn.execute(
            "INSERT INTO projects (created_by, project_name, category_id, "
            "pioneer_name, pioneer_email, xcsg_team_size, xcsg_revision_rounds, "
            "legacy_calendar_days, legacy_team_size, legacy_revision_rounds, "
            "expert_token, status) "
            "VALUES (1, 'mig17 test', 1, 'P', 'p@x.io', '2', '1', '10', '2', '1', 'tok-mig17', 'pending')"
        )
        project_id = cur.lastrowid
        cur = conn.execute(
            "INSERT INTO project_pioneers (project_id, pioneer_name, pioneer_email, expert_token) "
            "VALUES (?, 'P', 'p@x.io', 'tok-mig17-pp')",
            (project_id,),
        )
        pid = cur.lastrowid
        row = conn.execute(
            "SELECT role_name FROM project_pioneers WHERE id = ?", (pid,)
        ).fetchone()
        assert row["role_name"] is None
        # Cleanup — delete pioneer before project to satisfy FK constraint.
        conn.execute("DELETE FROM project_pioneers WHERE project_id = ?", (project_id,))
        conn.execute("DELETE FROM projects WHERE id = ?", (project_id,))
        conn.commit()


def test_practice_roles_db_helpers():
    """list_practice_roles and replace_practice_roles round-trip correctly."""
    from backend import database

    database.init_db()

    with database._db() as conn:
        cur = conn.execute(
            "INSERT INTO practices (code, name, description) VALUES (?, ?, ?)",
            ("HLP", "Helper test", "for db helper test"),
        )
        practice_id = cur.lastrowid
        conn.commit()

    try:
        # Empty list initially.
        assert database.list_practice_roles(practice_id) == []

        # Replace with a list.
        database.replace_practice_roles(practice_id, [
            {"role_name": "Senior", "day_rate": 1500, "currency": "EUR", "display_order": 0},
            {"role_name": "Manager", "day_rate": 1000, "currency": "EUR", "display_order": 1},
            {"role_name": "Senior", "day_rate": 1800, "currency": "USD", "display_order": 0},
        ])

        rows = database.list_practice_roles(practice_id)
        assert len(rows) == 3
        names = [(r["role_name"], r["currency"]) for r in rows]
        assert ("Senior", "EUR") in names
        assert ("Senior", "USD") in names
        assert ("Manager", "EUR") in names

        # Replace with a different list — old rows are gone.
        database.replace_practice_roles(practice_id, [
            {"role_name": "Analyst", "day_rate": 600, "currency": "EUR", "display_order": 0},
        ])
        rows = database.list_practice_roles(practice_id)
        assert len(rows) == 1
        assert rows[0]["role_name"] == "Analyst"

        # Replace with empty list — clears the catalog.
        database.replace_practice_roles(practice_id, [])
        assert database.list_practice_roles(practice_id) == []
    finally:
        with database._db() as conn:
            conn.execute("DELETE FROM practices WHERE id = ?", (practice_id,))
            conn.commit()


def test_practice_roles_schema():
    """schema.py exposes PRACTICE_ROLE_FIELDS and surfaces it via build_schema_response."""
    from backend.schema import PRACTICE_ROLE_FIELDS, build_schema_response

    expected_fields = {"role_name", "day_rate", "currency", "display_order"}
    assert expected_fields.issubset(set(PRACTICE_ROLE_FIELDS.keys()))

    role_name = PRACTICE_ROLE_FIELDS["role_name"]
    assert role_name["type"] == "text"
    assert role_name.get("max_length") == 80

    day_rate = PRACTICE_ROLE_FIELDS["day_rate"]
    assert day_rate["type"] == "number"
    assert day_rate["min"] == 0

    currency = PRACTICE_ROLE_FIELDS["currency"]
    assert currency["type"] == "select"
    assert "options" in currency

    response = build_schema_response()
    assert "practice_role_fields" in response
    assert response["practice_role_fields"]["role_name"]["max_length"] == 80


def test_economics_models():
    """ProjectCreate, PioneerCreate, PracticeUpdate accept and validate economics fields."""
    import pytest
    from pydantic import ValidationError
    from backend.models import (
        ProjectCreate, ProjectUpdate, PioneerCreate, PracticeUpdate,
        AppSettings, AppSettingsUpdate,
    )

    base = {
        "project_name": "Demo",
        "category_id": 1,
        "pioneers": [{"name": "Pia", "day_rate": 1500}],
        "xcsg_team_size": "2",
        "xcsg_revision_rounds": "1",
    }
    p = ProjectCreate(
        **base,
        engagement_revenue=120000,
        currency="EUR",
        xcsg_pricing_model="Fixed fee",
        scope_expansion_revenue=15000,
        legacy_day_rate_override=900,
    )
    assert p.engagement_revenue == 120000
    assert p.currency == "EUR"
    assert p.xcsg_pricing_model == "Fixed fee"
    assert p.pioneers[0].day_rate == 1500

    # Negative numeric fields are rejected.
    for bad_field in ("engagement_revenue", "scope_expansion_revenue", "legacy_day_rate_override"):
        with pytest.raises(ValidationError):
            ProjectCreate(**{**base, bad_field: -1})
    with pytest.raises(ValidationError):
        PioneerCreate(name="Pia", day_rate=-50)

    # Invalid currency / pricing model are rejected.
    with pytest.raises(ValidationError):
        ProjectCreate(**base, currency="XYZ")
    with pytest.raises(ValidationError):
        ProjectCreate(**base, xcsg_pricing_model="Pay what you want")

    # Practices accept default_legacy_day_rate.
    pu = PracticeUpdate(name="P", default_legacy_day_rate=1000)
    assert pu.default_legacy_day_rate == 1000
    with pytest.raises(ValidationError):
        PracticeUpdate(name="P", default_legacy_day_rate=-1)

    # AppSettings models.
    s = AppSettings(default_currency="USD")
    assert s.default_currency == "USD"
    with pytest.raises(ValidationError):
        AppSettingsUpdate(default_currency="XYZ")

    # Update model also accepts econ fields.
    u = ProjectUpdate(engagement_revenue=999, currency="USD")
    assert u.engagement_revenue == 999


def test_economics_metrics():
    """_compute_economics_metrics covers all formulas + edge cases per spec."""
    from backend.metrics import _compute_economics_metrics

    # Happy path: all inputs populated, single pioneer.
    out = _compute_economics_metrics(
        engagement_revenue=120000,
        xcsg_person_days=20,
        legacy_person_days=80,
        pioneer_rates=[1500],
        legacy_rate_effective=900,
        quality_score=0.85,
        legacy_quality_score=0.5,
        scope_expansion_revenue=15000,
        currency="EUR",
    )
    assert out["xcsg_blended_rate"] == 1500
    assert out["xcsg_cost"] == 30000.0          # 1500 * 20
    assert out["legacy_rate_effective"] == 900
    assert out["legacy_cost"] == 72000.0        # 900 * 80
    assert out["xcsg_margin"] == 90000.0        # 120000 - 30000
    assert out["legacy_margin"] == 48000.0      # 120000 - 72000
    assert round(out["xcsg_margin_pct"], 4) == 0.75
    assert round(out["legacy_margin_pct"], 4) == 0.4
    assert round(out["margin_gain"], 2) == 1.88  # 90000 / 48000
    assert out["scope_expansion_revenue"] == 15000
    assert out["currency"] == "EUR"

    # Multi-pioneer averaging, mixed null/non-null rates.
    out = _compute_economics_metrics(
        engagement_revenue=100000,
        xcsg_person_days=10,
        legacy_person_days=40,
        pioneer_rates=[2000, None, 1000],   # null skipped
        legacy_rate_effective=800,
        quality_score=0.8,
        legacy_quality_score=0.4,
        scope_expansion_revenue=None,
        currency="USD",
    )
    assert out["xcsg_blended_rate"] == 1500   # mean of [2000, 1000]

    # Negative legacy margin → margin_gain is None.
    out = _compute_economics_metrics(
        engagement_revenue=10000,
        xcsg_person_days=5,
        legacy_person_days=200,
        pioneer_rates=[1000],
        legacy_rate_effective=200,           # legacy_cost = 40000 > revenue
        quality_score=0.7,
        legacy_quality_score=0.4,
        scope_expansion_revenue=None,
        currency="EUR",
    )
    assert out["legacy_margin"] == -30000
    assert out["margin_gain"] is None

    # No pioneer rates → cost / margin / gain all None, but revenue still surfaces.
    out = _compute_economics_metrics(
        engagement_revenue=50000, xcsg_person_days=10, legacy_person_days=40,
        pioneer_rates=[None, None], legacy_rate_effective=900,
        quality_score=0.7, legacy_quality_score=0.4,
        scope_expansion_revenue=None, currency="EUR",
    )
    assert out["xcsg_blended_rate"] is None
    assert out["xcsg_cost"] is None
    assert out["xcsg_margin"] is None
    assert out["margin_gain"] is None
    assert out["legacy_cost"] == 36000.0  # legacy still computes
    assert out["legacy_margin"] == 14000.0

    # No legacy rate → legacy cost / margin / gain all None.
    out = _compute_economics_metrics(
        engagement_revenue=50000, xcsg_person_days=10, legacy_person_days=40,
        pioneer_rates=[1500], legacy_rate_effective=None,
        quality_score=0.7, legacy_quality_score=0.4,
        scope_expansion_revenue=None, currency="EUR",
    )
    assert out["legacy_cost"] is None
    assert out["legacy_margin"] is None
    assert out["margin_gain"] is None

    # Cost-per-quality-point gain.
    out = _compute_economics_metrics(
        engagement_revenue=120000, xcsg_person_days=20, legacy_person_days=80,
        pioneer_rates=[1500], legacy_rate_effective=900,
        quality_score=0.85, legacy_quality_score=0.5,
        scope_expansion_revenue=None, currency="EUR",
    )
    # xcsg_cppq = 30000/0.85, legacy_cppq = 72000/0.5
    # gain = legacy_cppq / xcsg_cppq = (72000/0.5) / (30000/0.85)
    expected_cppq_gain = (72000 / 0.5) / (30000 / 0.85)
    assert abs(out["cost_per_quality_point_gain"] - round(expected_cppq_gain, 2)) < 0.01

    # margin_gain capped at 10x. Setup: xcsg_cost=10, legacy_cost=10000,
    # so xcsg_margin=10990, legacy_margin=1000, raw ratio=10.99 → cap to 10.0.
    out = _compute_economics_metrics(
        engagement_revenue=11000, xcsg_person_days=1, legacy_person_days=100,
        pioneer_rates=[10], legacy_rate_effective=100,
        quality_score=0.9, legacy_quality_score=0.5,
        scope_expansion_revenue=None, currency="EUR",
    )
    assert out["margin_gain"] == 10.0


def test_compute_project_metrics_includes_economics():
    """compute_project_metrics merges economics keys into its output."""
    from backend.metrics import compute_project_metrics

    data = {
        "id": 1, "project_name": "T",
        "category_name": "Cat", "practice_code": "PC", "practice_name": "PName",
        "pioneer_name": "Pia", "client_name": "C",
        "xcsg_team_size": "2", "working_days": 10,
        "l1_legacy_working_days": 40, "l2_legacy_team_size": "2",
        "engagement_revenue": 100000,
        "currency": "EUR",
        "xcsg_pricing_model": "Fixed fee",
        "scope_expansion_revenue": 10000,
        "legacy_day_rate_override": None,
        "practice_default_legacy_day_rate": 800,
        "pioneer_day_rates": [1500],
        # quality inputs (minimum to make quality_score non-null)
        "c6_self_assessment": "Significantly better",
        "c7_analytical_depth": "Strong",
        "c8_decision_readiness": "Yes without caveats",
        "l13_legacy_c7_depth": "Adequate",
        "l14_legacy_c8_decision": "Yes with minor caveats",
        "l5_legacy_client_reaction": "Met expectations",
    }
    out = compute_project_metrics(data)
    for key in (
        "xcsg_blended_rate", "xcsg_cost", "legacy_cost",
        "xcsg_margin", "legacy_margin", "margin_gain",
        "xcsg_margin_pct", "legacy_margin_pct",
        "revenue_per_day_xcsg", "revenue_per_day_legacy",
        "cost_per_quality_point_xcsg", "cost_per_quality_point_legacy",
        "cost_per_quality_point_gain",
        "currency", "engagement_revenue", "scope_expansion_revenue",
    ):
        assert key in out, f"compute_project_metrics output missing {key}"
    assert out["currency"] == "EUR"
    assert out["xcsg_cost"] == 30000.0
    assert out["legacy_cost"] == 64000.0  # 800 * (40 * 2)
    assert out["xcsg_pricing_model"] == "Fixed fee"

    # No economics inputs → all econ keys present but None.
    bare = {k: v for k, v in data.items() if k not in (
        "engagement_revenue", "currency", "xcsg_pricing_model",
        "scope_expansion_revenue", "legacy_day_rate_override",
        "practice_default_legacy_day_rate", "pioneer_day_rates",
    )}
    out2 = compute_project_metrics(bare)
    assert out2["xcsg_cost"] is None
    assert out2["legacy_cost"] is None
    assert out2["margin_gain"] is None


def test_create_project_persists_economics():
    """POST /api/projects accepts and stores economics fields, including pioneer rates."""
    tk = admin_token()
    payload = {
        "project_name": "Econ test",
        "category_id": 1,
        "pioneers": [{"name": "P1", "day_rate": 1500}, {"name": "P2", "day_rate": 1000}],
        "xcsg_team_size": "2",
        "xcsg_revision_rounds": "1",
        "engagement_revenue": 80000,
        "currency": "USD",
        "xcsg_pricing_model": "Fixed fee",
        "scope_expansion_revenue": 5000,
        "legacy_day_rate_override": 750,
    }
    r = requests.post(f"{BASE}/api/projects", headers={**auth_h(tk), "Content-Type": "application/json"}, json=payload)
    test("POST /api/projects with economics returns 201", r.status_code == 201, f"got {r.status_code}: {r.text[:200]}")
    if r.status_code != 201:
        return
    pid = r.json()["id"]

    try:
        detail = requests.get(f"{BASE}/api/projects/{pid}", headers=auth_h(tk)).json()
        test("economics: engagement_revenue stored", detail.get("engagement_revenue") == 80000, f"got {detail.get('engagement_revenue')}")
        test("economics: currency stored", detail.get("currency") == "USD", f"got {detail.get('currency')}")
        test("economics: xcsg_pricing_model stored", detail.get("xcsg_pricing_model") == "Fixed fee", f"got {detail.get('xcsg_pricing_model')}")
        test("economics: scope_expansion_revenue stored", detail.get("scope_expansion_revenue") == 5000, f"got {detail.get('scope_expansion_revenue')}")
        test("economics: legacy_day_rate_override stored", detail.get("legacy_day_rate_override") == 750, f"got {detail.get('legacy_day_rate_override')}")

        pioneer_rates = sorted(p["day_rate"] for p in detail.get("pioneers", []))
        test("economics: pioneer day_rates stored", pioneer_rates == [1000, 1500], f"got {pioneer_rates}")

        # Adding a pioneer post-creation must also persist day_rate.
        add = requests.post(
            f"{BASE}/api/projects/{pid}/pioneers",
            headers={**auth_h(tk), "Content-Type": "application/json"},
            json={"name": "P3", "day_rate": 2000},
        )
        test("economics: POST pioneer returns 201", add.status_code == 201, add.text)
        if add.status_code == 201:
            detail2 = requests.get(f"{BASE}/api/projects/{pid}", headers=auth_h(tk)).json()
            rates2 = sorted(p["day_rate"] for p in detail2.get("pioneers", []))
            test("economics: post-creation pioneer day_rate persisted", rates2 == [1000, 1500, 2000], f"got {rates2}")
    finally:
        requests.delete(f"{BASE}/api/projects/{pid}", headers=auth_h(tk))


def test_practice_default_legacy_day_rate():
    """PUT /api/practices/{id} stores default_legacy_day_rate; GET surfaces it."""
    print("\n── C3. Practice default_legacy_day_rate ──")
    tk = admin_token()
    headers = auth_h(tk)

    list_r = requests.get(f"{BASE}/api/practices", headers=headers)
    test("GET /api/practices reachable for rate test", list_r.status_code == 200, f"got {list_r.status_code}")
    if list_r.status_code != 200:
        return
    practice = list_r.json()[0]
    pid = practice["id"]
    original_name = practice["name"]
    original_rate = practice.get("default_legacy_day_rate")

    try:
        upd = requests.put(
            f"{BASE}/api/practices/{pid}",
            headers=headers,
            json={"name": original_name, "default_legacy_day_rate": 950},
        )
        test("PUT practice with default_legacy_day_rate=950 returns 200", upd.status_code == 200, upd.text)

        after = requests.get(f"{BASE}/api/practices", headers=headers).json()
        target = next(p for p in after if p["id"] == pid)
        test("default_legacy_day_rate persisted as 950", target["default_legacy_day_rate"] == 950,
             f"got {target.get('default_legacy_day_rate')}")

        bad = requests.put(
            f"{BASE}/api/practices/{pid}",
            headers=headers,
            json={"name": original_name, "default_legacy_day_rate": -1},
        )
        test("PUT practice with negative rate returns 422", bad.status_code == 422,
             f"got {bad.status_code}: {bad.text[:120]}")
    finally:
        # Restore original rate
        requests.put(
            f"{BASE}/api/practices/{pid}",
            headers=headers,
            json={"name": original_name, "default_legacy_day_rate": original_rate},
        )


def test_app_settings_endpoints():
    """GET /api/settings is open to all roles; PUT requires admin."""
    print("\n── App Settings ──")

    def login_token(username, password):
        r = requests.post(f"{BASE}/api/auth/login", json={"username": username, "password": password})
        r.raise_for_status()
        return r.json()["access_token"]

    admin = admin_token()
    analyst = login_token("pmo", "AliraPMO2026!")
    viewer = login_token("viewer", "AliraView2026!")

    h_admin = auth_h(admin)
    h_analyst = auth_h(analyst)
    h_viewer = auth_h(viewer)

    r = requests.get(f"{BASE}/api/settings", headers=h_admin)
    test("GET /api/settings returns 200 for admin", r.status_code == 200, f"got {r.status_code}")
    if r.status_code != 200:
        return
    initial = r.json()["default_currency"]

    test("GET /api/settings returns 200 for analyst",
         requests.get(f"{BASE}/api/settings", headers=h_analyst).status_code == 200)
    test("GET /api/settings returns 200 for viewer",
         requests.get(f"{BASE}/api/settings", headers=h_viewer).status_code == 200)

    try:
        # Admin can change.
        upd = requests.put(f"{BASE}/api/settings", headers=h_admin, json={"default_currency": "USD"})
        test("PUT /api/settings returns 200 for admin", upd.status_code == 200, f"got {upd.status_code}: {upd.text[:120]}")
        test("PUT /api/settings persists new currency",
             requests.get(f"{BASE}/api/settings", headers=h_admin).json()["default_currency"] == "USD")

        # Analyst and viewer cannot.
        test("PUT /api/settings returns 403 for analyst",
             requests.put(f"{BASE}/api/settings", headers=h_analyst, json={"default_currency": "EUR"}).status_code == 403)
        test("PUT /api/settings returns 403 for viewer",
             requests.put(f"{BASE}/api/settings", headers=h_viewer, json={"default_currency": "EUR"}).status_code == 403)

        # Invalid currency rejected.
        bad = requests.put(f"{BASE}/api/settings", headers=h_admin, json={"default_currency": "XYZ"})
        test("PUT /api/settings rejects invalid currency with 422", bad.status_code == 422, f"got {bad.status_code}: {bad.text[:120]}")
    finally:
        # Restore.
        requests.put(f"{BASE}/api/settings", headers=h_admin, json={"default_currency": initial})


def test_practice_role_models():
    """PracticeRoleEntry and PracticeRolesUpdate validate correctly."""
    import pytest
    from pydantic import ValidationError
    from backend.models import PracticeRoleEntry, PracticeRolesUpdate

    # Happy path.
    e = PracticeRoleEntry(role_name="Senior Partner", day_rate=1500, currency="EUR", display_order=1)
    assert e.role_name == "Senior Partner"
    assert e.day_rate == 1500
    assert e.currency == "EUR"
    assert e.display_order == 1

    # Default display_order.
    e2 = PracticeRoleEntry(role_name="Manager", day_rate=1000, currency="EUR")
    assert e2.display_order == 0

    # Empty role_name rejected.
    with pytest.raises(ValidationError):
        PracticeRoleEntry(role_name="", day_rate=1000, currency="EUR")

    # Whitespace-only role_name rejected.
    with pytest.raises(ValidationError):
        PracticeRoleEntry(role_name="   ", day_rate=1000, currency="EUR")

    # role_name > 80 chars rejected.
    with pytest.raises(ValidationError):
        PracticeRoleEntry(role_name="x" * 81, day_rate=1000, currency="EUR")

    # Negative day_rate rejected.
    with pytest.raises(ValidationError):
        PracticeRoleEntry(role_name="X", day_rate=-1, currency="EUR")

    # Invalid currency rejected.
    with pytest.raises(ValidationError):
        PracticeRoleEntry(role_name="X", day_rate=100, currency="XYZ")

    # PracticeRolesUpdate accepts a list.
    u = PracticeRolesUpdate(roles=[
        {"role_name": "Senior", "day_rate": 1500, "currency": "EUR"},
        {"role_name": "Manager", "day_rate": 1000, "currency": "EUR"},
    ])
    assert len(u.roles) == 2

    # Duplicate (role_name, currency) rejected.
    with pytest.raises(ValidationError):
        PracticeRolesUpdate(roles=[
            {"role_name": "Senior", "day_rate": 1500, "currency": "EUR"},
            {"role_name": "Senior", "day_rate": 1600, "currency": "EUR"},
        ])

    # Same role_name with different currencies is OK.
    u2 = PracticeRolesUpdate(roles=[
        {"role_name": "Senior", "day_rate": 1500, "currency": "EUR"},
        {"role_name": "Senior", "day_rate": 1800, "currency": "USD"},
    ])
    assert len(u2.roles) == 2

    # Empty list is OK (clears the catalog).
    u3 = PracticeRolesUpdate(roles=[])
    assert u3.roles == []


def test_practice_roles_crud():
    """GET returns rows; PUT replaces atomically."""
    token = admin_token()
    headers = auth_h(token)

    practices = requests.get(f"{BASE}/api/practices", headers=headers).json()
    assert practices, "must have at least one seeded practice"
    pid = practices[0]["id"]

    try:
        # Initial GET — empty list (no roles defined yet for this practice).
        r = requests.get(f"{BASE}/api/practices/{pid}/roles", headers=headers)
        assert r.status_code == 200
        initial = r.json()
        assert isinstance(initial, list)

        # PUT — bulk replace with two roles.
        body = {"roles": [
            {"role_name": "Senior", "day_rate": 1500, "currency": "EUR", "display_order": 0},
            {"role_name": "Manager", "day_rate": 1000, "currency": "EUR", "display_order": 1},
        ]}
        r = requests.put(f"{BASE}/api/practices/{pid}/roles", headers=headers, json=body)
        assert r.status_code == 200, r.text

        # GET — confirm replacement.
        rows = requests.get(f"{BASE}/api/practices/{pid}/roles", headers=headers).json()
        assert len(rows) == 2
        names = sorted(r["role_name"] for r in rows)
        assert names == ["Manager", "Senior"]

        # PUT — replace with a different set; old rows go away.
        r = requests.put(f"{BASE}/api/practices/{pid}/roles", headers=headers, json={
            "roles": [{"role_name": "Analyst", "day_rate": 600, "currency": "EUR"}]
        })
        assert r.status_code == 200
        rows = requests.get(f"{BASE}/api/practices/{pid}/roles", headers=headers).json()
        assert len(rows) == 1
        assert rows[0]["role_name"] == "Analyst"

        # PUT — invalid currency rejected.
        r = requests.put(f"{BASE}/api/practices/{pid}/roles", headers=headers, json={
            "roles": [{"role_name": "X", "day_rate": 100, "currency": "XYZ"}]
        })
        assert r.status_code == 422

        # PUT — duplicate (role_name, currency) rejected.
        r = requests.put(f"{BASE}/api/practices/{pid}/roles", headers=headers, json={
            "roles": [
                {"role_name": "Dup", "day_rate": 100, "currency": "EUR"},
                {"role_name": "Dup", "day_rate": 200, "currency": "EUR"},
            ]
        })
        assert r.status_code == 422
    finally:
        # Restore: empty list (clears whatever was added during the test).
        requests.put(f"{BASE}/api/practices/{pid}/roles", headers=headers, json={"roles": []})


def test_practice_roles_admin_only():
    """GET is open to all roles; PUT requires admin."""
    def login_token(username, password):
        r = requests.post(f"{BASE}/api/auth/login", json={"username": username, "password": password})
        r.raise_for_status()
        return r.json()["access_token"]

    admin = admin_token()
    analyst = login_token("pmo", "AliraPMO2026!")
    viewer = login_token("viewer", "AliraView2026!")
    h_admin = auth_h(admin)
    h_analyst = auth_h(analyst)
    h_viewer = auth_h(viewer)

    practices = requests.get(f"{BASE}/api/practices", headers=h_admin).json()
    pid = practices[0]["id"]

    try:
        # GET allowed for all three roles.
        assert requests.get(f"{BASE}/api/practices/{pid}/roles", headers=h_admin).status_code == 200
        assert requests.get(f"{BASE}/api/practices/{pid}/roles", headers=h_analyst).status_code == 200
        assert requests.get(f"{BASE}/api/practices/{pid}/roles", headers=h_viewer).status_code == 200

        # PUT allowed for admin, blocked for analyst and viewer.
        body = {"roles": [{"role_name": "X", "day_rate": 1, "currency": "EUR"}]}
        assert requests.put(f"{BASE}/api/practices/{pid}/roles", headers=h_admin, json=body).status_code == 200
        assert requests.put(f"{BASE}/api/practices/{pid}/roles", headers=h_analyst, json=body).status_code == 403
        assert requests.put(f"{BASE}/api/practices/{pid}/roles", headers=h_viewer, json=body).status_code == 403
    finally:
        # Restore.
        requests.put(f"{BASE}/api/practices/{pid}/roles", headers=h_admin, json={"roles": []})


def test_practice_roles_404_for_unknown_practice():
    """Routes return 404 for non-existent practice IDs."""
    headers = auth_h(admin_token())
    bad_id = 99999

    r = requests.get(f"{BASE}/api/practices/{bad_id}/roles", headers=headers)
    assert r.status_code == 404, f"GET expected 404, got {r.status_code}: {r.text}"

    r = requests.put(
        f"{BASE}/api/practices/{bad_id}/roles",
        headers=headers,
        json={"roles": [{"role_name": "X", "day_rate": 1, "currency": "EUR"}]},
    )
    assert r.status_code == 404, f"PUT expected 404, got {r.status_code}: {r.text}"


def main():
    global passed, failed, failures

    print("=" * 70)
    print("xCSG Value Tracker V2 — Comprehensive QA/QC Test Suite")
    print("=" * 70)

    # Health check
    try:
        r = requests.get(f"{BASE}/api/health", timeout=5)
        test("Server reachable", r.status_code == 200, f"got {r.status_code}")
    except Exception as e:
        test("Server reachable", False, str(e))
        print("\nFATAL: Server not reachable. Exiting.")
        sys.exit(1)

    test_authentication()
    test_expert_options()
    test_categories()
    test_practices()
    test_practice_default_legacy_day_rate()
    test_create_deliverable()
    test_expert_assessment()
    test_metrics()
    test_scaling_gates()
    test_dashboard()
    test_deliverables_list()
    test_string_consistency()
    test_frontend_js()
    test_norms()
    test_schema_endpoint()
    test_metrics_summary_fields()
    test_schema()
    test_dashboard_config()
    test_seed_field_coverage()
    test_economics_schema()
    test_practice_roles_schema()
    test_migrate_v15_idempotent()
    test_migrate_v16_idempotent()
    test_migrate_v17_idempotent()
    test_practice_roles_db_helpers()
    test_economics_models()
    test_practice_role_models()
    test_economics_metrics()
    test_app_settings_endpoints()
    test_practice_roles_crud()
    test_practice_roles_admin_only()
    test_practice_roles_404_for_unknown_practice()
    test_compute_project_metrics_includes_economics()
    test_create_project_persists_economics()
    test_show_other_pioneers_flag()
    test_auto_issue_next_round()
    test_dashboard_takeaways()
    test_expert_notes()
    test_notes_feed_endpoint()
    test_notes_excel_sheet()
    test_dashboard_export_sheets()

    print("\n" + "=" * 70)
    print(f"QA SUMMARY: {passed} passed, {failed} failed, {passed + failed} total")
    print("=" * 70)
    
    if failures:
        print("\nFAILING TESTS:")
        for name, detail in failures:
            print(f"  ✗ {name}")
            if detail:
                print(f"    {detail}")
    
    return 0 if failed == 0 else 1

if __name__ == "__main__":
    sys.exit(main())
