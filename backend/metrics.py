"""
metrics.py — Computed metrics for xCSG Value Tracker.
All scoring weights imported from schema.py (single source of truth).
"""
from __future__ import annotations

from datetime import datetime
from typing import Optional

from backend.schema import SCORES

TEAM_MIDPOINTS = {"1": 1.0, "2": 2.0, "3": 3.0, "4+": 5.0}

REVISION_DEPTH_SCORES = SCORES["revision_depth"]
SCOPE_EXPANSION_SCORES = SCORES["scope_expansion"]
SELF_ASSESSMENT_SCORES = SCORES["c6_self_assessment"]
CLIENT_PULSE_SCORES = SCORES["client_pulse"]
B6_DATA_ANALYSIS_SCORES = SCORES["b6_data_analysis_split"]
C7_ANALYTICAL_DEPTH_SCORES = SCORES["c7_analytical_depth"]
C8_DECISION_READINESS_SCORES = SCORES["c8_decision_readiness"]
E1_CLIENT_DECISION_SCORES = SCORES["e1_client_decision"]

OPTION_SCORES = {key: SCORES[key] for key in [
    "b2_research_sources", "c1_specialization", "c2_directness", "c3_judgment_pct",
    "d1_proprietary_data", "d2_knowledge_reuse", "d3_moat_test",
    "b5_ai_survival", "g1_reuse_intent",
]}



def round2(value: float) -> float:
    return round(value, 2)



def average(values: list[Optional[float]]) -> Optional[float]:
    present = [float(v) for v in values if v is not None]
    return round2(sum(present) / len(present)) if present else None



def first_present(data: dict, *keys: str) -> object:
    for key in keys:
        if key and data.get(key) is not None:
            return data.get(key)
    return None



def parse_team_size(value: Optional[object]) -> Optional[float]:
    if value is None:
        return None
    s = str(value).strip()
    # Support old dropdown values
    mapped = TEAM_MIDPOINTS.get(s)
    if mapped is not None:
        return mapped
    # Support raw numeric input
    try:
        n = float(s)
        return n if n > 0 else None
    except (TypeError, ValueError):
        return None



def parse_number(value: Optional[object]) -> Optional[float]:
    if value in (None, ""):
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None



def compute_calendar_days(date_started: Optional[str], date_delivered: Optional[str]) -> Optional[int]:
    if not date_started or not date_delivered:
        return None
    try:
        start = datetime.strptime(date_started, "%Y-%m-%d")
        end = datetime.strptime(date_delivered, "%Y-%m-%d")
    except ValueError:
        return None
    return max((end - start).days, 1)



def compute_person_days(working_days: Optional[object], team_size: Optional[object]) -> Optional[float]:
    days = parse_number(working_days)
    team = parse_team_size(team_size)
    return round2(days * team) if days is not None and team is not None else None



def score_value(value: Optional[object], mapping: dict[str, Optional[float]]) -> Optional[float]:
    if value is None:
        return None
    return mapping.get(str(value).strip())



def compute_ratio(numerator: Optional[float], denominator: Optional[float]) -> Optional[float]:
    if numerator is None or denominator in (None, 0):
        return None
    return round2(numerator / denominator)



def score_pair_ratio(data: dict, xcsg_field: str, legacy_field: str, mapping: dict[str, Optional[float]]) -> Optional[float]:
    return compute_ratio(score_value(data.get(xcsg_field), mapping), score_value(data.get(legacy_field), mapping))



def compute_machine_first_score(data: dict) -> Optional[float]:
    return score_pair_ratio(data, "b2_research_sources", "l6_legacy_b2_sources", OPTION_SCORES["b2_research_sources"])



def compute_senior_led_score(data: dict) -> Optional[float]:
    """Senior-Led Gain: per-field ratios averaged. When legacy=0 but xcsg>0, that's max gain."""
    pairs = [
        ("c1_specialization", "l7_legacy_c1_specialization", OPTION_SCORES["c1_specialization"]),
        ("c2_directness", "l8_legacy_c2_directness", OPTION_SCORES["c2_directness"]),
        ("c3_judgment_pct", "l9_legacy_c3_judgment", OPTION_SCORES["c3_judgment_pct"]),
    ]
    ratios = []
    for xcsg_field, legacy_field, mapping in pairs:
        xcsg_val = score_value(data.get(xcsg_field), mapping)
        legacy_val = score_value(data.get(legacy_field), mapping)
        if xcsg_val is not None and legacy_val is not None:
            if legacy_val == 0:
                ratios.append(10.0 if xcsg_val > 0 else 1.0)
            else:
                ratios.append(round2(xcsg_val / legacy_val))
    return average(ratios)



