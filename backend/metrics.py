"""
metrics.py — All metric computations for xCSG Value Tracker
Realigned to Phase 1 spec (April 2026).

Scoring: all categorical fields use a 1–5 ordinal scale.
The option value maps to its position (1 = lowest, 5 = highest).
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


# ── Phase 1 scoring maps (1–5 ordinal) ───────────────────────────────────────
# Each option maps to 1–5 based on position in the progression.
# These MUST match the HTML <option> values exactly.

# B — Machine-First Operations
B1_SCORES = {
    "Raw request": 1,
    "Light brief": 2,
    "Structured brief": 3,
    "Hypothesis": 4,
    "Full hypothesis deck": 5,
}

B2_SCORES = {
    "General web": 1,
    "Industry databases": 2,
    "Proprietary database": 3,
    "Internal knowledge base": 4,
    "Synthesized firm knowledge": 5,
}

B3_SCORES = {
    ">80% manual": 1,
    "60-80%": 2,
    "40-60%": 3,
    "20-40%": 4,
    "<20% manual": 5,
}

B4_SCORES = {
    "Exploratory": 1,
    "Mostly exploratory": 2,
    "Balanced": 3,
    "Mostly hypothesis-led": 4,
    "Fully hypothesis-led": 5,
}

# C — Senior-Led Model (xcsg only)
C1_SCORES = {
    "Generalist": 1,
    "Mixed": 2,
    "Specialist": 3,
    "Deep specialist": 4,
    "World-class expert": 5,
}

C2_SCORES = {
    "Delegated": 1,
    "Partially delegated": 2,
    "Shared": 3,
    "Hands-on": 4,
    "Personally leading": 5,
}

C3_SCORES = {
    "<20%": 1,
    "20-40%": 2,
    "40-60%": 3,
    "60-80%": 4,
    ">80%": 5,
}

# D — Proprietary Knowledge
D1_SCORES = {
    "None": 1,
    "Public data": 2,
    "Some proprietary": 3,
    "Mostly proprietary": 4,
    "Fully proprietary": 5,
}

D2_SCORES = {
    "One-time": 1,
    "Some reuse": 2,
    "Moderate": 3,
    "High": 4,
    "Maximum": 5,
}

D3_SCORES = {
    "Easily replicable": 1,
    "Somewhat": 2,
    "Moderately unique": 3,
    "Highly unique": 4,
    "Impossible to replicate": 5,
}

# F — Value Creation
F1_SCORES = {
    "Not assessed": 1,
    "Basic": 2,
    "Standard": 3,
    "Comprehensive": 4,
    "Exceeds requirements": 5,
}

F2_SCORES = {
    "None": 1,
    "Identified": 2,
    "Designed": 3,
    "Implemented": 4,
    "Scaled": 5,
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
    denominator = xcsg_r if xcsg_r > 0 else 0.5
    return round(legacy_r / denominator, 2)


def compute_value_multiplier(effort_ratio: float, quality_ratio: float) -> float:
    return round(effort_ratio * quality_ratio, 2)


def _avg_score(data: dict, fields: list, score_maps: list) -> Optional[float]:
    """Average of mapped scores for a set of fields. Returns None if no values found."""
    scores = []
    for field, score_map in zip(fields, score_maps):
        val = data.get(field)
        if val and val in score_map:
            scores.append(score_map[val])
    if not scores:
        return None
    return round(sum(scores) / len(scores), 2)


def compute_machine_first_score(data: dict) -> Optional[float]:
    """Machine-First = avg(B1_xcsg, B2_xcsg, B3_xcsg, B4_xcsg) on 1–5 scale."""
    return _avg_score(data,
        ["b1_starting_point_xcsg", "b2_research_sources_xcsg",
         "b3_assembly_ratio_xcsg", "b4_hypothesis_first_xcsg"],
        [B1_SCORES, B2_SCORES, B3_SCORES, B4_SCORES],
    )


def compute_senior_led_score(data: dict) -> Optional[float]:
    """Senior-Led = avg(C1, C2, C3) on 1–5 scale."""
    return _avg_score(data,
        ["c1_specialization", "c2_directness", "c3_judgment_pct"],
        [C1_SCORES, C2_SCORES, C3_SCORES],
    )


def compute_proprietary_knowledge_score(data: dict) -> Optional[float]:
    """Proprietary Knowledge = avg(D1_xcsg, D2_xcsg, D3_xcsg) on 1–5 scale."""
    return _avg_score(data,
        ["d1_proprietary_data_xcsg", "d2_knowledge_reuse_xcsg", "d3_moat_test_xcsg"],
        [D1_SCORES, D2_SCORES, D3_SCORES],
    )


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
    if complete_count >= 20:
        return 4
    elif complete_count >= 8:
        return 3
    elif complete_count >= 3:
        return 2
    else:
        return 1


def projects_to_next_checkpoint(complete_count: int) -> int:
    if complete_count >= 20:
        return 0
    elif complete_count >= 8:
        return 20 - complete_count
    elif complete_count >= 3:
        return 8 - complete_count
    else:
        return 3 - complete_count


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

    mf_avg = round(sum(mf_scores) / len(mf_scores), 2) if mf_scores else 0.0
    sl_avg = round(sum(sl_scores) / len(sl_scores), 2) if sl_scores else 0.0
    pk_avg = round(sum(pk_scores) / len(pk_scores), 2) if pk_scores else 0.0

    # Flywheel health = average of the three leg scores (only those computed)
    leg_avgs = [v for v in [mf_avg, sl_avg, pk_avg] if v > 0]
    flywheel = round(sum(leg_avgs) / len(leg_avgs), 2) if leg_avgs else 0.0

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
    }


def compute_trend_data(complete_projects: list) -> list:
    return [compute_project_metrics(d) for d in complete_projects]


def compute_scaling_gates(complete_projects: list, all_projects: list) -> list:
    """Evaluate all 6 scaling gates."""
    # Gate 1: Multi-engagement
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

    # Gate 3: Client-invisible quality
    zero_revision = sum(1 for d in complete_projects if d["xcsg_revision_rounds"] == "0")
    gate3_pass = zero_revision >= 1
    gate3_detail = f"{zero_revision} project{'s' if zero_revision != 1 else ''} with 0 revisions"

    # Gate 4: Transferability (placeholder)
    gate4_pass = False
    gate4_detail = "Requires non-pioneer data \u2014 deferred to CP3"

    # Gate 5: Flywheel validation (placeholder)
    gate5_pass = False
    gate5_detail = "Requires registry-integrated AI delivery data"

    # Gate 6: Compounding — D2 reuse rate ≥40%
    d2_values = [d.get("d2_knowledge_reuse_xcsg", "") for d in complete_projects]
    reused = sum(1 for v in d2_values if v in ("High", "Maximum"))
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
