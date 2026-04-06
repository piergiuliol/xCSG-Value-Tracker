"""
metrics.py — All metric computations for xCSG Value Tracker v2

IMPORTANT: String values in scoring maps MUST match exactly the HTML option values
and the JavaScript chart logic. Em dashes (—) are used in D3 moat test options.
"""
from typing import List, Optional

# ── Midpoint mappings ──────────────────────────────────────────────────────────

DAYS_MIDPOINTS = {
    "1": 1.0,
    "2-3": 2.5,
    "4-5": 4.5,
    "6-10": 8.0,
    "11-20": 15.0,
    "20+": 25.0,
}

TEAM_MIDPOINTS = {
    "1": 1.0,
    "2": 2.0,
    "3": 3.0,
    "4+": 5.0,
}

REVISION_NUMBERS = {
    "0": 0.0,
    "1": 1.0,
    "2": 2.0,
    "3+": 3.5,
}


# ── Tier 2 scoring maps ───────────────────────────────────────────────────────
# NOTE: D3 uses em dashes (—) — must match HTML <option> values exactly.

B1_SCORES = {
    "From AI draft": 1.0,
    "Mixed (AI structure, manual content)": 0.5,
    "From blank page": 0.0,
}

B2_SCORES = {
    "1-3": 0.25,
    "4-7": 0.5,
    "8-12": 0.75,
    "13+": 1.0,
}

B3_SCORES = {
    ">75% AI": 1.0,
    "50-75%": 0.75,
    "25-50%": 0.5,
    "<25%": 0.25,
}

B4_SCORES = {
    "Hypothesis-first (tested a specific thesis)": 1.0,
    "Hybrid (hypothesis emerged during work)": 0.5,
    "Discovery-first (open-ended research)": 0.0,
}

C1_SCORES = {
    "Deep specialist in this TA/methodology": 1.0,
    "Adjacent expertise": 0.5,
    "Generalist": 0.0,
}

C2_SCORES = {
    "Expert authored (with AI assist)": 1.0,
    "Expert co-authored (shared with team)": 0.5,
    "Expert reviewed only": 0.0,
}

C3_SCORES = {
    ">75% judgment": 1.0,
    "50-75%": 0.75,
    "25-50%": 0.5,
    "<25%": 0.25,
}

D1_SCORES = {
    "Yes": 1.0,
    "No": 0.0,
}

D2_SCORES = {
    "Yes, directly reused and extended": 1.0,
    "Yes, provided useful starting context": 0.5,
    "No, built from scratch": 0.0,
}

# D3 moat test — uses em dashes (—)
D3_SCORES = {
    "No \u2014 proprietary inputs decisive": 1.0,
    "Partially \u2014 they would miss key insights": 0.5,
    "Yes \u2014 all inputs publicly available": 0.0,
}


# ── Per-project computation ──────────────────────────────────────────────────

def compute_person_days(calendar_days: str, team_size: str) -> float:
    days = DAYS_MIDPOINTS.get(calendar_days, 8.0)
    team = TEAM_MIDPOINTS.get(team_size, 2.0)
    return round(days * team, 2)


def compute_effort_ratio(legacy_pd: float, xcsg_pd: float) -> float:
    if xcsg_pd == 0:
        return 0.0
    return round(legacy_pd / xcsg_pd, 2)


def compute_quality_ratio(legacy_revisions: str, xcsg_revisions: str) -> float:
    legacy_r = REVISION_NUMBERS.get(legacy_revisions, 1.0)
    xcsg_r = REVISION_NUMBERS.get(xcsg_revisions, 0.5)
    # If xCSG revisions = 0, use 0.5 as denominator
    denominator = xcsg_r if xcsg_r > 0 else 0.5
    return round(legacy_r / denominator, 2)


def compute_value_multiplier(effort_ratio: float, quality_ratio: float) -> float:
    return round(effort_ratio * quality_ratio, 2)


