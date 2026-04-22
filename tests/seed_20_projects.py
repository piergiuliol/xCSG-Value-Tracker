"""Seed 20 real-world projects + expert surveys against a running dev server.

Usage: ensure server is up on 8765, then:
    .venv/bin/python tests/seed_20_projects.py
"""
import json
import sys
from datetime import datetime, timedelta

import requests

BASE = "http://127.0.0.1:8765"


def _expected_for(profile, actual_iso):
    """Derive date_expected_delivered from actual delivery date + profile.

    Business interpretation:
    - strong  -> project delivered EARLY (actual before expected): expected = actual + 2 days
    - balanced -> project delivered ON TIME:                       expected = actual
    - weak    -> project delivered LATE (actual after expected):   expected = actual - 5 days
    """
    d = datetime.fromisoformat(actual_iso)
    if profile == "strong":
        return (d + timedelta(days=2)).date().isoformat()
    if profile == "balanced":
        return d.date().isoformat()
    return (d - timedelta(days=5)).date().isoformat()


PROJECTS = [
    # (name, cat, practice, team, xcsg_working_days, revs, dateStart, dateEnd, revDepth, scope, pulse, stage, profile)
    ("510(k) — CardioFlow",        "510(k)",                              "RAM", "3",  7, "2", "2026-01-15","2026-02-05","Moderate rework","No","Exceeded expectations","Post-engagement (follow-on)","strong"),
    ("PMA — NeuroMonitor",         "PMA",                                 "RAM", "5", 22, "3", "2025-10-01","2025-11-28","Major rework","Yes expanded scope","Met expectations","Active engagement","balanced"),
    ("De Novo — DiaSense",         "De Novo",                             "RAM", "2",  6, "1", "2026-02-01","2026-02-20","Cosmetic only","No","Exceeded expectations","Active engagement","strong"),
    ("EU MDR Gap — OrthoPro",      "Gap Analysis",                        "RAM", "2",  4, "0", "2026-02-15","2026-02-26","No revisions needed","No","Met expectations","Active engagement","balanced"),
    ("Early MA — OncoNext",        "Early Market Access",                 "MAP", "4", 10, "1", "2026-01-10","2026-02-02","Cosmetic only","No","Exceeded expectations","Active engagement","strong"),
    ("HEOR Model — RareBio",       "Health Economics (e.g., HEOR Modelling like CE, BIM)", "MAP", "3", 18, "2", "2025-12-01","2026-01-15","Moderate rework","No","Met expectations","Post-engagement (follow-on)","balanced"),
    ("Payer Value — AlzMed",       "Payer Value Story Payer Objection Handler", "MAP", "3", 12, "2", "2026-01-20","2026-02-18","Moderate rework","Yes expanded scope","Met expectations","Active engagement","balanced"),
    ("Brand Strategy — Neuro",     "Brand Strategy",                      "NPS", "3", 24, "3", "2025-11-15","2026-01-20","Major rework","Yes expanded scope","Below expectations","Post-engagement (follow-on)","weak"),
    ("NPP — IO Launch",            "New Product Planning/Strategy",       "NPS", "4", 16, "2", "2026-01-05","2026-02-20","Moderate rework","No","Met expectations","Active engagement","balanced"),
    ("CDD — CNS Tx",               "Commercial Due Diligence",            "MCD", "5",  8, "1", "2026-02-01","2026-02-20","Cosmetic only","No","Exceeded expectations","Post-engagement (follow-on)","strong"),
    ("OA — Rare GI",               "Opportunity Assessment (Market and/ or Product) (e.g., market landscape analysis, market research, opportunity assessment)", "MCD", "3", 12, "2", "2025-12-10","2026-01-15","Moderate rework","No","Met expectations","Post-engagement (follow-on)","balanced"),
    ("Portfolio — MidPharma",      "Portfolio Management/ TA & Indication Prioritization", "MCD", "4",  9, "1", "2026-01-22","2026-02-15","Cosmetic only","No","Exceeded expectations","Active engagement","strong"),
    ("Retro RWE — DiabetES",       "Retrospective study",                 "RWE", "2", 15, "2", "2026-01-08","2026-02-18","Moderate rework","No","Met expectations","Active engagement","balanced"),
    ("RWE Data — LongCOVID",       "Data analysis",                       "RWE", "3", 10, "1", "2026-02-01","2026-02-25","Cosmetic only","No","Exceeded expectations","Active engagement","strong"),
    ("MAA — CardiaX",              "MAA/NDA",                             "RAP", "5", 20, "2", "2025-11-01","2026-01-10","Moderate rework","No","Met expectations","Post-engagement (follow-on)","balanced"),
    ("IND — GeneRise",             "IND and IND Related",                 "RAP", "3", 30, "4", "2025-09-01","2026-01-10","Major rework","Yes expanded scope","Below expectations","Post-engagement (follow-on)","weak"),
    ("Reg Strat — RareEye (RAP)",  "Regulatory Strategy",                 "RAP", "2",  5, "0", "2026-02-10","2026-02-22","No revisions needed","No","Exceeded expectations","Active engagement","strong"),
    ("Patient Journey — RDX",      "Patient Journey Definition",          "PEN", "2",  7, "1", "2026-01-30","2026-02-15","Cosmetic only","No","Met expectations","Active engagement","balanced"),
    ("Sell-Side — BioAurora",      "Sell-Side M&A",                       "TAD", "6", 12, "1", "2025-12-15","2026-01-20","Cosmetic only","No","Not yet received","Active engagement","strong"),
    ("Full Trial — OncoRx Ph2",    "Full Service Trial - Clinical Operations", "CLI", "6", 25, "2", "2025-10-20","2026-01-05","Moderate rework","No","Not yet received","Active engagement","balanced"),
]


