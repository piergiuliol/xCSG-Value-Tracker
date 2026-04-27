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



def coalesce(data: dict, *keys: str) -> object:
    for key in keys:
        if not key:
            continue
        value = data.get(key)
        if value is None:
            continue
        if isinstance(value, str) and not value.strip():
            continue
        return value
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


def compute_schedule_delta(date_expected: Optional[str], date_delivered: Optional[str]) -> Optional[int]:
    """Days by which actual delivery missed the expected date.

    Returns `actual - expected` in calendar days. Negative = early, 0 = on time, positive = late.
    Returns None if either date is missing or unparseable.
    """
    if not date_expected or not date_delivered:
        return None
    try:
        expected = datetime.strptime(date_expected, "%Y-%m-%d")
        actual = datetime.strptime(date_delivered, "%Y-%m-%d")
    except ValueError:
        return None
    return (actual - expected).days



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



def _compute_paired_ratio_score(data: dict, pairs: list[tuple[str, str, dict]]) -> Optional[float]:
    """Compute average ratio across paired xCSG/legacy fields. Caps at 10x when legacy=0."""
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



def compute_senior_led_score(data: dict) -> Optional[float]:
    """Senior-Led Gain: per-field ratios averaged."""
    return _compute_paired_ratio_score(data, [
        ("c1_specialization", "l7_legacy_c1_specialization", OPTION_SCORES["c1_specialization"]),
        ("c2_directness", "l8_legacy_c2_directness", OPTION_SCORES["c2_directness"]),
        ("c3_judgment_pct", "l9_legacy_c3_judgment", OPTION_SCORES["c3_judgment_pct"]),
    ])



def compute_proprietary_knowledge_score(data: dict) -> Optional[float]:
    """Knowledge Gain: per-field ratios averaged."""
    return _compute_paired_ratio_score(data, [
        ("d1_proprietary_data", "l10_legacy_d1_proprietary", OPTION_SCORES["d1_proprietary_data"]),
        ("d2_knowledge_reuse", "l11_legacy_d2_reuse", OPTION_SCORES["d2_knowledge_reuse"]),
        ("d3_moat_test", "l12_legacy_d3_moat", OPTION_SCORES["d3_moat_test"]),
    ])



def compute_ai_survival_rate(data: dict) -> Optional[float]:
    return score_value(coalesce(data, "b5_ai_survival_rate_xcsg", "b5_ai_survival", "b5_ai_survival_rate"), OPTION_SCORES["b5_ai_survival"])



def compute_reuse_intent_score(data: dict) -> Optional[float]:
    return score_value(coalesce(data, "g1_reuse_intent_xcsg", "g1_reuse_intent"), OPTION_SCORES["g1_reuse_intent"])



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
        score_value(coalesce(data, "revision_depth", "xcsg_revision_depth", "c4_revision_depth", "xcsg_revision_rounds"), REVISION_DEPTH_SCORES),
        score_value(coalesce(data, "xcsg_scope_expansion", "scope_expansion"), SCOPE_EXPANSION_SCORES),
        score_value(data.get("client_pulse"), CLIENT_PULSE_SCORES),
    ])



def compute_legacy_smoothness(data: dict) -> Optional[float]:
    return average([
        score_value(coalesce(data, "l3_legacy_revision_depth", "legacy_revision_depth", "legacy_revision_rounds"), REVISION_DEPTH_SCORES),
        score_value(coalesce(data, "l4_legacy_scope_expansion", "legacy_scope_expansion"), SCOPE_EXPANSION_SCORES),
        score_value(coalesce(data, "l5_legacy_client_reaction", "legacy_client_reaction"), CLIENT_PULSE_SCORES),
    ])



