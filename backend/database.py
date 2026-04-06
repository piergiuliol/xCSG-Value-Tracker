"""
database.py — SQLite CRUD, schema, and seed data for xCSG Value Tracker v2
Project-centric redesign: deliverables → projects, category-keyed norms.
"""
import json
import os
import secrets
import sqlite3
from typing import Optional

DATABASE_PATH = os.environ.get("DATABASE_PATH", "./data/tracker.db")


def get_connection() -> sqlite3.Connection:
    """Open a connection with WAL mode and foreign keys enabled."""
    os.makedirs(os.path.dirname(os.path.abspath(DATABASE_PATH)), exist_ok=True)
    conn = sqlite3.connect(DATABASE_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    return conn


def init_db() -> None:
    """Create all tables if they don't exist, then seed data."""
    conn = get_connection()
    try:
        conn.executescript("""
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT UNIQUE NOT NULL,
                email TEXT UNIQUE NOT NULL,
                password_hash TEXT NOT NULL,
                role TEXT DEFAULT 'viewer',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS project_categories (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT UNIQUE NOT NULL,
                description TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS projects (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                created_by INTEGER NOT NULL,
                project_name TEXT NOT NULL,
                category_id INTEGER NOT NULL,
                client_name TEXT,
                pioneer_name TEXT NOT NULL,
                pioneer_email TEXT,
                description TEXT,
                date_started TEXT,
                date_delivered TEXT,
                status TEXT DEFAULT 'expert_pending',
                xcsg_calendar_days TEXT NOT NULL,
                xcsg_team_size TEXT NOT NULL,
                xcsg_revision_rounds TEXT NOT NULL,
                xcsg_scope_expansion TEXT,
                legacy_calendar_days TEXT,
                legacy_team_size TEXT,
                legacy_revision_rounds TEXT,
                legacy_overridden INTEGER DEFAULT 0,
                expert_token TEXT UNIQUE NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (created_by) REFERENCES users(id),
                FOREIGN KEY (category_id) REFERENCES project_categories(id)
            );

            CREATE TABLE IF NOT EXISTS expert_responses (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                project_id INTEGER UNIQUE NOT NULL,
                b1_starting_point TEXT NOT NULL,
                b2_research_sources TEXT NOT NULL,
                b3_assembly_ratio TEXT NOT NULL,
                b4_hypothesis_first TEXT NOT NULL,
                c1_specialization TEXT NOT NULL,
                c2_directness TEXT NOT NULL,
                c3_judgment_pct TEXT NOT NULL,
                d1_proprietary_data TEXT NOT NULL,
                d2_knowledge_reuse TEXT NOT NULL,
                d3_moat_test TEXT NOT NULL,
                f1_feasibility TEXT NOT NULL,
                f2_productization TEXT NOT NULL,
                submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS legacy_norms (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                category_id INTEGER UNIQUE NOT NULL,
                typical_calendar_days TEXT NOT NULL,
                typical_team_size TEXT NOT NULL,
                typical_revision_rounds TEXT NOT NULL,
                notes TEXT,
                updated_by INTEGER,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (category_id) REFERENCES project_categories(id),
                FOREIGN KEY (updated_by) REFERENCES users(id)
            );

            CREATE TABLE IF NOT EXISTS activity_log (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                action TEXT NOT NULL,
                project_id INTEGER,
                details TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id)
            );
        """)
        conn.commit()
    finally:
        conn.close()

    migrate_v2()
    seed_data()


def seed_data() -> None:
    """Create seed users (with password re-hash verification), categories, and legacy norms."""
    from backend import auth as _auth

    SEED_USERS = [
        ("admin", "admin@alira.health", "AliraAdmin2026!", "admin"),
        ("pmo", "pmo@alira.health", "AliraPMO2026!", "analyst"),
    ]

    conn = get_connection()
    try:
        for username, email, password, role in SEED_USERS:
            row = conn.execute(
                "SELECT id, password_hash FROM users WHERE username = ?", (username,)
            ).fetchone()

            if row is None:
                hashed = _auth.hash_password(password)
                conn.execute(
                    "INSERT INTO users (username, email, password_hash, role) VALUES (?, ?, ?, ?)",
                    (username, email, hashed, role),
                )
            else:
                if not _auth.verify_password(password, row["password_hash"]):
                    new_hash = _auth.hash_password(password)
                    conn.execute(
                        "UPDATE users SET password_hash = ? WHERE id = ?",
                        (new_hash, row["id"]),
                    )

        # Seed categories
        SEED_CATEGORIES = [
            ("CDD", "Commercial due diligence"),
            ("Competitive Landscape", "Competitive analysis and market mapping"),
            ("Financial Model", "Financial modelling and projections"),
            ("Market Access", "Market access and reimbursement strategy"),
            ("Proposal", "Client proposal or pitch document"),
            ("Call Prep Brief", "KOL or expert interview preparation"),
            ("Presentation", "Slide deck or presentation"),
            ("KOL Mapping", "Key opinion leader identification and mapping"),
        ]
        for name, desc in SEED_CATEGORIES:
            conn.execute(
                "INSERT OR IGNORE INTO project_categories (name, description) VALUES (?, ?)",
                (name, desc),
            )

        conn.commit()

        # Seed legacy norms keyed by category_id
        SEED_NORMS = [
            ("CDD", "11-20", "3", "2", "Full commercial due diligence"),
            ("Competitive Landscape", "11-20", "3", "2", "Competitive analysis and market mapping"),
            ("Financial Model", "6-10", "2", "1", "Financial modelling and projections"),
            ("Market Access", "11-20", "3", "2", "Market access and reimbursement strategy"),
            ("Proposal", "4-5", "2", "1", "Client proposal or pitch document"),
            ("Call Prep Brief", "2-3", "1", "1", "KOL or expert interview preparation"),
            ("Presentation", "4-5", "2", "2", "Slide deck or presentation"),
            ("KOL Mapping", "11-20", "3", "2", "Key opinion leader identification and mapping"),
        ]
        for cat_name, days, team, revisions, notes in SEED_NORMS:
            cat = conn.execute(
                "SELECT id FROM project_categories WHERE name = ?", (cat_name,)
            ).fetchone()
            if cat:
                conn.execute(
                    """INSERT OR IGNORE INTO legacy_norms
                       (category_id, typical_calendar_days, typical_team_size, typical_revision_rounds, notes)
                       VALUES (?, ?, ?, ?, ?)""",
                    (cat["id"], days, team, revisions, notes),
                )

        conn.commit()
    finally:
        conn.close()


def migrate_v2() -> None:
    """Add v2 columns and tables. Idempotent."""
    conn = get_connection()
    try:
        # New columns on projects
        new_cols = [
            ("complexity", "REAL"),
            ("client_sector", "TEXT"),
            ("client_sub_category", "TEXT"),
            ("geographies", "TEXT"),
            ("countries_served", "TEXT"),
            ("xcsg_revision_intensity", "REAL"),
            ("xcsg_scope_expansion_score", "REAL"),
            ("legacy_scope_expansion", "REAL"),
            ("legacy_senior_involvement", "REAL"),
            ("legacy_ai_usage", "REAL"),
            ("xcsg_senior_involvement", "REAL"),
            ("xcsg_ai_usage", "REAL"),
            ("machine_first_score", "REAL"),
        ]
        for col_name, col_type in new_cols:
            try:
                conn.execute(f"ALTER TABLE projects ADD COLUMN {col_name} {col_type}")
            except sqlite3.OperationalError:
                pass  # column already exists

        # V2 norms table
        conn.execute("""
            CREATE TABLE IF NOT EXISTS legacy_norms_v2 (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                category_id INTEGER NOT NULL,
                complexity REAL,
                client_sector TEXT,
                client_sub_category TEXT,
                geographies TEXT,
                countries_served TEXT,
                avg_calendar_days REAL,
                avg_team_size REAL,
                avg_revision_intensity REAL,
                avg_scope_expansion REAL,
                avg_senior_involvement REAL,
                avg_ai_usage REAL,
                sample_size INTEGER DEFAULT 0,
                notes TEXT,
                updated_by TEXT,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (category_id) REFERENCES project_categories(id)
            )
        """)

        # History table
        conn.execute("""
            CREATE TABLE IF NOT EXISTS legacy_norms_history (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                norm_id INTEGER NOT NULL,
                field_changed TEXT NOT NULL,
                old_value TEXT,
                new_value TEXT,
                changed_by TEXT,
                changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (norm_id) REFERENCES legacy_norms_v2(id) ON DELETE CASCADE
            )
        """)

        conn.commit()
    finally:
        conn.close()


# ── Users ──────────────────────────────────────────────────────────────────────

def get_user_by_username(username: str) -> Optional[sqlite3.Row]:
    conn = get_connection()
    try:
        return conn.execute(
            "SELECT * FROM users WHERE username = ?", (username,)
        ).fetchone()
    finally:
        conn.close()


def get_user_by_id(user_id: int) -> Optional[sqlite3.Row]:
    conn = get_connection()
    try:
        return conn.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
    finally:
        conn.close()


def create_user(username: str, email: str, password_hash: str, role: str) -> int:
    conn = get_connection()
    try:
        cur = conn.execute(
            "INSERT INTO users (username, email, password_hash, role) VALUES (?, ?, ?, ?)",
            (username, email, password_hash, role),
        )
        conn.commit()
        return cur.lastrowid
    finally:
        conn.close()


# ── Project Categories ───────────────────────────────────────────────────────

def list_categories() -> list:
    conn = get_connection()
    try:
        rows = conn.execute("SELECT * FROM project_categories ORDER BY name").fetchall()
        return [dict(r) for r in rows]
    finally:
        conn.close()


def get_category(category_id: int) -> Optional[sqlite3.Row]:
    conn = get_connection()
    try:
        return conn.execute(
            "SELECT * FROM project_categories WHERE id = ?", (category_id,)
        ).fetchone()
    finally:
        conn.close()


def create_category(name: str, description: Optional[str] = None) -> int:
    conn = get_connection()
    try:
        cur = conn.execute(
            "INSERT INTO project_categories (name, description) VALUES (?, ?)",
            (name, description),
        )
        conn.commit()
        return cur.lastrowid
    finally:
        conn.close()


def update_category(category_id: int, name: str, description: Optional[str] = None) -> bool:
    conn = get_connection()
    try:
        conn.execute(
            "UPDATE project_categories SET name = ?, description = ? WHERE id = ?",
            (name, description, category_id),
        )
        conn.commit()
        return True
    finally:
        conn.close()


def delete_category(category_id: int) -> bool:
    conn = get_connection()
    try:
        # Check if projects exist for this category
        count = conn.execute(
            "SELECT COUNT(*) FROM projects WHERE category_id = ?", (category_id,)
        ).fetchone()[0]
        if count > 0:
            return False
        conn.execute("DELETE FROM legacy_norms WHERE category_id = ?", (category_id,))
        conn.execute("DELETE FROM project_categories WHERE id = ?", (category_id,))
        conn.commit()
        return True
    finally:
        conn.close()


def category_has_projects(category_id: int) -> bool:
    conn = get_connection()
    try:
        count = conn.execute(
            "SELECT COUNT(*) FROM projects WHERE category_id = ?", (category_id,)
        ).fetchone()[0]
        return count > 0
    finally:
        conn.close()


# ── Projects ─────────────────────────────────────────────────────────────────

def create_project(data: dict) -> int:
    """Create a project. Auto-populates legacy fields from category norms if null."""
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

    token = secrets.token_urlsafe(32)
    legacy_overridden = data.get("legacy_overridden", False)
    conn = get_connection()
    try:
        cur = conn.execute(
            """INSERT INTO projects
               (created_by, project_name, category_id, client_name,
                pioneer_name, pioneer_email, description,
                date_started, date_delivered,
                xcsg_calendar_days, xcsg_team_size, xcsg_revision_rounds, xcsg_scope_expansion,
                legacy_calendar_days, legacy_team_size, legacy_revision_rounds,
                legacy_overridden, expert_token,
                complexity, client_sector, client_sub_category, geographies, countries_served)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                data["created_by"],
                data["project_name"],
                data["category_id"],
                data.get("client_name"),
                data["pioneer_name"],
                data.get("pioneer_email"),
                data.get("description"),
                data.get("date_started"),
                data.get("date_delivered"),
                data["xcsg_calendar_days"],
                data["xcsg_team_size"],
                data["xcsg_revision_rounds"],
                data.get("xcsg_scope_expansion"),
                data["legacy_calendar_days"],
                data["legacy_team_size"],
                data["legacy_revision_rounds"],
                1 if legacy_overridden else 0,
                token,
                data.get("complexity"),
                data.get("client_sector"),
                data.get("client_sub_category"),
                json.dumps(data["geographies"]) if data.get("geographies") else None,
                json.dumps(data["countries_served"]) if data.get("countries_served") else None,
            ),
        )
        conn.commit()
        return cur.lastrowid
    finally:
        conn.close()


def get_project(project_id: int) -> Optional[sqlite3.Row]:
    conn = get_connection()
    try:
        return conn.execute(
            """SELECT p.*, pc.name as category_name
               FROM projects p
               JOIN project_categories pc ON p.category_id = pc.id
               WHERE p.id = ?""",
            (project_id,),
        ).fetchone()
    finally:
        conn.close()


def list_projects(
    status_filter: Optional[str] = None,
    category_id: Optional[int] = None,
    pioneer: Optional[str] = None,
    client: Optional[str] = None,
) -> list:
    conn = get_connection()
    try:
        query = """SELECT p.*, pc.name as category_name
                   FROM projects p
                   JOIN project_categories pc ON p.category_id = pc.id
                   WHERE 1=1"""
        params = []
        if status_filter:
            query += " AND p.status = ?"
            params.append(status_filter)
        if category_id:
            query += " AND p.category_id = ?"
            params.append(category_id)
        if pioneer:
            query += " AND p.pioneer_name = ?"
            params.append(pioneer)
        if client:
            query += " AND p.client_name = ?"
            params.append(client)
        query += " ORDER BY p.created_at DESC"
        rows = conn.execute(query, params).fetchall()
        return [dict(r) for r in rows]
    finally:
        conn.close()


def update_project(project_id: int, data: dict) -> bool:
    conn = get_connection()
    try:
        fields = {k: v for k, v in data.items() if v is not None}
        if not fields:
            return False
        # Serialize list fields to JSON
        for list_field in ("geographies", "countries_served"):
            if list_field in fields and isinstance(fields[list_field], list):
                fields[list_field] = json.dumps(fields[list_field])
        set_clause = ", ".join(f"{k} = ?" for k in fields)
        set_clause += ", updated_at = CURRENT_TIMESTAMP"
        values = list(fields.values()) + [project_id]
        conn.execute(
            f"UPDATE projects SET {set_clause} WHERE id = ?", values
        )
        conn.commit()
        return True
    finally:
        conn.close()


def delete_project(project_id: int) -> bool:
    conn = get_connection()
    try:
        conn.execute(
            "UPDATE activity_log SET project_id = NULL WHERE project_id = ?",
            (project_id,),
        )
        conn.execute(
            "DELETE FROM expert_responses WHERE project_id = ?",
            (project_id,),
        )
        conn.execute("DELETE FROM projects WHERE id = ?", (project_id,))
        conn.commit()
        return True
    finally:
        conn.close()


def get_project_by_token(token: str) -> Optional[sqlite3.Row]:
    conn = get_connection()
    try:
        return conn.execute(
            """SELECT p.*, pc.name as category_name
               FROM projects p
               JOIN project_categories pc ON p.category_id = pc.id
               WHERE p.expert_token = ?""",
            (token,),
        ).fetchone()
    finally:
        conn.close()


# ── Expert Responses ─────────────────────────────────────────────────────────

def get_expert_response(project_id: int) -> Optional[sqlite3.Row]:
    conn = get_connection()
    try:
        return conn.execute(
            "SELECT * FROM expert_responses WHERE project_id = ?", (project_id,)
        ).fetchone()
    finally:
        conn.close()


def create_expert_response(project_id: int, data: dict) -> int:
    conn = get_connection()
    try:
        cur = conn.execute(
            """INSERT INTO expert_responses
               (project_id, b1_starting_point, b2_research_sources, b3_assembly_ratio,
                b4_hypothesis_first, c1_specialization, c2_directness, c3_judgment_pct,
                d1_proprietary_data, d2_knowledge_reuse, d3_moat_test,
                f1_feasibility, f2_productization)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                project_id,
                data["b1_starting_point"],
                data["b2_research_sources"],
                data["b3_assembly_ratio"],
                data["b4_hypothesis_first"],
                data["c1_specialization"],
                data["c2_directness"],
                data["c3_judgment_pct"],
                data["d1_proprietary_data"],
                data["d2_knowledge_reuse"],
                data["d3_moat_test"],
                data["f1_feasibility"],
                data["f2_productization"],
            ),
        )
        # Mark project as complete
        conn.execute(
            "UPDATE projects SET status = 'complete', updated_at = CURRENT_TIMESTAMP WHERE id = ?",
            (project_id,),
        )
        conn.commit()
        return cur.lastrowid
    finally:
        conn.close()


