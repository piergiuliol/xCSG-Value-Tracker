"""
takeaways.py — One-sentence, data-driven takeaways for each dashboard chart.

Each function receives the same shape the dashboard endpoints already build:
  * `projects`: list of averaged project metrics dicts (as produced by
    `_build_averaged_complete_projects`). Each item contains flywheel scores,
    `productivity_ratio`, `delivery_speed`, `output_quality`, `client_pulse`,
    `reuse_intent_score`, `schedule_delta_days`, `practice_name`,
    `category_name`, `pioneer_name`, `date_delivered`, etc.
  * `aggregates`: dict from `compute_summary` (average_productivity_ratio,
    machine_first_avg, …).
  * `scaling_gates`: list from `compute_scaling_gates`.

Keep each function small (≤ 20 lines) and guard for empty/sparse data by
returning a short neutral string.
"""
from __future__ import annotations

from collections import defaultdict
from datetime import datetime
from typing import Iterable, Optional

NEUTRAL_EMPTY = "Not enough data yet"


# ── helpers ────────────────────────────────────────────────────────────────

def _fmt_ratio(x: Optional[float]) -> str:
    if x is None:
        return "—"
    return f"{x:.1f}×"


def _pct(n: int, total: int) -> int:
    if not total:
        return 0
    return round(n * 100 / total)


def _quarter_of(date_str: Optional[str]) -> Optional[str]:
    if not date_str:
        return None
    try:
        d = datetime.strptime(date_str[:10], "%Y-%m-%d")
    except (ValueError, TypeError):
        return None
    return f"{d.year}-Q{(d.month - 1) // 3 + 1}"


def _mean(values: Iterable[Optional[float]]) -> Optional[float]:
    vals = [float(v) for v in values if v is not None]
    return sum(vals) / len(vals) if vals else None


def _sorted_by_delivery(projects: list) -> list:
    return sorted(
        projects,
        key=lambda p: (p.get("date_delivered") or p.get("date_started") or ""),
    )


# ── per-chart takeaways ────────────────────────────────────────────────────

def takeaway_scatter_disprove(projects: list, aggregates: dict) -> str:
    if not projects:
        return NEUTRAL_EMPTY
    total = len(projects)
    def passes(p: dict) -> bool:
        pr = p.get("productivity_ratio")
        ds, oq = p.get("delivery_speed"), p.get("output_quality")
        if pr is not None and pr > 1.0:
            return True
        return ds is not None and oq is not None and ds > 1 and oq > 1
    n_pass = sum(1 for p in projects if passes(p))
    return f"{n_pass} of {total} projects validate the thesis"


_RADAR_LABELS = {
    "machine_first_avg": "Machine-First",
    "senior_led_avg": "Senior-Led",
    "proprietary_knowledge_avg": "Knowledge",
    "rework_efficiency_avg": "Rework Efficiency",
    "client_impact_avg": "Client Impact",
    "data_independence_avg": "Data Independence",
}


def takeaway_radar_gains(projects: list, aggregates: dict) -> str:
    if not projects:
        return NEUTRAL_EMPTY
    best_key, best_val = None, None
    for key in _RADAR_LABELS:
        v = aggregates.get(key)
        if v is None or v <= 0:
            continue
        if best_val is None or v > best_val:
            best_key, best_val = key, v
    if best_key is None:
        return NEUTRAL_EMPTY
    return f"{_RADAR_LABELS[best_key]} leads at {_fmt_ratio(best_val)}"


def takeaway_timeline_per_project(projects: list, aggregates: dict) -> str:
    if not projects:
        return NEUTRAL_EMPTY
    ordered = _sorted_by_delivery(projects)
    latest = ordered[-1].get("productivity_ratio")
    rolling = _mean(p.get("productivity_ratio") for p in ordered[-3:])
    if latest is None or rolling is None:
        return NEUTRAL_EMPTY
    return f"Latest Value Gain {_fmt_ratio(latest)} (rolling avg {_fmt_ratio(rolling)})"