# ── Profile payloads (module-level so tests can assert EXPERT_FIELDS coverage) ──
# Each profile dict must contain a valid option string for EVERY key in
# backend.schema.EXPERT_FIELDS. Otherwise metrics compute None for that
# dimension and dashboard tiles/charts show blanks.
#   STRONG   -> highest-scoring option from SCORES (or reasonable high values)
#   BALANCED -> middle-of-the-road options
#   WEAK     -> lowest-scoring options

STRONG = {
    "b1_starting_point": "From AI draft",
    "b2_research_sources": "Broad systematic synthesis (10+)",
    "b3_assembly_ratio": ">75% AI",
    "b4_hypothesis_first": "Hypothesis-first",
    "b5_ai_survival": ">75%",
    "b6_data_analysis_split": "<25% on data",
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
    "l1_legacy_working_days": 30,
    "l2_legacy_team_size": "4+",
    "l3_legacy_revision_depth": "Major rework",
    "l4_legacy_scope_expansion": "Yes",
    "l5_legacy_client_reaction": "Met expectations",
    "l6_legacy_b2_sources": "A few targeted sources (2-4)",
    "l7_legacy_c1_specialization": "Generalist",
    "l8_legacy_c2_directness": "Expert reviewed only",
    "l9_legacy_c3_judgment": "25-50%",
    "l10_legacy_d1_proprietary": "No",
    "l11_legacy_d2_reuse": "No built from scratch",
    "l12_legacy_d3_moat": "Yes — all inputs publicly available",
    "l13_legacy_c7_depth": "Adequate",
    "l14_legacy_c8_decision": "Needs significant additional work",
    "l15_legacy_e1_decision": "Too early to tell",
    "l16_legacy_b6_data": "50-75%",
}

BALANCED = {
    "b1_starting_point": "Mixed",
    "b2_research_sources": "Multiple sources across domains (5-10)",
    "b3_assembly_ratio": "50-75%",
    "b4_hypothesis_first": "Hybrid",
    "b5_ai_survival": "50-75%",
    "b6_data_analysis_split": "25-50%",
    "c1_specialization": "Deep specialist",
    "c2_directness": "Expert co-authored",
    "c3_judgment_pct": "50-75%",
    "c6_self_assessment": "Somewhat better",
    "c7_analytical_depth": "Strong",
    "c8_decision_readiness": "Yes with minor caveats",
    "d1_proprietary_data": "Yes",
    "d2_knowledge_reuse": "Yes provided useful starting context",
    "d3_moat_test": "Partially — they would miss key insights",
    "e1_client_decision": "Yes — referenced in internal discussions",
    "f1_feasibility": "Feasible but at 2x+ the cost and time",
    "f2_productization": "Yes with moderate customization",
    "g1_reuse_intent": "Yes with reservations",
    "l1_legacy_working_days": 20,
    "l2_legacy_team_size": "3",
    "l3_legacy_revision_depth": "Moderate rework",
    "l4_legacy_scope_expansion": "No",
    "l5_legacy_client_reaction": "Met expectations",
    "l6_legacy_b2_sources": "A few targeted sources (2-4)",
    "l7_legacy_c1_specialization": "Adjacent expertise",
    "l8_legacy_c2_directness": "Expert reviewed only",
    "l9_legacy_c3_judgment": "25-50%",
    "l10_legacy_d1_proprietary": "No",
    "l11_legacy_d2_reuse": "Yes provided useful starting context",
    "l12_legacy_d3_moat": "Yes — all inputs publicly available",
    "l13_legacy_c7_depth": "Adequate",
    "l14_legacy_c8_decision": "Yes with minor caveats",
    "l15_legacy_e1_decision": "Yes — referenced in internal discussions",
    "l16_legacy_b6_data": "50-75%",
}