# ── Legacy Norms ──────────────────────────────────────────────────────────────

def list_norms() -> list:
    conn = get_connection()
    try:
        rows = conn.execute(
            """SELECT ln.*, pc.name as category_name
               FROM legacy_norms ln
               JOIN project_categories pc ON ln.category_id = pc.id
               ORDER BY pc.name"""
        ).fetchall()
        return [dict(r) for r in rows]
    finally:
        conn.close()


def get_norm_by_category(category_id: int) -> Optional[sqlite3.Row]:
    conn = get_connection()
    try:
        return conn.execute(
            "SELECT * FROM legacy_norms WHERE category_id = ?", (category_id,)
        ).fetchone()
    finally:
        conn.close()


def update_norm(category_id: int, data: dict, updated_by: int) -> bool:
    conn = get_connection()
    try:
        existing = conn.execute(
            "SELECT id FROM legacy_norms WHERE category_id = ?", (category_id,)
        ).fetchone()
        if existing:
            fields = {k: v for k, v in data.items() if v is not None}
            if not fields:
                return False
            set_clause = ", ".join(f"{k} = ?" for k in fields)
            set_clause += ", updated_by = ?, updated_at = CURRENT_TIMESTAMP"
            values = list(fields.values()) + [updated_by, category_id]
            conn.execute(
                f"UPDATE legacy_norms SET {set_clause} WHERE category_id = ?", values
            )
        else:
            conn.execute(
                """INSERT INTO legacy_norms
                   (category_id, typical_calendar_days, typical_team_size, typical_revision_rounds, notes, updated_by)
                   VALUES (?, ?, ?, ?, ?, ?)""",
                (
                    category_id,
                    data.get("typical_calendar_days", "6-10"),
                    data.get("typical_team_size", "2"),
                    data.get("typical_revision_rounds", "1"),
                    data.get("notes"),
                    updated_by,
                ),
            )
        conn.commit()
        return True
    finally:
        conn.close()