def takeaway_timeline_quarterly(projects: list, aggregates: dict) -> str:
    if not projects:
        return NEUTRAL_EMPTY
    buckets: dict = defaultdict(list)
    for p in projects:
        q = _quarter_of(p.get("date_delivered"))
        if q and p.get("productivity_ratio") is not None:
            buckets[q].append(p["productivity_ratio"])
    if len(buckets) == 0:
        return NEUTRAL_EMPTY
    if len(buckets) == 1:
        return "Need 2+ quarters of data"
    ordered = sorted(buckets.items())
    prior = _mean(ordered[-2][1]) or 0.0
    last = _mean(ordered[-1][1]) or 0.0
    if prior == 0:
        return f"Flat Q-o-Q at {_fmt_ratio(last)}"
    pct = round((last - prior) / prior * 100)
    if pct == 0:
        return f"Flat Q-o-Q at {_fmt_ratio(last)}"
    return f"Value Gain {pct:+d}% QoQ"


def takeaway_timeline_cumulative(projects: list, aggregates: dict) -> str:
    if len(projects) < 2:
        return "Need more projects"
    ordered = _sorted_by_delivery(projects)
    first = ordered[0].get("productivity_ratio")
    last_avg = _mean(p.get("productivity_ratio") for p in ordered)
    if first is None or last_avg is None:
        return NEUTRAL_EMPTY
    return f"Running avg: {_fmt_ratio(first)} → {_fmt_ratio(last_avg)}"


def takeaway_cohort_learning_curve(projects: list, aggregates: dict, min_n: int = 1) -> str:
    if not projects:
        return NEUTRAL_EMPTY
    counts: dict = defaultdict(int)
    for p in projects:
        key = p.get("practice_name") or p.get("practice_code") or "Unassigned"
        counts[key] += 1
    qualifying = sum(1 for n in counts.values() if n >= min_n)
    if qualifying == 0:
        return f"No cohort reached {min_n} projects yet"
    return f"{qualifying} practice cohorts with ≥{min_n} projects"


def _top_by_group(projects: list, group_key: str) -> Optional[tuple]:
    grouped: dict = defaultdict(list)
    for p in projects:
        key = p.get(group_key)
        pr = p.get("productivity_ratio")
        if key and pr is not None:
            grouped[key].append(pr)
    if not grouped:
        return None
    best = max(grouped.items(), key=lambda kv: _mean(kv[1]) or 0.0)
    return best[0], _mean(best[1])


def takeaway_bar_by_category(projects: list, aggregates: dict) -> str:
    if not projects:
        return NEUTRAL_EMPTY
    top = _top_by_group(projects, "category_name")
    if not top:
        return NEUTRAL_EMPTY
    return f"{top[0]} leads at {_fmt_ratio(top[1])}"


def takeaway_bar_by_practice(projects: list, aggregates: dict) -> str:
    if not projects:
        return NEUTRAL_EMPTY
    top = _top_by_group(projects, "practice_name")
    if not top:
        return NEUTRAL_EMPTY
    return f"{top[0]} leads at {_fmt_ratio(top[1])}"


def takeaway_bar_by_pioneer(projects: list, aggregates: dict) -> str:
    if not projects:
        return NEUTRAL_EMPTY
    grouped: dict = defaultdict(list)
    for p in projects:
        raw = p.get("pioneer_name") or ""
        first = raw.split(",")[0].strip() if raw else ""
        pr = p.get("productivity_ratio")
        if first and pr is not None:
            grouped[first].append(pr)
    if not grouped:
        return NEUTRAL_EMPTY
    best = max(grouped.items(), key=lambda kv: _mean(kv[1]) or 0.0)
    return f"{best[0]} leads at {_fmt_ratio(_mean(best[1]))}"


def takeaway_heatmap_practice_quarter(projects: list, aggregates: dict) -> str:
    cells: dict = defaultdict(list)
    quarters: set = set()
    for p in projects:
        q = _quarter_of(p.get("date_delivered"))
        prac = p.get("practice_name") or p.get("practice_code")
        pr = p.get("productivity_ratio")
        if q and prac and pr is not None:
            cells[(prac, q)].append(pr)
            quarters.add(q)
    if len(quarters) < 2 or not cells:
        return "Matures with more quarters"
    (top_prac, top_q), vals = max(cells.items(), key=lambda kv: _mean(kv[1]) or 0.0)
    return f"{top_prac} × {top_q} at {_fmt_ratio(_mean(vals))}"


