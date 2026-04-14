# Multi-Pioneer Longitudinal Surveys — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow multiple pioneers per project, each surveyed over multiple rounds, with metrics averaged across all responses and a PMO monitoring dashboard.

**Architecture:** New `project_pioneers` junction table links projects to pioneers. `expert_responses` gains `pioneer_id` and `round_number` columns. Metrics computation averages all responses per project. New monitoring page and pioneer management UI added to the frontend.

**Tech Stack:** Python 3.11, FastAPI, SQLite, vanilla JS/CSS, Playwright for E2E tests.

**Spec:** `docs/superpowers/specs/2026-04-14-multi-pioneer-longitudinal-design.md`

---

## File Structure

### Backend changes

| File | Action | Responsibility |
|------|--------|----------------|
| `backend/schema.py` | Modify | Add project status constants, pioneer defaults, expose in schema response |
| `backend/database.py` | Modify | Add `project_pioneers` table, migrate schema, new CRUD functions for pioneers, update `list_complete_projects` and `get_project_by_token` to use new model |
| `backend/models.py` | Modify | Update `ProjectCreate`/`ProjectUpdate` to accept pioneers array, add pioneer models, update `ExpertContextResponse` |
| `backend/metrics.py` | Modify | Add `compute_averaged_project_metrics()` that averages across multiple responses |
| `backend/app.py` | Modify | Update project endpoints, expert endpoints, add pioneer CRUD routes, add monitoring endpoint |

### Frontend changes

| File | Action | Responsibility |
|------|--------|----------------|
| `frontend/app.js` | Modify | Update project form (pioneers list), expert flow (round tracking, previous answers), add monitoring page, update project detail |
| `frontend/styles.css` | Modify | Styles for pioneer list, monitoring page, round indicators |

### Test changes

| File | Action | Responsibility |
|------|--------|----------------|
| `tests/test_multi_pioneer.py` | Create | Backend unit tests for pioneer CRUD, metrics averaging, status transitions |
| `tests/e2e-multi-pioneer.spec.ts` | Create | E2E tests for multi-pioneer flow |

---

## Task 1: Schema Constants

**Files:**
- Modify: `backend/schema.py:1-194`

- [ ] **Step 1: Write the failing test**

Create `tests/test_multi_pioneer.py`:

```python
"""Tests for multi-pioneer longitudinal survey support."""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from backend.schema import (
    PROJECT_STATUS_PENDING, PROJECT_STATUS_PARTIAL, PROJECT_STATUS_COMPLETE,
    DEFAULT_ROUNDS, MAX_ROUNDS_PER_PIONEER, MAX_PIONEERS_PER_PROJECT,
    SHOW_PREVIOUS_ANSWERS_DEFAULT, MONITORING_STATUS_OPTIONS,
    build_schema_response,
)

def test_project_status_constants():
    assert PROJECT_STATUS_PENDING == "pending"
    assert PROJECT_STATUS_PARTIAL == "partial"
    assert PROJECT_STATUS_COMPLETE == "complete"

def test_pioneer_defaults():
    assert DEFAULT_ROUNDS == 1
    assert MAX_ROUNDS_PER_PIONEER == 10
    assert MAX_PIONEERS_PER_PROJECT == 20
    assert SHOW_PREVIOUS_ANSWERS_DEFAULT is False

def test_monitoring_status_options():
    assert MONITORING_STATUS_OPTIONS == ["pending", "partial", "complete"]

def test_schema_response_includes_pioneer_config():
    resp = build_schema_response()
    assert resp["project_statuses"] == ["pending", "partial", "complete"]
    assert resp["default_rounds"] == 1
    assert resp["max_rounds"] == 10
    assert resp["max_pioneers"] == 20

if __name__ == "__main__":
    test_project_status_constants()
    test_pioneer_defaults()
    test_monitoring_status_options()
    test_schema_response_includes_pioneer_config()
    print("All schema tests passed.")
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/pj/Documents/Projects/xCSG-Value-Tracker && .venv/bin/python tests/test_multi_pioneer.py`

Expected: `ImportError: cannot import name 'PROJECT_STATUS_PENDING'`

- [ ] **Step 3: Add constants and update schema response**

Add to `backend/schema.py` before the `build_schema_response` function:

```python
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
```

Update `build_schema_response()` to include:

```python
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /Users/pj/Documents/Projects/xCSG-Value-Tracker && .venv/bin/python tests/test_multi_pioneer.py`

Expected: `All schema tests passed.`

- [ ] **Step 5: Commit**

```bash
git add backend/schema.py tests/test_multi_pioneer.py
git commit -m "feat: add project status constants and pioneer defaults to schema"
```

---

## Task 2: Database Migration — project_pioneers Table and Schema Changes

**Files:**
- Modify: `backend/database.py:44-150` (schema), `backend/database.py:145-385` (migration + seed)

- [ ] **Step 1: Write the failing test**

Append to `tests/test_multi_pioneer.py`:

```python
import sqlite3
import tempfile, os

def get_test_db():
    """Create a fresh in-memory-like temp DB and init it."""
    tmp = tempfile.NamedTemporaryFile(suffix=".db", delete=False)
    tmp.close()
    os.environ["DATABASE_PATH"] = tmp.name
    # Force re-import to pick up new DB path
    import importlib
    from backend import database as db
    importlib.reload(db)
    db.init_db()
    db.migrate()
    db.migrate_v2()
    return db, tmp.name

def test_project_pioneers_table_exists():
    db, db_path = get_test_db()
    conn = db.get_connection()
    try:
        tables = [r[0] for r in conn.execute(
            "SELECT name FROM sqlite_master WHERE type='table'"
        ).fetchall()]
        assert "project_pioneers" in tables, f"project_pioneers not in {tables}"
    finally:
        conn.close()
        os.unlink(db_path)

def test_project_pioneers_columns():
    db, db_path = get_test_db()
    conn = db.get_connection()
    try:
        cols = [r[1] for r in conn.execute("PRAGMA table_info(project_pioneers)").fetchall()]
        assert "id" in cols
        assert "project_id" in cols
        assert "pioneer_name" in cols
        assert "pioneer_email" in cols
        assert "total_rounds" in cols
        assert "show_previous" in cols
        assert "expert_token" in cols
    finally:
        conn.close()
        os.unlink(db_path)

def test_projects_has_new_columns():
    db, db_path = get_test_db()
    conn = db.get_connection()
    try:
        cols = [r[1] for r in conn.execute("PRAGMA table_info(projects)").fetchall()]
        assert "default_rounds" in cols
        assert "show_previous_answers" in cols
    finally:
        conn.close()
        os.unlink(db_path)

def test_expert_responses_has_pioneer_columns():
    db, db_path = get_test_db()
    conn = db.get_connection()
    try:
        cols = [r[1] for r in conn.execute("PRAGMA table_info(expert_responses)").fetchall()]
        assert "pioneer_id" in cols
        assert "round_number" in cols
        assert "project_id" in cols  # kept for denormalized queries
    finally:
        conn.close()
        os.unlink(db_path)

if __name__ == "__main__":
    test_project_status_constants()
    test_pioneer_defaults()
    test_monitoring_status_options()
    test_schema_response_includes_pioneer_config()
    test_project_pioneers_table_exists()
    test_project_pioneers_columns()
    test_projects_has_new_columns()
    test_expert_responses_has_pioneer_columns()
    print("All tests passed.")
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/pj/Documents/Projects/xCSG-Value-Tracker && .venv/bin/python tests/test_multi_pioneer.py`

Expected: `AssertionError: project_pioneers not in [...]`

- [ ] **Step 3: Update database.py — add project_pioneers table to init_db**

In `init_db()`, after the `expert_responses` CREATE TABLE, add:

```python
            CREATE TABLE IF NOT EXISTS project_pioneers (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                project_id INTEGER NOT NULL,
                pioneer_name TEXT NOT NULL,
                pioneer_email TEXT,
                total_rounds INTEGER,
                show_previous INTEGER,
                expert_token TEXT UNIQUE NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (project_id) REFERENCES projects(id)
            );
```

- [ ] **Step 4: Add migration function migrate_v11() for existing databases**

Add a new `migrate_v11()` function in `database.py`:

```python
def migrate_v11():
    """Migrate from v1.0 to v1.1: multi-pioneer support."""
    conn = get_connection()
    try:
        tables = [r[0] for r in conn.execute(
            "SELECT name FROM sqlite_master WHERE type='table'"
        ).fetchall()]

        # 1. Create project_pioneers if not exists
        if "project_pioneers" not in tables:
            conn.execute("""
                CREATE TABLE project_pioneers (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    project_id INTEGER NOT NULL,
                    pioneer_name TEXT NOT NULL,
                    pioneer_email TEXT,
                    total_rounds INTEGER,
                    show_previous INTEGER,
                    expert_token TEXT UNIQUE NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (project_id) REFERENCES projects(id)
                )
            """)

        # 2. Add new columns to projects
        project_cols = {r[1] for r in conn.execute("PRAGMA table_info(projects)").fetchall()}
        if "default_rounds" not in project_cols:
            conn.execute("ALTER TABLE projects ADD COLUMN default_rounds INTEGER DEFAULT 1")
        if "show_previous_answers" not in project_cols:
            conn.execute("ALTER TABLE projects ADD COLUMN show_previous_answers INTEGER DEFAULT 0")

        # 3. Add new columns to expert_responses
        er_cols = {r[1] for r in conn.execute("PRAGMA table_info(expert_responses)").fetchall()}
        if "pioneer_id" not in er_cols:
            conn.execute("ALTER TABLE expert_responses ADD COLUMN pioneer_id INTEGER")
        if "round_number" not in er_cols:
            conn.execute("ALTER TABLE expert_responses ADD COLUMN round_number INTEGER DEFAULT 1")

        # 4. Migrate existing data: create pioneer rows from projects that have pioneer_name
        if "pioneer_name" in project_cols and "expert_token" in project_cols:
            existing_pioneers = conn.execute(
                "SELECT id FROM project_pioneers LIMIT 1"
            ).fetchone()
            if not existing_pioneers:
                projects = conn.execute(
                    "SELECT id, pioneer_name, pioneer_email, expert_token FROM projects WHERE pioneer_name IS NOT NULL"
                ).fetchall()
                for p in projects:
                    conn.execute(
                        """INSERT INTO project_pioneers (project_id, pioneer_name, pioneer_email, expert_token)
                           VALUES (?, ?, ?, ?)""",
                        (p["id"], p["pioneer_name"], p["pioneer_email"], p["expert_token"]),
                    )
                # Link expert_responses to pioneers
                conn.execute("""
                    UPDATE expert_responses SET pioneer_id = (
                        SELECT pp.id FROM project_pioneers pp WHERE pp.project_id = expert_responses.project_id LIMIT 1
                    ) WHERE pioneer_id IS NULL
                """)

        # 5. Update project statuses
        conn.execute("""
            UPDATE projects SET status = 'pending'
            WHERE status = 'expert_pending'
        """)

        conn.commit()
    finally:
        conn.close()
```