def _compute_effort_metrics(data: dict) -> dict:
    """Compute delivery speed and person-day metrics."""
    calendar_days = compute_calendar_days(data.get("date_started"), data.get("date_delivered"))
    schedule_delta_days = compute_schedule_delta(data.get("date_expected_delivered"), data.get("date_delivered"))
    xcsg_person_days = compute_person_days(coalesce(data, "xcsg_working_days", "working_days"), data.get("xcsg_team_size"))
    legacy_person_days = compute_person_days(coalesce(data, "l1_legacy_working_days", "legacy_working_days"), coalesce(data, "l2_legacy_team_size", "legacy_team_size"))
    delivery_speed = compute_ratio(legacy_person_days, xcsg_person_days)
    engagement_revenue = parse_number(data.get("engagement_revenue"))
    revenue_productivity_xcsg = round2(engagement_revenue / xcsg_person_days) if engagement_revenue is not None and xcsg_person_days else None
    revenue_productivity_legacy = round2(engagement_revenue / legacy_person_days) if engagement_revenue is not None and legacy_person_days else None
    return {
        "calendar_days": calendar_days,
        "schedule_delta_days": schedule_delta_days,
        "xcsg_person_days": xcsg_person_days,
        "legacy_person_days": legacy_person_days, "delivery_speed": delivery_speed,
        "effort_ratio": delivery_speed,
        "revenue_productivity_xcsg": revenue_productivity_xcsg,
        "revenue_productivity_legacy": revenue_productivity_legacy,
    }


def _compute_quality_metrics(data: dict, xcsg_person_days, legacy_person_days) -> dict:
    """Compute quality scores and value gain.

    IMPORTANT: don't round xcsg_qpd/legacy_qpd before the ratio — legacy_qpd
    frequently rounds to 0.00 at 2 decimals (e.g. 0.3 / 150 = 0.002), which
    then makes compute_ratio return None. Ratio the raw values; round the
    displayed per-day metrics separately.
    """
    quality_score = compute_quality_score(data)
    legacy_quality = compute_legacy_quality(data)
    output_quality = compute_ratio(quality_score, legacy_quality)
    xcsg_qpd = (quality_score / xcsg_person_days) if quality_score is not None and xcsg_person_days else None
    legacy_qpd = (legacy_quality / legacy_person_days) if legacy_quality is not None and legacy_person_days else None
    productivity_ratio = compute_ratio(xcsg_qpd, legacy_qpd)
    return {
        "quality_score": quality_score, "legacy_quality": legacy_quality, "legacy_quality_score": legacy_quality,
        "quality_ratio": output_quality, "output_quality": output_quality,
        "xcsg_quality_per_day": round2(xcsg_qpd) if xcsg_qpd is not None else None,
        "legacy_quality_per_day": round2(legacy_qpd) if legacy_qpd is not None else None,
        "productivity_ratio": productivity_ratio, "xcsg_advantage": productivity_ratio,
        "value_multiplier": productivity_ratio, "outcome_rate_ratio": productivity_ratio,
    }


def _compute_smoothness_metrics(data: dict) -> dict:
    """Compute rework efficiency metrics."""
    xcsg_smoothness = compute_xcsg_smoothness(data)
    legacy_smoothness = compute_legacy_smoothness(data)
    rework_efficiency = compute_ratio(xcsg_smoothness, legacy_smoothness)
    return {"xcsg_smoothness": xcsg_smoothness, "legacy_smoothness": legacy_smoothness, "rework_efficiency": rework_efficiency}


def _compute_flywheel_metrics(data: dict) -> dict:
    """Compute flywheel pillar scores."""
    mf = compute_machine_first_score(data)
    sl = compute_senior_led_score(data)
    pk = compute_proprietary_knowledge_score(data)
    raw_impact = score_pair_ratio(data, "e1_client_decision", "l15_legacy_e1_decision", E1_CLIENT_DECISION_SCORES)
    ci = min(raw_impact, 10.0) if raw_impact is not None else None
    di = score_pair_ratio(data, "b6_data_analysis_split", "l16_legacy_b6_data", B6_DATA_ANALYSIS_SCORES)
    return {
        "machine_first_score": mf, "senior_led_score": sl, "proprietary_knowledge_score": pk,
        "overall_xcsg_score": average([mf, sl, pk]),
        "client_impact": ci, "data_independence": di,
    }


def _compute_signal_metrics(data: dict) -> dict:
    """Compute signal percentage metrics."""
    return {
        "ai_survival_rate": compute_ai_survival_rate(data),
        "reuse_intent_score": compute_reuse_intent_score(data),
        "client_pulse_score": compute_client_pulse_score(data),
    }