def takeaway_area_category_mix(projects: list, aggregates: dict) -> str:
    per_q: dict = defaultdict(lambda: defaultdict(int))
    quarters: set = set()
    for p in projects:
        q = _quarter_of(p.get("date_delivered"))
        cat = p.get("category_name") or "Unknown"
        if q:
            per_q[q][cat] += 1
            quarters.add(q)
    if len(quarters) < 2:
        return "Matures with more quarters"
    ordered_q = sorted(quarters)
    prior, last = per_q[ordered_q[-2]], per_q[ordered_q[-1]]
    best_cat, best_delta = None, None
    for cat in set(last) | set(prior):
        prev_n = prior.get(cat, 0) or 0
        now_n = last.get(cat, 0) or 0
        delta = (now_n - prev_n) / prev_n * 100 if prev_n else (100.0 if now_n else 0.0)
        if best_delta is None or delta > best_delta:
            best_cat, best_delta = cat, delta
    if best_cat is None:
        return "Matures with more quarters"
    return f"{best_cat} grew {round(best_delta):+d}% QoQ"


def takeaway_donut_client_pulse(projects: list, aggregates: dict) -> str:
    pulses = [p.get("client_pulse") for p in projects if p.get("client_pulse")]
    if not pulses:
        return NEUTRAL_EMPTY
    exceeded = sum(1 for v in pulses if v == "Exceeded expectations")
    return f"{_pct(exceeded, len(pulses))}% exceeded expectations"


def takeaway_donut_reuse_intent(projects: list, aggregates: dict) -> str:
    scored = [p.get("reuse_intent_score") for p in projects if p.get("reuse_intent_score") is not None]
    if not scored:
        return NEUTRAL_EMPTY
    yes = sum(1 for v in scored if v == 1.0)
    return f"{_pct(yes, len(scored))}% would choose xCSG again"


def takeaway_scatter_schedule(projects: list, aggregates: dict) -> str:
    deltas = [p.get("schedule_delta_days") for p in projects if p.get("schedule_delta_days") is not None]
    if not deltas:
        return NEUTRAL_EMPTY
    on_time = sum(1 for d in deltas if d <= 0)
    on_time_pct = _pct(on_time, len(deltas))
    if on_time_pct >= 50:
        return f"{on_time_pct}% delivered on time"
    avg = sum(deltas) / len(deltas)
    label = "early" if avg < 0 else "late"
    return f"Avg {abs(avg):.1f}d {label}"


def takeaway_track_scaling_gates(projects: list, aggregates: dict, scaling_gates: list) -> str:
    if not scaling_gates:
        return NEUTRAL_EMPTY
    passed = sum(1 for g in scaling_gates if g.get("status") == "pass")
    return f"{passed}/{len(scaling_gates)} gates passed"


def takeaway_table_portfolio(projects: list, aggregates: dict, all_projects_count: int) -> str:
    total = all_projects_count
    complete = sum(1 for p in projects if p.get("productivity_ratio") is not None)
    partial = max(len(projects) - complete, 0)
    return f"{total} projects, {complete} complete, {partial} partial"


def takeaway_ranked_list_top(projects: list) -> str:
    done = [p for p in projects if p.get("productivity_ratio") is not None]
    if not done:
        return "Not enough data yet"
    leader = max(done, key=lambda p: p.get("productivity_ratio") or 0)
    name = (leader.get("project_name") or "—")[:30]
    return f'"{name}" leads at {_fmt_ratio(leader["productivity_ratio"])}×'


def takeaway_ranked_list_bottom(projects: list) -> str:
    done = [p for p in projects if p.get("productivity_ratio") is not None]
    if not done:
        return "Not enough data yet"
    trailing = min(done, key=lambda p: p.get("productivity_ratio") or 0)
    name = (trailing.get("project_name") or "—")[:30]
    return f'"{name}" at {_fmt_ratio(trailing["productivity_ratio"])}× — worth review'