# ── Activity Log ──────────────────────────────────────────────────────────────

def log_activity(user_id: int, action: str, project_id: Optional[int] = None, details: Optional[str] = None) -> None:
    conn = get_connection()
    try:
        conn.execute(
            "INSERT INTO activity_log (user_id, action, project_id, details) VALUES (?, ?, ?, ?)",
            (user_id, action, project_id, details),
        )
        conn.commit()
    finally:
        conn.close()


def list_activity(limit: int = 100, offset: int = 0) -> list:
    conn = get_connection()
    try:
        rows = conn.execute(
            """SELECT a.*, u.username
               FROM activity_log a
               JOIN users u ON a.user_id = u.id
               ORDER BY a.created_at DESC
               LIMIT ? OFFSET ?""",
            (limit, offset),
        ).fetchall()
        return [dict(r) for r in rows]
    finally:
        conn.close()


def get_activity_count() -> int:
    conn = get_connection()
    try:
        return conn.execute("SELECT COUNT(*) FROM activity_log").fetchone()[0]
    finally:
        conn.close()


# ── Legacy Norms V2 ──────────────────────────────────────────────────────────


def list_norms_v2() -> list:
    conn = get_connection()
    try:
        rows = conn.execute(
            """SELECT n.*, pc.name as category_name
               FROM legacy_norms_v2 n
               JOIN project_categories pc ON n.category_id = pc.id
               ORDER BY pc.name, n.complexity""").fetchall()
        result = []
        for r in rows:
            d = dict(r)
            d["confidence"] = _norm_confidence(d.get("sample_size", 0))
            result.append(d)
        return result
    finally:
        conn.close()


