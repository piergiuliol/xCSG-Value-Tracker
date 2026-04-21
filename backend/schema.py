"""
schema.py — Single source of truth for all field definitions, scoring weights,
section metadata, and metric definitions. Every other module imports from here.
"""

# ── Section metadata ────────────────────────────────────────────────────────

SECTIONS = {
    "A": {"title": "Context", "desc": "Baseline for like-with-like comparison", "icon": "\U0001F4CB"},
    "B": {"title": "Machine-First Operations", "desc": "How AI-driven was the approach?", "icon": "\U0001F916"},
    "C": {"title": "Senior-Led Operations", "desc": "How deeply was senior expertise involved?", "icon": "\U0001F454"},
    "D": {"title": "Proprietary Knowledge", "desc": "How unique was the knowledge advantage?", "icon": "\U0001F3F0"},
    "E": {"title": "Client Impact", "desc": "Did the work drive a real decision or action?", "icon": "\U0001F4A5"},
    "F": {"title": "Value Creation", "desc": "What value did xCSG create beyond legacy?", "icon": "\U0001F48E"},
    "G": {"title": "Honest Signal", "desc": "Would you reuse this approach?", "icon": "\U0001F4C8"},
    "L": {"title": "Legacy Estimates", "desc": "Estimate traditional delivery performance for this specific deliverable.", "icon": "\U0001F4DD"},
}

# ── Scoring weights per option ──────────────────────────────────────────────
# Each field maps option text -> numeric score (0.0 to 1.0, or None for N/A)

SCORES = {
    "b1_starting_point": {
        "From AI draft": 1.0, "Mixed": 0.5, "From blank page": 0.0,
    },
    "b2_research_sources": {
        "Single source or dataset": 0.25, "A few targeted sources (2-4)": 0.5,
        "Multiple sources across domains (5-10)": 0.75, "Broad systematic synthesis (10+)": 1.0,
        "1-3": 0.25, "4-7": 0.5, "8-12": 0.75, "13+": 1.0,
    },
    "b3_assembly_ratio": {
        ">75% AI": 1.0, "50-75%": 0.75, "25-50%": 0.5, "<25%": 0.25,
    },
    "b4_hypothesis_first": {
        "Hypothesis-first": 1.0, "Hybrid": 0.5, "Discovery-first": 0.0,
    },
    "b5_ai_survival": {
        ">75%": 1.0, "50-75%": 0.75, "25-50%": 0.5, "<25%": 0.25,
        "Did not use AI draft": None,
    },
    "b6_data_analysis_split": {
        "<25% on data": 1.0, "25-50%": 0.75, "50-75%": 0.4, ">75% on data": 0.1,
    },
    "c1_specialization": {
        "Deep specialist": 1.0, "Deep specialist in this TA/methodology": 1.0,
        "Adjacent expertise": 0.5, "Generalist": 0.0,
    },
    "c2_directness": {
        "Expert authored": 1.0, "Expert authored (with AI assist)": 1.0,
        "Expert co-authored": 0.5, "Expert co-authored (shared with team)": 0.5,
        "Expert reviewed only": 0.0,
    },
    "c3_judgment_pct": {
        ">75% judgment": 1.0, "50-75%": 0.75, "25-50%": 0.5, "<25%": 0.25,
    },
    "c6_self_assessment": {
        "Significantly better": 1.0, "Somewhat better": 0.7, "Comparable": 0.4, "Somewhat worse": 0.1,
    },
    "c7_analytical_depth": {
        "Exceptional": 1.0, "Strong": 0.75, "Adequate": 0.4, "Superficial": 0.1,
    },
    "c8_decision_readiness": {
        "Yes without caveats": 1.0, "Yes with minor caveats": 0.7, "Needs significant additional work": 0.2,
    },
    "d1_proprietary_data": {"Yes": 1.0, "No": 0.0},
    "d2_knowledge_reuse": {
        "Yes directly reused and extended": 1.0, "Yes, directly reused and extended": 1.0,
        "Yes provided useful starting context": 0.5, "Yes, provided useful starting context": 0.5,
        "No built from scratch": 0.0, "No, built from scratch": 0.0,
    },
    "d3_moat_test": {
        "No \u2014 proprietary inputs decisive": 1.0,
        "Partially \u2014 they would miss key insights": 0.5,
        "Yes \u2014 all inputs publicly available": 0.0,
    },
    "e1_client_decision": {
        "Yes \u2014 informed a specific decision": 1.0,
        "Yes \u2014 referenced in internal discussions": 0.6,
        "Too early to tell": None,
        "No": 0.1,
    },
    "f1_feasibility": {
        "Not feasible": 1.0, "Feasible but at 2x+ the cost and time": 0.7,
        "Feasible at similar cost": 0.3, "Legacy would have been more effective": 0.0,
    },
    "f2_productization": {
        "Yes largely as-is": 1.0, "Yes with moderate customization": 0.5, "No fully bespoke": 0.0,
    },
    "g1_reuse_intent": {
        "Yes without hesitation": 1.0, "Yes with reservations": 0.5,
        "No \u2014 legacy would have been better": 0.0,
        "No \u2014 legacy would have been worse": 0.0,
    },
    "client_pulse": {
        "Exceeded expectations": 1.0, "Met expectations": 0.6, "Below expectations": 0.1,
    },
    "revision_depth": {
        "No revisions needed": 1.0, "Cosmetic only": 0.85, "Moderate rework": 0.55, "Major rework": 0.2,
    },
    "scope_expansion": {
        "Yes expanded scope": 1.0, "Yes new engagement": 1.0, "Yes": 1.0, "No": 0.0,
    },
}