def _compute_economics_metrics(
    engagement_revenue: Optional[float],
    xcsg_person_days: Optional[float],
    legacy_person_days: Optional[float],
    pioneer_rates: list,
    legacy_rate_effective: Optional[float],
    quality_score: Optional[float],
    legacy_quality_score: Optional[float],
    scope_expansion_revenue: Optional[float],
    currency: Optional[str],
) -> dict:
    """Compute optional economics metrics.

    Every metric returns None when its inputs are missing — this is what
    makes the section truly optional. Frontend renders '—' for None values.
    """
    rates_present = [r for r in pioneer_rates if r is not None]
    xcsg_blended_rate = round2(sum(rates_present) / len(rates_present)) if rates_present else None

    xcsg_cost = round2(xcsg_blended_rate * xcsg_person_days) if xcsg_blended_rate is not None and xcsg_person_days else None
    legacy_cost = round2(legacy_rate_effective * legacy_person_days) if legacy_rate_effective is not None and legacy_person_days else None

    xcsg_margin = round2(engagement_revenue - xcsg_cost) if engagement_revenue is not None and xcsg_cost is not None else None
    legacy_margin = round2(engagement_revenue - legacy_cost) if engagement_revenue is not None and legacy_cost is not None else None

    xcsg_margin_pct = round2(xcsg_margin / engagement_revenue) if xcsg_margin is not None and engagement_revenue else None
    legacy_margin_pct = round2(legacy_margin / engagement_revenue) if legacy_margin is not None and engagement_revenue else None

    if xcsg_margin is not None and legacy_margin is not None and legacy_margin > 0:
        margin_gain = round2(min(xcsg_margin / legacy_margin, 10.0))
    else:
        margin_gain = None

    revenue_per_day_xcsg = round2(engagement_revenue / xcsg_person_days) if engagement_revenue is not None and xcsg_person_days else None
    revenue_per_day_legacy = round2(engagement_revenue / legacy_person_days) if engagement_revenue is not None and legacy_person_days else None
    if revenue_per_day_xcsg is not None and revenue_per_day_legacy:
        revenue_per_day_gain = round2(revenue_per_day_xcsg / revenue_per_day_legacy)
    else:
        revenue_per_day_gain = None

    xcsg_cppq = (xcsg_cost / quality_score) if xcsg_cost is not None and quality_score else None
    legacy_cppq = (legacy_cost / legacy_quality_score) if legacy_cost is not None and legacy_quality_score else None
    if xcsg_cppq is not None and legacy_cppq is not None and xcsg_cppq > 0:
        cppq_gain = round2(legacy_cppq / xcsg_cppq)
    else:
        cppq_gain = None

    return {
        "currency": currency,
        "engagement_revenue": engagement_revenue,
        "scope_expansion_revenue": scope_expansion_revenue,
        "xcsg_blended_rate": xcsg_blended_rate,
        "xcsg_cost": xcsg_cost,
        "legacy_rate_effective": legacy_rate_effective,
        "legacy_cost": legacy_cost,
        "xcsg_margin": xcsg_margin,
        "legacy_margin": legacy_margin,
        "xcsg_margin_pct": xcsg_margin_pct,
        "legacy_margin_pct": legacy_margin_pct,
        "margin_gain": margin_gain,
        "revenue_per_day_xcsg": revenue_per_day_xcsg,
        "revenue_per_day_legacy": revenue_per_day_legacy,
        "revenue_per_day_gain": revenue_per_day_gain,
        "cost_per_quality_point_xcsg": round2(xcsg_cppq) if xcsg_cppq is not None else None,
        "cost_per_quality_point_legacy": round2(legacy_cppq) if legacy_cppq is not None else None,
        "cost_per_quality_point_gain": cppq_gain,
    }


