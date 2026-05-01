"""Portfolio-level economics aggregator (PR1 of Dashboard Economics).

Pure functions that take pre-computed per-project metrics dicts (the same
shape produced by app._build_averaged_complete_projects) plus an FX rate
table and base currency. No DB access — composes naturally with whatever
filtering the caller has already applied.

A project "qualifies" for portfolio sums when:
    status == 'complete'
    AND engagement_revenue is not None
    AND legacy_team is non-empty
    AND xcsg_person_days is not None

Non-qualifying projects are excluded from sums but still counted in
total_complete_count so the user sees the denominator.

If a project's currency has no FX rate (rate == 0 or missing), it is
excluded from normalized totals and the code is reported in
currencies_missing_fx so the frontend can render a caveat banner.
"""
from typing import Optional


def _project_qualifies(p: dict) -> bool:
    return (
        p.get("status") == "complete"
        and p.get("engagement_revenue") is not None
        and bool(p.get("legacy_team"))
        and p.get("xcsg_person_days") is not None
    )


def _fx(rate_dict: dict, currency: Optional[str]) -> Optional[float]:
    """Return the rate for currency, or None if missing/zero."""
    if not currency:
        return None
    rate = rate_dict.get(currency)
    if rate is None or rate <= 0:
        return None
    return rate


def _round2(v: Optional[float]) -> Optional[float]:
    return round(v, 2) if v is not None else None


def compute_economics_summary(
    projects: list[dict],
    fx_rates: dict[str, float],
    base_currency: str,
) -> dict:
    """Return the 6 hero tile values + caveat metadata."""
    total_complete = sum(1 for p in projects if p.get("status") == "complete")
    qualifying = [p for p in projects if _project_qualifies(p)]

    total_revenue = 0.0
    total_xcsg_cost = 0.0
    total_legacy_cost = 0.0
    total_cost_saved = 0.0
    margin_pcts: list[float] = []
    rev_per_days: list[float] = []
    counted = 0
    missing_fx: set[str] = set()

    for p in qualifying:
        currency = p.get("currency")
        rate = _fx(fx_rates, currency)
        if rate is None:
            if currency:
                missing_fx.add(currency)
            continue

        revenue = p["engagement_revenue"] * rate
        xcsg_cost = (p.get("xcsg_cost") or 0.0) * rate
        legacy_cost = (p.get("legacy_cost") or 0.0) * rate
        total_revenue += revenue
        total_xcsg_cost += xcsg_cost
        total_legacy_cost += legacy_cost
        total_cost_saved += (legacy_cost - xcsg_cost)
        if p.get("xcsg_margin_pct") is not None:
            margin_pcts.append(p["xcsg_margin_pct"])
        if p.get("revenue_per_day_xcsg") is not None:
            rev_per_days.append(p["revenue_per_day_xcsg"] * rate)
        counted += 1

    avg_margin_pct = round(sum(margin_pcts) / len(margin_pcts), 4) if margin_pcts else None
    avg_rev_per_day = _round2(sum(rev_per_days) / len(rev_per_days)) if rev_per_days else None
    cost_ratio = round(total_xcsg_cost / total_legacy_cost, 4) if total_legacy_cost > 0 else None

    return {
        "total_revenue": _round2(total_revenue) or 0.0,
        "total_cost_saved": _round2(total_cost_saved) or 0.0,
        "avg_margin_pct": avg_margin_pct,
        "avg_revenue_per_day_xcsg": avg_rev_per_day,
        "cost_ratio": cost_ratio,
        "qualifying_project_count": counted,
        "total_complete_count": total_complete,
        "base_currency": base_currency,
        "currencies_missing_fx": sorted(missing_fx),
    }