def compute_proprietary_knowledge_score(data: dict) -> Optional[float]:
    """Knowledge Gain: per-field ratios averaged. When legacy=0 but xcsg>0, that's max gain."""
    pairs = [
        ("d1_proprietary_data", "l10_legacy_d1_proprietary", OPTION_SCORES["d1_proprietary_data"]),
        ("d2_knowledge_reuse", "l11_legacy_d2_reuse", OPTION_SCORES["d2_knowledge_reuse"]),
        ("d3_moat_test", "l12_legacy_d3_moat", OPTION_SCORES["d3_moat_test"]),
    ]
    ratios = []
    for xcsg_field, legacy_field, mapping in pairs:
        xcsg_val = score_value(data.get(xcsg_field), mapping)
        legacy_val = score_value(data.get(legacy_field), mapping)
        if xcsg_val is not None and legacy_val is not None:
            if legacy_val == 0:
                ratios.append(10.0 if xcsg_val > 0 else 1.0)
            else:
                ratios.append(round2(xcsg_val / legacy_val))
    return average(ratios)



def compute_ai_survival_rate(data: dict) -> Optional[float]:
    return score_value(first_present(data, "b5_ai_survival_rate_xcsg", "b5_ai_survival", "b5_ai_survival_rate"), OPTION_SCORES["b5_ai_survival"])



def compute_reuse_intent_score(data: dict) -> Optional[float]:
    return score_value(first_present(data, "g1_reuse_intent_xcsg", "g1_reuse_intent"), OPTION_SCORES["g1_reuse_intent"])



def compute_client_pulse_score(data: dict) -> Optional[float]:
    return score_value(data.get("client_pulse"), CLIENT_PULSE_SCORES)



def compute_quality_score(data: dict) -> Optional[float]:
    return average([
        score_value(data.get("c6_self_assessment"), SELF_ASSESSMENT_SCORES),
        score_value(data.get("c7_analytical_depth"), C7_ANALYTICAL_DEPTH_SCORES),
        score_value(data.get("c8_decision_readiness"), C8_DECISION_READINESS_SCORES),
    ])



def compute_legacy_quality(data: dict) -> Optional[float]:
    return average([
        score_value(data.get("l13_legacy_c7_depth"), C7_ANALYTICAL_DEPTH_SCORES),
        score_value(data.get("l14_legacy_c8_decision"), C8_DECISION_READINESS_SCORES),
    ])



def compute_xcsg_smoothness(data: dict) -> Optional[float]:
    return average([
        score_value(first_present(data, "revision_depth", "xcsg_revision_depth", "c4_revision_depth", "xcsg_revision_rounds"), REVISION_DEPTH_SCORES),
        score_value(first_present(data, "xcsg_scope_expansion", "scope_expansion"), SCOPE_EXPANSION_SCORES),
        score_value(data.get("client_pulse"), CLIENT_PULSE_SCORES),
    ])



def compute_legacy_smoothness(data: dict) -> Optional[float]:
    return average([
        score_value(first_present(data, "l3_legacy_revision_depth", "legacy_revision_depth", "legacy_revision_rounds"), REVISION_DEPTH_SCORES),
        score_value(first_present(data, "legacy_scope_expansion", "l4_legacy_scope_expansion"), SCOPE_EXPANSION_SCORES),
        score_value(first_present(data, "legacy_client_reaction", "l5_legacy_client_reaction"), CLIENT_PULSE_SCORES),
    ])



