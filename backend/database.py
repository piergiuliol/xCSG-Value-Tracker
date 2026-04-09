"""
database.py — SQLite CRUD, schema, and seed data for xCSG Value Tracker
Realigned to final spec (April 2026).
"""
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
                xcsg_calendar_days TEXT,
                working_days INTEGER,
                xcsg_team_size TEXT NOT NULL,
                xcsg_revision_rounds TEXT NOT NULL,
                revision_depth TEXT,
                xcsg_scope_expansion TEXT,
                engagement_revenue REAL,
                legacy_calendar_days TEXT,
                legacy_team_size TEXT,
                legacy_revision_rounds TEXT,
                legacy_overridden INTEGER DEFAULT 0,
                engagement_stage TEXT,
                client_contact_email TEXT,
                client_pulse TEXT DEFAULT 'Not yet received',
                expert_token TEXT UNIQUE NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (created_by) REFERENCES users(id),
                FOREIGN KEY (category_id) REFERENCES project_categories(id)
            );

            CREATE TABLE IF NOT EXISTS expert_responses (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                project_id INTEGER UNIQUE NOT NULL,
                b1_starting_point TEXT,
                b2_research_sources TEXT,
                b3_assembly_ratio TEXT,
                b4_hypothesis_first TEXT,
                b5_ai_survival TEXT,
                b6_data_analysis_split TEXT,
                c1_specialization TEXT,
                c2_directness TEXT,
                c3_judgment_pct TEXT,
                c6_self_assessment TEXT,
                c7_analytical_depth TEXT,
                c8_decision_readiness TEXT,
                d1_proprietary_data TEXT,
                d2_knowledge_reuse TEXT,
                d3_moat_test TEXT,
                e1_client_decision TEXT,
                f1_feasibility TEXT,
                f2_productization TEXT,
                g1_reuse_intent TEXT,
                l1_legacy_working_days INTEGER,
                l2_legacy_team_size TEXT,
                l3_legacy_revision_depth TEXT,
                l4_legacy_scope_expansion TEXT,
                l5_legacy_client_reaction TEXT,
                l6_legacy_b2_sources TEXT,
                l7_legacy_c1_specialization TEXT,
                l8_legacy_c2_directness TEXT,
                l9_legacy_c3_judgment TEXT,
                l10_legacy_d1_proprietary TEXT,
                l11_legacy_d2_reuse TEXT,
                l12_legacy_d3_moat TEXT,
                l13_legacy_c7_depth TEXT,
                l14_legacy_c8_decision TEXT,
                l15_legacy_e1_decision TEXT,
                l16_legacy_b6_data TEXT,
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

    # Clean up v2 tables if they exist
    _drop_v2_tables()

    # Migrate expert_responses from old 12-field schema to new 23-field schema
    _migrate_expert_responses()
    migrate()
    migrate_v2()

    seed_data()


def migrate() -> None:
    conn = get_connection()
    try:
        project_columns = {row[1] for row in conn.execute("PRAGMA table_info(projects)").fetchall()}
        for statement in [
            "ALTER TABLE projects ADD COLUMN engagement_stage TEXT",
            "ALTER TABLE projects ADD COLUMN client_contact_email TEXT",
            "ALTER TABLE projects ADD COLUMN client_pulse TEXT DEFAULT 'Not yet received'",
        ]:
            col = statement.split()[5]
            if col not in project_columns:
                conn.execute(statement)
        conn.execute("UPDATE projects SET client_pulse = 'Not yet received' WHERE client_pulse IS NULL OR TRIM(client_pulse) = ''")
        conn.commit()
    finally:
        conn.close()


def migrate_v2() -> None:
    conn = get_connection()
    try:
        project_columns = {row[1] for row in conn.execute("PRAGMA table_info(projects)").fetchall()}
        for statement in [
            "ALTER TABLE projects ADD COLUMN working_days INTEGER",
            "ALTER TABLE projects ADD COLUMN engagement_revenue REAL",
            "ALTER TABLE projects ADD COLUMN revision_depth TEXT",
        ]:
            col = statement.split()[5]
            if col not in project_columns:
                conn.execute(statement)

        expert_columns = {row[1] for row in conn.execute("PRAGMA table_info(expert_responses)").fetchall()}
        expert_statements = [
            "ALTER TABLE expert_responses ADD COLUMN b1_starting_point TEXT",
            "ALTER TABLE expert_responses ADD COLUMN b2_research_sources TEXT",
            "ALTER TABLE expert_responses ADD COLUMN b3_assembly_ratio TEXT",
            "ALTER TABLE expert_responses ADD COLUMN b4_hypothesis_first TEXT",
            "ALTER TABLE expert_responses ADD COLUMN b5_ai_survival TEXT",
            "ALTER TABLE expert_responses ADD COLUMN b6_data_analysis_split TEXT",
            "ALTER TABLE expert_responses ADD COLUMN c1_specialization TEXT",
            "ALTER TABLE expert_responses ADD COLUMN c2_directness TEXT",
            "ALTER TABLE expert_responses ADD COLUMN c3_judgment_pct TEXT",
            "ALTER TABLE expert_responses ADD COLUMN c6_self_assessment TEXT",
            "ALTER TABLE expert_responses ADD COLUMN c7_analytical_depth TEXT",
            "ALTER TABLE expert_responses ADD COLUMN c8_decision_readiness TEXT",
            "ALTER TABLE expert_responses ADD COLUMN d1_proprietary_data TEXT",
            "ALTER TABLE expert_responses ADD COLUMN d2_knowledge_reuse TEXT",
            "ALTER TABLE expert_responses ADD COLUMN d3_moat_test TEXT",
            "ALTER TABLE expert_responses ADD COLUMN e1_client_decision TEXT",
            "ALTER TABLE expert_responses ADD COLUMN f1_feasibility TEXT",
            "ALTER TABLE expert_responses ADD COLUMN f2_productization TEXT",
            "ALTER TABLE expert_responses ADD COLUMN g1_reuse_intent TEXT",
            "ALTER TABLE expert_responses ADD COLUMN l1_legacy_working_days INTEGER",
            "ALTER TABLE expert_responses ADD COLUMN l2_legacy_team_size TEXT",
            "ALTER TABLE expert_responses ADD COLUMN l3_legacy_revision_depth TEXT",
            "ALTER TABLE expert_responses ADD COLUMN l4_legacy_scope_expansion TEXT",
            "ALTER TABLE expert_responses ADD COLUMN l5_legacy_client_reaction TEXT",
            "ALTER TABLE expert_responses ADD COLUMN l6_legacy_b2_sources TEXT",
            "ALTER TABLE expert_responses ADD COLUMN l7_legacy_c1_specialization TEXT",
            "ALTER TABLE expert_responses ADD COLUMN l8_legacy_c2_directness TEXT",
            "ALTER TABLE expert_responses ADD COLUMN l9_legacy_c3_judgment TEXT",
            "ALTER TABLE expert_responses ADD COLUMN l10_legacy_d1_proprietary TEXT",
            "ALTER TABLE expert_responses ADD COLUMN l11_legacy_d2_reuse TEXT",
            "ALTER TABLE expert_responses ADD COLUMN l12_legacy_d3_moat TEXT",
            "ALTER TABLE expert_responses ADD COLUMN l13_legacy_c7_depth TEXT",
            "ALTER TABLE expert_responses ADD COLUMN l14_legacy_c8_decision TEXT",
            "ALTER TABLE expert_responses ADD COLUMN l15_legacy_e1_decision TEXT",
            "ALTER TABLE expert_responses ADD COLUMN l16_legacy_b6_data TEXT",
        ]
        for statement in expert_statements:
            col = statement.split()[5]
            if col not in expert_columns:
                conn.execute(statement)
        conn.commit()
    finally:
        conn.close()


def _drop_v2_tables() -> None:
    """Drop legacy v2 tables and history table if they exist."""
    conn = get_connection()
    try:
        conn.execute("DROP TABLE IF EXISTS legacy_norms_history")
        conn.execute("DROP TABLE IF EXISTS legacy_norms_v2")
        # Remove v2 columns from projects table if they exist
        v2_cols = [
            "complexity", "client_sector", "client_sub_category", "geographies",
            "countries_served", "xcsg_revision_intensity", "xcsg_scope_expansion_score",
            "legacy_scope_expansion", "legacy_senior_involvement", "legacy_ai_usage",
            "xcsg_senior_involvement", "xcsg_ai_usage", "machine_first_score",
        ]
        try:
            for col in v2_cols:
                conn.execute(f"ALTER TABLE projects DROP COLUMN {col}")
        except sqlite3.OperationalError:
            pass
        conn.commit()
    finally:
        conn.close()


def _migrate_expert_responses() -> None:
    """Migrate expert_responses from pre-v2 schema to the current response model."""
    conn = get_connection()
    try:
        table = conn.execute(
            "SELECT name FROM sqlite_master WHERE type='table' AND name='expert_responses'"
        ).fetchone()
        if not table:
            return

        columns = [row[1] for row in conn.execute("PRAGMA table_info(expert_responses)").fetchall()]
        if "b1_starting_point" in columns:
            return

        conn.execute("ALTER TABLE expert_responses RENAME TO _expert_responses_old")
        conn.execute("""CREATE TABLE expert_responses (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            project_id INTEGER UNIQUE NOT NULL,
            b1_starting_point TEXT,
            b2_research_sources TEXT,
            b3_assembly_ratio TEXT,
            b4_hypothesis_first TEXT,
            b5_ai_survival TEXT,
            b6_data_analysis_split TEXT,
            c1_specialization TEXT,
            c2_directness TEXT,
            c3_judgment_pct TEXT,
            c6_self_assessment TEXT,
            c7_analytical_depth TEXT,
            c8_decision_readiness TEXT,
            d1_proprietary_data TEXT,
            d2_knowledge_reuse TEXT,
            d3_moat_test TEXT,
            e1_client_decision TEXT,
            f1_feasibility TEXT,
            f2_productization TEXT,
            g1_reuse_intent TEXT,
            l1_legacy_working_days INTEGER,
            l2_legacy_team_size TEXT,
            l3_legacy_revision_depth TEXT,
            l4_legacy_scope_expansion TEXT,
            l5_legacy_client_reaction TEXT,
            l6_legacy_b2_sources TEXT,
            l7_legacy_c1_specialization TEXT,
            l8_legacy_c2_directness TEXT,
            l9_legacy_c3_judgment TEXT,
            l10_legacy_d1_proprietary TEXT,
            l11_legacy_d2_reuse TEXT,
            l12_legacy_d3_moat TEXT,
            l13_legacy_c7_depth TEXT,
            l14_legacy_c8_decision TEXT,
            l15_legacy_e1_decision TEXT,
            l16_legacy_b6_data TEXT,
            submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
        )""")
        conn.execute(
            "INSERT INTO expert_responses (id, project_id, submitted_at) "
            "SELECT id, project_id, submitted_at FROM _expert_responses_old"
        )
        conn.execute("DROP TABLE _expert_responses_old")
        conn.execute(
            """UPDATE projects SET status = 'expert_pending', updated_at = CURRENT_TIMESTAMP
               WHERE id IN (
                   SELECT project_id FROM expert_responses WHERE b1_starting_point IS NULL
               )"""
        )
        conn.commit()
    finally:
        conn.close()

def seed_data() -> None:
    """Create seed users, categories, and legacy norms."""
    from backend import auth as _auth

    SEED_USERS = [
        ("admin", "admin@alira.health", "AliraAdmin2026!", "admin"),
        ("pmo", "pmo@alira.health", "AliraPMO2026!", "analyst"),
        ("viewer", "viewer@alira.health", "AliraView2026!", "viewer"),
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

        # Seed categories (V2 spec — 11 project categories)
        SEED_CATEGORIES = [
            ("CDD", "Commercial due diligence"),
            ("Strategic Planning", "Strategic planning and advisory"),
            ("Portfolio Management & Opportunity Assessment", "Portfolio strategy and opportunity evaluation"),
            ("Pricing & Reimbursement", "Pricing strategy and reimbursement planning"),
            ("Market Access Strategy", "Market access and reimbursement strategy"),
            ("New Product Strategy", "New product planning and launch strategy"),
            ("Strategic Surveillance & Competitive Intelligence", "Competitive intelligence and market monitoring"),
            ("Evidence Generation & HEOR", "Health economics and outcomes research"),
            ("Transaction Advisory", "M&A due diligence and transaction support"),
            ("Market Research", "Primary and secondary market research"),
            ("Regulatory Strategy", "Regulatory affairs and submission strategy"),
        ]
        for name, desc in SEED_CATEGORIES:
            conn.execute(
                "INSERT OR IGNORE INTO project_categories (name, description) VALUES (?, ?)",
                (name, desc),
            )

        conn.commit()

        # V2: No seeded legacy norms — norms are computed from expert responses
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
                xcsg_calendar_days, working_days, xcsg_team_size, xcsg_revision_rounds, revision_depth, xcsg_scope_expansion, engagement_revenue,
                legacy_calendar_days, legacy_team_size, legacy_revision_rounds,
                legacy_overridden, engagement_stage, client_contact_email, client_pulse, expert_token)
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
                token,
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
        query = """SELECT DISTINCT p.*, pc.name as category_name
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
               (project_id,
                b1_starting_point, b2_research_sources, b3_assembly_ratio, b4_hypothesis_first, b5_ai_survival, b6_data_analysis_split,
                c1_specialization, c2_directness, c3_judgment_pct, c6_self_assessment, c7_analytical_depth, c8_decision_readiness,
                d1_proprietary_data, d2_knowledge_reuse, d3_moat_test, e1_client_decision,
                f1_feasibility, f2_productization, g1_reuse_intent,
                l1_legacy_working_days, l2_legacy_team_size, l3_legacy_revision_depth, l4_legacy_scope_expansion,
                l5_legacy_client_reaction, l6_legacy_b2_sources, l7_legacy_c1_specialization, l8_legacy_c2_directness,
                l9_legacy_c3_judgment, l10_legacy_d1_proprietary, l11_legacy_d2_reuse, l12_legacy_d3_moat,
                l13_legacy_c7_depth, l14_legacy_c8_decision, l15_legacy_e1_decision, l16_legacy_b6_data)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                project_id,
                data.get("b1_starting_point"),
                data.get("b2_research_sources"),
                data.get("b3_assembly_ratio"),
                data.get("b4_hypothesis_first"),
                data.get("b5_ai_survival"),
                data.get("b6_data_analysis_split"),
                data.get("c1_specialization"),
                data.get("c2_directness"),
                data.get("c3_judgment_pct"),
                data.get("c6_self_assessment"),
                data.get("c7_analytical_depth"),
                data.get("c8_decision_readiness"),
                data.get("d1_proprietary_data"),
                data.get("d2_knowledge_reuse"),
                data.get("d3_moat_test"),
                data.get("e1_client_decision"),
                data.get("f1_feasibility"),
                data.get("f2_productization"),
                data.get("g1_reuse_intent"),
                data.get("l1_legacy_working_days"),
                data.get("l2_legacy_team_size"),
                data.get("l3_legacy_revision_depth"),
                data.get("l4_legacy_scope_expansion"),
                data.get("l5_legacy_client_reaction"),
                data.get("l6_legacy_b2_sources"),
                data.get("l7_legacy_c1_specialization"),
                data.get("l8_legacy_c2_directness"),
                data.get("l9_legacy_c3_judgment"),
                data.get("l10_legacy_d1_proprietary"),
                data.get("l11_legacy_d2_reuse"),
                data.get("l12_legacy_d3_moat"),
                data.get("l13_legacy_c7_depth"),
                data.get("l14_legacy_c8_decision"),
                data.get("l15_legacy_e1_decision"),
                data.get("l16_legacy_b6_data"),
            ),
        )
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


def update_project_client_pulse(project_id: int, client_pulse: str) -> bool:
    return update_project(project_id, {"client_pulse": client_pulse})


def list_norm_aggregates() -> list:
    from backend.metrics import compute_project_metrics

    completed = list_complete_projects()
    all_projects = list_projects()

    # Group completed projects by category
    grouped = {}
    for project in completed:
        cat_name = project.get("category_name") or "Unknown"
        cat_id = project.get("category_id")
        grouped.setdefault(cat_name, {"category_id": cat_id, "items": []})
        grouped[cat_name]["items"].append(project)

    # Count total projects per category
    total_by_cat = {}
    for p in all_projects:
        cat_name = p.get("category_name") or "Unknown"
        total_by_cat[cat_name] = total_by_cat.get(cat_name, 0) + 1

    def avg(vals):
        filtered = [v for v in vals if v is not None]
        return round(sum(filtered) / len(filtered), 2) if filtered else None

    rows = []
    for cat_name, group in sorted(grouped.items()):
        items = group["items"]
        metrics_list = [compute_project_metrics(item) for item in items]

        rows.append({
            "category_id": group["category_id"],
            "category_name": cat_name,
            "completed_surveys": len(items),
            "total_projects": total_by_cat.get(cat_name, len(items)),
            "avg_effort_ratio": avg([m["delivery_speed"] for m in metrics_list]),
            "avg_quality_ratio": avg([m["output_quality"] for m in metrics_list]),
            "avg_productivity": avg([m["productivity_ratio"] for m in metrics_list]),
        })
    return rows