def compute_project_metrics(data: dict) -> dict:
    effort = _compute_effort_metrics(data)
    quality = _compute_quality_metrics(data, effort["xcsg_person_days"], effort["legacy_person_days"])
    smoothness = _compute_smoothness_metrics(data)
    flywheel = _compute_flywheel_metrics(data)
    signals = _compute_signal_metrics(data)

    # Economics (optional — every key may be None)
    legacy_rate_effective = parse_number(data.get("legacy_day_rate_override"))
    if legacy_rate_effective is None:
        legacy_rate_effective = parse_number(data.get("practice_default_legacy_day_rate"))
    pioneer_day_rates = data.get("pioneer_day_rates") or []
    economics = _compute_economics_metrics(
        engagement_revenue=parse_number(data.get("engagement_revenue")),
        xcsg_person_days=effort["xcsg_person_days"],
        legacy_person_days=effort["legacy_person_days"],
        pioneer_rates=[parse_number(r) for r in pioneer_day_rates],
        legacy_rate_effective=legacy_rate_effective,
        quality_score=quality["quality_score"],
        legacy_quality_score=quality["legacy_quality"],
        scope_expansion_revenue=parse_number(data.get("scope_expansion_revenue")),
        currency=data.get("currency"),
    )

    # Raw survey strings needed by downstream aggregators (scaling gates).
    # Keep them on the metric dict so compute_scaling_gates doesn't have to
    # re-open the response table.
    raw_strings = {
        key: data.get(key) for key in (
            "d2_knowledge_reuse", "f2_productization", "g1_reuse_intent",
            "c6_self_assessment", "e1_client_decision", "b5_ai_survival",
            "revision_depth", "xcsg_revision_rounds", "xcsg_scope_expansion",
            "client_pulse",
        )
    }

    return {
        "id": data.get("id"),
        "project_id": data.get("id"),
        "project_name": data.get("project_name", ""),
        "category_name": data.get("category_name", data.get("project_category", "")),
        "practice_code": data.get("practice_code"),
        "practice_name": data.get("practice_name"),
        "pioneer_name": data.get("pioneer_name", ""),
        "client_name": data.get("client_name"),
        "created_at": data.get("created_at", ""),
        "has_expert_response": data.get("project_id") is not None or data.get("b1_starting_point") is not None,
        "outcome_rate_xcsg": None,
        "outcome_rate_legacy": None,
        "legacy_overridden": bool(data.get("legacy_overridden", 0)),
        **raw_strings,
        **effort, **quality, **smoothness, **flywheel, **signals,
        **economics,
        "xcsg_pricing_model": data.get("xcsg_pricing_model"),
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
    # Accept pre-computed metrics dicts (from averaged computation) or raw project dicts
    metrics_list = []
    for project in complete_projects:
        if "delivery_speed" in project and "machine_first_score" in project:
            metrics_list.append(project)  # already computed
        else:
            metrics_list.append(compute_project_metrics(project))
    deliverable_types = {project.get("deliverable_type") or project.get("category_name") for project in complete_projects if project.get("deliverable_type") or project.get("category_name")}
    avg_effort = average([m["effort_ratio"] for m in metrics_list])
    reuse_rate = round2((sum(1 for m in metrics_list if m["reuse_intent_score"] == 1.0) / len(metrics_list)) * 100) if metrics_list else None
    d2_reuse_rate = round2((sum(1 for project in complete_projects if coalesce(project, "d2_knowledge_reuse_xcsg", "d2_knowledge_reuse") == "Yes directly reused and extended") / len(complete_projects)) * 100) if complete_projects else None
    client_invisible_quality = any(
        coalesce(project, "xcsg_revision_depth", "c4_revision_depth", "revision_depth", "xcsg_revision_rounds") in {"No revisions needed", "Cosmetic only", "0", "1", 0, 1}
        and project.get("client_pulse") != "Below expectations"
        for project in complete_projects
    )
    # Transferability: F2 productization rate + cross-category pioneer count
    f2_yes_count = sum(1 for project in complete_projects if coalesce(project, "f2_productization") in {"Yes largely as-is", "Yes with moderate customization"})
    f2_total = sum(1 for project in complete_projects if coalesce(project, "f2_productization") is not None)
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
    def _get_advantage(p):
        if "xcsg_advantage" in p:
            return p["xcsg_advantage"]
        return compute_project_metrics(p)["xcsg_advantage"]
    flywheel_first_avg = average([_get_advantage(p) for p in flywheel_first]) if flywheel_first else None
    flywheel_recent_avg = average([_get_advantage(p) for p in flywheel_recent]) if flywheel_recent else None
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
    # Accept pre-computed metrics dicts (from averaged computation) or raw project dicts
    metrics_list = []
    for project in complete_projects:
        if "delivery_speed" in project and "machine_first_score" in project:
            metrics_list.append(project)  # already computed
        else:
            metrics_list.append(compute_project_metrics(project))
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

    # Schedule-variance aggregates over *all* projects with both expected & actual dates.
    # Independent of expert completion — a project can be delivered before its survey is done.
    schedule_series = []
    for project in all_projects:
        delta = compute_schedule_delta(project.get("date_expected_delivered"), project.get("date_delivered"))
        if delta is None:
            continue
        schedule_series.append({
            "project_id": project.get("id"),
            "project_name": project.get("project_name"),
            "category_name": project.get("category_name"),
            "practice_code": project.get("practice_code"),
            "practice_name": project.get("practice_name"),
            "delta_days": delta,
            "date_expected_delivered": project.get("date_expected_delivered"),
            "date_delivered": project.get("date_delivered"),
        })
    schedule_tracked = len(schedule_series)
    on_time_count = sum(1 for s in schedule_series if s["delta_days"] <= 0)
    on_time_pct = round2((on_time_count / schedule_tracked) * 100) if schedule_tracked else None
    avg_schedule_delta_days = round2(sum(s["delta_days"] for s in schedule_series) / schedule_tracked) if schedule_tracked else None

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
        "average_productivity_ratio": average_advantage,  # alias: productivity_ratio == xcsg_advantage
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
        "on_time_pct": on_time_pct,
        "avg_schedule_delta_days": avg_schedule_delta_days,
        "schedule_tracked_count": schedule_tracked,
        "schedule_on_time_count": on_time_count,
        "schedule_series": schedule_series,
        "checkpoint": determine_checkpoint(completed_count),
        "projects_to_next_checkpoint": projects_to_next_checkpoint(completed_count),
        "scaling_gates": scaling_gates,
        "scaling_gates_passed": sum(1 for g in scaling_gates if g["status"] == "pass"),
        "scaling_gates_total": len(scaling_gates),
    }