def get_norm_v2(norm_id: int) -> Optional[sqlite3.Row]:
    conn = get_connection()
    try:
        row = conn.execute(
            """SELECT n.*, pc.name as category_name
               FROM legacy_norms_v2 n
               JOIN project_categories pc ON n.category_id = pc.id
               WHERE n.id = ?""", (norm_id,)).fetchone()
        if row:
            d = dict(row)
            d["confidence"] = _norm_confidence(d.get("sample_size", 0))
            return d
        return None
    finally:
        conn.close()


def _norm_confidence(sample_size: int) -> str:
    if sample_size >= 20:
        return "high"
    elif sample_size >= 5:
        return "limited"
    return "low"


def lookup_norm(category_id: int, complexity=None, client_sub_category=None, geographies=None) -> dict:
    """Cascading lookup: most specific match first."""
    conn = get_connection()
    try:
        # Build cascading queries from most to least specific
        queries = [
            # category + complexity + segment + geo
            ("SELECT n.*, pc.name as category_name FROM legacy_norms_v2 n JOIN project_categories pc ON n.category_id = pc.id WHERE n.category_id = ? AND n.complexity = ? AND n.client_sub_category = ? AND n.geographies IS NOT NULL",
             [category_id, complexity, client_sub_category]),
            # category + complexity + segment
            ("SELECT n.*, pc.name as category_name FROM legacy_norms_v2 n JOIN project_categories pc ON n.category_id = pc.id WHERE n.category_id = ? AND n.complexity = ? AND n.client_sub_category = ? AND n.geographies IS NULL",
             [category_id, complexity, client_sub_category]),
            # category + complexity
            ("SELECT n.*, pc.name as category_name FROM legacy_norms_v2 n JOIN project_categories pc ON n.category_id = pc.id WHERE n.category_id = ? AND n.complexity = ? AND n.client_sub_category IS NULL AND n.geographies IS NULL",
             [category_id, complexity]),
            # category only
            ("SELECT n.*, pc.name as category_name FROM legacy_norms_v2 n JOIN project_categories pc ON n.category_id = pc.id WHERE n.category_id = ? AND n.complexity IS NULL AND n.client_sub_category IS NULL AND n.geographies IS NULL",
             [category_id]),
        ]

        # Only include queries that have the required params
        for i, (query, params) in enumerate(queries):
            if i == 0 and (complexity is None or client_sub_category is None):
                continue
            if i == 1 and (complexity is None or client_sub_category is None):
                continue
            if i == 2 and complexity is None:
                continue
            row = conn.execute(query, params).fetchone()
            if row:
                d = dict(row)
                d["confidence"] = _norm_confidence(d.get("sample_size", 0))
                return d
        return {}
    finally:
        conn.close()