def compute_machine_first_v2(data: dict) -> Optional[float]:
    """Machine-first score v2: composite from completion sliders (0-100)."""
    si = data.get("xcsg_senior_involvement")
    ai = data.get("xcsg_ai_usage")
    ri = data.get("xcsg_revision_intensity")
    se = data.get("xcsg_scope_expansion_score")
    if any(v is None for v in (si, ai, ri, se)):
        return None
    score = (
        (si / 7) * 25 +
        (ai / 7) * 25 +
        ((8 - ri) / 7) * 25 +
        ((8 - se) / 7) * 25
    )
    return round(score, 1)


def compute_machine_first_score(er: dict) -> Optional[float]:
    """Machine-First = average of B1, B2, B3, B4 (4 components per Palladio fix)."""
    scores = []
    for field, score_map in [
        ("b1_starting_point", B1_SCORES),
        ("b2_research_sources", B2_SCORES),
        ("b3_assembly_ratio", B3_SCORES),
        ("b4_hypothesis_first", B4_SCORES),
    ]:
        val = er.get(field)
        if val and val in score_map:
            scores.append(score_map[val])
    if not scores:
        return None
    return round(sum(scores) / len(scores), 4)


def compute_senior_led_score(er: dict) -> Optional[float]:
    """Senior-Led = average of C1, C2, C3."""
    scores = []
    for field, score_map in [
        ("c1_specialization", C1_SCORES),
        ("c2_directness", C2_SCORES),
        ("c3_judgment_pct", C3_SCORES),
    ]:
        val = er.get(field)
        if val and val in score_map:
            scores.append(score_map[val])
    if not scores:
        return None
    return round(sum(scores) / len(scores), 4)


def compute_proprietary_knowledge_score(er: dict) -> Optional[float]:
    """Proprietary Knowledge = average of D1, D2, D3."""
    scores = []
    for field, score_map in [
        ("d1_proprietary_data", D1_SCORES),
        ("d2_knowledge_reuse", D2_SCORES),
        ("d3_moat_test", D3_SCORES),
    ]:
        val = er.get(field)
        if val and val in score_map:
            scores.append(score_map[val])
    if not scores:
        return None
    return round(sum(scores) / len(scores), 4)


def compute_project_metrics(d: dict) -> dict:
    """Compute all metrics for a single complete project."""
    xcsg_pd = compute_person_days(d["xcsg_calendar_days"], d["xcsg_team_size"])
    legacy_pd = compute_person_days(
        d.get("legacy_calendar_days", "6-10"),
        d.get("legacy_team_size", "2"),
    )
    effort_ratio = compute_effort_ratio(legacy_pd, xcsg_pd)
    quality_ratio = compute_quality_ratio(
        d.get("legacy_revision_rounds", "1"),
        d["xcsg_revision_rounds"],
    )
    value_multiplier = compute_value_multiplier(effort_ratio, quality_ratio)

    machine_first = compute_machine_first_score(d)
    senior_led = compute_senior_led_score(d)
    proprietary = compute_proprietary_knowledge_score(d)

    return {
        "id": d["id"],
        "project_name": d.get("project_name", ""),
        "category_name": d.get("category_name", ""),
        "pioneer_name": d["pioneer_name"],
        "client_name": d.get("client_name"),
        "xcsg_person_days": xcsg_pd,
        "legacy_person_days": legacy_pd,
        "effort_ratio": effort_ratio,
        "xcsg_revisions": REVISION_NUMBERS.get(d["xcsg_revision_rounds"], 0.0),
        "legacy_revisions": REVISION_NUMBERS.get(d.get("legacy_revision_rounds", "1"), 1.0),
        "quality_ratio": quality_ratio,
        "value_multiplier": value_multiplier,
        "machine_first_score": machine_first,
        "senior_led_score": senior_led,
        "proprietary_knowledge_score": proprietary,
        "legacy_overridden": bool(d.get("legacy_overridden", 0)),
        "created_at": d.get("created_at", ""),
    }


def determine_checkpoint(complete_count: int) -> int:
    """Determine current checkpoint based on complete project count."""
    if complete_count >= 20:
        return 4
    elif complete_count >= 8:
        return 3
    elif complete_count >= 3:
        return 2
    else:
        return 1


