"""
metrics.py — Computed metrics for xCSG Value Tracker.

Phase 2 metrics are derived from project delivery data plus expert assessment
responses stored in expert_responses.
"""
from __future__ import annotations

from typing import Optional

# ── Project delivery mappings ────────────────────────────────────────────────

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

# ── Expert assessment option-to-score mapping (canonical labels from app.py) ─

OPTION_SCORES = {
    "b1_starting_point": {
        "Raw request": 1,
        "Light brief": 2,
        "Structured brief": 3,
        "Hypothesis": 4,
        "Full hypothesis deck": 5,
    },
    "b2_research_sources": {
        "General web": 1,
        "Industry databases": 2,
        "Proprietary database": 3,
        "Internal knowledge base": 4,
        "Synthesized firm knowledge": 5,
    },
    "b3_assembly_ratio": {
        ">80% manual": 1,
        "60-80%": 2,
        "40-60%": 3,
        "20-40%": 4,
        "<20% manual": 5,
    },
    "b4_hypothesis_first": {
        "Exploratory": 1,
        "Mostly exploratory": 2,
        "Balanced": 3,
        "Mostly hypothesis-led": 4,
        "Fully hypothesis-led": 5,
    },
    "c1_specialization": {
        "Generalist": 1,
        "Mixed": 2,
        "Specialist": 3,
        "Deep specialist": 4,
        "World-class expert": 5,
    },
    "c2_directness": {
        "Delegated": 1,
        "Partially delegated": 2,
        "Shared": 3,
        "Hands-on": 4,
        "Personally leading": 5,
    },
    "c3_judgment_pct": {
        "<20%": 1,
        "20-40%": 2,
        "40-60%": 3,
        "60-80%": 4,
        ">80%": 5,
    },
    "d1_proprietary_data": {
        "None": 1,
        "Public data": 2,
        "Some proprietary": 3,
        "Mostly proprietary": 4,
        "Fully proprietary": 5,
    },
    "d2_knowledge_reuse": {
        "One-time": 1,
        "Some reuse": 2,
        "Moderate": 3,
        "High": 4,
        "Maximum": 5,
    },
    "d3_moat_test": {
        "Easily replicable": 1,
        "Somewhat": 2,
        "Moderately unique": 3,
        "Highly unique": 4,
        "Impossible to replicate": 5,
    },
    "f1_feasibility": {
        "Not assessed": 1,
        "Basic": 2,
        "Standard": 3,
        "Comprehensive": 4,
        "Exceeds requirements": 5,
    },
    "f2_productization": {
        "None": 1,
        "Identified": 2,
        "Designed": 3,
        "Implemented": 4,
        "Scaled": 5,
    },
}

MACHINE_FIRST_FIELDS = [
    ("b1_starting_point_xcsg", OPTION_SCORES["b1_starting_point"]),
    ("b2_research_sources_xcsg", OPTION_SCORES["b2_research_sources"]),
    ("b3_assembly_ratio_xcsg", OPTION_SCORES["b3_assembly_ratio"]),
    ("b4_hypothesis_first_xcsg", OPTION_SCORES["b4_hypothesis_first"]),
]

SENIOR_LED_FIELDS = [
    ("c1_specialization", OPTION_SCORES["c1_specialization"]),
    ("c2_directness", OPTION_SCORES["c2_directness"]),
    ("c3_judgment_pct", OPTION_SCORES["c3_judgment_pct"]),
]

PROPRIETARY_KNOWLEDGE_FIELDS = [
    ("d1_proprietary_data_xcsg", OPTION_SCORES["d1_proprietary_data"]),
    ("d2_knowledge_reuse_xcsg", OPTION_SCORES["d2_knowledge_reuse"]),
    ("d3_moat_test_xcsg", OPTION_SCORES["d3_moat_test"]),
]

VALUE_CREATION_FIELDS = [
    ("f1_feasibility_xcsg", OPTION_SCORES["f1_feasibility"]),
    ("f2_productization_xcsg", OPTION_SCORES["f2_productization"]),
]