def compute_summary(complete_projects: list, total_projects: list) -> dict:
    return compute_dashboard_metrics(complete_projects, total_projects)



def compute_trend_data(complete_projects: list) -> list:
    result = []
    for project in complete_projects:
        if "delivery_speed" in project and "machine_first_score" in project:
            result.append(project)
        else:
            result.append(compute_project_metrics(project))
    return result



def compute_averaged_project_metrics(project: dict, responses: list[dict]) -> dict:
    """Compute project metrics averaged across all pioneer responses.

    - 0 responses: returns metrics from project data alone (no expert fields).
    - 1 response: merges response into project and computes normally (v1.0 behaviour).
    - N responses: computes metrics for each merged dict and averages numeric fields.
    """
    if not responses:
        return compute_project_metrics(project)

    if len(responses) == 1:
        merged = dict(project)
        merged.update(dict(responses[0]))
        return compute_project_metrics(merged)

    # Multiple responses — average numeric metric fields across all pioneers.
    numeric_keys = [
        "calendar_days", "xcsg_person_days", "legacy_person_days",
        "effort_ratio", "delivery_speed", "quality_score", "quality_ratio",
        "output_quality", "legacy_quality", "legacy_quality_score",
        "xcsg_smoothness", "legacy_smoothness", "rework_efficiency",
        "productivity_ratio", "xcsg_advantage", "value_multiplier",
        "outcome_rate_ratio", "xcsg_quality_per_day", "legacy_quality_per_day",
        "machine_first_score", "senior_led_score", "proprietary_knowledge_score",
        "overall_xcsg_score", "client_impact", "data_independence",
        "ai_survival_rate", "reuse_intent_score", "client_pulse_score",
        "revenue_productivity_xcsg", "revenue_productivity_legacy",
        "xcsg_blended_rate",
        "xcsg_cost",
        "legacy_cost",
        "xcsg_margin",
        "legacy_margin",
        "xcsg_margin_pct",
        "legacy_margin_pct",
        "margin_gain",
        "revenue_per_day_xcsg",
        "revenue_per_day_legacy",
        "revenue_per_day_gain",
        "cost_per_quality_point_xcsg",
        "cost_per_quality_point_legacy",
        "cost_per_quality_point_gain",
    ]

    per_response_metrics = []
    for response in responses:
        merged = dict(project)
        merged.update(dict(response))
        per_response_metrics.append(compute_project_metrics(merged))

    # Start with the first result as a base (preserves non-numeric fields).
    result = dict(per_response_metrics[0])

    for key in numeric_keys:
        values = [m.get(key) for m in per_response_metrics]
        result[key] = average(values)

    return result