WEAK = {
    "b1_starting_point": "From blank page",
    "b2_research_sources": "A few targeted sources (2-4)",
    "b3_assembly_ratio": "25-50%",
    "b4_hypothesis_first": "Discovery-first",
    "b5_ai_survival": "25-50%",
    "b6_data_analysis_split": "50-75%",
    "c1_specialization": "Adjacent expertise",
    "c2_directness": "Expert co-authored",
    "c3_judgment_pct": "25-50%",
    "c6_self_assessment": "Comparable",
    "c7_analytical_depth": "Adequate",
    "c8_decision_readiness": "Needs significant additional work",
    "d1_proprietary_data": "No",
    "d2_knowledge_reuse": "No built from scratch",
    "d3_moat_test": "Yes — all inputs publicly available",
    "e1_client_decision": "Too early to tell",
    "f1_feasibility": "Feasible at similar cost",
    "f2_productization": "No fully bespoke",
    "g1_reuse_intent": "Yes with reservations",
    "l1_legacy_working_days": 12,
    "l2_legacy_team_size": "2",
    "l3_legacy_revision_depth": "Cosmetic only",
    "l4_legacy_scope_expansion": "No",
    "l5_legacy_client_reaction": "Exceeded expectations",
    "l6_legacy_b2_sources": "Multiple sources across domains (5-10)",
    "l7_legacy_c1_specialization": "Deep specialist",
    "l8_legacy_c2_directness": "Expert authored",
    "l9_legacy_c3_judgment": "50-75%",
    "l10_legacy_d1_proprietary": "Yes",
    "l11_legacy_d2_reuse": "Yes directly reused and extended",
    "l12_legacy_d3_moat": "Partially — they would miss key insights",
    "l13_legacy_c7_depth": "Strong",
    "l14_legacy_c8_decision": "Yes with minor caveats",
    "l15_legacy_e1_decision": "Yes — informed a specific decision",
    "l16_legacy_b6_data": "25-50%",
}


def survey_body(profile):
    if profile == "strong":
        return dict(STRONG)
    if profile == "balanced":
        return dict(BALANCED)
    return dict(WEAK)


def main():
    auth = requests.post(f"{BASE}/api/auth/login", json={"username":"admin","password":"AliraAdmin2026!"})
    auth.raise_for_status()
    TOK = auth.json()["access_token"]
    H = {"Authorization": f"Bearer {TOK}", "Content-Type": "application/json"}

    cats = {c["name"]: c for c in requests.get(f"{BASE}/api/categories", headers=H).json()}
    prs = {p["code"]: p for p in requests.get(f"{BASE}/api/practices", headers=H).json()}

    created = []
    for (name, cat_name, prac_code, team, days, revs, ds, dd, rd, sc, pulse, stage, profile) in PROJECTS:
        body = {
            "project_name": name,
            "category_id": cats[cat_name]["id"],
            "practice_id": prs[prac_code]["id"],
            "date_started": ds, "date_delivered": dd,
            "date_expected_delivered": _expected_for(profile, dd),
            "working_days": days,
            "xcsg_team_size": team, "xcsg_revision_rounds": revs,
            "revision_depth": rd, "xcsg_scope_expansion": sc,
            "client_pulse": pulse, "engagement_stage": stage,
            "pioneers": [
                {"name": f"{prac_code} Lead {name[:3]}", "email": f"{prac_code.lower()}.lead.{len(created)}@alira.health"},
                {"name": f"{prac_code} Co {name[:3]}",   "email": f"{prac_code.lower()}.co.{len(created)}@alira.health"},
            ],
        }
        r = requests.post(f"{BASE}/api/projects", headers=H, data=json.dumps(body))
        if r.status_code != 201:
            print(f"[FAIL] {name}: {r.status_code} {r.text[:160]}")
            continue
        created.append((r.json()["id"], name, profile))
        print(f"  [{prac_code}] {name}")

    print(f"\nCreated {len(created)} projects\n")

    n = 0
    for pid, name, profile in created:
        proj = requests.get(f"{BASE}/api/projects/{pid}", headers=H).json()
        tok = proj["pioneers"][0]["rounds"][0]["token"]
        r = requests.post(f"{BASE}/api/expert/{tok}", data=json.dumps(survey_body(profile)), headers={"Content-Type":"application/json"})
        if r.status_code == 201:
            n += 1
        else:
            print(f"  [survey FAIL] {name}: {r.status_code} {r.text[:160]}")
    print(f"Submitted {n} surveys")


if __name__ == "__main__":
    main()