# ── Expert survey field definitions ─────────────────────────────────────────

EXPERT_FIELDS = {
    # Section B — Machine-First Operations
    "b1_starting_point":      {"label": "Starting point: Did you build from an AI draft or blank page?", "section": "B", "options": ["From AI draft", "Mixed", "From blank page"]},
    "b2_research_sources":    {"label": "How many distinct knowledge sources (databases, prior work, expert inputs, publications) were synthesized?", "section": "B", "options": ["Single source or dataset", "A few targeted sources (2-4)", "Multiple sources across domains (5-10)", "Broad systematic synthesis (10+)"]},
    "b3_assembly_ratio":      {"label": "What % of the final deliverable was AI-assembled vs manual?", "section": "B", "options": [">75% AI", "50-75%", "25-50%", "<25%"]},
    "b4_hypothesis_first":    {"label": "Was the approach hypothesis-led or discovery-first?", "section": "B", "options": ["Hypothesis-first", "Hybrid", "Discovery-first"]},
    "b5_ai_survival":         {"label": "What % of the AI draft survived into the final deliverable?", "section": "B", "options": [">75%", "50-75%", "25-50%", "<25%", "Did not use AI draft"]},
    "b6_data_analysis_split": {"label": "What % of effort went to data sourcing vs analysis/insight?", "section": "B", "options": ["<25% on data", "25-50%", "50-75%", ">75% on data"]},
    # Section C — Senior-Led Operations
    "c1_specialization":      {"label": "What level of domain expertise led this deliverable?", "section": "C", "options": ["Deep specialist", "Adjacent expertise", "Generalist"]},
    "c2_directness":          {"label": "How directly was the senior expert involved?", "section": "C", "options": ["Expert authored", "Expert co-authored", "Expert reviewed only"]},
    "c3_judgment_pct":        {"label": "What % of the final content reflects expert judgment vs data compilation?", "section": "C", "options": [">75% judgment", "50-75%", "25-50%", "<25%"]},
    "c6_self_assessment":     {"label": "How does xCSG output quality compare to traditional?", "section": "C", "options": ["Significantly better", "Somewhat better", "Comparable", "Somewhat worse"]},
    "c7_analytical_depth":    {"label": "Rate the analytical depth of the deliverable.", "section": "C", "options": ["Exceptional", "Strong", "Adequate", "Superficial"]},
    "c8_decision_readiness":  {"label": "Was the deliverable decision-ready for the client?", "section": "C", "options": ["Yes without caveats", "Yes with minor caveats", "Needs significant additional work"]},
    # Section D — Proprietary Knowledge
    "d1_proprietary_data":    {"label": "Did this deliverable use proprietary data or datasets?", "section": "D", "options": ["Yes", "No"]},
    "d2_knowledge_reuse":     {"label": "Did you reuse knowledge, templates, or data assets from prior engagements?", "section": "D", "options": ["Yes directly reused and extended", "Yes provided useful starting context", "No built from scratch"]},
    "d3_moat_test":           {"label": "Could a competitor with public data replicate this deliverable?", "section": "D", "options": ["No \u2014 proprietary inputs decisive", "Partially \u2014 they would miss key insights", "Yes \u2014 all inputs publicly available"]},
    # Section E — Client Impact
    "e1_client_decision":     {"label": "Did the deliverable directly inform a client decision?", "section": "E", "options": ["Yes \u2014 informed a specific decision", "Yes \u2014 referenced in internal discussions", "Too early to tell", "No"]},
    # Section F — Value Creation
    "f1_feasibility":         {"label": "Could this deliverable have been produced without the xCSG approach?", "section": "F", "options": ["Not feasible", "Feasible but at 2x+ the cost and time", "Feasible at similar cost", "Legacy would have been more effective"]},
    "f2_productization":      {"label": "Could this deliverable be reused or productized for similar future engagements?", "section": "F", "options": ["Yes largely as-is", "Yes with moderate customization", "No fully bespoke"]},
    # Section G — Honest Signal
    "g1_reuse_intent":        {"label": "For this type of deliverable, would you choose the xCSG approach again?", "section": "G", "options": ["Yes without hesitation", "Yes with reservations", "No \u2014 legacy would have been better"]},
    # Section L — Legacy Estimates
    "l1_legacy_working_days":      {"label": "How many working days would this deliverable have taken using traditional methods?", "section": "L", "type": "integer"},
    "l2_legacy_team_size":         {"label": "What team size would traditional delivery have required?", "section": "L", "options": ["1", "2", "3", "4+"]},
    "l3_legacy_revision_depth":    {"label": "What level of rework would traditional delivery have needed?", "section": "L", "options": ["No revisions needed", "Cosmetic only", "Moderate rework", "Major rework"]},
    "l4_legacy_scope_expansion":   {"label": "Would the scope have expanded under traditional delivery?", "section": "L", "options": ["Yes", "No"]},
    "l5_legacy_client_reaction":   {"label": "How would the client have reacted to traditional delivery?", "section": "L", "options": ["Exceeded expectations", "Met expectations", "Below expectations"]},
    "l6_legacy_b2_sources":        {"label": "How many knowledge sources would traditional delivery have synthesized?", "section": "L", "options": ["Single source or dataset", "A few targeted sources (2-4)", "Multiple sources across domains (5-10)", "Broad systematic synthesis (10+)"]},
    "l7_legacy_c1_specialization": {"label": "What specialization level would traditional delivery have had?", "section": "L", "options": ["Deep specialist", "Adjacent expertise", "Generalist"]},
    "l8_legacy_c2_directness":     {"label": "How directly would the senior expert have been involved in traditional delivery?", "section": "L", "options": ["Expert authored", "Expert co-authored", "Expert reviewed only"]},
    "l9_legacy_c3_judgment":       {"label": "What % of traditional output would reflect expert judgment?", "section": "L", "options": [">75% judgment", "50-75%", "25-50%", "<25%"]},
    "l10_legacy_d1_proprietary":   {"label": "Would proprietary data have been used in traditional delivery?", "section": "L", "options": ["Yes", "No"]},
    "l11_legacy_d2_reuse":         {"label": "Would prior knowledge assets have been reused in traditional delivery?", "section": "L", "options": ["Yes directly reused and extended", "Yes provided useful starting context", "No built from scratch"]},
    "l12_legacy_d3_moat":          {"label": "Could a competitor replicate the traditional version?", "section": "L", "options": ["No \u2014 proprietary inputs decisive", "Partially \u2014 they would miss key insights", "Yes \u2014 all inputs publicly available"]},
    "l13_legacy_c7_depth":         {"label": "Rate the analytical depth of traditional delivery.", "section": "L", "options": ["Exceptional", "Strong", "Adequate", "Superficial"]},
    "l14_legacy_c8_decision":      {"label": "Would a traditionally-produced version have been decision-ready?", "section": "L", "options": ["Yes without caveats", "Yes with minor caveats", "Needs significant additional work"]},
    "l15_legacy_e1_decision":      {"label": "Would a traditional deliverable have led to the same client decision?", "section": "L", "options": ["Yes \u2014 informed a specific decision", "Yes \u2014 referenced in internal discussions", "Too early to tell", "No"]},
    "l16_legacy_b6_data":          {"label": "What % of time would traditional delivery spend on data sourcing?", "section": "L", "options": ["<25% on data", "25-50%", "50-75%", ">75% on data"]},
}