# ── Generic helpers ──────────────────────────────────────────────────────────


def round2(value: float) -> float:
    return round(value, 2)


def parse_days(value: Optional[str]) -> Optional[float]:
    if not value:
        return None
    return DAYS_MIDPOINTS.get(value)


def parse_team_size(value: Optional[str]) -> Optional[float]:
    if not value:
        return None
    return TEAM_MIDPOINTS.get(value)


def parse_revisions(value: Optional[str]) -> Optional[float]:
    if not value:
        return None
    return REVISION_NUMBERS.get(value)


def average(values: list[Optional[float]]) -> Optional[float]:
    present = [float(v) for v in values if v is not None]
    if not present:
        return None
    return round2(sum(present) / len(present))


def safe_divide(numerator: Optional[float], denominator: Optional[float]) -> Optional[float]:
    if numerator is None or denominator in (None, 0):
        return None
    return round2(numerator / denominator)


def score_value(value: Optional[str], mapping: dict[str, int]) -> Optional[float]:
    if not value:
        return None
    score = mapping.get(value)
    return float(score) if score is not None else None


def average_scored_fields(data: dict, field_mappings: list[tuple[str, dict[str, int]]]) -> Optional[float]:
    return average([score_value(data.get(field), mapping) for field, mapping in field_mappings])


# ── Per-project metrics ──────────────────────────────────────────────────────


def compute_person_days(calendar_days: Optional[str], team_size: Optional[str]) -> Optional[float]:
    days = parse_days(calendar_days)
    team = parse_team_size(team_size)
    if days is None or team is None:
        return None
    return round2(days * team)


def compute_machine_first_score(data: dict) -> Optional[float]:
    return average_scored_fields(data, MACHINE_FIRST_FIELDS)


def compute_senior_led_score(data: dict) -> Optional[float]:
    return average_scored_fields(data, SENIOR_LED_FIELDS)


def compute_proprietary_knowledge_score(data: dict) -> Optional[float]:
    return average_scored_fields(data, PROPRIETARY_KNOWLEDGE_FIELDS)


def compute_value_creation_score(data: dict) -> Optional[float]:
    return average_scored_fields(data, VALUE_CREATION_FIELDS)


def compute_overall_xcsg_score(data: dict) -> Optional[float]:
    return average([
        compute_machine_first_score(data),
        compute_senior_led_score(data),
        compute_proprietary_knowledge_score(data),
        compute_value_creation_score(data),
    ])


def compute_project_metrics(data: dict) -> dict:
    xcsg_person_days = compute_person_days(data.get("xcsg_calendar_days"), data.get("xcsg_team_size"))
    legacy_person_days = compute_person_days(data.get("legacy_calendar_days"), data.get("legacy_team_size"))

    xcsg_revisions = parse_revisions(data.get("xcsg_revision_rounds"))
    legacy_revisions = parse_revisions(data.get("legacy_revision_rounds"))

    effort_ratio = safe_divide(legacy_person_days, xcsg_person_days)
    quality_ratio = safe_divide(legacy_revisions, xcsg_revisions)
    value_multiplier = (
        round2(effort_ratio * quality_ratio)
        if effort_ratio is not None and quality_ratio is not None
        else None
    )

    machine_first_score = compute_machine_first_score(data)
    senior_led_score = compute_senior_led_score(data)
    proprietary_knowledge_score = compute_proprietary_knowledge_score(data)
    value_creation_score = compute_value_creation_score(data)
    overall_xcsg_score = compute_overall_xcsg_score(data)

    senior_hours = data.get("c4_senior_hours")
    senior_days = round2(float(senior_hours) / 8.0) if senior_hours is not None else None

    return {
        "id": data.get("id"),
        "project_id": data.get("id"),
        "project_name": data.get("project_name", ""),
        "category_name": data.get("category_name", ""),
        "pioneer_name": data.get("pioneer_name", ""),
        "client_name": data.get("client_name"),
        "created_at": data.get("created_at", ""),
        "has_expert_response": any(
            data.get(field) is not None for field, _ in MACHINE_FIRST_FIELDS + SENIOR_LED_FIELDS + PROPRIETARY_KNOWLEDGE_FIELDS + VALUE_CREATION_FIELDS
        ),
        "xcsg_person_days": xcsg_person_days,
        "legacy_person_days": legacy_person_days,
        "effort_ratio": effort_ratio,
        "xcsg_revisions": xcsg_revisions,
        "legacy_revisions": legacy_revisions,
        "quality_ratio": quality_ratio,
        "value_multiplier": value_multiplier,
        "machine_first_score": machine_first_score,
        "senior_led_score": senior_led_score,
        "proprietary_knowledge_score": proprietary_knowledge_score,
        "value_creation_score": value_creation_score,
        "overall_xcsg_score": overall_xcsg_score,
        "xcsg_senior_hours": float(senior_hours) if senior_hours is not None else None,
        "xcsg_senior_days": senior_days,
        "xcsg_junior_hours": float(data.get("c5_junior_hours")) if data.get("c5_junior_hours") is not None else None,
        "legacy_overridden": bool(data.get("legacy_overridden", 0)),
    }


