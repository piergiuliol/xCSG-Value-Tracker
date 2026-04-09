"""metrics.py — All metric computations for xCSG Value Tracker V2."""
from __future__ import annotations
from datetime import date
from typing import Optional, List, Dict, Any

# ── Midpoint Mappings ─────────────────────────────────────────────────────────

DAYS_MIDPOINTS = {"1": 1.0, "2-3": 2.5, "4-5": 4.5, "6-10": 8.0, "11-20": 15.0, "20+": 25.0}
TEAM_MIDPOINTS = {"1": 1.0, "2": 2.0, "3": 3.0, "4+": 5.0}
REVISION_NUMBERS = {"0": 0.0, "1": 1.0, "2": 2.0, "3+": 3.5}

# ── Flywheel Scoring Maps ────────────────────────────────────────────────────

B1_SCORES = {"From AI draft": 1.0, "Mixed": 0.5, "From blank page": 0.0}
B2_SCORES = {"1-3": 0.25, "4-7": 0.5, "8-12": 0.75, "13+": 1.0}
B3_SCORES = {">75% AI": 1.0, "50-75%": 0.75, "25-50%": 0.5, "<25%": 0.25}
B4_SCORES = {"Hypothesis-first": 1.0, "Hybrid": 0.5, "Discovery-first": 0.0}
B5_SCORES = {">75%": 1.0, "50-75%": 0.75, "25-50%": 0.5, "<25%": 0.25}

C1_SCORES = {"Deep specialist": 1.0, "Adjacent expertise": 0.5, "Generalist": 0.0}
C2_SCORES = {"Expert authored": 1.0, "Expert co-authored": 0.5, "Expert reviewed only": 0.0}
C3_SCORES = {">75% judgment": 1.0, "50-75%": 0.75, "25-50%": 0.5, "<25%": 0.25}

D1_SCORES = {"Yes": 1.0, "No": 0.0}
D2_SCORES = {"Yes directly reused and extended": 1.0, "Yes provided useful starting context": 0.5, "No built from scratch": 0.0}
D3_SCORES = {"No — proprietary inputs decisive": 1.0, "Partially — they would miss key insights": 0.5, "Yes — all inputs publicly available": 0.0}

F1_SCORES = {"Not feasible": 1.0, "Feasible but 2x+ cost": 0.75, "Feasible similar cost": 0.5, "Legacy more effective": 0.25}
F2_SCORES = {"Yes largely as-is": 1.0, "Yes with moderate customization": 0.5, "No fully bespoke": 0.0}


def round2(v: float) -> float:
    return round(v, 2)


def compute_xcsg_calendar_days(date_started: str, date_delivered: str) -> int:
    ds = date.fromisoformat(date_started)
    de = date.fromisoformat(date_delivered)
    return max((de - ds).days, 1)


def _safe_get(mapping: dict, key: Optional[str]) -> Optional[float]:
    if key is None:
        return None
    v = mapping.get(key)
    return float(v) if v is not None else None


def _avg(values: list) -> Optional[float]:
    clean = [v for v in values if v is not None]
    if not clean:
        return None
    return round2(sum(clean) / len(clean))


def compute_effort_ratio(date_started: str, date_delivered: str, xcsg_team_size: str,
                          legacy_calendar_days: Optional[str], legacy_team_size: Optional[str]) -> Optional[float]:
    xcsg_days = compute_xcsg_calendar_days(date_started, date_delivered)
    xcsg_team = TEAM_MIDPOINTS.get(xcsg_team_size)
    legacy_days = DAYS_MIDPOINTS.get(legacy_calendar_days) if legacy_calendar_days else None
    legacy_team = TEAM_MIDPOINTS.get(legacy_team_size) if legacy_team_size else None
    if not xcsg_team or not legacy_days or not legacy_team:
        return None
    xcsg_pd = xcsg_days * xcsg_team
    legacy_pd = legacy_days * legacy_team
    if xcsg_pd == 0:
        return None
    return round2(legacy_pd / xcsg_pd)


def compute_quality_ratio(xcsg_revisions: Optional[str], legacy_revisions: Optional[str]) -> Optional[float]:
    xcsg_r = REVISION_NUMBERS.get(xcsg_revisions) if xcsg_revisions else None
    legacy_r = REVISION_NUMBERS.get(legacy_revisions) if legacy_revisions else None
    if legacy_r is None:
        return None
    denom = max(xcsg_r, 0.5) if xcsg_r is not None else None
    if denom is None:
        return None
    return round2(legacy_r / denom)


def compute_machine_first_score(data: dict) -> Optional[float]:
    scores = [
        _safe_get(B1_SCORES, data.get("b1_starting_point")),
        _safe_get(B2_SCORES, data.get("b2_research_sources")),
        _safe_get(B3_SCORES, data.get("b3_assembly_ratio")),
        _safe_get(B4_SCORES, data.get("b4_hypothesis_first")),
    ]
    return _avg(scores)


def compute_ai_survival_rate(data: dict) -> Optional[float]:
    val = data.get("b5_ai_survival")
    if val == "Did not use AI draft":
        return None  # N/A
    return _safe_get(B5_SCORES, val)