# Fields that must be filled for a round to be considered "complete" and recorded.
# All scoring-critical fields across B/C/D/E/F/G/L. f2_productization is intentionally
# excluded — it's a forward-looking signal, not a scoring input.
REQUIRED_EXPERT_FIELDS = tuple(
    k for k in EXPERT_FIELDS.keys() if k != "f2_productization"
)


def missing_required_fields(data: dict) -> list:
    """Return the list of REQUIRED_EXPERT_FIELDS whose value in `data` is missing/blank."""
    missing = []
    for key in REQUIRED_EXPERT_FIELDS:
        value = data.get(key)
        if value is None:
            missing.append(key)
            continue
        if isinstance(value, str) and not value.strip():
            missing.append(key)
    return missing

# ── Metric definitions (for KPI tiles, chart tooltips, norms headers) ───────

METRICS = {
    "delivery_speed":              {"label": "Delivery Speed", "format": "ratio", "icon": "\u26A1", "tip": "How much faster xCSG delivers vs legacy. Legacy person-days \u00F7 xCSG person-days. 2\u00D7 = xCSG took half the effort."},
    "output_quality":              {"label": "Output Quality", "format": "ratio", "icon": "\u2B50", "tip": "xCSG output quality \u00F7 legacy quality. Based on analytical depth, decision readiness, and self-assessment. 1.5\u00D7 = 50% better quality."},
    "rework_efficiency":           {"label": "Rework Efficiency", "format": "ratio", "icon": "\U0001F527", "tip": "xCSG revision/rework burden vs legacy. Combines revision depth, scope changes, and client reaction. Higher = smoother delivery."},
    "machine_first_score":         {"label": "Machine-First Gain", "format": "ratio", "icon": "\U0001F916", "tip": "xCSG knowledge synthesis breadth vs legacy. From single-source to broad systematic synthesis. Higher = more automation leverage."},
    "senior_led_score":            {"label": "Senior-Led Gain", "format": "ratio", "icon": "\U0001F454", "tip": "Senior expert involvement in xCSG vs legacy. Averages specialization depth, directness of authorship, and judgment time. Higher = more expert-driven."},
    "proprietary_knowledge_score": {"label": "Knowledge Gain", "format": "ratio", "icon": "\U0001F3F0", "tip": "Proprietary knowledge advantage. Averages proprietary data use, knowledge reuse, and competitive moat vs legacy. Higher = harder to replicate."},
    "client_impact":               {"label": "Client Impact", "format": "ratio", "icon": "\U0001F4A5", "tip": "Did xCSG work drive client decisions more than legacy would have? Ratio of decision influence scores, capped at 10\u00D7."},
    "data_independence":           {"label": "Data Independence", "format": "ratio", "icon": "\U0001F4CA", "tip": "How efficiently xCSG uses data vs legacy. Less time on sourcing, more on analysis. Higher = more insight per data effort."},
    "productivity_ratio":          {"label": "xCSG Value Gain", "format": "ratio", "icon": "\U0001F3AF", "tip": "Quality per person-day: xCSG vs legacy. Higher = more value per unit of effort."},
    "reuse_intent_avg":            {"label": "Reuse Intent", "format": "pct", "icon": "\U0001F504", "tip": "Expert loyalty signal. Would they choose xCSG again? 100% = all said yes without hesitation, 50% = mixed, 0% = all said no."},
    "ai_survival_avg":             {"label": "AI Survival", "format": "pct", "icon": "\U0001F30D", "tip": "How much of the initial AI-generated draft made it into the final deliverable unchanged. Higher = AI produced better starting material."},
    "client_pulse_avg":            {"label": "Client Pulse", "format": "pct", "icon": "\u2764", "tip": "How clients rated the deliverable. 100% = all exceeded expectations, 60% = met expectations, 10% = below."},
}