Call `migrate_v11()` in the startup event in `app.py`:

```python
@app.on_event("startup")
async def startup_event():
    db.init_db()
    db.migrate()
    db.migrate_v2()
    db.migrate_v11()
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd /Users/pj/Documents/Projects/xCSG-Value-Tracker && .venv/bin/python tests/test_multi_pioneer.py`

Expected: `All tests passed.`

- [ ] **Step 6: Commit**

```bash
git add backend/database.py backend/app.py tests/test_multi_pioneer.py
git commit -m "feat: database migration for multi-pioneer support (project_pioneers table)"
```

---

## Task 3: Pioneer CRUD in database.py

**Files:**
- Modify: `backend/database.py`

- [ ] **Step 1: Write failing tests**

Append to `tests/test_multi_pioneer.py`:

```python
def test_create_pioneer():
    db, db_path = get_test_db()
    try:
        # Create a user and project first
        from backend.auth import hash_password
        db.create_user("admin", "a@b.com", hash_password("pass"), "admin")
        project_id = db.create_project({
            "created_by": 1,
            "project_name": "Test Project",
            "category_id": 1,
            "xcsg_team_size": "2",
            "xcsg_revision_rounds": "1",
            "default_rounds": 2,
            "pioneers": [
                {"name": "Alice", "email": "alice@test.com"},
                {"name": "Bob", "email": "bob@test.com", "total_rounds": 3},
            ],
        })
        pioneers = db.list_pioneers(project_id)
        assert len(pioneers) == 2
        alice = next(p for p in pioneers if p["pioneer_name"] == "Alice")
        bob = next(p for p in pioneers if p["pioneer_name"] == "Bob")
        assert alice["total_rounds"] is None  # inherits project default
        assert bob["total_rounds"] == 3
        assert alice["expert_token"] is not None
        assert bob["expert_token"] is not None
        assert alice["expert_token"] != bob["expert_token"]
    finally:
        os.unlink(db_path)

def test_add_pioneer_to_existing_project():
    db, db_path = get_test_db()
    try:
        from backend.auth import hash_password
        db.create_user("admin", "a@b.com", hash_password("pass"), "admin")
        project_id = db.create_project({
            "created_by": 1,
            "project_name": "Test",
            "category_id": 1,
            "xcsg_team_size": "2",
            "xcsg_revision_rounds": "1",
            "pioneers": [{"name": "Alice"}],
        })
        pioneer_id = db.add_pioneer(project_id, "Charlie", "charlie@test.com")
        assert pioneer_id > 0
        pioneers = db.list_pioneers(project_id)
        assert len(pioneers) == 2
    finally:
        os.unlink(db_path)

def test_remove_pioneer_no_responses():
    db, db_path = get_test_db()
    try:
        from backend.auth import hash_password
        db.create_user("admin", "a@b.com", hash_password("pass"), "admin")
        project_id = db.create_project({
            "created_by": 1,
            "project_name": "Test",
            "category_id": 1,
            "xcsg_team_size": "2",
            "xcsg_revision_rounds": "1",
            "pioneers": [{"name": "Alice"}, {"name": "Bob"}],
        })
        pioneers = db.list_pioneers(project_id)
        bob = next(p for p in pioneers if p["pioneer_name"] == "Bob")
        result = db.remove_pioneer(bob["id"])
        assert result is True
        assert len(db.list_pioneers(project_id)) == 1
    finally:
        os.unlink(db_path)

def test_get_pioneer_by_token():
    db, db_path = get_test_db()
    try:
        from backend.auth import hash_password
        db.create_user("admin", "a@b.com", hash_password("pass"), "admin")
        project_id = db.create_project({
            "created_by": 1,
            "project_name": "Test",
            "category_id": 1,
            "xcsg_team_size": "2",
            "xcsg_revision_rounds": "1",
            "pioneers": [{"name": "Alice"}],
        })
        pioneers = db.list_pioneers(project_id)
        token = pioneers[0]["expert_token"]
        pioneer = db.get_pioneer_by_token(token)
        assert pioneer is not None
        assert pioneer["pioneer_name"] == "Alice"
        assert pioneer["project_name"] == "Test"
    finally:
        os.unlink(db_path)

if __name__ == "__main__":
    test_project_status_constants()
    test_pioneer_defaults()
    test_monitoring_status_options()
    test_schema_response_includes_pioneer_config()
    test_project_pioneers_table_exists()
    test_project_pioneers_columns()
    test_projects_has_new_columns()
    test_expert_responses_has_pioneer_columns()
    test_create_pioneer()
    test_add_pioneer_to_existing_project()
    test_remove_pioneer_no_responses()
    test_get_pioneer_by_token()
    print("All tests passed.")
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd /Users/pj/Documents/Projects/xCSG-Value-Tracker && .venv/bin/python tests/test_multi_pioneer.py`

Expected: Failures on pioneer functions not existing or `create_project` not accepting `pioneers` key.

- [ ] **Step 3: Update create_project to handle pioneers array**

Modify `create_project()` in `database.py`. If `data` contains a `"pioneers"` key, create pioneer rows. If it contains `"pioneer_name"` (v1.0 compat), create a single pioneer. The project no longer stores `pioneer_name`, `pioneer_email`, or `expert_token` directly — those go in `project_pioneers`.

```python
def create_project(data: dict) -> int:
    """Create a project with pioneer assignments."""
    category_id = data["category_id"]
    for field in ("legacy_calendar_days", "legacy_team_size", "legacy_revision_rounds"):
        if not data.get(field):
            norm = get_norm_by_category(category_id)
            if norm:
                if field == "legacy_calendar_days":
                    data[field] = norm["typical_calendar_days"]
                elif field == "legacy_team_size":
                    data[field] = norm["typical_team_size"]
                elif field == "legacy_revision_rounds":
                    data[field] = norm["typical_revision_rounds"]
            else:
                data[field] = "6-10" if "days" in field else ("2" if "team" in field else "1")

    legacy_overridden = data.get("legacy_overridden", False)
    conn = get_connection()
    try:
        cur = conn.execute(
            """INSERT INTO projects
               (created_by, project_name, category_id, client_name,
                description, date_started, date_delivered,
                xcsg_calendar_days, working_days, xcsg_team_size, xcsg_revision_rounds,
                revision_depth, xcsg_scope_expansion, engagement_revenue,
                legacy_calendar_days, legacy_team_size, legacy_revision_rounds,
                legacy_overridden, engagement_stage, client_contact_email, client_pulse,
                default_rounds, show_previous_answers, status)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                data["created_by"],
                data["project_name"],
                data["category_id"],
                data.get("client_name"),
                data.get("description"),
                data.get("date_started"),
                data.get("date_delivered"),
                data.get("xcsg_calendar_days"),
                data.get("working_days"),
                data["xcsg_team_size"],
                data["xcsg_revision_rounds"],
                data.get("revision_depth"),
                data.get("xcsg_scope_expansion"),
                data.get("engagement_revenue"),
                data["legacy_calendar_days"],
                data["legacy_team_size"],
                data["legacy_revision_rounds"],
                1 if legacy_overridden else 0,
                data.get("engagement_stage"),
                data.get("client_contact_email"),
                data.get("client_pulse") or "Not yet received",
                data.get("default_rounds", 1),
                1 if data.get("show_previous_answers") else 0,
                "pending",
            ),
        )
        project_id = cur.lastrowid

        # Create pioneer assignments
        pioneers = data.get("pioneers", [])
        if not pioneers and data.get("pioneer_name"):
            # v1.0 compat: single pioneer
            pioneers = [{"name": data["pioneer_name"], "email": data.get("pioneer_email")}]

        for p in pioneers:
            token = secrets.token_urlsafe(32)
            conn.execute(
                """INSERT INTO project_pioneers (project_id, pioneer_name, pioneer_email, total_rounds, expert_token)
                   VALUES (?, ?, ?, ?, ?)""",
                (project_id, p["name"], p.get("email"), p.get("total_rounds"), token),
            )

        conn.commit()
        return project_id
    finally:
        conn.close()
```

- [ ] **Step 4: Add pioneer CRUD functions**

Add to `database.py`:

```python
def list_pioneers(project_id: int) -> list:
    conn = get_connection()
    try:
        rows = conn.execute(
            """SELECT pp.*,
                      (SELECT COUNT(*) FROM expert_responses er WHERE er.pioneer_id = pp.id) as response_count,
                      (SELECT MAX(er.round_number) FROM expert_responses er WHERE er.pioneer_id = pp.id) as last_round,
                      (SELECT er.submitted_at FROM expert_responses er WHERE er.pioneer_id = pp.id ORDER BY er.round_number DESC LIMIT 1) as last_submitted
               FROM project_pioneers pp
               WHERE pp.project_id = ?
               ORDER BY pp.id""",
            (project_id,),
        )
        return [dict(r) for r in rows.fetchall()]
    finally:
        conn.close()


def add_pioneer(project_id: int, name: str, email: str = None, total_rounds: int = None) -> int:
    conn = get_connection()
    try:
        token = secrets.token_urlsafe(32)
        cur = conn.execute(
            """INSERT INTO project_pioneers (project_id, pioneer_name, pioneer_email, total_rounds, expert_token)
               VALUES (?, ?, ?, ?, ?)""",
            (project_id, name, email, total_rounds, token),
        )
        conn.commit()
        return cur.lastrowid
    finally:
        conn.close()


def remove_pioneer(pioneer_id: int) -> bool:
    conn = get_connection()
    try:
        count = conn.execute(
            "SELECT COUNT(*) FROM expert_responses WHERE pioneer_id = ?", (pioneer_id,)
        ).fetchone()[0]
        if count > 0:
            return False
        conn.execute("DELETE FROM project_pioneers WHERE id = ?", (pioneer_id,))
        conn.commit()
        return True
    finally:
        conn.close()


def update_pioneer(pioneer_id: int, data: dict) -> bool:
    conn = get_connection()
    try:
        fields = {k: v for k, v in data.items() if k in ("pioneer_name", "pioneer_email", "total_rounds", "show_previous")}
        if not fields:
            return False
        set_clause = ", ".join(f"{k} = ?" for k in fields)
        values = list(fields.values()) + [pioneer_id]
        conn.execute(f"UPDATE project_pioneers SET {set_clause} WHERE id = ?", values)
        conn.commit()
        return True
    finally:
        conn.close()


def get_pioneer_by_token(token: str) -> Optional[sqlite3.Row]:
    conn = get_connection()
    try:
        return conn.execute(
            """SELECT pp.*, p.project_name, p.category_id, p.status as project_status,
                      p.default_rounds, p.show_previous_answers,
                      p.description, p.client_name, p.date_started, p.date_delivered,
                      p.xcsg_team_size, p.xcsg_calendar_days, p.engagement_stage,
                      pc.name as category_name
               FROM project_pioneers pp
               JOIN projects p ON pp.project_id = p.id
               JOIN project_categories pc ON p.category_id = pc.id
               WHERE pp.expert_token = ?""",
            (token,),
        ).fetchone()
    finally:
        conn.close()


def get_pioneer_responses(pioneer_id: int) -> list:
    conn = get_connection()
    try:
        rows = conn.execute(
            "SELECT * FROM expert_responses WHERE pioneer_id = ? ORDER BY round_number",
            (pioneer_id,),
        ).fetchall()
        return [dict(r) for r in rows]
    finally:
        conn.close()
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd /Users/pj/Documents/Projects/xCSG-Value-Tracker && .venv/bin/python tests/test_multi_pioneer.py`