# ── Portfolio metrics ────────────────────────────────────────────────────────


def determine_checkpoint(completed_projects: int) -> int:
    if completed_projects >= 20:
        return 4
    if completed_projects >= 10:
        return 3
    if completed_projects >= 5:
        return 2
    return 1


def projects_to_next_checkpoint(completed_projects: int) -> int:
    if completed_projects >= 20:
        return 0
    if completed_projects >= 10:
        return 20 - completed_projects
    if completed_projects >= 5:
        return 10 - completed_projects
    return 5 - completed_projects


def compute_scaling_gates(complete_projects: list[dict]) -> list[dict]:
    metrics_list = [compute_project_metrics(project) for project in complete_projects]
    completed_count = len(metrics_list)

    multipliers = [m["value_multiplier"] for m in metrics_list if m["value_multiplier"] is not None]
    high_multiplier_rate = (
        (sum(1 for value in multipliers if value > 2.0) / len(multipliers))
        if multipliers else None
    )

    machine_first_avg = average([m["machine_first_score"] for m in metrics_list])
    senior_led_avg = average([m["senior_led_score"] for m in metrics_list])
    knowledge_avg = average([m["proprietary_knowledge_score"] for m in metrics_list])
    avg_effort_ratio = average([m["effort_ratio"] for m in metrics_list])

    senior_leverage_checks = [
        m for m in metrics_list
        if m["senior_led_score"] is not None and m["xcsg_senior_days"] is not None and m["legacy_person_days"] is not None
    ]
    senior_time_ok = (
        all((m["xcsg_senior_days"] or 0) <= (m["legacy_person_days"] or 0) for m in senior_leverage_checks)
        if senior_leverage_checks else None
    )

    return [
        {
            "id": 1,
            "name": "Value consistency",
            "description": "≥80% of completed projects exceed 2× value multiplier",
            "status": "pass" if high_multiplier_rate is not None and high_multiplier_rate >= 0.8 else "pending",
            "detail": (
                f"{round(high_multiplier_rate * 100)}% of projects >2× multiplier"
                if high_multiplier_rate is not None else "Not enough completed projects"
            ),
        },
        {
            "id": 2,
            "name": "Machine-first maturity",
            "description": "Average B1-B4 score ≥ 3.5",
            "status": "pass" if machine_first_avg is not None and machine_first_avg >= 3.5 else "pending",
            "detail": f"Average machine-first score: {machine_first_avg}" if machine_first_avg is not None else "No machine-first scores yet",
        },
        {
            "id": 3,
            "name": "Senior leverage",
            "description": "Average C1-C3 score ≥ 3.5 and senior time ≤ legacy effort",
            "status": "pass" if senior_led_avg is not None and senior_led_avg >= 3.5 and senior_time_ok is True else "pending",
            "detail": (
                f"Average senior-led score: {senior_led_avg}, senior time within legacy effort"
                if senior_led_avg is not None and senior_time_ok is True
                else f"Average senior-led score: {senior_led_avg}, senior time check: {senior_time_ok}"
                if senior_led_avg is not None else "No senior-led scores yet"
            ),
        },
        {
            "id": 4,
            "name": "Knowledge flywheel",
            "description": "Average D1-D3 score ≥ 3.0",
            "status": "pass" if knowledge_avg is not None and knowledge_avg >= 3.0 else "pending",
            "detail": f"Average proprietary knowledge score: {knowledge_avg}" if knowledge_avg is not None else "No proprietary knowledge scores yet",
        },
        {
            "id": 5,
            "name": "Margin improvement",
            "description": "Average effort ratio is positive (>1.0)",
            "status": "pass" if avg_effort_ratio is not None and avg_effort_ratio > 1.0 else "pending",
            "detail": f"Average effort ratio: {avg_effort_ratio}×" if avg_effort_ratio is not None else "No effort ratios yet",
        },
    ]


