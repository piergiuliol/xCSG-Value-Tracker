"""
pioneers.py — Pioneer-related CRUD and aggregation helpers for xCSG Value Tracker.

Extracted from database.py to keep the main module manageable. All internal
cross-module imports (database._db, metrics.compute_project_metrics, etc.)
are deferred to function bodies to avoid circular module initialisation.
"""
from typing import Optional


class PioneerInUseError(Exception):
    """Raised when delete_pioneer is called on a pioneer assigned to projects."""
    def __init__(self, pioneer_id: int, project_count: int):
        self.pioneer_id = pioneer_id
        self.project_count = project_count
        super().__init__(
            f"Pioneer {pioneer_id} is assigned to {project_count} project(s); "
            "remove from all projects before deleting."
        )


def create_pioneer(name: str, email: Optional[str], notes: Optional[str],
                   created_by: Optional[int]) -> int:
    """Insert a new pioneer row; return the new id. Email uniqueness enforced
    by the partial index — caller should call find_pioneer_by_email first
    when find-or-create semantics are desired."""
    from backend.database import _db
    with _db() as conn:
        cur = conn.execute(
            """INSERT INTO pioneers (name, email, notes, created_by)
               VALUES (?, ?, ?, ?)""",
            (name.strip(), email.strip() if email else None, notes, created_by),
        )
        conn.commit()
        return cur.lastrowid


def find_pioneer_by_email(email: Optional[str]) -> Optional[dict]:
    """Case-insensitive lookup. Returns the pioneer row as a dict, or None."""
    if not email or not email.strip():
        return None
    from backend.database import _db
    with _db() as conn:
        row = conn.execute(
            """SELECT * FROM pioneers
                WHERE lower(trim(email)) = lower(trim(?))""",
            (email,),
        ).fetchone()
        return dict(row) if row else None


def update_pioneer_record(pioneer_id: int, name: Optional[str] = None,
                          email: Optional[str] = None,
                          notes: Optional[str] = None) -> None:
    """Update only the provided fields. None means 'leave unchanged'."""
    fields = {}
    if name is not None:
        fields["name"] = name.strip()
    if email is not None:
        fields["email"] = email.strip() if email else None
    if notes is not None:
        fields["notes"] = notes
    if not fields:
        return
    from backend.database import _db
    with _db() as conn:
        cols = ", ".join(f"{k} = ?" for k in fields)
        conn.execute(
            f"UPDATE pioneers SET {cols} WHERE id = ?",
            (*fields.values(), pioneer_id),
        )
        conn.commit()


def delete_pioneer(pioneer_id: int) -> None:
    """Hard delete. Raises PioneerInUseError if assigned to any project."""
    from backend.database import _db
    with _db() as conn:
        n = conn.execute(
            "SELECT COUNT(*) AS n FROM project_pioneers WHERE pioneer_id = ?",
            (pioneer_id,),
        ).fetchone()["n"]
        if n > 0:
            raise PioneerInUseError(pioneer_id, n)
        conn.execute("DELETE FROM pioneers WHERE id = ?", (pioneer_id,))
        conn.commit()


def _compute_pioneer_status(rounds_completed: int, rounds_expected: int,
                             oldest_pending_age_days: Optional[int],
                             overdue_threshold_days: int) -> str:
    """Engagement-based status. See spec section 3."""
    if rounds_expected == 0:
        return "never"
    if rounds_completed >= rounds_expected:
        return "completed"
    # Has open rounds.
    if oldest_pending_age_days is not None and oldest_pending_age_days > overdue_threshold_days:
        return "pending_overdue"
    return "pending"


def _get_project_data_for_metrics(project_id: int) -> Optional[dict]:
    """Internal helper for list_pioneers_with_metrics — builds the dict shape
    that compute_project_metrics expects. Re-uses get_project + side queries
    to inject pioneer_day_rates and legacy_team."""
    from backend.database import get_project, get_pioneer_day_rates, list_legacy_team
    proj = get_project(project_id)
    if proj is None:
        return None
    data = dict(proj)
    # Phase 1: pioneer rates.
    data["pioneer_day_rates"] = get_pioneer_day_rates(project_id)
    # Phase 2c: legacy team mix.
    data["legacy_team"] = list_legacy_team(project_id)
    return data


