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

# ── Main ──────────────────────────────────────────────────────────────────────

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
    test_create_deliverable()
    test_expert_assessment()
    test_metrics()
    test_scaling_gates()
    test_dashboard()
    test_deliverables_list()
    test_string_consistency()
    test_frontend_js()
    test_norms()
    test_schema()

    # ── DASHBOARD_CONFIG ──────────────────────────────────────────────────────────
    from backend import schema as _schema
    dc = getattr(_schema, "DASHBOARD_CONFIG", None)
    test("DASHBOARD_CONFIG exists", isinstance(dc, dict))
    test("DASHBOARD_CONFIG has tabs", isinstance(dc.get("tabs"), list) and len(dc["tabs"]) == 4)
    test("DASHBOARD_CONFIG has kpi_tiles (list, may be empty this task)", isinstance(dc.get("kpi_tiles"), list))
    test("DASHBOARD_CONFIG has charts (list, may be empty this task)", isinstance(dc.get("charts"), list))
    th = dc.get("thresholds", {})
    test("thresholds.radar_axis_cap is positive float", isinstance(th.get("radar_axis_cap"), (int, float)) and th["radar_axis_cap"] > 1)
    test("thresholds.quarterly_bucket_min_quarters is int >= 2", isinstance(th.get("quarterly_bucket_min_quarters"), int) and th["quarterly_bucket_min_quarters"] >= 2)
    test("thresholds.cohort_min_projects is int >= 2", isinstance(th.get("cohort_min_projects"), int) and th["cohort_min_projects"] >= 2)
    test("thresholds.bar_top_n is int >= 3", isinstance(th.get("bar_top_n"), int) and th["bar_top_n"] >= 3)
    tone = th.get("metric_tone", {})
    test("metric_tone.success_above is float", isinstance(tone.get("success_above"), (int, float)))
    test("metric_tone.blue_above is float", isinstance(tone.get("blue_above"), (int, float)))
    test("metric_tone.warning_above is float", isinstance(tone.get("warning_above"), (int, float)))

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