def projects_to_next_checkpoint(complete_count: int) -> int:
    """How many more complete projects to reach next checkpoint."""
    if complete_count >= 20:
        return 0  # Already at CP4
    elif complete_count >= 8:
        return 20 - complete_count  # To CP4
    elif complete_count >= 3:
        return 8 - complete_count   # To CP3
    else:
        return 3 - complete_count   # To CP2


def compute_summary(complete_projects: list, total_projects: list) -> dict:
    """Compute aggregate summary metrics."""
    total = len(total_projects)
    complete = len(complete_projects)
    pending = total - complete

    if not complete_projects:
        return {
            "total_projects": total,
            "complete_projects": complete,
            "pending_projects": pending,
            "average_value_multiplier": 0.0,
            "average_effort_ratio": 0.0,
            "average_quality_ratio": 0.0,
            "flywheel_health": 0.0,
            "machine_first_avg": 0.0,
            "senior_led_avg": 0.0,
            "proprietary_knowledge_avg": 0.0,
            "checkpoint": determine_checkpoint(complete),
            "projects_to_next_checkpoint": projects_to_next_checkpoint(complete),
        }

    metrics_list = [compute_project_metrics(d) for d in complete_projects]

    avg_value_mult = round(sum(m["value_multiplier"] for m in metrics_list) / len(metrics_list), 2)
    avg_effort = round(sum(m["effort_ratio"] for m in metrics_list) / len(metrics_list), 2)
    avg_quality = round(sum(m["quality_ratio"] for m in metrics_list) / len(metrics_list), 2)

    mf_scores = [m["machine_first_score"] for m in metrics_list if m["machine_first_score"] is not None]
    sl_scores = [m["senior_led_score"] for m in metrics_list if m["senior_led_score"] is not None]
    pk_scores = [m["proprietary_knowledge_score"] for m in metrics_list if m["proprietary_knowledge_score"] is not None]

    mf_avg = round(sum(mf_scores) / len(mf_scores), 4) if mf_scores else 0.0
    sl_avg = round(sum(sl_scores) / len(sl_scores), 4) if sl_scores else 0.0
    pk_avg = round(sum(pk_scores) / len(pk_scores), 4) if pk_scores else 0.0

    # Flywheel health = average of the three leg scores (only those computed)
    leg_avgs = [v for v in [mf_avg, sl_avg, pk_avg] if v > 0]
    flywheel = round(sum(leg_avgs) / len(leg_avgs), 4) if leg_avgs else 0.0

    return {
        "total_projects": total,
        "complete_projects": complete,
        "pending_projects": pending,
        "average_value_multiplier": avg_value_mult,
        "average_effort_ratio": avg_effort,
        "average_quality_ratio": avg_quality,
        "flywheel_health": flywheel,
        "machine_first_avg": mf_avg,
        "senior_led_avg": sl_avg,
        "proprietary_knowledge_avg": pk_avg,
        "checkpoint": determine_checkpoint(complete),
        "projects_to_next_checkpoint": projects_to_next_checkpoint(complete),
        # v2 metrics
        "ai_adoption_rate": _compute_ai_adoption_rate(complete_projects),
        "senior_leverage": _compute_senior_leverage(complete_projects),
        "scope_predictability": _compute_scope_predictability(complete_projects),
    }


def _compute_ai_adoption_rate(complete_projects: list) -> float:
    """% of projects with ai_usage >= 3."""
    v2_projects = [p for p in complete_projects if p.get("xcsg_ai_usage") is not None]
    if not v2_projects:
        return 0.0
    adopted = sum(1 for p in v2_projects if p["xcsg_ai_usage"] >= 3)
    return round(adopted / len(v2_projects) * 100, 1)


def _compute_senior_leverage(complete_projects: list) -> Optional[float]:
    """avg senior_involvement xCSG vs legacy."""
    projects = [p for p in complete_projects
                if p.get("xcsg_senior_involvement") is not None and p.get("legacy_senior_involvement") is not None]
    if not projects:
        return None
    avg_xcsg = sum(p["xcsg_senior_involvement"] for p in projects) / len(projects)
    avg_legacy = sum(p["legacy_senior_involvement"] for p in projects) / len(projects)
    if avg_legacy == 0:
        return None
    return round(avg_xcsg / avg_legacy, 2)