def list_pioneers_with_metrics() -> list[dict]:
    """Return one PioneerSummary-shaped dict per pioneer, with aggregated
    metrics across their project_pioneers rows. Aggregates avg_* over
    *complete* projects only; status is engagement-based."""
    from backend.schema import DASHBOARD_CONFIG
    from backend.database import _db
    overdue_days = DASHBOARD_CONFIG["thresholds"]["pioneer_overdue_days"]

    with _db() as conn:
        # All pioneers.
        pioneers = conn.execute(
            "SELECT id, name, email, notes FROM pioneers ORDER BY name COLLATE NOCASE"
        ).fetchall()
        if not pioneers:
            return []

        # All project_pioneers joined with project + practice metadata,
        # plus per-(project_pioneer) round-completion counts.
        join_rows = conn.execute(
            """SELECT pp.pioneer_id, pp.id AS pp_id, pp.project_id, pp.role_name,
                      pp.day_rate, pp.total_rounds AS expected,
                      p.default_rounds AS project_default_rounds,
                      p.project_name, p.status AS project_status,
                      pr.code AS practice_code,
                      (SELECT COUNT(*) FROM expert_responses er
                         WHERE er.pioneer_id = pp.id AND er.submitted_at IS NOT NULL) AS rounds_done,
                      (SELECT MAX(er2.submitted_at) FROM expert_responses er2
                         WHERE er2.pioneer_id = pp.id) AS last_response_at,
                      (SELECT MIN(prt.issued_at) FROM pioneer_round_tokens prt
                         LEFT JOIN expert_responses er3 ON er3.pioneer_id = prt.pioneer_id
                              AND er3.round_number = prt.round_number
                         WHERE prt.pioneer_id = pp.id AND er3.submitted_at IS NULL) AS oldest_pending_at
                 FROM project_pioneers pp
                 JOIN projects p ON p.id = pp.project_id
            LEFT JOIN practices pr ON pr.id = p.practice_id"""
        ).fetchall()

    # Group by pioneer_id.
    from collections import defaultdict, Counter
    by_pioneer = defaultdict(list)
    for r in join_rows:
        by_pioneer[r["pioneer_id"]].append(dict(r))

    # Per-project metrics for avg computation. Use existing compute helper.
    from backend.metrics import compute_project_metrics
    metrics_by_project: dict[int, dict] = {}
    for pid_set in by_pioneer.values():
        for rec in pid_set:
            proj_id = rec["project_id"]
            if proj_id in metrics_by_project:
                continue
            proj_dict = _get_project_data_for_metrics(proj_id)
            if proj_dict is not None:
                metrics_by_project[proj_id] = compute_project_metrics(proj_dict)

    from datetime import datetime, timezone
    now = datetime.now(timezone.utc).replace(tzinfo=None)

    def _age_days(timestamp_str: Optional[str]) -> Optional[int]:
        if not timestamp_str:
            return None
        try:
            normalized = timestamp_str.replace("Z", "+00:00").replace(" ", "T")
            ts = datetime.fromisoformat(normalized)
            ts_naive = ts.replace(tzinfo=None) if ts.tzinfo else ts
            return (now - ts_naive).days
        except Exception:
            return None

    result = []
    for p in pioneers:
        pid = p["id"]
        recs = by_pioneer.get(pid, [])
        def _expected_for_row(r):
            return r.get("expected") or r.get("project_default_rounds") or 1

        rounds_completed = sum((r["rounds_done"] or 0) for r in recs)
        rounds_expected = sum(_expected_for_row(r) for r in recs) if recs else 0
        completion_rate = (rounds_completed / rounds_expected) if rounds_expected else None
        last_activity_at = max(
            (r["last_response_at"] for r in recs if r.get("last_response_at")),
            default=None,
        )
        oldest_pending = min(
            (r["oldest_pending_at"] for r in recs if r.get("oldest_pending_at")),
            default=None,
        )
        oldest_age = _age_days(oldest_pending)
        status = _compute_pioneer_status(
            rounds_completed, rounds_expected, oldest_age, overdue_days
        )

        # Aggregate metrics across complete projects.
        complete_metrics = [
            metrics_by_project[r["project_id"]]
            for r in recs
            if r["project_status"] == "complete" and r["project_id"] in metrics_by_project
        ]

        def _avg(field: str) -> Optional[float]:
            vals = [m.get(field) for m in complete_metrics if m.get(field) is not None]
            return round(sum(vals) / len(vals), 2) if vals else None

        practice_counter = Counter(r["practice_code"] for r in recs if r.get("practice_code"))
        role_counter = Counter(r["role_name"] for r in recs if r.get("role_name"))

        result.append({
            "id": pid,
            "name": p["name"],
            "email": p["email"],
            "notes": p["notes"],
            "project_count": len({r["project_id"] for r in recs}),
            "rounds_completed": rounds_completed,
            "rounds_expected": rounds_expected,
            "completion_rate": round(completion_rate, 2) if completion_rate is not None else None,
            "last_activity_at": last_activity_at,
            "status": status,
            "avg_quality_score":  _avg("quality_score"),
            "avg_value_gain":     _avg("productivity_ratio"),
            "avg_machine_first":  _avg("machine_first_score"),
            "avg_senior_led":     _avg("senior_led_score"),
            "avg_knowledge":      _avg("proprietary_knowledge_score"),
            "practices": [{"code": c, "count": n} for c, n in practice_counter.most_common()],
            "roles":     [{"role_name": r, "count": n} for r, n in role_counter.most_common()],
        })

    return result