def compute_project_metrics(data: dict) -> dict:
    calendar_days = compute_calendar_days(data.get("date_started"), data.get("date_delivered"))
    xcsg_person_days = compute_person_days(first_present(data, "xcsg_working_days", "working_days"), data.get("xcsg_team_size"))
    legacy_person_days = compute_person_days(first_present(data, "legacy_working_days", "l1_legacy_working_days"), first_present(data, "legacy_team_size", "l2_legacy_team_size"))

    delivery_speed = compute_ratio(legacy_person_days, xcsg_person_days)
    engagement_revenue = parse_number(data.get("engagement_revenue"))
    revenue_productivity_xcsg = round2(engagement_revenue / xcsg_person_days) if engagement_revenue is not None and xcsg_person_days else None
    revenue_productivity_legacy = round2(engagement_revenue / legacy_person_days) if engagement_revenue is not None and legacy_person_days else None
    quality_score = compute_quality_score(data)
    legacy_quality = compute_legacy_quality(data)
    output_quality = compute_ratio(quality_score, legacy_quality)

    # Productivity = quality per person-day, xCSG vs legacy
    xcsg_quality_per_day = round2(quality_score / xcsg_person_days) if quality_score is not None and xcsg_person_days else None
    legacy_quality_per_day = round2(legacy_quality / legacy_person_days) if legacy_quality is not None and legacy_person_days else None
    productivity_ratio = compute_ratio(xcsg_quality_per_day, legacy_quality_per_day)

    xcsg_smoothness = compute_xcsg_smoothness(data)
    legacy_smoothness = compute_legacy_smoothness(data)
    rework_efficiency = compute_ratio(xcsg_smoothness, legacy_smoothness)

    machine_first_score = compute_machine_first_score(data)
    senior_led_score = compute_senior_led_score(data)
    proprietary_knowledge_score = compute_proprietary_knowledge_score(data)
    raw_impact = score_pair_ratio(data, "e1_client_decision", "l15_legacy_e1_decision", E1_CLIENT_DECISION_SCORES)
    client_impact = min(raw_impact, 10.0) if raw_impact is not None else None
    data_independence = score_pair_ratio(data, "b6_data_analysis_split", "l16_legacy_b6_data", B6_DATA_ANALYSIS_SCORES)

    ai_survival_rate = compute_ai_survival_rate(data)
    reuse_intent_score = compute_reuse_intent_score(data)
    client_pulse_score = compute_client_pulse_score(data)
    overall_xcsg_score = average([machine_first_score, senior_led_score, proprietary_knowledge_score])
    has_expert_response = data.get("project_id") is not None or data.get("b1_starting_point") is not None

    return {
        "id": data.get("id"),
        "project_id": data.get("id"),
        "project_name": data.get("project_name", ""),
        "category_name": data.get("category_name", data.get("project_category", "")),
        "pioneer_name": data.get("pioneer_name", ""),
        "client_name": data.get("client_name"),
        "created_at": data.get("created_at", ""),
        "has_expert_response": has_expert_response,
        "calendar_days": calendar_days,
        "xcsg_person_days": xcsg_person_days,
        "legacy_person_days": legacy_person_days,
        "effort_ratio": delivery_speed,
        "delivery_speed": delivery_speed,
        "quality_score": quality_score,
        "quality_ratio": output_quality,
        "output_quality": output_quality,
        "legacy_quality": legacy_quality,
        "legacy_quality_score": legacy_quality,
        "xcsg_smoothness": xcsg_smoothness,
        "legacy_smoothness": legacy_smoothness,
        "rework_efficiency": rework_efficiency,
        "outcome_rate_xcsg": None,
        "outcome_rate_legacy": None,
        "outcome_rate_ratio": productivity_ratio,
        "revenue_productivity_xcsg": revenue_productivity_xcsg,
        "revenue_productivity_legacy": revenue_productivity_legacy,
        "productivity_ratio": productivity_ratio,
        "xcsg_quality_per_day": xcsg_quality_per_day,
        "legacy_quality_per_day": legacy_quality_per_day,
        "client_impact": client_impact,
        "data_independence": data_independence,
        "xcsg_advantage": productivity_ratio,
        "value_multiplier": productivity_ratio,
        "machine_first_score": machine_first_score,
        "senior_led_score": senior_led_score,
        "proprietary_knowledge_score": proprietary_knowledge_score,
        "overall_xcsg_score": overall_xcsg_score,
        "ai_survival_rate": ai_survival_rate,
        "reuse_intent_score": reuse_intent_score,
        "client_pulse_score": client_pulse_score,
        "legacy_overridden": bool(data.get("legacy_overridden", 0)),
    }



def determine_checkpoint(completed_projects: int) -> int:
    if completed_projects >= 20:
        return 4
    if completed_projects >= 8:
        return 3
    if completed_projects >= 3:
        return 2
    return 1



def projects_to_next_checkpoint(completed_projects: int) -> int:
    if completed_projects >= 20:
        return 0
    if completed_projects >= 8:
        return 20 - completed_projects
    if completed_projects >= 3:
        return 8 - completed_projects
    return 3 - completed_projects