Expected: `All tests passed.`

- [ ] **Step 6: Commit**

```bash
git add backend/database.py tests/test_multi_pioneer.py
git commit -m "feat: pioneer CRUD functions and updated create_project"
```

---

## Task 4: Expert Response Submission with Rounds

**Files:**
- Modify: `backend/database.py`

- [ ] **Step 1: Write failing tests**

Append to `tests/test_multi_pioneer.py`:

```python
def _create_test_project(db):
    from backend.auth import hash_password
    try:
        db.create_user("admin", "a@b.com", hash_password("pass"), "admin")
    except Exception:
        pass
    return db.create_project({
        "created_by": 1,
        "project_name": "Test",
        "category_id": 1,
        "xcsg_team_size": "2",
        "xcsg_revision_rounds": "1",
        "default_rounds": 2,
        "pioneers": [{"name": "Alice"}, {"name": "Bob"}],
    })

def test_submit_expert_response_round_1():
    db, db_path = get_test_db()
    try:
        project_id = _create_test_project(db)
        pioneers = db.list_pioneers(project_id)
        alice = pioneers[0]
        response_id = db.create_expert_response_v11(
            pioneer_id=alice["id"],
            project_id=project_id,
            round_number=1,
            data={"b1_starting_point": "From AI draft", "c1_specialization": "Deep specialist"},
        )
        assert response_id > 0
        responses = db.get_pioneer_responses(alice["id"])
        assert len(responses) == 1
        assert responses[0]["round_number"] == 1
    finally:
        os.unlink(db_path)

def test_submit_multiple_rounds():
    db, db_path = get_test_db()
    try:
        project_id = _create_test_project(db)
        pioneers = db.list_pioneers(project_id)
        alice = pioneers[0]
        db.create_expert_response_v11(pioneer_id=alice["id"], project_id=project_id, round_number=1, data={"b1_starting_point": "From AI draft"})
        db.create_expert_response_v11(pioneer_id=alice["id"], project_id=project_id, round_number=2, data={"b1_starting_point": "Mixed"})
        responses = db.get_pioneer_responses(alice["id"])
        assert len(responses) == 2
        assert responses[0]["round_number"] == 1
        assert responses[1]["round_number"] == 2
    finally:
        os.unlink(db_path)

def test_project_status_transitions():
    db, db_path = get_test_db()
    try:
        project_id = _create_test_project(db)
        pioneers = db.list_pioneers(project_id)
        alice, bob = pioneers[0], pioneers[1]

        # Initially pending
        p = db.get_project(project_id)
        assert p["status"] == "pending"

        # After 1 response -> partial
        db.create_expert_response_v11(pioneer_id=alice["id"], project_id=project_id, round_number=1, data={"b1_starting_point": "From AI draft"})
        db.update_project_status(project_id)
        p = db.get_project(project_id)
        assert p["status"] == "partial"

        # Alice round 2
        db.create_expert_response_v11(pioneer_id=alice["id"], project_id=project_id, round_number=2, data={"b1_starting_point": "Mixed"})
        db.update_project_status(project_id)
        p = db.get_project(project_id)
        assert p["status"] == "partial"  # Bob hasn't responded

        # Bob round 1
        db.create_expert_response_v11(pioneer_id=bob["id"], project_id=project_id, round_number=1, data={"b1_starting_point": "Mixed"})
        db.update_project_status(project_id)
        p = db.get_project(project_id)
        assert p["status"] == "partial"  # Bob needs round 2

        # Bob round 2
        db.create_expert_response_v11(pioneer_id=bob["id"], project_id=project_id, round_number=2, data={"b1_starting_point": "From blank page"})
        db.update_project_status(project_id)
        p = db.get_project(project_id)
        assert p["status"] == "complete"
    finally:
        os.unlink(db_path)

if __name__ == "__main__":
    test_project_status_constants()
    test_pioneer_defaults()
    test_monitoring_status_options()
    test_schema_response_includes_pioneer_config()
    test_project_pioneers_table_exists()
    test_project_pioneers_columns()
    test_projects_has_new_columns()
    test_expert_responses_has_pioneer_columns()
    test_create_pioneer()
    test_add_pioneer_to_existing_project()
    test_remove_pioneer_no_responses()
    test_get_pioneer_by_token()
    test_submit_expert_response_round_1()
    test_submit_multiple_rounds()
    test_project_status_transitions()
    print("All tests passed.")
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd /Users/pj/Documents/Projects/xCSG-Value-Tracker && .venv/bin/python tests/test_multi_pioneer.py`

Expected: `AttributeError: module 'backend.database' has no attribute 'create_expert_response_v11'`

- [ ] **Step 3: Implement create_expert_response_v11 and update_project_status**

Add to `database.py`:

```python
def create_expert_response_v11(pioneer_id: int, project_id: int, round_number: int, data: dict) -> int:
    """Create an expert response for a specific pioneer and round."""
    conn = get_connection()
    try:
        cur = conn.execute(
            """INSERT INTO expert_responses
               (project_id, pioneer_id, round_number,
                b1_starting_point, b2_research_sources, b3_assembly_ratio, b4_hypothesis_first, b5_ai_survival, b6_data_analysis_split,
                c1_specialization, c2_directness, c3_judgment_pct, c6_self_assessment, c7_analytical_depth, c8_decision_readiness,
                d1_proprietary_data, d2_knowledge_reuse, d3_moat_test, e1_client_decision,
                f1_feasibility, f2_productization, g1_reuse_intent,
                l1_legacy_working_days, l2_legacy_team_size, l3_legacy_revision_depth, l4_legacy_scope_expansion,
                l5_legacy_client_reaction, l6_legacy_b2_sources, l7_legacy_c1_specialization, l8_legacy_c2_directness,
                l9_legacy_c3_judgment, l10_legacy_d1_proprietary, l11_legacy_d2_reuse, l12_legacy_d3_moat,
                l13_legacy_c7_depth, l14_legacy_c8_decision, l15_legacy_e1_decision, l16_legacy_b6_data)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                project_id, pioneer_id, round_number,
                data.get("b1_starting_point"), data.get("b2_research_sources"),
                data.get("b3_assembly_ratio"), data.get("b4_hypothesis_first"),
                data.get("b5_ai_survival"), data.get("b6_data_analysis_split"),
                data.get("c1_specialization"), data.get("c2_directness"),
                data.get("c3_judgment_pct"), data.get("c6_self_assessment"),
                data.get("c7_analytical_depth"), data.get("c8_decision_readiness"),
                data.get("d1_proprietary_data"), data.get("d2_knowledge_reuse"),
                data.get("d3_moat_test"), data.get("e1_client_decision"),
                data.get("f1_feasibility"), data.get("f2_productization"),
                data.get("g1_reuse_intent"),
                data.get("l1_legacy_working_days"), data.get("l2_legacy_team_size"),
                data.get("l3_legacy_revision_depth"), data.get("l4_legacy_scope_expansion"),
                data.get("l5_legacy_client_reaction"), data.get("l6_legacy_b2_sources"),
                data.get("l7_legacy_c1_specialization"), data.get("l8_legacy_c2_directness"),
                data.get("l9_legacy_c3_judgment"), data.get("l10_legacy_d1_proprietary"),
                data.get("l11_legacy_d2_reuse"), data.get("l12_legacy_d3_moat"),
                data.get("l13_legacy_c7_depth"), data.get("l14_legacy_c8_decision"),
                data.get("l15_legacy_e1_decision"), data.get("l16_legacy_b6_data"),
            ),
        )
        conn.commit()
        return cur.lastrowid
    finally:
        conn.close()


def update_project_status(project_id: int):
    """Recompute project status based on pioneer response completeness."""
    conn = get_connection()
    try:
        project = conn.execute("SELECT default_rounds FROM projects WHERE id = ?", (project_id,)).fetchone()
        if not project:
            return
        default_rounds = project["default_rounds"] or 1

        pioneers = conn.execute(
            "SELECT id, total_rounds FROM project_pioneers WHERE project_id = ?", (project_id,)
        ).fetchall()

        if not pioneers:
            conn.execute("UPDATE projects SET status = 'pending', updated_at = CURRENT_TIMESTAMP WHERE id = ?", (project_id,))
            conn.commit()
            return

        total_responses = conn.execute(
            "SELECT COUNT(*) FROM expert_responses WHERE project_id = ?", (project_id,)
        ).fetchone()[0]

        if total_responses == 0:
            new_status = "pending"
        else:
            all_complete = True
            for p in pioneers:
                expected = p["total_rounds"] if p["total_rounds"] is not None else default_rounds
                actual = conn.execute(
                    "SELECT COUNT(*) FROM expert_responses WHERE pioneer_id = ?", (p["id"],)
                ).fetchone()[0]
                if actual < expected:
                    all_complete = False
                    break
            new_status = "complete" if all_complete else "partial"

        conn.execute(
            "UPDATE projects SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
            (new_status, project_id),
        )
        conn.commit()
    finally:
        conn.close()
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd /Users/pj/Documents/Projects/xCSG-Value-Tracker && .venv/bin/python tests/test_multi_pioneer.py`

Expected: `All tests passed.`

- [ ] **Step 5: Commit**

```bash
git add backend/database.py tests/test_multi_pioneer.py
git commit -m "feat: expert response submission with rounds and status transitions"
```

---

## Task 5: Metrics Averaging Across Multiple Responses

**Files:**
- Modify: `backend/metrics.py`
- Modify: `backend/database.py`

- [ ] **Step 1: Write failing tests**

Append to `tests/test_multi_pioneer.py`:

```python
def test_averaged_project_metrics():
    db, db_path = get_test_db()
    try:
        from backend.metrics import compute_averaged_project_metrics
        project_id = _create_test_project(db)
        pioneers = db.list_pioneers(project_id)
        alice, bob = pioneers[0], pioneers[1]

        # Alice: strong xCSG, weak legacy
        db.create_expert_response_v11(pioneer_id=alice["id"], project_id=project_id, round_number=1, data={
            "c6_self_assessment": "Significantly better",
            "c7_analytical_depth": "Exceptional",
            "c8_decision_readiness": "Yes without caveats",
            "l13_legacy_c7_depth": "Adequate",
            "l14_legacy_c8_decision": "Needs significant additional work",
        })
        # Bob: moderate scores
        db.create_expert_response_v11(pioneer_id=bob["id"], project_id=project_id, round_number=1, data={
            "c6_self_assessment": "Somewhat better",
            "c7_analytical_depth": "Strong",
            "c8_decision_readiness": "Yes with minor caveats",
            "l13_legacy_c7_depth": "Strong",
            "l14_legacy_c8_decision": "Yes with minor caveats",
        })

        project = dict(db.get_project(project_id))
        responses = db.get_all_project_responses(project_id)
        avg_metrics = compute_averaged_project_metrics(project, responses)

        # Should be an average, not identical to either
        assert avg_metrics["quality_score"] is not None
        assert avg_metrics["output_quality"] is not None
    finally:
        os.unlink(db_path)

def test_single_response_matches_v10():
    """A project with 1 response should compute identically to v1.0."""
    db, db_path = get_test_db()
    try:
        from backend.metrics import compute_project_metrics, compute_averaged_project_metrics
        project_id = _create_test_project(db)
        pioneers = db.list_pioneers(project_id)
        alice = pioneers[0]

        data = {
            "c6_self_assessment": "Significantly better",
            "c7_analytical_depth": "Exceptional",
            "c8_decision_readiness": "Yes without caveats",
            "l13_legacy_c7_depth": "Adequate",
            "l14_legacy_c8_decision": "Needs significant additional work",
            "b2_research_sources": "Broad systematic synthesis (10+)",
            "l6_legacy_b2_sources": "A few targeted sources (2-4)",
        }
        db.create_expert_response_v11(pioneer_id=alice["id"], project_id=project_id, round_number=1, data=data)

        project = dict(db.get_project(project_id))
        responses = db.get_all_project_responses(project_id)

        # v1.1 averaged
        avg_metrics = compute_averaged_project_metrics(project, responses)

        # v1.0 style: merge project + single response
        merged = dict(project)
        merged.update(dict(responses[0]))
        v10_metrics = compute_project_metrics(merged)

        # Should match
        assert avg_metrics["quality_score"] == v10_metrics["quality_score"]
        assert avg_metrics["output_quality"] == v10_metrics["output_quality"]
        assert avg_metrics["machine_first_score"] == v10_metrics["machine_first_score"]
    finally:
        os.unlink(db_path)

if __name__ == "__main__":
    test_project_status_constants()
    test_pioneer_defaults()
    test_monitoring_status_options()
    test_schema_response_includes_pioneer_config()
    test_project_pioneers_table_exists()
    test_project_pioneers_columns()
    test_projects_has_new_columns()
    test_expert_responses_has_pioneer_columns()
    test_create_pioneer()
    test_add_pioneer_to_existing_project()
    test_remove_pioneer_no_responses()
    test_get_pioneer_by_token()
    test_submit_expert_response_round_1()
    test_submit_multiple_rounds()
    test_project_status_transitions()
    test_averaged_project_metrics()
    test_single_response_matches_v10()
    print("All tests passed.")
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd /Users/pj/Documents/Projects/xCSG-Value-Tracker && .venv/bin/python tests/test_multi_pioneer.py`

Expected: `ImportError: cannot import name 'compute_averaged_project_metrics'`

- [ ] **Step 3: Add get_all_project_responses to database.py**

```python
def get_all_project_responses(project_id: int) -> list:
    """Return all expert responses for a project, across all pioneers and rounds."""
    conn = get_connection()
    try:
        rows = conn.execute(
            "SELECT * FROM expert_responses WHERE project_id = ? ORDER BY pioneer_id, round_number",
            (project_id,),
        ).fetchall()
        return [dict(r) for r in rows]
    finally:
        conn.close()
```

- [ ] **Step 4: Add compute_averaged_project_metrics to metrics.py**

```python
def compute_averaged_project_metrics(project: dict, responses: list[dict]) -> dict:
    """Compute metrics averaged across multiple expert responses for a project."""
    if not responses:
        return compute_project_metrics(project)

    # Compute metrics for each response individually (merged with project data)
    all_metrics = []
    for resp in responses:
        merged = dict(project)
        merged.update({k: v for k, v in resp.items() if k != "id"})
        all_metrics.append(compute_project_metrics(merged))

    if len(all_metrics) == 1:
        return all_metrics[0]

    # Average numeric metric fields
    result = dict(all_metrics[0])  # Start with first for non-numeric fields
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
    ]
    for key in numeric_keys:
        values = [m[key] for m in all_metrics if m.get(key) is not None]
        result[key] = average(values) if values else None

    return result
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd /Users/pj/Documents/Projects/xCSG-Value-Tracker && .venv/bin/python tests/test_multi_pioneer.py`

Expected: `All tests passed.`

- [ ] **Step 6: Commit**

```bash
git add backend/metrics.py backend/database.py tests/test_multi_pioneer.py
git commit -m "feat: metrics averaging across multiple pioneer responses"
```

---

## Task 6: Update Pydantic Models

**Files:**
- Modify: `backend/models.py`

- [ ] **Step 1: Update models**

Add pioneer models and update project models in `backend/models.py`:

```python
# ── Pioneers ────────────────────────────────────────────────────────────────

class PioneerCreate(BaseModel):
    name: str
    email: Optional[EmailStr] = None
    total_rounds: Optional[int] = None

class PioneerUpdate(BaseModel):
    pioneer_name: Optional[str] = None
    pioneer_email: Optional[EmailStr] = None
    total_rounds: Optional[int] = None
    show_previous: Optional[bool] = None
```

Update `ProjectCreate`:
- Remove `pioneer_name` and `pioneer_email`
- Add `pioneers: List[PioneerCreate]` (min 1)
- Add `default_rounds: int = 1`
- Add `show_previous_answers: bool = False`

```python
class ProjectCreate(BaseModel):
    project_name: str
    category_id: int
    client_name: Optional[str] = None
    pioneers: List[PioneerCreate]
    engagement_stage: Optional[str] = None
    client_contact_email: Optional[EmailStr] = None
    client_pulse: Optional[str] = "Not yet received"
    description: Optional[str] = None
    date_started: Optional[str] = None
    date_delivered: Optional[str] = None
    xcsg_calendar_days: Optional[str] = None
    working_days: Optional[int] = None
    xcsg_team_size: str
    xcsg_revision_rounds: str
    revision_depth: Optional[str] = None
    xcsg_scope_expansion: Optional[str] = None
    engagement_revenue: Optional[float] = None
    legacy_calendar_days: Optional[str] = None
    legacy_team_size: Optional[str] = None
    legacy_revision_rounds: Optional[str] = None
    default_rounds: int = 1
    show_previous_answers: bool = False
```

Update `ProjectUpdate` to add:
```python
    default_rounds: Optional[int] = None
    show_previous_answers: Optional[bool] = None
```

Update `ExpertContextResponse` to add round info:
```python
class ExpertContextResponse(BaseModel):
    project_id: int
    project_name: str
    category_name: str
    description: Optional[str] = None
    client_name: Optional[str]
    pioneer_name: str
    pioneer_id: int
    date_started: Optional[str]
    date_delivered: Optional[str]
    xcsg_team_size: str
    xcsg_calendar_days: Optional[str] = None
    engagement_stage: Optional[str] = None
    current_round: int
    total_rounds: int
    show_previous: bool
    previous_responses: Optional[list] = None
    already_completed: bool
```

- [ ] **Step 2: Verify syntax**

Run: `cd /Users/pj/Documents/Projects/xCSG-Value-Tracker && .venv/bin/python -c "from backend.models import ProjectCreate, PioneerCreate, ExpertContextResponse; print('OK')"`

Expected: `OK`

- [ ] **Step 3: Commit**

```bash
git add backend/models.py
git commit -m "feat: pydantic models for multi-pioneer support"
```

---

## Task 7: Update API Routes — Project Endpoints

**Files:**
- Modify: `backend/app.py`

- [ ] **Step 1: Update create_project route**

Update `POST /api/projects` to pass pioneers array to `db.create_project`:

```python
@app.post("/api/projects", status_code=201)
async def create_project(
    body: ProjectCreate,
    current_user: dict = Depends(auth.get_current_user_analyst),
):
    cat = db.get_category(body.category_id)
    if not cat:
        raise HTTPException(status_code=400, detail="Invalid category_id")

    data = _normalize_project_payload(body.model_dump())
    data["created_by"] = current_user["sub"]
    data["pioneers"] = [p.model_dump() for p in body.pioneers]

    norm = db.get_norm_by_category(body.category_id)
    if norm:
        data["legacy_overridden"] = (
            data.get("legacy_calendar_days") != norm["typical_calendar_days"]
            or data.get("legacy_team_size") != norm["typical_team_size"]
            or data.get("legacy_revision_rounds") != norm["typical_revision_rounds"]
        )
    else:
        data["legacy_overridden"] = False

    project_id = db.create_project(data)
    row = db.get_project(project_id)
    result = dict(row)
    result["pioneers"] = db.list_pioneers(project_id)
    db.log_activity(
        current_user["sub"],
        "project_created",
        project_id=project_id,
        details=f"Created project '{data['project_name']}' ({cat['name']})",
    )
    return result
```

- [ ] **Step 2: Update get_project route to include pioneers and averaged metrics**

```python
@app.get("/api/projects/{project_id}")
async def get_project(
    project_id: int,
    current_user: dict = Depends(auth.get_current_user),
):
    row = db.get_project(project_id)
    if not row:
        raise HTTPException(status_code=404, detail="Project not found")
    result = dict(row)
    result["pioneers"] = db.list_pioneers(project_id)
    responses = db.get_all_project_responses(project_id)
    if responses:
        result["metrics"] = mtx.compute_averaged_project_metrics(dict(row), responses)
        result["response_count"] = len(responses)
    else:
        result["metrics"] = None
        result["response_count"] = 0
    return result
```

- [ ] **Step 3: Update list_projects to use averaged metrics**

```python
@app.get("/api/projects")
async def list_projects(
    status_filter: Optional[str] = Query(None, alias="status"),
    category_id: Optional[int] = Query(None),
    pioneer: Optional[str] = Query(None),
    client: Optional[str] = Query(None),
    current_user: dict = Depends(auth.get_current_user),
):
    projects = db.list_projects(
        status_filter=status_filter,
        category_id=category_id,
        pioneer=pioneer,
        client=client,
    )

    enriched_projects = []
    for project in projects:
        result = dict(project)
        result["pioneers"] = db.list_pioneers(project["id"])
        responses = db.get_all_project_responses(project["id"])
        if responses:
            result["metrics"] = mtx.compute_averaged_project_metrics(dict(project), responses)
            result["response_count"] = len(responses)
        else:
            result["metrics"] = None
            result["response_count"] = 0
        enriched_projects.append(result)

    return enriched_projects
```

- [ ] **Step 4: Add pioneer management endpoints**