# ── Dashboard configuration (single source of truth for the frontend) ───────

DASHBOARD_CONFIG = {
    "tabs": [
        {"id": "overview",    "label": "Overview",    "icon": "\U0001F30D"},
        {"id": "trends",      "label": "Trends",      "icon": "\U0001F4C8"},
        {"id": "breakdowns",  "label": "Breakdowns",  "icon": "\U0001F4CA"},
        {"id": "signals",     "label": "Signals & Gates", "icon": "\U0001F680"},
    ],
    "kpi_tiles": [
        # (Each tile draws its label/icon/tooltip/format from METRICS[metric_key])
        # `server_key` is the key in the /api/dashboard/metrics response dict.
        {"tab": "overview", "metric_key": "delivery_speed",              "server_key": "average_effort_ratio"},
        {"tab": "overview", "metric_key": "output_quality",              "server_key": "average_quality_ratio"},
        {"tab": "overview", "metric_key": "rework_efficiency",           "server_key": "rework_efficiency_avg"},
        {"tab": "overview", "metric_key": "machine_first_score",         "server_key": "machine_first_avg"},
        {"tab": "overview", "metric_key": "senior_led_score",            "server_key": "senior_led_avg"},
        {"tab": "overview", "metric_key": "proprietary_knowledge_score", "server_key": "proprietary_knowledge_avg"},
        {"tab": "overview", "metric_key": "client_impact",               "server_key": "client_impact_avg"},
        {"tab": "overview", "metric_key": "data_independence",           "server_key": "data_independence_avg"},
        {"tab": "overview", "metric_key": "reuse_intent_avg",            "server_key": "reuse_intent_avg"},
        {"tab": "overview", "metric_key": "ai_survival_avg",             "server_key": "ai_survival_avg"},
        {"tab": "overview", "metric_key": "client_pulse_avg",            "server_key": "client_pulse_avg"},
        # Synthetic: On-Time Delivery is computed client-side from schedule deltas
        {"tab": "overview", "metric_key": "on_time_delivery_pct", "synthetic": True,
         "label": "On-Time Delivery", "format": "pct", "icon": "⏱",
         "tip": "Proportion of projects delivered on or before their expected date."},
    ],
    "charts": [],      # populated in Task 3
    "thresholds": {
        "radar_axis_cap": 3.0,
        "quarterly_bucket_min_quarters": 6,
        "cohort_min_projects": 3,
        "bar_top_n": 8,
        "metric_tone": {"success_above": 1.5, "blue_above": 1.0, "warning_above": 0.8},
    },
}