def compute_scaling_gates(complete_projects: list[dict]) -> list[dict]:
    metrics_list = [compute_project_metrics(project) for project in complete_projects]
    deliverable_types = {project.get("deliverable_type") or project.get("category_name") for project in complete_projects if project.get("deliverable_type") or project.get("category_name")}
    avg_effort = average([m["effort_ratio"] for m in metrics_list])
    reuse_rate = round2((sum(1 for m in metrics_list if m["reuse_intent_score"] == 1.0) / len(metrics_list)) * 100) if metrics_list else None
    d2_reuse_rate = round2((sum(1 for project in complete_projects if first_present(project, "d2_knowledge_reuse_xcsg", "d2_knowledge_reuse") == "Yes directly reused and extended") / len(complete_projects)) * 100) if complete_projects else None
    client_invisible_quality = any(
        first_present(project, "xcsg_revision_depth", "c4_revision_depth", "revision_depth", "xcsg_revision_rounds") in {"No revisions needed", "Cosmetic only", "0", "1", 0, 1}
        and project.get("client_pulse") != "Below expectations"
        for project in complete_projects
    )
    # Transferability: F2 productization rate + cross-category pioneer count
    f2_yes_count = sum(1 for project in complete_projects if first_present(project, "f2_productization") in {"Yes largely as-is", "Yes with moderate customization"})
    f2_total = sum(1 for project in complete_projects if first_present(project, "f2_productization") is not None)
    f2_rate = round2((f2_yes_count / f2_total) * 100) if f2_total else None
    f2_pass = f2_rate is not None and f2_rate >= 50

    pioneer_cats = {}
    for project in complete_projects:
        pion = project.get("pioneer_name")
        cat = project.get("category_name") or project.get("deliverable_type")
        if pion and cat:
            pioneer_cats.setdefault(pion, set()).add(cat)
    cross_cat_count = sum(1 for cats in pioneer_cats.values() if len(cats) >= 2)
    cross_cat_pass = cross_cat_count >= 2

    # Flywheel validation: recent 5 projects avg advantage >= first 5 projects avg advantage
    sorted_for_flywheel = sorted(complete_projects, key=lambda p: p.get("date_delivered") or p.get("date_started") or "")
    flywheel_first = sorted_for_flywheel[:5]
    flywheel_recent = sorted_for_flywheel[-5:] if len(sorted_for_flywheel) >= 10 else sorted_for_flywheel[5:]
    flywheel_first_avg = average([compute_project_metrics(p)["xcsg_advantage"] for p in flywheel_first]) if flywheel_first else None
    flywheel_recent_avg = average([compute_project_metrics(p)["xcsg_advantage"] for p in flywheel_recent]) if flywheel_recent else None
    if flywheel_first_avg is not None and flywheel_recent_avg is not None:
        flywheel_pass = flywheel_recent_avg >= flywheel_first_avg
        flywheel_detail = f"First 5 avg: {round2(flywheel_first_avg)}x \u2192 Recent {len(flywheel_recent)} avg: {round2(flywheel_recent_avg)}x"
    else:
        flywheel_pass = False
        flywheel_detail = "Need at least 6 projects to compare"

    return [
        {"id": 1, "name": "Multi-engagement", "description": "At least 2 deliverable types completed", "status": "pass" if len(deliverable_types) >= 2 else "pending", "detail": f"{len(deliverable_types)} deliverable type(s) completed"},
        {"id": 2, "name": "Effort reduction", "description": "Average effort ratio > 1.3", "status": "pass" if avg_effort is not None and avg_effort > 1.3 else "pending", "detail": f"Average effort ratio: {avg_effort}×" if avg_effort is not None else "Not enough data"},
        {"id": 3, "name": "Client-invisible quality", "description": "At least 1 deliverable with low revision depth and no negative client pulse", "status": "pass" if client_invisible_quality else "pending", "detail": "Met" if client_invisible_quality else "No qualifying deliverable yet"},
        {"id": 4, "name": "Transferability", "description": "Two sub-checks: F2 productization rate ≥ 50% AND ≥2 pioneers with 2+ categories", "status": "pass" if f2_pass and cross_cat_pass else "pending", "detail": f"F2: {f2_rate}% (need ≥50%) \u00b7 Cross-cat pioneers: {cross_cat_count} (need ≥2)"},
        {"id": 5, "name": "Flywheel validation", "description": "Average xCSG Value Gain of most recent 5 projects \u2265 first 5", "status": "pass" if flywheel_pass else "pending", "detail": flywheel_detail},
        {"id": 6, "name": "Compounding", "description": "D2 reuse rate ≥ 40%", "status": "pass" if d2_reuse_rate is not None and d2_reuse_rate >= 40 else "pending", "detail": f"D2 reuse rate: {d2_reuse_rate}%" if d2_reuse_rate is not None else "Not enough data"},
        {"id": 7, "name": "Adoption confidence", "description": 'G1 "Yes without hesitation" ≥ 70%', "status": "pass" if reuse_rate is not None and reuse_rate >= 70 else "pending", "detail": f"Reuse intent rate: {reuse_rate}%" if reuse_rate is not None else "No reuse intent data yet"},
    ]