```python
@app.get("/api/projects/{project_id}/pioneers")
async def list_project_pioneers(
    project_id: int,
    current_user: dict = Depends(auth.get_current_user),
):
    row = db.get_project(project_id)
    if not row:
        raise HTTPException(status_code=404, detail="Project not found")
    return db.list_pioneers(project_id)


@app.post("/api/projects/{project_id}/pioneers", status_code=201)
async def add_project_pioneer(
    project_id: int,
    body: PioneerCreate,
    current_user: dict = Depends(auth.get_current_user_analyst),
):
    row = db.get_project(project_id)
    if not row:
        raise HTTPException(status_code=404, detail="Project not found")
    pioneer_id = db.add_pioneer(project_id, body.name, body.email, body.total_rounds)
    pioneers = db.list_pioneers(project_id)
    return next(p for p in pioneers if p["id"] == pioneer_id)


@app.put("/api/projects/{project_id}/pioneers/{pioneer_id}")
async def update_project_pioneer(
    project_id: int,
    pioneer_id: int,
    body: PioneerUpdate,
    current_user: dict = Depends(auth.get_current_user_analyst),
):
    data = {k: v for k, v in body.model_dump().items() if v is not None}
    db.update_pioneer(pioneer_id, data)
    pioneers = db.list_pioneers(project_id)
    return next((p for p in pioneers if p["id"] == pioneer_id), None)


@app.delete("/api/projects/{project_id}/pioneers/{pioneer_id}", status_code=204)
async def remove_project_pioneer(
    project_id: int,
    pioneer_id: int,
    current_user: dict = Depends(auth.get_current_user_analyst),
):
    result = db.remove_pioneer(pioneer_id)
    if not result:
        raise HTTPException(status_code=400, detail="Cannot remove pioneer with existing responses")
```

Add import for `PioneerCreate` and `PioneerUpdate` at the top of `app.py`.

- [ ] **Step 5: Update delete_project to cascade to pioneers**

In `database.py`, update `delete_project()`:

```python
def delete_project(project_id: int) -> bool:
    conn = get_connection()
    try:
        conn.execute("UPDATE activity_log SET project_id = NULL WHERE project_id = ?", (project_id,))
        conn.execute("DELETE FROM expert_responses WHERE project_id = ?", (project_id,))
        conn.execute("DELETE FROM project_pioneers WHERE project_id = ?", (project_id,))
        conn.execute("DELETE FROM projects WHERE id = ?", (project_id,))
        conn.commit()
        return True
    finally:
        conn.close()
```

- [ ] **Step 6: Verify syntax**

Run: `cd /Users/pj/Documents/Projects/xCSG-Value-Tracker && .venv/bin/python -c "from backend.app import app; print('OK')"`

Expected: `OK`

- [ ] **Step 7: Commit**

```bash
git add backend/app.py backend/database.py backend/models.py
git commit -m "feat: API routes for pioneer management and multi-response metrics"
```

---

## Task 8: Update Expert API Routes

**Files:**
- Modify: `backend/app.py`

- [ ] **Step 1: Update GET /api/expert/{token}**

Token now resolves to a pioneer assignment:

```python
@app.get("/api/expert/{token}")
async def get_expert_context(token: str):
    pioneer = db.get_pioneer_by_token(token)
    if not pioneer:
        raise HTTPException(status_code=404, detail="Expert link is invalid or has expired")

    pioneer_dict = dict(pioneer)
    total_rounds = pioneer_dict["total_rounds"] if pioneer_dict["total_rounds"] is not None else pioneer_dict["default_rounds"] or 1
    show_prev = pioneer_dict["show_previous"] if pioneer_dict["show_previous"] is not None else bool(pioneer_dict["show_previous_answers"])

    responses = db.get_pioneer_responses(pioneer_dict["id"])
    current_round = len(responses) + 1
    all_done = current_round > total_rounds

    previous_responses = None
    if show_prev and responses:
        previous_responses = [dict(r) for r in responses]

    return ExpertContextResponse(
        project_id=pioneer_dict["project_id"],
        project_name=pioneer_dict["project_name"],
        category_name=pioneer_dict["category_name"],
        description=pioneer_dict.get("description"),
        client_name=pioneer_dict.get("client_name"),
        pioneer_name=pioneer_dict["pioneer_name"],
        pioneer_id=pioneer_dict["id"],
        date_started=pioneer_dict.get("date_started"),
        date_delivered=pioneer_dict.get("date_delivered"),
        xcsg_team_size=pioneer_dict["xcsg_team_size"],
        xcsg_calendar_days=pioneer_dict.get("xcsg_calendar_days"),
        engagement_stage=pioneer_dict.get("engagement_stage"),
        current_round=min(current_round, total_rounds),
        total_rounds=total_rounds,
        show_previous=show_prev,
        previous_responses=previous_responses,
        already_completed=all_done,
    )
```

- [ ] **Step 2: Update POST /api/expert/{token}**

```python
@app.post("/api/expert/{token}", status_code=201)
async def submit_expert_response(token: str, body: ExpertResponseCreate):
    pioneer = db.get_pioneer_by_token(token)
    if not pioneer:
        raise HTTPException(status_code=404, detail="Expert link is invalid or has expired")

    pioneer_dict = dict(pioneer)
    total_rounds = pioneer_dict["total_rounds"] if pioneer_dict["total_rounds"] is not None else pioneer_dict["default_rounds"] or 1

    responses = db.get_pioneer_responses(pioneer_dict["id"])
    current_round = len(responses) + 1

    if current_round > total_rounds:
        return {"already_completed": True, "message": "All rounds have been completed"}

    data = body.model_dump()
    db.create_expert_response_v11(
        pioneer_id=pioneer_dict["id"],
        project_id=pioneer_dict["project_id"],
        round_number=current_round,
        data=data,
    )
    db.update_project_status(pioneer_dict["project_id"])

    db.log_activity(
        1,
        "expert_submitted",
        project_id=pioneer_dict["project_id"],
        details=f"Expert assessment round {current_round}/{total_rounds} submitted for '{pioneer_dict['project_name']}' (pioneer: {pioneer_dict['pioneer_name']})",
    )

    # Compute and return metrics
    project = dict(db.get_project(pioneer_dict["project_id"]))
    all_responses = db.get_all_project_responses(pioneer_dict["project_id"])
    metrics = mtx.compute_averaged_project_metrics(project, all_responses)

    rounds_remaining = total_rounds - current_round
    return {
        "success": True,
        "message": f"Round {current_round} of {total_rounds} submitted successfully",
        "metrics": metrics,
        "current_round": current_round,
        "total_rounds": total_rounds,
        "rounds_remaining": rounds_remaining,
    }
```

- [ ] **Step 3: Update GET /api/expert/{token}/metrics**

```python
@app.get("/api/expert/{token}/metrics")
async def get_expert_metrics(token: str):
    pioneer = db.get_pioneer_by_token(token)
    if not pioneer:
        raise HTTPException(status_code=404, detail="Expert link is invalid or has expired")

    pioneer_dict = dict(pioneer)
    responses = db.get_pioneer_responses(pioneer_dict["id"])
    if not responses:
        raise HTTPException(status_code=404, detail="No responses submitted yet")

    project = dict(db.get_project(pioneer_dict["project_id"]))
    all_responses = db.get_all_project_responses(pioneer_dict["project_id"])
    metrics = mtx.compute_averaged_project_metrics(project, all_responses)

    return ExpertAssessmentMetrics(
        machine_first_score=metrics.get("machine_first_score"),
        senior_led_score=metrics.get("senior_led_score"),
        proprietary_knowledge_score=metrics.get("proprietary_knowledge_score"),
        client_impact=metrics.get("client_impact"),
        data_independence=metrics.get("data_independence"),
        ai_survival_rate=metrics.get("ai_survival_rate"),
        reuse_intent_score=metrics.get("reuse_intent_score"),
    )
```

- [ ] **Step 4: Verify syntax**

Run: `cd /Users/pj/Documents/Projects/xCSG-Value-Tracker && .venv/bin/python -c "from backend.app import app; print('OK')"`

Expected: `OK`

- [ ] **Step 5: Commit**

```bash
git add backend/app.py
git commit -m "feat: expert routes use pioneer tokens with round tracking"
```

---

## Task 9: Update Dashboard Metrics to Use Averaged Data

**Files:**
- Modify: `backend/database.py`
- Modify: `backend/app.py`

- [ ] **Step 1: Update list_complete_projects**

Projects with at least 1 response should be included in dashboard metrics. Update `list_complete_projects()` in `database.py`:

```python
def list_complete_projects() -> list:
    """Return all projects that have at least 1 expert response, with project data."""
    conn = get_connection()
    try:
        rows = conn.execute(
            """SELECT DISTINCT p.*, pc.name as category_name
               FROM projects p
               JOIN project_categories pc ON p.category_id = pc.id
               WHERE p.status IN ('partial', 'complete')
               ORDER BY p.created_at ASC"""
        ).fetchall()
        return [dict(r) for r in rows]
    finally:
        conn.close()
```

- [ ] **Step 2: Update dashboard_metrics and related endpoints in app.py**

Update `dashboard_metrics`, `metrics_summary`, `metrics_projects`, `metrics_trends`, and `metrics_scaling_gates` to use `compute_averaged_project_metrics`:

```python
@app.get("/api/dashboard/metrics")
async def dashboard_metrics(current_user: dict = Depends(auth.get_current_user)):
    projects_with_responses = db.list_complete_projects()
    all_projects = db.list_projects()
    # Compute averaged metrics for each project
    complete = []
    for p in projects_with_responses:
        responses = db.get_all_project_responses(p["id"])
        if responses:
            avg = mtx.compute_averaged_project_metrics(p, responses)
            # Merge back project-level data needed by dashboard
            avg.update({
                "id": p["id"],
                "project_name": p["project_name"],
                "category_name": p["category_name"],
                "date_started": p.get("date_started"),
                "date_delivered": p.get("date_delivered"),
            })
            complete.append(avg)
    return mtx.compute_dashboard_metrics_from_averaged(complete, all_projects)
```

Add to `metrics.py`:

```python
def compute_dashboard_metrics_from_averaged(averaged_metrics: list[dict], all_projects: list[dict]) -> dict:
    """Dashboard metrics from pre-averaged project metrics."""
    completed_count = len(averaged_metrics)
    total_count = len(all_projects)
    # Reuse scaling gates with averaged data
    scaling_gates = compute_scaling_gates_from_averaged(averaged_metrics)

    average_effort_ratio = average([m["delivery_speed"] for m in averaged_metrics]) or 0.0
    average_quality_score = average([m["quality_score"] for m in averaged_metrics]) or 0.0
    average_quality_ratio = average([m["output_quality"] for m in averaged_metrics]) or 0.0
    average_advantage = average([m["xcsg_advantage"] for m in averaged_metrics]) or 0.0
    machine_first_avg = average([m["machine_first_score"] for m in averaged_metrics]) or 0.0
    senior_led_avg = average([m["senior_led_score"] for m in averaged_metrics]) or 0.0
    proprietary_knowledge_avg = average([m["proprietary_knowledge_score"] for m in averaged_metrics]) or 0.0
    rework_efficiency_avg = average([m["rework_efficiency"] for m in averaged_metrics]) or 0.0
    client_impact_avg = average([m["client_impact"] for m in averaged_metrics]) or 0.0
    data_independence_avg = average([m["data_independence"] for m in averaged_metrics]) or 0.0
    reuse_intent_avg = average([m["reuse_intent_score"] for m in averaged_metrics]) or 0.0
    ai_survival_avg = average([m["ai_survival_rate"] for m in averaged_metrics if m.get("ai_survival_rate") is not None]) or 0.0
    client_pulse_avg = average([m["client_pulse_score"] for m in averaged_metrics if m.get("client_pulse_score") is not None]) or 0.0
    reuse_intent_rate = round2((sum(1 for m in averaged_metrics if m.get("reuse_intent_score") == 1.0) / completed_count) * 100) if completed_count else 0.0
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


def compute_scaling_gates_from_averaged(averaged_metrics: list[dict]) -> list[dict]:
    """Compute scaling gates from pre-averaged metrics. Simplified version that works with averaged data."""
    deliverable_types = {m.get("category_name") for m in averaged_metrics if m.get("category_name")}
    avg_effort = average([m["delivery_speed"] for m in averaged_metrics])
    reuse_rate = round2((sum(1 for m in averaged_metrics if m.get("reuse_intent_score") == 1.0) / len(averaged_metrics)) * 100) if averaged_metrics else None

    # For gates that need raw project data, we use what's available in averaged metrics
    # Gate 3: client-invisible quality — check rework efficiency
    client_invisible = any(
        m.get("rework_efficiency") is not None and m["rework_efficiency"] >= 1.0
        for m in averaged_metrics
    )

    # Gate 4: transferability — use pioneer/category data from metrics
    pioneer_cats = {}
    for m in averaged_metrics:
        pion = m.get("pioneer_name")
        cat = m.get("category_name")
        if pion and cat:
            pioneer_cats.setdefault(pion, set()).add(cat)
    cross_cat_count = sum(1 for cats in pioneer_cats.values() if len(cats) >= 2)

    # Gate 5: flywheel validation
    sorted_metrics = sorted(averaged_metrics, key=lambda m: m.get("created_at", ""))
    flywheel_first = sorted_metrics[:5]
    flywheel_recent = sorted_metrics[-5:] if len(sorted_metrics) >= 10 else sorted_metrics[5:]
    ff_avg = average([m["xcsg_advantage"] for m in flywheel_first]) if flywheel_first else None
    fr_avg = average([m["xcsg_advantage"] for m in flywheel_recent]) if flywheel_recent else None
    flywheel_pass = fr_avg >= ff_avg if ff_avg is not None and fr_avg is not None else False
    flywheel_detail = f"First 5 avg: {round2(ff_avg)}x → Recent {len(flywheel_recent)} avg: {round2(fr_avg)}x" if ff_avg and fr_avg else "Need at least 6 projects to compare"

    # Gate 6: compounding (D2 reuse) — approximate from knowledge score
    d2_reuse_rate = None  # Would need raw response data; skip for now

    return [
        {"id": 1, "name": "Multi-engagement", "description": "At least 2 deliverable types completed", "status": "pass" if len(deliverable_types) >= 2 else "pending", "detail": f"{len(deliverable_types)} deliverable type(s) completed"},
        {"id": 2, "name": "Effort reduction", "description": "Average effort ratio > 1.3", "status": "pass" if avg_effort is not None and avg_effort > 1.3 else "pending", "detail": f"Average effort ratio: {avg_effort}×" if avg_effort is not None else "Not enough data"},
        {"id": 3, "name": "Client-invisible quality", "description": "At least 1 deliverable with high rework efficiency", "status": "pass" if client_invisible else "pending", "detail": "Met" if client_invisible else "No qualifying deliverable yet"},
        {"id": 4, "name": "Transferability", "description": "≥2 pioneers with 2+ categories", "status": "pass" if cross_cat_count >= 2 else "pending", "detail": f"Cross-cat pioneers: {cross_cat_count} (need ≥2)"},
        {"id": 5, "name": "Flywheel validation", "description": "Average xCSG Value Gain of most recent 5 projects ≥ first 5", "status": "pass" if flywheel_pass else "pending", "detail": flywheel_detail},
        {"id": 6, "name": "Compounding", "description": "D2 reuse rate ≥ 40%", "status": "pass" if d2_reuse_rate is not None and d2_reuse_rate >= 40 else "pending", "detail": f"D2 reuse rate: {d2_reuse_rate}%" if d2_reuse_rate is not None else "Not enough data"},
        {"id": 7, "name": "Adoption confidence", "description": 'G1 "Yes without hesitation" ≥ 70%', "status": "pass" if reuse_rate is not None and reuse_rate >= 70 else "pending", "detail": f"Reuse intent rate: {reuse_rate}%" if reuse_rate is not None else "No reuse intent data yet"},
    ]
```

- [ ] **Step 3: Add monitoring endpoint**

```python
@app.get("/api/monitoring")
async def get_monitoring(
    status_filter: Optional[str] = Query(None, alias="status"),
    current_user: dict = Depends(auth.get_current_user),
):
    projects = db.list_projects(status_filter=status_filter)
    results = []
    total_pending = 0
    for p in projects:
        pioneers = db.list_pioneers(p["id"])
        default_rounds = p.get("default_rounds", 1) or 1
        total_expected = sum(
            (pp.get("total_rounds") or default_rounds) for pp in pioneers
        )
        total_completed = sum(pp.get("response_count", 0) for pp in pioneers)
        total_pending += max(total_expected - total_completed, 0)
        results.append({
            "id": p["id"],
            "project_name": p["project_name"],
            "category_name": p.get("category_name", ""),
            "status": p["status"],
            "pioneer_count": len(pioneers),
            "responses_completed": total_completed,
            "responses_expected": total_expected,
        })
    total_projects = len(results)
    complete_count = sum(1 for r in results if r["status"] == "complete")
    return {
        "projects": results,
        "total_projects": total_projects,
        "total_pending_responses": total_pending,
        "completion_rate": round(complete_count / total_projects * 100, 1) if total_projects else 0,
    }
```

- [ ] **Step 4: Verify syntax**

Run: `cd /Users/pj/Documents/Projects/xCSG-Value-Tracker && .venv/bin/python -c "from backend.app import app; print('OK')"`

Expected: `OK`

- [ ] **Step 5: Commit**

```bash
git add backend/app.py backend/metrics.py backend/database.py
git commit -m "feat: dashboard uses averaged metrics, add monitoring endpoint"
```

---

## Task 10: Update list_projects to Work with Pioneers

**Files:**
- Modify: `backend/database.py`

- [ ] **Step 1: Update list_projects to filter by pioneer via join**

The `pioneer` filter previously used `p.pioneer_name`. Now pioneer names are in `project_pioneers`:

```python
def list_projects(
    status_filter: Optional[str] = None,
    category_id: Optional[int] = None,
    pioneer: Optional[str] = None,
    client: Optional[str] = None,
) -> list:
    conn = get_connection()
    try:
        query = """SELECT DISTINCT p.*, pc.name as category_name
                   FROM projects p
                   JOIN project_categories pc ON p.category_id = pc.id"""
        params = []
        if pioneer:
            query += " JOIN project_pioneers pp ON pp.project_id = p.id"
        query += " WHERE 1=1"
        if status_filter:
            query += " AND p.status = ?"
            params.append(status_filter)
        if category_id:
            query += " AND p.category_id = ?"
            params.append(category_id)
        if pioneer:
            query += " AND pp.pioneer_name = ?"
            params.append(pioneer)
        if client:
            query += " AND p.client_name = ?"
            params.append(client)
        query += " ORDER BY p.created_at DESC"
        rows = conn.execute(query, params).fetchall()
        return [dict(r) for r in rows]
    finally:
        conn.close()
```

- [ ] **Step 2: Update get_project_by_token to use project_pioneers**

The old version looked up `expert_token` on the projects table. Now it should delegate to `get_pioneer_by_token`. Keep `get_project_by_token` for backward compatibility but route through pioneers:

```python
def get_project_by_token(token: str) -> Optional[sqlite3.Row]:
    """Legacy compat: look up by token in project_pioneers."""
    return get_pioneer_by_token(token)
```

- [ ] **Step 3: Verify syntax**

Run: `cd /Users/pj/Documents/Projects/xCSG-Value-Tracker && .venv/bin/python -c "from backend.database import list_projects, get_project_by_token; print('OK')"`

Expected: `OK`

- [ ] **Step 4: Commit**

```bash
git add backend/database.py
git commit -m "feat: list_projects filters by pioneer via join, token lookup uses project_pioneers"
```

---

## Task 11: Frontend — Update Project Form for Multiple Pioneers

**Files:**
- Modify: `frontend/app.js:632-800` (renderNewProject function)

- [ ] **Step 1: Replace single pioneer fields with dynamic pioneers list**

In `renderNewProject()`, replace the pioneer name/email form row with a dynamic pioneers section. The pioneers fieldset should contain:

```javascript
<fieldset><legend>Pioneers</legend>
  <div id="pioneersContainer"></div>
  <button type="button" class="btn btn-secondary btn-sm" id="addPioneerBtn" style="margin-top:8px">+ Add Pioneer</button>
  <div class="form-row" style="margin-top:16px">
    <div class="form-group">
      <label>Default Rounds</label>
      <input type="number" id="fDefaultRounds" min="1" max="${schema.max_rounds || 10}" value="${p.default_rounds || 1}" style="width:80px">
    </div>
    <div class="form-group">
      <label>Show Previous Answers</label>
      <select id="fShowPrevious">
        <option value="0" ${!p.show_previous_answers ? 'selected' : ''}>No</option>
        <option value="1" ${p.show_previous_answers ? 'selected' : ''}>Yes</option>
      </select>
    </div>
  </div>
</fieldset>
```

Add JavaScript functions to manage the dynamic list:

```javascript
let pioneerIndex = 0;
function addPioneerRow(name = '', email = '', rounds = '') {
  const idx = pioneerIndex++;
  const container = document.getElementById('pioneersContainer');
  const row = document.createElement('div');
  row.className = 'form-row pioneer-row';
  row.dataset.idx = idx;
  row.innerHTML = `
    <div class="form-group"><label>Name *</label><input type="text" class="pioneer-name" value="${esc(name)}" required></div>
    <div class="form-group"><label>Email</label><input type="email" class="pioneer-email" value="${esc(email)}"></div>
    <div class="form-group" style="max-width:100px"><label>Rounds</label><input type="number" class="pioneer-rounds" min="1" max="${schema.max_rounds || 10}" value="${esc(rounds)}" placeholder="default"></div>
    <div class="form-group" style="max-width:40px;align-self:flex-end"><button type="button" class="btn btn-danger btn-sm remove-pioneer" style="padding:6px 10px">×</button></div>
  `;
  container.appendChild(row);
  row.querySelector('.remove-pioneer').addEventListener('click', () => {
    if (document.querySelectorAll('.pioneer-row').length > 1) row.remove();
  });
}
```