# ── Norms column definitions ────────────────────────────────────────────────

NORMS_COLUMNS = [
    {"key": "avg_effort_ratio", "label": "Avg Speed (xCSG/Legacy)", "format": "ratio"},
    {"key": "avg_quality_ratio", "label": "Avg Quality (xCSG/Legacy)", "format": "ratio"},
    {"key": "avg_productivity", "label": "xCSG Value Gain", "format": "ratio"},
    {"key": "completed_surveys", "label": "Completed Surveys", "format": "int"},
    {"key": "total_projects", "label": "Total Projects", "format": "int"},
]

# ── Project status values ──────────────────────────────────────────────────
PROJECT_STATUS_PENDING = "pending"
PROJECT_STATUS_PARTIAL = "partial"
PROJECT_STATUS_COMPLETE = "complete"

# ── Pioneer defaults ───────────────────────────────────────────────────────
DEFAULT_ROUNDS = 1
MAX_ROUNDS_PER_PIONEER = 10
MAX_PIONEERS_PER_PROJECT = 20
SHOW_PREVIOUS_ANSWERS_DEFAULT = False

# ── Monitoring filters ─────────────────────────────────────────────────────
MONITORING_STATUS_OPTIONS = ["pending", "partial", "complete"]

# ── Helper: build the /api/schema response ──────────────────────────────────

def build_schema_response() -> dict:
    return {
        "sections": SECTIONS,
        "fields": {
            key: {
                **defn,
                "scores": SCORES.get(key, {}),
            }
            for key, defn in EXPERT_FIELDS.items()
        },
        "metrics": METRICS,
        "norms_columns": NORMS_COLUMNS,
        "project_statuses": MONITORING_STATUS_OPTIONS,
        "default_rounds": DEFAULT_ROUNDS,
        "max_rounds": MAX_ROUNDS_PER_PIONEER,
        "max_pioneers": MAX_PIONEERS_PER_PROJECT,
    }