def compute_dashboard_metrics(complete_projects: list[dict], all_projects: list[dict]) -> dict:
    metrics_list = [compute_project_metrics(project) for project in complete_projects]
    completed_count = len(metrics_list)
    total_count = len(all_projects)
    scaling_gates = compute_scaling_gates(complete_projects)

    average_effort_ratio = average([m["delivery_speed"] for m in metrics_list]) or 0.0
    average_quality_score = average([m["quality_score"] for m in metrics_list]) or 0.0
    average_quality_ratio = average([m["output_quality"] for m in metrics_list]) or 0.0
    average_advantage = average([m["xcsg_advantage"] for m in metrics_list]) or 0.0
    machine_first_avg = average([m["machine_first_score"] for m in metrics_list]) or 0.0
    senior_led_avg = average([m["senior_led_score"] for m in metrics_list]) or 0.0
    proprietary_knowledge_avg = average([m["proprietary_knowledge_score"] for m in metrics_list]) or 0.0
    rework_efficiency_avg = average([m["rework_efficiency"] for m in metrics_list]) or 0.0
    client_impact_avg = average([m["client_impact"] for m in metrics_list]) or 0.0
    data_independence_avg = average([m["data_independence"] for m in metrics_list]) or 0.0
    reuse_intent_avg = average([m["reuse_intent_score"] for m in metrics_list]) or 0.0
    ai_survival_avg = average([m["ai_survival_rate"] for m in metrics_list if m["ai_survival_rate"] is not None]) or 0.0
    client_pulse_avg = average([m["client_pulse_score"] for m in metrics_list if m["client_pulse_score"] is not None]) or 0.0
    reuse_intent_rate = round2((sum(1 for m in metrics_list if m["reuse_intent_score"] == 1.0) / completed_count) * 100) if completed_count else 0.0
    flywheel_health = average([machine_first_avg, senior_led_avg, proprietary_knowledge_avg, reuse_intent_avg]) or 0.0

    return {
        "total_projects": total_count,
        "completed_count": completed_count,
        "projects_completed": completed_count,
        "complete_projects": completed_count,
        "pending_projects": max(total_count - completed_count, 0),
        "average_effort_ratio": average_effort_ratio,
        "average_quality_score": average_quality_score,
        "average_quality_ratio": average_quality_ratio,
        "average_outcome_rate_ratio": average_advantage,
        "average_value_multiplier": average_advantage,
        "average_advantage": average_advantage,
        "flywheel_health": flywheel_health,
        "machine_first_avg": machine_first_avg,
        "senior_led_avg": senior_led_avg,
        "proprietary_knowledge_avg": proprietary_knowledge_avg,
        "rework_efficiency_avg": rework_efficiency_avg,
        "client_impact_avg": client_impact_avg,
        "data_independence_avg": data_independence_avg,
        "reuse_intent_avg": reuse_intent_avg,
        "reuse_intent_rate": reuse_intent_rate,
        "ai_survival_avg": ai_survival_avg,
        "client_pulse_avg": client_pulse_avg,
        "overall_xcsg_avg": average([machine_first_avg, senior_led_avg, proprietary_knowledge_avg]) or 0.0,
        "checkpoint": determine_checkpoint(completed_count),
        "projects_to_next_checkpoint": projects_to_next_checkpoint(completed_count),
        "scaling_gates": scaling_gates,
        "scaling_gates_passed": sum(1 for g in scaling_gates if g["status"] == "pass"),
        "scaling_gates_total": len(scaling_gates),
    }



def compute_summary(complete_projects: list, total_projects: list) -> dict:
    return compute_dashboard_metrics(complete_projects, total_projects)



def compute_trend_data(complete_projects: list) -> list:
    return [compute_project_metrics(project) for project in complete_projects]