def _compute_scope_predictability(complete_projects: list) -> Optional[float]:
    """avg scope_expansion xCSG vs legacy (lower is better, so ratio > 1 means xCSG is more predictable)."""
    projects = [p for p in complete_projects
                if p.get("xcsg_scope_expansion_score") is not None and p.get("legacy_scope_expansion") is not None]
    if not projects:
        return None
    avg_xcsg = sum(p["xcsg_scope_expansion_score"] for p in projects) / len(projects)
    avg_legacy = sum(p["legacy_scope_expansion"] for p in projects) / len(projects)
    if avg_legacy == 0:
        return None
    return round(avg_xcsg / avg_legacy, 2)


def compute_trend_data(complete_projects: list) -> list:
    """Per-project metrics in chronological order for trend charts."""
    return [compute_project_metrics(d) for d in complete_projects]


def compute_scaling_gates(complete_projects: list, all_projects: list) -> list:
    """Evaluate all 6 scaling gates."""
    # Gate 1: Multi-engagement — ≥2 categories
    categories = set(d.get("category_name", "") for d in complete_projects)
    gate1_pass = len(categories) >= 2
    gate1_detail = f"{len(categories)} categor{'ies' if len(categories) != 1 else 'y'} completed"

    # Gate 2: Time reduction — avg effort ratio > 1.3
    if complete_projects:
        metrics_list = [compute_project_metrics(d) for d in complete_projects]
        avg_effort = sum(m["effort_ratio"] for m in metrics_list) / len(metrics_list)
        gate2_pass = avg_effort > 1.3
        gate2_detail = f"Avg effort ratio {avg_effort:.1f}\u00d7 (threshold: >1.3\u00d7)"
    else:
        gate2_pass = False
        gate2_detail = "No complete projects yet"

    # Gate 3: Client-invisible quality — ≥1 project with 0 revision rounds
    zero_revision = sum(1 for d in complete_projects if d["xcsg_revision_rounds"] == "0")
    gate3_pass = zero_revision >= 1
    gate3_detail = f"{zero_revision} project{'s' if zero_revision != 1 else ''} with 0 revisions"

    # Gate 4: Transferability — placeholder (requires non-pioneer data)
    gate4_pass = False
    gate4_detail = "Requires non-pioneer data \u2014 deferred to CP3"

    # Gate 5: Flywheel validation — placeholder
    gate5_pass = False
    gate5_detail = "Requires registry-integrated AI delivery data"

    # Gate 6: Compounding — D2 reuse rate ≥40%
    d2_values = [d.get("d2_knowledge_reuse", "") for d in complete_projects]
    reused = sum(1 for v in d2_values if v in (
        "Yes, directly reused and extended",
        "Yes, provided useful starting context",
    ))
    reuse_rate = (reused / len(d2_values) * 100) if d2_values else 0
    gate6_pass = reuse_rate >= 40
    gate6_detail = f"D2 reuse rate: {reuse_rate:.0f}% (threshold: \u226540%)"

    gates = [
        {"id": 1, "name": "Multi-engagement", "description": "\u22652 categories completed", "status": "pass" if gate1_pass else "pending", "detail": gate1_detail},
        {"id": 2, "name": "Time Reduction", "description": "Average effort ratio > 1.3\u00d7", "status": "pass" if gate2_pass else "pending", "detail": gate2_detail},
        {"id": 3, "name": "Client-Invisible Quality", "description": "\u22651 project with 0 revision rounds", "status": "pass" if gate3_pass else "pending", "detail": gate3_detail},
        {"id": 4, "name": "Transferability", "description": "Requires non-pioneer data", "status": "pass" if gate4_pass else "pending", "detail": gate4_detail},
        {"id": 5, "name": "Flywheel Validation", "description": "Requires registry-integrated AI delivery", "status": "pass" if gate5_pass else "pending", "detail": gate5_detail},
        {"id": 6, "name": "Compounding", "description": "D2 reuse rate \u226540%", "status": "pass" if gate6_pass else "pending", "detail": gate6_detail},
    ]
    return gates