def create_norm_v2(data: dict) -> int:
    conn = get_connection()
    try:
        cur = conn.execute(
            """INSERT INTO legacy_norms_v2
               (category_id, complexity, client_sector, client_sub_category,
                geographies, countries_served,
                avg_calendar_days, avg_team_size, avg_revision_intensity,
                avg_scope_expansion, avg_senior_involvement, avg_ai_usage,
                sample_size, notes, updated_by)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                data["category_id"],
                data.get("complexity"),
                data.get("client_sector"),
                data.get("client_sub_category"),
                json.dumps(data["geographies"]) if data.get("geographies") else None,
                json.dumps(data["countries_served"]) if data.get("countries_served") else None,
                data.get("avg_calendar_days"),
                data.get("avg_team_size"),
                data.get("avg_revision_intensity"),
                data.get("avg_scope_expansion"),
                data.get("avg_senior_involvement"),
                data.get("avg_ai_usage"),
                data.get("sample_size", 0),
                data.get("notes"),
                data.get("updated_by"),
            ),
        )
        conn.commit()
        return cur.lastrowid
    finally:
        conn.close()


def update_norm_v2(norm_id: int, data: dict, changed_by: str) -> bool:
    conn = get_connection()
    try:
        existing = get_norm_v2(norm_id)
        if not existing:
            return False

        fields = {k: v for k, v in data.items() if v is not None}
        if not fields:
            return False

        # Serialize list fields
        for list_field in ("geographies", "countries_served"):
            if list_field in fields and isinstance(fields[list_field], list):
                fields[list_field] = json.dumps(fields[list_field])

        # Audit trail: record changes
        for field, new_val in fields.items():
            old_val = existing.get(field)
            old_str = json.dumps(old_val) if isinstance(old_val, (list, dict)) else (str(old_val) if old_val is not None else None)
            new_str = json.dumps(new_val) if isinstance(new_val, (list, dict)) else (str(new_val) if new_val is not None else None)
            if old_str != new_str:
                conn.execute(
                    "INSERT INTO legacy_norms_history (norm_id, field_changed, old_value, new_value, changed_by) VALUES (?, ?, ?, ?, ?)",
                    (norm_id, field, old_str, new_str, changed_by),
                )

        set_clause = ", ".join(f"{k} = ?" for k in fields)
        set_clause += ", updated_at = CURRENT_TIMESTAMP"
        values = list(fields.values()) + [norm_id]
        conn.execute(f"UPDATE legacy_norms_v2 SET {set_clause} WHERE id = ?", values)
        conn.commit()
        return True
    finally:
        conn.close()


def get_norm_history(norm_id: int) -> list:
    conn = get_connection()
    try:
        rows = conn.execute(
            "SELECT * FROM legacy_norms_history WHERE norm_id = ? ORDER BY changed_at DESC",
            (norm_id,),
        ).fetchall()
        return [dict(r) for r in rows]
    finally:
        conn.close()


def recalculate_norms() -> dict:
    """Recalculate all v2 norms from completed projects."""
    from backend import metrics as mtx

    conn = get_connection()
    try:
        norms = conn.execute("SELECT * FROM legacy_norms_v2").fetchall()
        updated = 0
        errors = 0

        for norm in norms:
            # Build query to find matching completed projects
            query = "SELECT * FROM projects WHERE status = 'complete' AND category_id = ?"
            params = [norm["category_id"]]

            if norm["complexity"] is not None:
                query += " AND complexity = ?"
                params.append(norm["complexity"])
            else:
                query += " AND complexity IS NULL"

            if norm["client_sub_category"] is not None:
                query += " AND client_sub_category = ?"
                params.append(norm["client_sub_category"])
            else:
                query += " AND client_sub_category IS NULL"

            projects = conn.execute(query, params).fetchall()
            n = len(projects)

            if n == 0:
                continue

            # Compute averages
            def avg_field(field, use_float=True):
                vals = [p[field] for p in projects if p[field] is not None]
                if not vals:
                    return None
                if use_float:
                    return round(sum(vals) / len(vals), 1)
                return round(sum(float(v) for v in vals) / len(vals), 1)

            updates = {
                "avg_revision_intensity": avg_field("xcsg_revision_intensity"),
                "avg_scope_expansion": avg_field("xcsg_scope_expansion_score"),
                "avg_senior_involvement": avg_field("xcsg_senior_involvement"),
                "avg_ai_usage": avg_field("xcsg_ai_usage"),
                "sample_size": n,
            }

            # Calendar days and team size need midpoint conversion
            xcsg_pds = []
            for p in projects:
                if p["xcsg_calendar_days"] and p["xcsg_team_size"]:
                    xcsg_pds.append(mtx.compute_person_days(p["xcsg_calendar_days"], p["xcsg_team_size"]))
            if xcsg_pds:
                updates["avg_calendar_days"] = round(sum(xcsg_pds) / len(xcsg_pds), 1)

            team_sizes = [float(p["xcsg_team_size"]) for p in projects if p["xcsg_team_size"] is not None and p["xcsg_team_size"] not in mtx.TEAM_MIDPOINTS]
            if not team_sizes:
                # Use midpoints
                team_sizes = [mtx.TEAM_MIDPOINTS.get(p["xcsg_team_size"], 2.0) for p in projects if p["xcsg_team_size"]]
            if team_sizes:
                updates["avg_team_size"] = round(sum(team_sizes) / len(team_sizes), 1)

            set_clause = ", ".join(f"{k} = ?" for k in updates)
            set_clause += ", updated_at = CURRENT_TIMESTAMP"
            values = list(updates.values()) + [norm["id"]]
            conn.execute(f"UPDATE legacy_norms_v2 SET {set_clause} WHERE id = ?", values)
            updated += 1

        conn.commit()
        return {"norms_checked": len(norms), "norms_updated": updated, "errors": errors}
    finally:
        conn.close()


def complete_project(project_id: int, data: dict) -> bool:
    """Set completion sliders and compute machine_first_score."""
    from backend import metrics as mtx

    conn = get_connection()
    try:
        fields = {k: v for k, v in data.items() if v is not None}
        if not fields:
            return False

        # Compute machine_first_score if we have the required sliders
        si = data.get("xcsg_senior_involvement")
        ai = data.get("xcsg_ai_usage")
        ri = data.get("xcsg_revision_intensity")
        se = data.get("xcsg_scope_expansion_score")
        if all(v is not None for v in (si, ai, ri, se)):
            fields["machine_first_score"] = mtx.compute_machine_first_v2(data)

        set_clause = ", ".join(f"{k} = ?" for k in fields)
        set_clause += ", updated_at = CURRENT_TIMESTAMP"
        values = list(fields.values()) + [project_id]
        conn.execute(f"UPDATE projects SET {set_clause} WHERE id = ?", values)
        conn.commit()
        return True
    finally:
        conn.close()


# ── Metrics helpers ───────────────────────────────────────────────────────────

def list_complete_projects() -> list:
    """Return all complete projects joined with expert_responses and category name."""
    conn = get_connection()
    try:
        rows = conn.execute(
            """SELECT p.*, pc.name as category_name, er.*
               FROM projects p
               JOIN project_categories pc ON p.category_id = pc.id
               JOIN expert_responses er ON p.id = er.project_id
               ORDER BY p.created_at ASC"""
        ).fetchall()
        return [dict(r) for r in rows]
    finally:
        conn.close()