def compute_senior_led_score(data: dict) -> Optional[float]:
    scores = [
        _safe_get(C1_SCORES, data.get("c1_specialization")),
        _safe_get(C2_SCORES, data.get("c2_directness")),
        _safe_get(C3_SCORES, data.get("c3_judgment_pct")),
    ]
    return _avg(scores)


def compute_proprietary_knowledge_score(data: dict) -> Optional[float]:
    scores = [
        _safe_get(D1_SCORES, data.get("d1_proprietary_data")),
        _safe_get(D2_SCORES, data.get("d2_knowledge_reuse")),
        _safe_get(D3_SCORES, data.get("d3_moat_test")),
    ]
    return _avg(scores)


def compute_reuse_intent_rate(deliverables: list) -> Optional[float]:
    """G1 'Yes without hesitation' rate among completed deliverables."""
    completed = [d for d in deliverables if d.get("g1_reuse_intent")]
    if not completed:
        return None
    yes_count = sum(1 for d in completed if d.get("g1_reuse_intent") == "Yes without hesitation")
    return round2(yes_count / len(completed) * 100)


def compute_d2_reuse_rate(deliverables: list) -> float:
    """D2 reuse rate: directly reused + useful context / total with D2 data."""
    with_d2 = [d for d in deliverables if d.get("d2_knowledge_reuse")]
    if not with_d2:
        return 0.0
    reused = sum(1 for d in with_d2 if d.get("d2_knowledge_reuse") in ("Yes directly reused and extended", "Yes provided useful starting context"))
    return round2(reused / len(with_d2) * 100)


def get_checkpoint(complete_count: int) -> int:
    if complete_count >= 20:
        return 4
    elif complete_count >= 8:
        return 3
    elif complete_count >= 3:
        return 2
    elif complete_count >= 1:
        return 1
    return 0


def compute_scaling_gates(deliverables: list, avg_effort_ratio: Optional[float]) -> List[Dict[str, Any]]:
    completed = [d for d in deliverables if d.get("expert_completed")]
    types_seen = set(d.get("deliverable_type") for d in completed if d.get("deliverable_type"))
    
    # Gate 1: Multi-engagement
    g1_status = "pass" if len(types_seen) >= 2 else ("pending" if len(completed) > 0 else "pending")
    
    # Gate 2: Time reduction
    g2_status = "pass" if avg_effort_ratio and avg_effort_ratio > 1.3 else "pending"
    if avg_effort_ratio is not None and avg_effort_ratio <= 1.3:
        g2_status = "fail"
    
    # Gate 3: Client-invisible quality
    zero_rev = [d for d in completed if d.get("xcsg_revision_rounds") == "0"]
    g3_pass = False
    for d in zero_rev:
        pulse = d.get("client_pulse")
        if not pulse or pulse == "Not yet received" or pulse != "Below expectations":
            g3_pass = True
            break
    g3_status = "pass" if g3_pass else ("pending" if not zero_rev else "fail")
    
    # Gate 4: Transferability (placeholder)
    g4_status = "pending"
    
    # Gate 5: Flywheel validation (placeholder)
    g5_status = "pending"
    
    # Gate 6: Compounding
    d2_rate = compute_d2_reuse_rate(completed)
    g6_status = "pass" if d2_rate >= 40 else ("pending" if len(completed) < 1 else "fail" if d2_rate < 40 and d2_rate > 0 else "pending")
    
    # Gate 7: Adoption confidence
    ri_rate = compute_reuse_intent_rate(completed)
    g7_status = "pass" if ri_rate is not None and ri_rate >= 70 else ("pending" if ri_rate is None else "fail")
    
    gates = [
        {"id": 1, "name": "Multi-engagement", "description": "≥2 deliverable types completed", "status": g1_status, "detail": f"{len(types_seen)} types completed"},
        {"id": 2, "name": "Time reduction", "description": "Average effort ratio > 1.3", "status": g2_status, "detail": f"Avg effort ratio: {avg_effort_ratio:.2f}x" if avg_effort_ratio else "No data yet"},
        {"id": 3, "name": "Client-invisible quality", "description": "≥1 deliverable with 0 revisions AND no negative client feedback", "status": g3_status, "detail": f"{len(zero_rev)} zero-revision deliverables"},
        {"id": 4, "name": "Transferability", "description": "Placeholder (requires non-pioneer data)", "status": g4_status, "detail": "Not yet measurable"},
        {"id": 5, "name": "Flywheel validation", "description": "Placeholder (requires registry-integrated AI delivery)", "status": g5_status, "detail": "Not yet measurable"},
        {"id": 6, "name": "Compounding", "description": "D2 reuse rate ≥40%", "status": g6_status, "detail": f"D2 reuse rate: {d2_rate:.0f}%"},
        {"id": 7, "name": "Adoption confidence", "description": "G1 'Yes without hesitation' ≥70%", "status": g7_status, "detail": f"Reuse intent rate: {ri_rate:.0f}%" if ri_rate is not None else "No G1 data yet"},
    ]
    return gates