def get_pioneer_with_metrics(pioneer_id: int) -> Optional[dict]:
    """Same shape as list_pioneers_with_metrics()'s items, plus a `portfolio`
    field listing each project the pioneer is on. Returns None if the pioneer
    does not exist."""
    from backend.database import _db
    # Fast path: if the pioneer exists but has no project_pioneers rows,
    # skip the full aggregation.
    with _db() as conn:
        pioneer_row = conn.execute(
            "SELECT id, name, email, notes FROM pioneers WHERE id = ?",
            (pioneer_id,),
        ).fetchone()
        if not pioneer_row:
            return None
        pp_count = conn.execute(
            "SELECT COUNT(*) AS n FROM project_pioneers WHERE pioneer_id = ?",
            (pioneer_id,),
        ).fetchone()["n"]

    if pp_count == 0:
        return {
            "id": pioneer_row["id"],
            "name": pioneer_row["name"],
            "email": pioneer_row["email"],
            "notes": pioneer_row["notes"],
            "project_count": 0,
            "rounds_completed": 0,
            "rounds_expected": 0,
            "completion_rate": None,
            "last_activity_at": None,
            "status": "never",
            "avg_quality_score": None,
            "avg_value_gain": None,
            "avg_machine_first": None,
            "avg_senior_led": None,
            "avg_knowledge": None,
            "practices": [],
            "roles": [],
            "portfolio": [],
        }

    # Pioneer has assignments — go through the full aggregation.
    summary = next(
        (p for p in list_pioneers_with_metrics() if p["id"] == pioneer_id),
        None,
    )
    if summary is None:
        # Defensive: the pioneer was just deleted between the COUNT and the loop.
        return None

    # Build portfolio.
    with _db() as conn:
        portfolio_rows = conn.execute(
            """SELECT pp.project_id, p.project_name, pr.code AS practice_code,
                      pp.role_name, pp.day_rate, pp.total_rounds AS expected,
                      p.status AS project_status,
                      (SELECT COUNT(*) FROM expert_responses er
                         WHERE er.pioneer_id = pp.id AND er.submitted_at IS NOT NULL) AS rounds_done,
                      (SELECT MAX(er2.submitted_at) FROM expert_responses er2
                         WHERE er2.pioneer_id = pp.id) AS last_activity_at
                 FROM project_pioneers pp
                 JOIN projects p ON p.id = pp.project_id
            LEFT JOIN practices pr ON pr.id = p.practice_id
                WHERE pp.pioneer_id = ?
             ORDER BY p.id DESC""",
            (pioneer_id,),
        ).fetchall()

    summary["portfolio"] = [
        {
            "project_id": r["project_id"],
            "project_name": r["project_name"],
            "practice_code": r["practice_code"],
            "role_name": r["role_name"],
            "day_rate": r["day_rate"],
            "rounds_completed": r["rounds_done"],
            "rounds_expected": r["expected"],
            "status": r["project_status"],
            "last_activity_at": r["last_activity_at"],
        }
        for r in portfolio_rows
    ]
    return summary