For new projects, call `addPioneerRow()` once. For edit mode, populate from `p.pioneers`.

Update the submit handler to collect pioneers:

```javascript
const pioneerRows = document.querySelectorAll('.pioneer-row');
const pioneers = [];
pioneerRows.forEach(row => {
  const name = row.querySelector('.pioneer-name').value.trim();
  if (name) {
    pioneers.push({
      name: name,
      email: row.querySelector('.pioneer-email').value || null,
      total_rounds: parseInt(row.querySelector('.pioneer-rounds').value) || null,
    });
  }
});
payload.pioneers = pioneers;
payload.default_rounds = parseInt(document.getElementById('fDefaultRounds').value) || 1;
payload.show_previous_answers = document.getElementById('fShowPrevious').value === '1';
```

Remove `pioneer_name` and `pioneer_email` from the payload.

- [ ] **Step 2: Update showExpertLink to show multiple pioneer links**

After project creation, the response includes a `pioneers` array. Update `showExpertLink` to show all pioneer tokens:

```javascript
function showExpertLinks(pioneers) {
  const base = window.location.origin + '/#expert/';
  let html = '<div class="expert-links-modal"><h3>Expert Assessment Links</h3>';
  for (const p of pioneers) {
    const url = base + p.expert_token;
    html += `<div class="pioneer-link-row" style="margin:12px 0;padding:12px;background:var(--gray-50);border-radius:var(--radius)">
      <strong>${esc(p.pioneer_name)}</strong>${p.pioneer_email ? ' (' + esc(p.pioneer_email) + ')' : ''}
      <div style="margin-top:6px;display:flex;gap:8px;align-items:center">
        <input type="text" value="${url}" readonly style="flex:1;padding:8px;font-size:12px;border:1px solid var(--gray-300);border-radius:var(--radius)">
        <button class="btn btn-secondary btn-sm" onclick="navigator.clipboard.writeText('${url}');this.textContent='Copied!';setTimeout(()=>this.textContent='Copy',2000)">Copy</button>
      </div>
    </div>`;
  }
  html += '</div>';
  showModal(html);
}
```

- [ ] **Step 3: Verify syntax**

Run: `node --check frontend/app.js`

Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add frontend/app.js
git commit -m "feat: frontend project form supports multiple pioneers"
```

---

## Task 12: Frontend — Update Expert Flow for Rounds

**Files:**
- Modify: `frontend/app.js:1247-1540` (renderExpert function)

- [ ] **Step 1: Update renderExpert to handle rounds**

The API now returns `current_round`, `total_rounds`, `show_previous`, and `previous_responses`. Update `renderExpert()`:

- Show "Round N of M" in the header
- If `show_previous` and `previous_responses` exist, render them read-only above the form in a collapsible section
- After submit, if `rounds_remaining > 0`, show a message with the round info instead of the generic "Already Submitted"
- Show aggregated metrics from other pioneers after submission

Key changes to the expert header:

```javascript
// After Section A context card
html += '<div class="expert-round-info" style="text-align:center;padding:12px;background:var(--blue-light,#EBF5FB);border-radius:var(--radius);margin:16px 0">';
html += '<strong>Round ' + ctx.current_round + ' of ' + ctx.total_rounds + '</strong>';
if (ctx.total_rounds > 1) {
  html += '<span style="color:var(--gray-500);margin-left:8px">(' + (ctx.total_rounds - ctx.current_round) + ' remaining after this)</span>';
}
html += '</div>';
```

If `ctx.show_previous && ctx.previous_responses`:

```javascript
html += '<details class="previous-responses" style="margin:16px 0">';
html += '<summary style="cursor:pointer;font-weight:600;color:var(--navy)">View Your Previous Responses</summary>';
html += '<div style="padding:12px;background:var(--gray-50);border-radius:var(--radius);margin-top:8px">';
for (const prev of ctx.previous_responses) {
  html += '<div style="margin-bottom:12px"><strong>Round ' + prev.round_number + '</strong></div>';
  // Render each field as read-only text
  for (const [key, val] of Object.entries(prev)) {
    if (key.startsWith('b') || key.startsWith('c') || key.startsWith('d') || key.startsWith('e') || key.startsWith('f') || key.startsWith('g') || key.startsWith('l')) {
      if (val) html += '<div style="font-size:13px;color:var(--gray-600)">' + esc(key) + ': ' + esc(String(val)) + '</div>';
    }
  }
}
html += '</div></details>';
```

After submit, update the thank-you screen:

```javascript
if (result.rounds_remaining > 0) {
  ec.innerHTML = '<div class="expert-thankyou"><div class="thankyou-icon">&#10003;</div>'
    + '<h2>Round ' + result.current_round + ' of ' + result.total_rounds + ' Complete</h2>'
    + '<p>Thank you! You have ' + result.rounds_remaining + ' round(s) remaining. Use this same link when ready for the next round.</p>'
    + '</div>';
} else {
  // existing thank-you with metrics display
}
```

- [ ] **Step 2: Verify syntax**

Run: `node --check frontend/app.js`

Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add frontend/app.js
git commit -m "feat: expert flow supports multiple rounds with previous answer visibility"
```

---

## Task 13: Frontend — Project Detail Pioneer Table

**Files:**
- Modify: `frontend/app.js` (renderEditProject / project detail area)

- [ ] **Step 1: Add pioneers section to project detail**

In `renderEditProject()` or wherever the project detail view renders, add a "Pioneers" section after the form:

```javascript
// After the main form, add pioneers table
const pioneers = project.pioneers || [];
const defaultRounds = project.default_rounds || 1;
let pioneersHtml = '<fieldset><legend>Pioneers & Assessment Links</legend>';
pioneersHtml += '<table class="data-table" style="width:100%"><thead><tr>';
pioneersHtml += '<th>Pioneer</th><th>Email</th><th>Round</th><th>Status</th><th>Last Submitted</th><th>Actions</th>';
pioneersHtml += '</tr></thead><tbody>';

for (const p of pioneers) {
  const totalRounds = p.total_rounds || defaultRounds;
  const completed = p.response_count || 0;
  const status = completed >= totalRounds ? 'Complete' : (completed > 0 ? 'Partial' : 'Pending');
  const statusClass = status === 'Complete' ? 'badge-success' : (status === 'Partial' ? 'badge-warning' : 'badge-secondary');
  const expertUrl = window.location.origin + '/#expert/' + p.expert_token;

  pioneersHtml += '<tr>';
  pioneersHtml += '<td>' + esc(p.pioneer_name) + '</td>';
  pioneersHtml += '<td>' + esc(p.pioneer_email || '—') + '</td>';
  pioneersHtml += '<td>' + completed + ' of ' + totalRounds + '</td>';
  pioneersHtml += '<td><span class="badge ' + statusClass + '">' + status + '</span></td>';
  pioneersHtml += '<td>' + (p.last_submitted || '—') + '</td>';
  pioneersHtml += '<td>';
  pioneersHtml += '<button class="btn btn-secondary btn-sm" onclick="navigator.clipboard.writeText(\'' + expertUrl + '\');showToast(\'Link copied\')">Copy Link</button>';
  if (completed === 0 && canWrite()) {
    pioneersHtml += ' <button class="btn btn-danger btn-sm" onclick="removePioneer(' + project.id + ',' + p.id + ',\'' + esc(p.pioneer_name) + '\')">Remove</button>';
  }
  pioneersHtml += '</td></tr>';
}
pioneersHtml += '</tbody></table>';

if (canWrite()) {
  pioneersHtml += '<div style="margin-top:12px"><button class="btn btn-secondary btn-sm" onclick="showAddPioneerForm(' + project.id + ')">+ Add Pioneer</button></div>';
}
pioneersHtml += '</fieldset>';
```

Add helper functions:

```javascript
async function removePioneer(projectId, pioneerId, name) {
  if (!confirm('Remove pioneer ' + name + '?')) return;
  await apiCall('DELETE', '/projects/' + projectId + '/pioneers/' + pioneerId);
  showToast('Pioneer removed');
  window.location.hash = '#edit/' + projectId;
}

function showAddPioneerForm(projectId) {
  showModal(`
    <h3>Add Pioneer</h3>
    <div class="form-group"><label>Name *</label><input type="text" id="newPioneerName" required></div>
    <div class="form-group"><label>Email</label><input type="email" id="newPioneerEmail"></div>
    <div class="form-group"><label>Rounds (leave blank for project default)</label><input type="number" id="newPioneerRounds" min="1" max="10"></div>
    <button class="btn btn-primary" onclick="submitAddPioneer(${projectId})">Add</button>
  `);
}

async function submitAddPioneer(projectId) {
  const name = document.getElementById('newPioneerName').value.trim();
  if (!name) return;
  await apiCall('POST', '/projects/' + projectId + '/pioneers', {
    name: name,
    email: document.getElementById('newPioneerEmail').value || null,
    total_rounds: parseInt(document.getElementById('newPioneerRounds').value) || null,
  });
  document.querySelector('.modal-backdrop')?.remove();
  showToast('Pioneer added');
  window.location.hash = '#edit/' + projectId;
}
```

- [ ] **Step 2: Verify syntax**