def takeaway_timeline_effort(projects: list) -> str:
    """Avg person-days per deliverable, comparing latest quarter to prior."""
    by_q = {}
    for p in projects:
        if not p.get("date_delivered") or not p.get("xcsg_person_days"):
            continue
        q = _quarter_of(p["date_delivered"])
        by_q.setdefault(q, []).append(p["xcsg_person_days"])
    quarters = sorted(by_q.keys())
    if len(quarters) < 2:
        if quarters:
            avg = _mean(by_q[quarters[0]])
            return f"Avg {avg:.1f} person-days / deliverable"
        return "Not enough data yet"
    latest, prior = quarters[-1], quarters[-2]
    latest_avg = _mean(by_q[latest])
    prior_avg = _mean(by_q[prior])
    if prior_avg <= 0:
        return f"Avg {latest_avg:.1f} person-days / deliverable"
    pct = int(round((latest_avg - prior_avg) / prior_avg * 100))
    arrow = "down" if pct < 0 else "up"
    return f"Effort {arrow} {abs(pct)}% QoQ to {latest_avg:.1f} PD/deliverable"


# ── dispatch ──────────────────────────────────────────────────────────────

def compute_takeaways(
    projects: list,
    aggregates: dict,
    scaling_gates: list,
    chart_configs: list,
) -> dict:
    """Return {chart_id: takeaway_string} for each chart in chart_configs.

    Uses DASHBOARD_CONFIG.charts' `type` to dispatch to the right takeaway fn.
    Unknown types return '' (no takeaway).
    """
    cohort_min = 1
    try:
        from backend.schema import DASHBOARD_CONFIG
        cohort_min = int(DASHBOARD_CONFIG.get("thresholds", {}).get("cohort_min_projects", 1))
    except Exception:  # pragma: no cover — defensive
        cohort_min = 1

    total_projects = aggregates.get("total_projects") or len(projects)

    dispatch = {
        "scatter_disprove":        lambda: takeaway_scatter_disprove(projects, aggregates),
        "radar_gains":             lambda: takeaway_radar_gains(projects, aggregates),
        "timeline_per_project":    lambda: takeaway_timeline_per_project(projects, aggregates),
        "timeline_quarterly":      lambda: takeaway_timeline_quarterly(projects, aggregates),
        "timeline_cumulative":     lambda: takeaway_timeline_cumulative(projects, aggregates),
        "cohort_learning_curve":   lambda: takeaway_cohort_learning_curve(projects, aggregates, cohort_min),
        "bar_by_category":         lambda: takeaway_bar_by_category(projects, aggregates),
        "bar_by_practice":         lambda: takeaway_bar_by_practice(projects, aggregates),
        "bar_by_pioneer":          lambda: takeaway_bar_by_pioneer(projects, aggregates),
        "heatmap_practice_quarter":lambda: takeaway_heatmap_practice_quarter(projects, aggregates),
        "area_category_mix":       lambda: takeaway_area_category_mix(projects, aggregates),
        "donut_client_pulse":      lambda: takeaway_donut_client_pulse(projects, aggregates),
        "donut_reuse_intent":      lambda: takeaway_donut_reuse_intent(projects, aggregates),
        "scatter_schedule":        lambda: takeaway_scatter_schedule(projects, aggregates),
        "track_scaling_gates":     lambda: takeaway_track_scaling_gates(projects, aggregates, scaling_gates),
        "table_portfolio":         lambda: takeaway_table_portfolio(projects, aggregates, total_projects),
        "ranked_list_top":         lambda: takeaway_ranked_list_top(projects),
        "ranked_list_bottom":      lambda: takeaway_ranked_list_bottom(projects),
        "timeline_effort":         lambda: takeaway_timeline_effort(projects),
    }

    out: dict = {}
    for cfg in chart_configs:
        cid = cfg.get("id")
        ctype = cfg.get("type")
        if not cid:
            continue
        fn = dispatch.get(ctype)
        try:
            out[cid] = fn() if fn else ""
        except Exception:
            # Never let a single chart's compute error break the whole payload.
            out[cid] = NEUTRAL_EMPTY
    return out
