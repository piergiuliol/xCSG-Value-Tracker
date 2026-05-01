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


def compute_economics_breakdowns(
    projects: list[dict],
    fx_rates: dict[str, float],
    base_currency: str,
) -> dict:
    """Group qualifying projects by practice / pioneer / currency / pricing model.

    Pioneer attribution is full-revenue (each pioneer on a project gets the
    project's full revenue) — matches the existing By Pioneer chart.
    Currency breakdown uses NATIVE amounts (not normalized).
    """
    qualifying = [p for p in projects if _project_qualifies(p)]

    by_practice: dict[str, dict] = {}
    by_pioneer: dict[int, dict] = {}
    by_currency: dict[str, dict] = {}
    by_pricing_model: dict[str, dict] = {}

    for p in qualifying:
        currency = p.get("currency")
        rate = _fx(fx_rates, currency)
        revenue_native = p["engagement_revenue"]

        # By currency uses NATIVE amounts (purpose: show source-of-funds mix).
        if currency:
            entry = by_currency.setdefault(currency, {
                "code": currency, "native_revenue": 0.0, "n_projects": 0,
            })
            entry["native_revenue"] += revenue_native
            entry["n_projects"] += 1

        # The remaining breakdowns need a normalized rate.
        if rate is None:
            continue
        revenue = revenue_native * rate
        cost_saved = ((p.get("legacy_cost") or 0.0) - (p.get("xcsg_cost") or 0.0)) * rate
        margin_pct = p.get("xcsg_margin_pct")

        # By practice
        practice_code = p.get("practice_code") or "—"
        prac = by_practice.setdefault(practice_code, {
            "practice_code": practice_code, "revenue": 0.0, "cost_saved": 0.0,
            "margin_pcts": [], "n": 0,
        })
        prac["revenue"] += revenue
        prac["cost_saved"] += cost_saved
        if margin_pct is not None:
            prac["margin_pcts"].append(margin_pct)
        prac["n"] += 1

        # By pioneer (each contributes full project revenue)
        ids = p.get("pioneer_ids") or []
        names = p.get("pioneer_display_names") or []
        for i, pid in enumerate(ids):
            display = names[i] if i < len(names) else f"#{pid}"
            ent = by_pioneer.setdefault(pid, {
                "pioneer_id": pid, "display_name": display,
                "revenue": 0.0, "cost_saved": 0.0, "n": 0,
            })
            ent["revenue"] += revenue
            ent["cost_saved"] += cost_saved
            ent["n"] += 1

        # By pricing model
        model = p.get("xcsg_pricing_model") or "—"
        pm = by_pricing_model.setdefault(model, {
            "model": model, "revenue": 0.0, "n": 0,
        })
        pm["revenue"] += revenue
        pm["n"] += 1

    # Finalize: round numerics and compute avg_margin_pct per practice.
    practice_out = []
    for v in sorted(by_practice.values(), key=lambda x: -x["revenue"]):
        avg_pct = round(sum(v["margin_pcts"]) / len(v["margin_pcts"]), 4) if v["margin_pcts"] else None
        practice_out.append({
            "practice_code": v["practice_code"],
            "revenue": _round2(v["revenue"]),
            "cost_saved": _round2(v["cost_saved"]),
            "margin_pct": avg_pct,
            "n": v["n"],
        })

    pioneer_out = sorted(
        [{"pioneer_id": v["pioneer_id"], "display_name": v["display_name"],
          "revenue": _round2(v["revenue"]), "cost_saved": _round2(v["cost_saved"]),
          "n": v["n"]}
         for v in by_pioneer.values()],
        key=lambda x: -x["revenue"],
    )

    currency_out = sorted(
        [{"code": v["code"], "native_revenue": _round2(v["native_revenue"]),
          "n_projects": v["n_projects"]}
         for v in by_currency.values()],
        key=lambda x: x["code"],
    )

    pricing_out = sorted(
        [{"model": v["model"], "revenue": _round2(v["revenue"]), "n": v["n"]}
         for v in by_pricing_model.values()],
        key=lambda x: -x["revenue"],
    )

    return {
        "by_practice": practice_out,
        "by_pioneer": pioneer_out,
        "by_currency": currency_out,
        "by_pricing_model": pricing_out,
    }


def _quarter_label(date_str: Optional[str]) -> Optional[str]:
    """'2026-02-15' → '2026-Q1'. Returns None if date is missing/malformed."""
    if not date_str:
        return None
    try:
        year, month, _ = date_str.split("-", 2)
        q = (int(month) - 1) // 3 + 1
        return f"{year}-Q{q}"
    except (ValueError, AttributeError):
        return None


def compute_economics_trends(
    projects: list[dict],
    fx_rates: dict[str, float],
    base_currency: str,
) -> dict:
    """Bucket qualifying projects by date_delivered quarter; normalize to base."""
    qualifying = [p for p in projects if _project_qualifies(p)]

    buckets: dict[str, dict] = {}
    for p in qualifying:
        q = _quarter_label(p.get("date_delivered"))
        if not q:
            continue
        rate = _fx(fx_rates, p.get("currency"))
        if rate is None:
            continue

        revenue = p["engagement_revenue"] * rate
        cost_saved = ((p.get("legacy_cost") or 0.0) - (p.get("xcsg_cost") or 0.0)) * rate
        rev_per_xcsg = (p.get("revenue_per_day_xcsg") or 0.0) * rate if p.get("revenue_per_day_xcsg") is not None else None
        rev_per_legacy = (p.get("revenue_per_day_legacy") or 0.0) * rate if p.get("revenue_per_day_legacy") is not None else None

        ent = buckets.setdefault(q, {
            "quarter": q, "revenue": 0.0, "cost_saved": 0.0,
            "margin_pcts": [], "rev_per_xcsg": [], "rev_per_legacy": [], "n": 0,
        })
        ent["revenue"] += revenue
        ent["cost_saved"] += cost_saved
        if p.get("xcsg_margin_pct") is not None:
            ent["margin_pcts"].append(p["xcsg_margin_pct"])
        if rev_per_xcsg is not None:
            ent["rev_per_xcsg"].append(rev_per_xcsg)
        if rev_per_legacy is not None:
            ent["rev_per_legacy"].append(rev_per_legacy)
        ent["n"] += 1

    quarterly = []
    for q in sorted(buckets.keys()):
        v = buckets[q]
        quarterly.append({
            "quarter": v["quarter"],
            "revenue": _round2(v["revenue"]),
            "cost_saved": _round2(v["cost_saved"]),
            "margin_pct": round(sum(v["margin_pcts"]) / len(v["margin_pcts"]), 4) if v["margin_pcts"] else None,
            "revenue_per_day_xcsg": _round2(sum(v["rev_per_xcsg"]) / len(v["rev_per_xcsg"])) if v["rev_per_xcsg"] else None,
            "revenue_per_day_legacy": _round2(sum(v["rev_per_legacy"]) / len(v["rev_per_legacy"])) if v["rev_per_legacy"] else None,
            "n": v["n"],
        })
    return {"quarterly": quarterly}