Run: `node --check frontend/app.js`

Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add frontend/app.js
git commit -m "feat: project detail shows pioneer table with status and links"
```

---

## Task 14: Frontend — Monitoring Page

**Files:**
- Modify: `frontend/app.js` (add renderMonitoring function, update router)
- Modify: `frontend/styles.css`

- [ ] **Step 1: Add monitoring route to the router**

In the hash router section of `app.js`, add:

```javascript
} else if (hash === '#monitoring' || hash === '#monitoring/') {
  showScreen('app');
  await renderMonitoring();
```

Add navigation link in the sidebar/nav for admin and analyst roles.

- [ ] **Step 2: Implement renderMonitoring**

```javascript
async function renderMonitoring() {
  const mc = document.getElementById('mainContent');
  mc.innerHTML = '<div class="loading">Loading monitoring data…</div>';

  try {
    const data = await apiCall('GET', '/monitoring');

    let html = '<div class="page-header"><h1>Pioneer Monitoring</h1></div>';

    // Summary bar
    html += '<div class="kpi-grid" style="margin-bottom:24px">';
    html += '<div class="kpi-card"><div class="kpi-value">' + data.total_projects + '</div><div class="kpi-label">Total Projects</div></div>';
    html += '<div class="kpi-card"><div class="kpi-value">' + data.total_pending_responses + '</div><div class="kpi-label">Pending Responses</div></div>';
    html += '<div class="kpi-card"><div class="kpi-value">' + data.completion_rate + '%</div><div class="kpi-label">Completion Rate</div></div>';
    html += '</div>';

    // Filter
    html += '<div style="margin-bottom:16px">';
    html += '<select id="monitoringFilter" style="padding:8px 12px;border:1px solid var(--gray-300);border-radius:var(--radius)">';
    html += '<option value="">All Statuses</option>';
    html += '<option value="pending">Pending</option>';
    html += '<option value="partial">Partial</option>';
    html += '<option value="complete">Complete</option>';
    html += '</select></div>';

    // Table
    html += '<table class="data-table" id="monitoringTable"><thead><tr>';
    html += '<th>Project</th><th>Category</th><th>Pioneers</th><th>Responses</th><th>Status</th>';
    html += '</tr></thead><tbody>';

    for (const p of data.projects) {
      const statusClass = p.status === 'complete' ? 'badge-success' : (p.status === 'partial' ? 'badge-warning' : 'badge-secondary');
      html += '<tr class="monitoring-row clickable" data-status="' + p.status + '" onclick="window.location.hash=\'#edit/' + p.id + '\'">';
      html += '<td>' + esc(p.project_name) + '</td>';
      html += '<td>' + esc(p.category_name) + '</td>';
      html += '<td>' + p.pioneer_count + '</td>';
      html += '<td>' + p.responses_completed + ' of ' + p.responses_expected + '</td>';
      html += '<td><span class="badge ' + statusClass + '">' + p.status + '</span></td>';
      html += '</tr>';
    }

    html += '</tbody></table>';
    mc.innerHTML = html;

    // Filter handler
    document.getElementById('monitoringFilter').addEventListener('change', function() {
      const val = this.value;
      document.querySelectorAll('.monitoring-row').forEach(row => {
        row.style.display = (!val || row.dataset.status === val) ? '' : 'none';
      });
    });
  } catch (err) {
    mc.innerHTML = '<div class="error">Error loading monitoring data: ' + esc(err.message) + '</div>';
  }
}
```

- [ ] **Step 3: Add monitoring nav link**

In the navigation/sidebar HTML, add between existing links:

```javascript
${canWrite() ? '<a href="#monitoring" class="nav-link"><span class="nav-icon">📊</span> Monitoring</a>' : ''}
```

- [ ] **Step 4: Add styles for monitoring page**

Append to `frontend/styles.css`:

```css
/* Monitoring */
.monitoring-row.clickable { cursor: pointer; }
.monitoring-row.clickable:hover { background: var(--gray-50); }
.badge-warning { background: #FEF3C7; color: #92400E; }
```

- [ ] **Step 5: Verify syntax**

Run: `node --check frontend/app.js`

Expected: No errors

- [ ] **Step 6: Commit**

```bash
git add frontend/app.js frontend/styles.css
git commit -m "feat: monitoring page for PMO response tracking"
```

---

## Task 15: Update Projects List to Show Pioneer Count

**Files:**
- Modify: `frontend/app.js` (renderProjects function)

- [ ] **Step 1: Update project list columns**

In `renderProjects()`, replace the single pioneer name column with pioneer count and response progress:

Where the table headers are defined, change `Pioneer` to `Pioneers` and add a `Responses` column.

In the row rendering, change:
```javascript
// Old: <td>${esc(p.pioneer_name)}</td>
// New:
const pioneers = p.pioneers || [];
const pioneerNames = pioneers.map(pp => pp.pioneer_name).join(', ');
html += '<td title="' + esc(pioneerNames) + '">' + pioneers.length + ' pioneer' + (pioneers.length !== 1 ? 's' : '') + '</td>';
html += '<td>' + (p.response_count || 0) + ' of ' + (p.responses_expected || pioneers.length) + '</td>';
```

Update status badges to handle `partial`:
```javascript
const statusClass = p.status === 'complete' ? 'badge-success' : (p.status === 'partial' ? 'badge-warning' : 'badge-secondary');
```

- [ ] **Step 2: Verify syntax**

Run: `node --check frontend/app.js`

Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add frontend/app.js
git commit -m "feat: projects list shows pioneer count and response progress"
```

---

## Task 16: Update Excel Export

**Files:**
- Modify: `backend/app.py` (export_excel function)

- [ ] **Step 1: Update export to handle multiple responses per project**

The export currently references `p["pioneer_name"]` from the projects table. Update to join through pioneers:

```python
# In the Raw Data sheet, add pioneer name from project_pioneers
for p in all_p:
    pioneers = db.list_pioneers(p["id"])
    pioneer_names = ", ".join(pp["pioneer_name"] for pp in pioneers)
    # Use pioneer_names instead of p["pioneer_name"]
```

Update the headers to reflect the new structure and use `pioneer_names` variable.

- [ ] **Step 2: Verify syntax**

Run: `cd /Users/pj/Documents/Projects/xCSG-Value-Tracker && .venv/bin/python -c "from backend.app import app; print('OK')"`

Expected: `OK`

- [ ] **Step 3: Commit**

```bash
git add backend/app.py
git commit -m "feat: excel export handles multi-pioneer projects"
```

---

## Task 17: Run Backend Tests

**Files:**
- Test: `tests/test_multi_pioneer.py`

- [ ] **Step 1: Run the full test suite**

Run: `cd /Users/pj/Documents/Projects/xCSG-Value-Tracker && .venv/bin/python tests/test_multi_pioneer.py`

Expected: `All tests passed.`

- [ ] **Step 2: Verify the server starts**

Run: `cd /Users/pj/Documents/Projects/xCSG-Value-Tracker && .venv/bin/python -m uvicorn backend.app:app --port 8766 &` (different port to avoid conflicts)

Hit: `curl http://localhost:8766/api/health`

Expected: `{"status":"ok","version":"2.1.0"}`

Kill the server.

- [ ] **Step 3: Commit if any fixes were needed**

```bash
git add -A
git commit -m "fix: address test failures from integration"
```

---

## Task 18: E2E Tests

**Files:**
- Create: `tests/e2e-multi-pioneer.spec.ts`

- [ ] **Step 1: Create E2E test for multi-pioneer flow**

```typescript
import { test, expect } from '@playwright/test';

const BASE = 'http://localhost:8765';

test.describe('Multi-Pioneer Flow', () => {
  test.beforeAll(async () => {
    // Delete DB for clean state (handled by playwright config)
  });

  test('create project with multiple pioneers', async ({ page }) => {
    await page.goto(BASE);
    // Login as admin
    await page.fill('#username', 'admin');
    await page.fill('#password', 'AliraAdmin2026!');
    await page.click('#loginBtn');
    await page.waitForSelector('#mainContent');

    // Navigate to new project
    await page.goto(BASE + '/#new');
    await page.waitForSelector('#projectForm');

    // Fill project info
    await page.fill('#fName', 'Multi-Pioneer Test');
    await page.selectOption('#fCategory', { index: 1 });
    await page.fill('#fXTeam', '2');
    await page.fill('#fRevisions', '1');

    // First pioneer should already be there
    await page.fill('.pioneer-name', 'Alice');
    await page.fill('.pioneer-email', 'alice@test.com');

    // Add second pioneer
    await page.click('#addPioneerBtn');
    const nameInputs = await page.locator('.pioneer-name').all();
    await nameInputs[1].fill('Bob');

    // Set default rounds
    await page.fill('#fDefaultRounds', '2');

    // Submit
    await page.click('#fSubmit');
    await page.waitForSelector('.modal-backdrop, .expert-links-modal');
  });

  test('pioneer can submit round 1 and see round info', async ({ page }) => {
    await page.goto(BASE);
    await page.fill('#username', 'admin');
    await page.fill('#password', 'AliraAdmin2026!');
    await page.click('#loginBtn');
    await page.waitForSelector('#mainContent');

    // Get first project's pioneer links
    await page.goto(BASE + '/#projects');
    await page.waitForSelector('.data-table');
    // Click first project
    await page.click('.data-table tbody tr:first-child');
    await page.waitForTimeout(1000);

    // Check that pioneer table exists
    await expect(page.locator('text=Pioneers & Assessment Links')).toBeVisible();
  });

  test('monitoring page shows project status', async ({ page }) => {
    await page.goto(BASE);
    await page.fill('#username', 'admin');
    await page.fill('#password', 'AliraAdmin2026!');
    await page.click('#loginBtn');
    await page.waitForSelector('#mainContent');

    await page.goto(BASE + '/#monitoring');
    await page.waitForSelector('#monitoringTable');
    await expect(page.locator('#monitoringTable')).toBeVisible();
  });
});
```

- [ ] **Step 2: Run E2E tests**

Run: `npx playwright test tests/e2e-multi-pioneer.spec.ts --headed --timeout 600000`

Expected: All tests pass.

- [ ] **Step 3: Commit**

```bash
git add tests/e2e-multi-pioneer.spec.ts
git commit -m "test: E2E tests for multi-pioneer flow"
```

---

## Task 19: Update FRAMEWORK.md

**Files:**
- Modify: `FRAMEWORK.md`

- [ ] **Step 1: Update framework doc**

Add a "Multi-Pioneer Assessment" section after "Data Priority":

```markdown
## Multi-Pioneer Assessment

Projects can have multiple pioneers, each independently assessed over multiple rounds.

### How it works

- PMO assigns one or more pioneers when creating a project
- Each pioneer gets their own unique assessment link
- PMO sets a default number of rounds per project, with optional per-pioneer override
- The same link works for all rounds — the system tracks which round the pioneer is on
- PMO can optionally allow pioneers to see their previous answers

### Metrics computation

All expert responses for a project (across all pioneers and all rounds) are averaged:

1. Each individual response is scored using the same formulas as a single-response project
2. The per-response metrics are averaged to produce project-level metrics
3. Dashboard, norms, and scaling gates use these averaged project-level metrics

A project with 1 pioneer and 1 response computes identically to the original single-response model.

### Project status

| Status | Condition |
|--------|-----------|
| Pending | No responses received |
| Partial | At least 1 response, but not all pioneers × rounds completed |
| Complete | Every pioneer has completed all their rounds |

Metrics are available on the dashboard as soon as the first response is submitted (partial status).
```

- [ ] **Step 2: Commit**

```bash
git add FRAMEWORK.md
git commit -m "docs: document multi-pioneer assessment in framework"
```

---

## Task 20: Final Integration Test and Push

- [ ] **Step 1: Run all backend tests**

Run: `cd /Users/pj/Documents/Projects/xCSG-Value-Tracker && .venv/bin/python tests/test_multi_pioneer.py`

- [ ] **Step 2: Start the server and manually verify**

Run: `cd /Users/pj/Documents/Projects/xCSG-Value-Tracker && ./launch.sh`

Manual checks:
1. Login as admin
2. Create a project with 2 pioneers and 2 rounds
3. Copy both pioneer links
4. Open pioneer 1 link — see "Round 1 of 2"
5. Fill and submit the survey
6. See "Round 1 of 2 Complete"
7. Open the same link again — see form for round 2
8. Go to #monitoring — see the project with "1 of 4" responses
9. Check project detail — see pioneer table with statuses
10. Check dashboard — project metrics appear (partial status)

- [ ] **Step 3: Fix any issues found**

- [ ] **Step 4: Final commit and push**

```bash
git add -A
git commit -m "feat: v1.1 — multi-pioneer longitudinal surveys"
git push origin main
```