def compute_dashboard_metrics(complete_projects: list[dict], all_projects: list[dict]) -> dict:
    metrics_list = [compute_project_metrics(project) for project in complete_projects]
    completed_count = len(metrics_list)
    total_count = len(all_projects)

    average_value_multiplier = average([m["value_multiplier"] for m in metrics_list]) or 0.0
    average_effort_ratio = average([m["effort_ratio"] for m in metrics_list]) or 0.0
    average_quality_ratio = average([m["quality_ratio"] for m in metrics_list]) or 0.0
    machine_first_avg = average([m["machine_first_score"] for m in metrics_list]) or 0.0
    senior_led_avg = average([m["senior_led_score"] for m in metrics_list]) or 0.0
    proprietary_knowledge_avg = average([m["proprietary_knowledge_score"] for m in metrics_list]) or 0.0
    value_creation_avg = average([m["value_creation_score"] for m in metrics_list]) or 0.0
    overall_xcsg_avg = average([m["overall_xcsg_score"] for m in metrics_list]) or 0.0

    flywheel_components: list[Optional[float]] = []
    for metric in metrics_list:
        flywheel_components.extend([
            metric["machine_first_score"],
            metric["senior_led_score"],
            metric["proprietary_knowledge_score"],
        ])
    flywheel_health = average(flywheel_components) or 0.0

    scaling_gates = compute_scaling_gates(complete_projects)
    passed_gates = sum(1 for gate in scaling_gates if gate["status"] == "pass")

    return {
        "total_projects": total_count,
        "projects_completed": completed_count,
        "complete_projects": completed_count,
        "pending_projects": max(total_count - completed_count, 0),
        "average_value_multiplier": average_value_multiplier,
        "average_effort_ratio": average_effort_ratio,
        "average_quality_ratio": average_quality_ratio,
        "flywheel_health": flywheel_health,
        "machine_first_avg": machine_first_avg,
        "senior_led_avg": senior_led_avg,
        "proprietary_knowledge_avg": proprietary_knowledge_avg,
        "value_creation_avg": value_creation_avg,
        "overall_xcsg_avg": overall_xcsg_avg,
        "checkpoint": determine_checkpoint(completed_count),
        "projects_to_next_checkpoint": projects_to_next_checkpoint(completed_count),
        "scaling_gates": scaling_gates,
        "scaling_gates_passed": passed_gates,
        "scaling_gates_total": len(scaling_gates),
    }


# ── Backward-compatible wrappers ─────────────────────────────────────────────


def compute_summary(complete_projects: list, total_projects: list) -> dict:
    return compute_dashboard_metrics(complete_projects, total_projects)


def compute_trend_data(complete_projects: list) -> list:
    return [compute_project_metrics(project) for project in complete_projects]
