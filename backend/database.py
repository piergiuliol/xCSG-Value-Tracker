"""
database.py — SQLite CRUD, schema, and seed data for xCSG Value Tracker
Realigned to final spec (April 2026).
"""
import os
import secrets
import sqlite3
from contextlib import contextmanager
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


@contextmanager
def _db():
    """Context manager for database connections. Auto-closes on exit."""
    conn = get_connection()
    try:
        yield conn
    finally:
        conn.close()


def init_db() -> None:
    """Create all tables if they don't exist, then seed data."""
    with _db() as conn:
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

            CREATE TABLE IF NOT EXISTS practices (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                code TEXT UNIQUE NOT NULL,
                name TEXT NOT NULL,
                description TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS projects (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                created_by INTEGER NOT NULL,
                project_name TEXT NOT NULL,
                category_id INTEGER NOT NULL,
                practice_id INTEGER,
                client_name TEXT,
                pioneer_name TEXT NOT NULL,
                pioneer_email TEXT,
                description TEXT,
                date_started TEXT,
                date_expected_delivered TEXT,
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
                FOREIGN KEY (category_id) REFERENCES project_categories(id),
                FOREIGN KEY (practice_id) REFERENCES practices(id)
            );

            CREATE TABLE IF NOT EXISTS expert_responses (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                project_id INTEGER NOT NULL,
                pioneer_id INTEGER,
                round_number INTEGER DEFAULT 1,
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
                FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
                UNIQUE(pioneer_id, round_number)
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

            CREATE TABLE IF NOT EXISTS pioneer_round_tokens (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                pioneer_id INTEGER NOT NULL,
                round_number INTEGER NOT NULL,
                token TEXT UNIQUE NOT NULL,
                issued_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                issued_by INTEGER,
                completed_at TIMESTAMP,
                response_id INTEGER,
                FOREIGN KEY (pioneer_id) REFERENCES project_pioneers(id) ON DELETE CASCADE,
                FOREIGN KEY (issued_by) REFERENCES users(id),
                FOREIGN KEY (response_id) REFERENCES expert_responses(id),
                UNIQUE(pioneer_id, round_number)
            );
        """)
        conn.commit()

    # Clean up v2 tables if they exist
    _drop_v2_tables()

    # Migrate expert_responses from old 12-field schema to new 23-field schema
    _migrate_expert_responses()
    migrate()
    migrate_v2()
    migrate_v12()

    seed_data()


def migrate() -> None:
    with _db() as conn:
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


def migrate_v12() -> None:
    """v1.2: add Practice as a peer field to Project Category.

    - Creates `practices` table if missing.
    - Adds `projects.practice_id` nullable FK column if missing.
    - On first run (when practices table is newly created), destructively
      wipes existing projects/responses/pioneers/round_tokens/legacy_norms
      and the old generic project_categories seed, then reseeds
      project_categories (79 rows) and practices (11 rows) from
      backend.taxonomy_seed.
    - On subsequent runs, only runs INSERT OR IGNORE for the seed, so
      admin-added categories/practices survive.
    """
    from backend.taxonomy_seed import CATEGORIES, PRACTICES

    with _db() as conn:
        existing_tables = {
            row[0] for row in conn.execute(
                "SELECT name FROM sqlite_master WHERE type='table'"
            ).fetchall()
        }
        practices_existed = "practices" in existing_tables

        # 1. Create practices table if missing.
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS practices (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                code TEXT UNIQUE NOT NULL,
                name TEXT NOT NULL,
                description TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
            """
        )

        # 2. Add projects.practice_id column if missing (nullable FK).
        project_columns = {row[1] for row in conn.execute("PRAGMA table_info(projects)").fetchall()}
        if "practice_id" not in project_columns:
            conn.execute("ALTER TABLE projects ADD COLUMN practice_id INTEGER REFERENCES practices(id)")

        # 3. First-run destructive reseed: only when practices did not pre-exist.
        #    Wipes legacy data and the old 11 generic categories so the reseed
        #    replaces them with the 79 CSV-derived categories.
        if not practices_existed:
            if "pioneer_round_tokens" in existing_tables:
                conn.execute("DELETE FROM pioneer_round_tokens")
            if "expert_responses" in existing_tables:
                conn.execute("DELETE FROM expert_responses")
            if "project_pioneers" in existing_tables:
                conn.execute("DELETE FROM project_pioneers")
            if "legacy_norms" in existing_tables:
                conn.execute("DELETE FROM legacy_norms")
            if "activity_log" in existing_tables:
                conn.execute("UPDATE activity_log SET project_id = NULL")
            if "projects" in existing_tables:
                conn.execute("DELETE FROM projects")
            if "project_categories" in existing_tables:
                conn.execute("DELETE FROM project_categories")

        # 4. Seed practices (idempotent — INSERT OR IGNORE on unique `code`).
        for code, description in PRACTICES:
            conn.execute(
                "INSERT OR IGNORE INTO practices (code, name, description) VALUES (?, ?, ?)",
                (code, code, description or None),
            )

        # 5. Seed project categories (idempotent — INSERT OR IGNORE on unique `name`).
        for name in CATEGORIES:
            conn.execute(
                "INSERT OR IGNORE INTO project_categories (name, description) VALUES (?, ?)",
                (name, None),
            )

        conn.commit()


def migrate_v2() -> None:
    with _db() as conn:
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


def _migrate_v11_schema(conn) -> None:
    """Add v1.1 tables and columns."""
    # Create project_pioneers table if not exists
    conn.execute("""
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
        )
    """)

    # Add new columns to projects
    project_columns = {row[1] for row in conn.execute("PRAGMA table_info(projects)").fetchall()}
    if "default_rounds" not in project_columns:
        conn.execute("ALTER TABLE projects ADD COLUMN default_rounds INTEGER DEFAULT 1")
    if "show_previous_answers" not in project_columns:
        conn.execute("ALTER TABLE projects ADD COLUMN show_previous_answers INTEGER DEFAULT 0")
    if "date_expected_delivered" not in project_columns:
        conn.execute("ALTER TABLE projects ADD COLUMN date_expected_delivered TEXT")

    # Rebuild expert_responses to remove the UNIQUE constraint on project_id
    # and add pioneer_id + round_number columns
    expert_columns = {row[1] for row in conn.execute("PRAGMA table_info(expert_responses)").fetchall()}
    needs_rebuild = "pioneer_id" not in expert_columns

    if needs_rebuild:
        # Check if there's a unique index/constraint on project_id
        # SQLite requires table rebuild to remove column-level UNIQUE
        conn.execute("ALTER TABLE expert_responses RENAME TO _expert_responses_v10")
        conn.execute("""CREATE TABLE expert_responses (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            project_id INTEGER NOT NULL,
            pioneer_id INTEGER,
            round_number INTEGER DEFAULT 1,
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
            FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
            UNIQUE(pioneer_id, round_number)
        )""")

        # Copy existing data (determine which columns exist in the old table)
        old_cols = {row[1] for row in conn.execute("PRAGMA table_info(_expert_responses_v10)").fetchall()}
        # Build list of columns common to both tables (excluding new ones)
        common_cols = [
            "id", "project_id",
            "b1_starting_point", "b2_research_sources", "b3_assembly_ratio",
            "b4_hypothesis_first", "b5_ai_survival", "b6_data_analysis_split",
            "c1_specialization", "c2_directness", "c3_judgment_pct",
            "c6_self_assessment", "c7_analytical_depth", "c8_decision_readiness",
            "d1_proprietary_data", "d2_knowledge_reuse", "d3_moat_test",
            "e1_client_decision", "f1_feasibility", "f2_productization",
            "g1_reuse_intent",
            "l1_legacy_working_days", "l2_legacy_team_size",
            "l3_legacy_revision_depth", "l4_legacy_scope_expansion",
            "l5_legacy_client_reaction", "l6_legacy_b2_sources",
            "l7_legacy_c1_specialization", "l8_legacy_c2_directness",
            "l9_legacy_c3_judgment", "l10_legacy_d1_proprietary",
            "l11_legacy_d2_reuse", "l12_legacy_d3_moat",
            "l13_legacy_c7_depth", "l14_legacy_c8_decision",
            "l15_legacy_e1_decision", "l16_legacy_b6_data",
            "submitted_at",
        ]
        cols_to_copy = [c for c in common_cols if c in old_cols]
        cols_str = ", ".join(cols_to_copy)
        conn.execute(
            f"INSERT INTO expert_responses ({cols_str}) SELECT {cols_str} FROM _expert_responses_v10"
        )
        conn.execute("DROP TABLE _expert_responses_v10")


def _migrate_v11_data(conn) -> None:
    """Migrate existing v1.0 data to v1.1 structure."""
    # Create pioneer rows from existing project pioneer_name/email/token
    rows = conn.execute(
        "SELECT id, pioneer_name, pioneer_email, expert_token FROM projects WHERE pioneer_name IS NOT NULL AND pioneer_name != ''"
    ).fetchall()
    for row in rows:
        project_id = row["id"]
        pioneer_name = row["pioneer_name"]
        pioneer_email = row["pioneer_email"]
        expert_token = row["expert_token"]
        # Check if already migrated
        existing = conn.execute(
            "SELECT id FROM project_pioneers WHERE expert_token = ?", (expert_token,)
        ).fetchone()
        if not existing:
            cur = conn.execute(
                "INSERT INTO project_pioneers (project_id, pioneer_name, pioneer_email, expert_token) VALUES (?, ?, ?, ?)",
                (project_id, pioneer_name, pioneer_email, expert_token),
            )
            pioneer_id = cur.lastrowid
            # Link existing expert_responses to the new pioneer
            conn.execute(
                "UPDATE expert_responses SET pioneer_id = ? WHERE project_id = ? AND pioneer_id IS NULL",
                (pioneer_id, project_id),
            )

    # Clean up orphaned responses
    conn.execute("DELETE FROM expert_responses WHERE pioneer_id IS NULL")

    # Update expert_pending status to pending
    conn.execute("UPDATE projects SET status = 'pending' WHERE status = 'expert_pending'")


def _migrate_v11_indexes(conn) -> None:
    """Add indexes for v1.1 queries."""
    # Create unique index on (pioneer_id, round_number)
    conn.execute("CREATE UNIQUE INDEX IF NOT EXISTS idx_er_pioneer_round ON expert_responses(pioneer_id, round_number) WHERE pioneer_id IS NOT NULL")


def migrate_v11() -> None:
    """Migrate from v1.0 to v1.1: multi-pioneer support."""
    with _db() as conn:
        _migrate_v11_schema(conn)
        _migrate_v11_data(conn)
        _migrate_v11_indexes(conn)
        conn.commit()


def migrate_round_tokens() -> None:
    """Create pioneer_round_tokens table and seed round 1 for existing pioneers.

    The first round reuses the pioneer's existing expert_token so any in-flight
    links survive the migration. Any existing expert_responses are marked as
    completed on the matching round_token row (round > 1 gets a dead placeholder
    token since there's no URL value to preserve).
    """
    with _db() as conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS pioneer_round_tokens (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                pioneer_id INTEGER NOT NULL,
                round_number INTEGER NOT NULL,
                token TEXT UNIQUE NOT NULL,
                issued_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                issued_by INTEGER,
                completed_at TIMESTAMP,
                response_id INTEGER,
                FOREIGN KEY (pioneer_id) REFERENCES project_pioneers(id) ON DELETE CASCADE,
                FOREIGN KEY (issued_by) REFERENCES users(id),
                FOREIGN KEY (response_id) REFERENCES expert_responses(id),
                UNIQUE(pioneer_id, round_number)
            )
        """)

        # Seed round 1 for every existing pioneer that doesn't already have one.
        pioneers = conn.execute(
            "SELECT id, expert_token, created_at FROM project_pioneers"
        ).fetchall()
        for pp in pioneers:
            has_round1 = conn.execute(
                "SELECT 1 FROM pioneer_round_tokens WHERE pioneer_id = ? AND round_number = 1",
                (pp["id"],),
            ).fetchone()
            if has_round1:
                continue
            conn.execute(
                """INSERT INTO pioneer_round_tokens
                   (pioneer_id, round_number, token, issued_at, issued_by)
                   VALUES (?, 1, ?, ?, NULL)""",
                (pp["id"], pp["expert_token"], pp["created_at"]),
            )

        # Mark tokens completed for every existing response.
        responses = conn.execute(
            "SELECT id, pioneer_id, round_number, submitted_at FROM expert_responses WHERE pioneer_id IS NOT NULL"
        ).fetchall()
        for r in responses:
            existing = conn.execute(
                "SELECT id FROM pioneer_round_tokens WHERE pioneer_id = ? AND round_number = ?",
                (r["pioneer_id"], r["round_number"]),
            ).fetchone()
            if existing:
                conn.execute(
                    "UPDATE pioneer_round_tokens SET completed_at = ?, response_id = ? WHERE id = ?",
                    (r["submitted_at"], r["id"], existing["id"]),
                )
            else:
                conn.execute(
                    """INSERT INTO pioneer_round_tokens
                       (pioneer_id, round_number, token, issued_at, completed_at, response_id)
                       VALUES (?, ?, ?, ?, ?, ?)""",
                    (r["pioneer_id"], r["round_number"], secrets.token_urlsafe(32),
                     r["submitted_at"], r["submitted_at"], r["id"]),
                )

        conn.commit()


def _drop_v2_tables() -> None:
    """Drop legacy v2 tables and history table if they exist."""
    with _db() as conn:
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


def _migrate_expert_responses() -> None:
    """Migrate expert_responses from pre-v2 schema to the current response model."""
    with _db() as conn:
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

def seed_data() -> None:
    """Create seed users, categories, and legacy norms."""
    from backend import auth as _auth

    SEED_USERS = [
        ("admin", "admin@alira.health", "AliraAdmin2026!", "admin"),
        ("pmo", "pmo@alira.health", "AliraPMO2026!", "analyst"),
        ("viewer", "viewer@alira.health", "AliraView2026!", "viewer"),
    ]

    with _db() as conn:
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

        conn.commit()

        # V1.2: project_categories + practices are seeded by migrate_v12 from
        # backend/taxonomy_seed.py. No seeded legacy norms — norms are
        # computed from expert responses.


# ── Users ──────────────────────────────────────────────────────────────────────

def get_user_by_username(username: str) -> Optional[sqlite3.Row]:
    with _db() as conn:
        return conn.execute(
            "SELECT * FROM users WHERE username = ?", (username,)
        ).fetchone()


def get_user_by_id(user_id: int) -> Optional[sqlite3.Row]:
    with _db() as conn:
        return conn.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()


def create_user(username: str, email: str, password_hash: str, role: str) -> int:
    with _db() as conn:
        cur = conn.execute(
            "INSERT INTO users (username, email, password_hash, role) VALUES (?, ?, ?, ?)",
            (username, email, password_hash, role),
        )
        conn.commit()
        return cur.lastrowid


def list_users() -> list:
    with _db() as conn:
        rows = conn.execute(
            "SELECT id, username, email, role, created_at FROM users ORDER BY id"
        ).fetchall()
        return [dict(r) for r in rows]


def update_user(user_id: int, data: dict) -> bool:
    with _db() as conn:
        fields = {k: v for k, v in data.items() if v is not None}
        if not fields:
            return False
        set_clause = ", ".join(f"{k} = ?" for k in fields)
        values = list(fields.values()) + [user_id]
        conn.execute(f"UPDATE users SET {set_clause} WHERE id = ?", values)
        conn.commit()
        return True


def delete_user(user_id: int) -> bool:
    with _db() as conn:
        conn.execute("DELETE FROM users WHERE id = ?", (user_id,))
        conn.commit()
        return True


# ── Project Categories ───────────────────────────────────────────────────────

def list_categories() -> list:
    with _db() as conn:
        rows = conn.execute("SELECT * FROM project_categories ORDER BY name").fetchall()
        return [dict(r) for r in rows]


def get_category(category_id: int) -> Optional[sqlite3.Row]:
    with _db() as conn:
        return conn.execute(
            "SELECT * FROM project_categories WHERE id = ?", (category_id,)
        ).fetchone()


def create_category(name: str, description: Optional[str] = None) -> int:
    with _db() as conn:
        cur = conn.execute(
            "INSERT INTO project_categories (name, description) VALUES (?, ?)",
            (name, description),
        )
        conn.commit()
        return cur.lastrowid


def update_category(category_id: int, name: str, description: Optional[str] = None) -> bool:
    with _db() as conn:
        conn.execute(
            "UPDATE project_categories SET name = ?, description = ? WHERE id = ?",
            (name, description, category_id),
        )
        conn.commit()
        return True


def delete_category(category_id: int) -> bool:
    with _db() as conn:
        count = conn.execute(
            "SELECT COUNT(*) FROM projects WHERE category_id = ?", (category_id,)
        ).fetchone()[0]
        if count > 0:
            return False
        conn.execute("DELETE FROM legacy_norms WHERE category_id = ?", (category_id,))
        conn.execute("DELETE FROM project_categories WHERE id = ?", (category_id,))
        conn.commit()
        return True


def category_has_projects(category_id: int) -> bool:
    with _db() as conn:
        count = conn.execute(
            "SELECT COUNT(*) FROM projects WHERE category_id = ?", (category_id,)
        ).fetchone()[0]
        return count > 0


# ── Projects ─────────────────────────────────────────────────────────────────

def create_project(data: dict) -> int:
    """Create a project with multi-pioneer support.

    Accepts either:
    - ``pioneers`` list (v1.1): each dict has ``name``, optional ``email``, optional ``total_rounds``
    - ``pioneer_name`` string (v1.0 compat): creates a single pioneer from it
    """
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

    # Determine pioneers list
    pioneers_input = data.get("pioneers")
    if not pioneers_input and data.get("pioneer_name"):
        # v1.0 backward compatibility
        pioneers_input = [{"name": data["pioneer_name"], "email": data.get("pioneer_email")}]

    # Generate a legacy token for the project row (backward compat)
    project_token = secrets.token_urlsafe(32)
    pioneer_name_for_project = pioneers_input[0]["name"] if pioneers_input else ""
    pioneer_email_for_project = (pioneers_input[0].get("email") or "") if pioneers_input else ""

    legacy_overridden = data.get("legacy_overridden", False)
    default_rounds = data.get("default_rounds", 1)
    show_previous_answers = 1 if data.get("show_previous_answers") else 0

    with _db() as conn:
        cur = conn.execute(
            """INSERT INTO projects
               (created_by, project_name, category_id, client_name,
                pioneer_name, pioneer_email, description,
                date_started, date_expected_delivered, date_delivered,
                xcsg_calendar_days, working_days, xcsg_team_size, xcsg_revision_rounds, revision_depth, xcsg_scope_expansion, engagement_revenue,
                legacy_calendar_days, legacy_team_size, legacy_revision_rounds,
                legacy_overridden, engagement_stage, client_contact_email, client_pulse, expert_token,
                default_rounds, show_previous_answers, status)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                data["created_by"],
                data["project_name"],
                data["category_id"],
                data.get("client_name"),
                pioneer_name_for_project,
                pioneer_email_for_project,
                data.get("description"),
                data.get("date_started"),
                data.get("date_expected_delivered"),
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
                project_token,
                default_rounds,
                show_previous_answers,
                "pending",
            ),
        )
        project_id = cur.lastrowid

        # Create pioneer rows + auto-issue round 1 token for each.
        if pioneers_input:
            for p in pioneers_input:
                token = secrets.token_urlsafe(32)
                cur_pp = conn.execute(
                    """INSERT INTO project_pioneers
                       (project_id, pioneer_name, pioneer_email, total_rounds, expert_token)
                       VALUES (?, ?, ?, ?, ?)""",
                    (project_id, p["name"], p.get("email"), p.get("total_rounds"), token),
                )
                conn.execute(
                    """INSERT INTO pioneer_round_tokens
                       (pioneer_id, round_number, token, issued_by)
                       VALUES (?, 1, ?, ?)""",
                    (cur_pp.lastrowid, token, data.get("created_by")),
                )

        conn.commit()
        return project_id


def get_project(project_id: int) -> Optional[sqlite3.Row]:
    with _db() as conn:
        return conn.execute(
            """SELECT p.*, pc.name as category_name
               FROM projects p
               JOIN project_categories pc ON p.category_id = pc.id
               WHERE p.id = ?""",
            (project_id,),
        ).fetchone()


def list_projects(
    status_filter: Optional[str] = None,
    category_id: Optional[int] = None,
    pioneer: Optional[str] = None,
    client: Optional[str] = None,
) -> list:
    with _db() as conn:
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


def update_project(project_id: int, data: dict) -> bool:
    with _db() as conn:
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


def delete_project(project_id: int) -> bool:
    with _db() as conn:
        conn.execute(
            "UPDATE activity_log SET project_id = NULL WHERE project_id = ?",
            (project_id,),
        )
        conn.execute(
            "DELETE FROM expert_responses WHERE project_id = ?",
            (project_id,),
        )
        conn.execute(
            "DELETE FROM project_pioneers WHERE project_id = ?",
            (project_id,),
        )
        conn.execute("DELETE FROM projects WHERE id = ?", (project_id,))
        conn.commit()
        return True


def get_project_by_token(token: str) -> Optional[sqlite3.Row]:
    with _db() as conn:
        return conn.execute(
            """SELECT p.*, pc.name as category_name
               FROM projects p
               JOIN project_categories pc ON p.category_id = pc.id
               WHERE p.expert_token = ?""",
            (token,),
        ).fetchone()


# ── Pioneer CRUD ─────────────────────────────────────────────────────────────

def list_pioneers(project_id: int) -> list:
    """Return all pioneers for a project with response counts and round tokens.

    Each pioneer dict gains a ``rounds`` list containing every round token row
    (issued and/or completed) ordered by round_number.
    """
    with _db() as conn:
        rows = conn.execute(
            """SELECT pp.*,
                      COALESCE(stats.response_count, 0) AS response_count,
                      stats.last_round,
                      stats.last_submitted
               FROM project_pioneers pp
               LEFT JOIN (
                   SELECT pioneer_id,
                          COUNT(*) AS response_count,
                          MAX(round_number) AS last_round,
                          MAX(submitted_at) AS last_submitted
                   FROM expert_responses
                   WHERE pioneer_id IS NOT NULL
                   GROUP BY pioneer_id
               ) stats ON pp.id = stats.pioneer_id
               WHERE pp.project_id = ?
               ORDER BY pp.created_at ASC""",
            (project_id,),
        ).fetchall()
        pioneers = [dict(r) for r in rows]
        if not pioneers:
            return pioneers
        pioneer_ids = [p["id"] for p in pioneers]
        placeholders = ",".join("?" for _ in pioneer_ids)
        token_rows = conn.execute(
            f"SELECT * FROM pioneer_round_tokens WHERE pioneer_id IN ({placeholders}) ORDER BY round_number ASC",
            pioneer_ids,
        ).fetchall()
        by_pioneer: dict[int, list] = {}
        for tr in token_rows:
            by_pioneer.setdefault(tr["pioneer_id"], []).append(dict(tr))
        for p in pioneers:
            p["rounds"] = by_pioneer.get(p["id"], [])
        return pioneers


def add_pioneer(project_id: int, name: str, email: str = None, total_rounds: int = None, issued_by: Optional[int] = None) -> int:
    """Add a new pioneer to an existing project and auto-issue round 1 token.

    Returns the new pioneer id.
    """
    token = secrets.token_urlsafe(32)
    with _db() as conn:
        cur = conn.execute(
            """INSERT INTO project_pioneers (project_id, pioneer_name, pioneer_email, total_rounds, expert_token)
               VALUES (?, ?, ?, ?, ?)""",
            (project_id, name, email, total_rounds, token),
        )
        pioneer_id = cur.lastrowid
        conn.execute(
            """INSERT INTO pioneer_round_tokens (pioneer_id, round_number, token, issued_by)
               VALUES (?, 1, ?, ?)""",
            (pioneer_id, token, issued_by),
        )
        conn.commit()
        return pioneer_id


def remove_pioneer(pioneer_id: int) -> bool:
    """Remove a pioneer only if they have zero responses."""
    with _db() as conn:
        count = conn.execute(
            "SELECT COUNT(*) FROM expert_responses WHERE pioneer_id = ?", (pioneer_id,)
        ).fetchone()[0]
        if count > 0:
            return False
        conn.execute("DELETE FROM project_pioneers WHERE id = ?", (pioneer_id,))
        conn.commit()
        return True


def update_pioneer(pioneer_id: int, data: dict) -> bool:
    """Update allowed fields on a pioneer."""
    allowed = {"pioneer_name", "pioneer_email", "total_rounds", "show_previous"}
    fields = {k: v for k, v in data.items() if k in allowed and v is not None}
    if not fields:
        return False
    with _db() as conn:
        if "total_rounds" in fields and fields["total_rounds"] is not None:
            completed = conn.execute(
                "SELECT COUNT(*) FROM expert_responses WHERE pioneer_id = ?", (pioneer_id,)
            ).fetchone()[0]
            if fields["total_rounds"] < completed:
                raise ValueError(f"Cannot set rounds below {completed} (already completed)")
        set_clause = ", ".join(f"{k} = ?" for k in fields)
        values = list(fields.values()) + [pioneer_id]
        conn.execute(f"UPDATE project_pioneers SET {set_clause} WHERE id = ?", values)
        conn.commit()
        return True


def get_round_token(token: str) -> Optional[dict]:
    """Look up a round token, joining pioneer, project, and category context.

    Returns None if no round token with the given value exists. The returned
    dict includes round_number, completed_at, and all pioneer/project fields
    previously returned by get_pioneer_by_token.
    """
    with _db() as conn:
        row = conn.execute(
            """SELECT prt.id AS token_row_id, prt.pioneer_id, prt.round_number,
                      prt.token, prt.issued_at, prt.completed_at, prt.response_id,
                      pp.pioneer_name, pp.pioneer_email, pp.total_rounds, pp.show_previous,
                      pp.project_id,
                      p.project_name, p.category_id, p.client_name,
                      p.description, p.date_started, p.date_delivered,
                      p.xcsg_calendar_days, p.working_days, p.xcsg_team_size,
                      p.xcsg_revision_rounds, p.revision_depth, p.xcsg_scope_expansion,
                      p.engagement_revenue, p.legacy_calendar_days, p.legacy_team_size,
                      p.legacy_revision_rounds, p.legacy_overridden, p.engagement_stage,
                      p.default_rounds, p.show_previous_answers, p.status,
                      pc.name AS category_name
               FROM pioneer_round_tokens prt
               JOIN project_pioneers pp ON prt.pioneer_id = pp.id
               JOIN projects p ON pp.project_id = p.id
               JOIN project_categories pc ON p.category_id = pc.id
               WHERE prt.token = ?""",
            (token,),
        ).fetchone()
        return dict(row) if row else None


def issue_round_token(pioneer_id: int, round_number: int, issued_by: Optional[int] = None) -> dict:
    """Issue a new round token (or re-issue a pending one). Returns the token row as a dict.

    Raises ValueError if the round is out of range, the previous round isn't
    completed, or the target round is already completed.
    """
    with _db() as conn:
        pp = conn.execute(
            """SELECT pp.id, pp.total_rounds, p.default_rounds
               FROM project_pioneers pp
               JOIN projects p ON p.id = pp.project_id
               WHERE pp.id = ?""",
            (pioneer_id,),
        ).fetchone()
        if not pp:
            raise ValueError(f"Pioneer {pioneer_id} not found")
        total_rounds = pp["total_rounds"] or pp["default_rounds"] or 1
        if round_number < 1 or round_number > total_rounds:
            raise ValueError(f"Round {round_number} is out of range (1..{total_rounds})")
        if round_number > 1:
            prev = conn.execute(
                "SELECT completed_at FROM pioneer_round_tokens WHERE pioneer_id = ? AND round_number = ?",
                (pioneer_id, round_number - 1),
            ).fetchone()
            if not prev or prev["completed_at"] is None:
                raise ValueError(f"Round {round_number - 1} must be completed before issuing round {round_number}")
        existing = conn.execute(
            "SELECT completed_at FROM pioneer_round_tokens WHERE pioneer_id = ? AND round_number = ?",
            (pioneer_id, round_number),
        ).fetchone()
        if existing and existing["completed_at"]:
            raise ValueError(f"Round {round_number} is already completed")

        new_token = secrets.token_urlsafe(32)
        if existing:
            conn.execute(
                """UPDATE pioneer_round_tokens
                   SET token = ?, issued_at = CURRENT_TIMESTAMP, issued_by = ?
                   WHERE pioneer_id = ? AND round_number = ?""",
                (new_token, issued_by, pioneer_id, round_number),
            )
        else:
            conn.execute(
                """INSERT INTO pioneer_round_tokens (pioneer_id, round_number, token, issued_by)
                   VALUES (?, ?, ?, ?)""",
                (pioneer_id, round_number, new_token, issued_by),
            )
        conn.commit()

        row = conn.execute(
            "SELECT * FROM pioneer_round_tokens WHERE pioneer_id = ? AND round_number = ?",
            (pioneer_id, round_number),
        ).fetchone()
        return dict(row)


def cancel_round_token(pioneer_id: int, round_number: int) -> bool:
    """Cancel a pending round token. Returns False if already completed or absent."""
    with _db() as conn:
        row = conn.execute(
            "SELECT completed_at FROM pioneer_round_tokens WHERE pioneer_id = ? AND round_number = ?",
            (pioneer_id, round_number),
        ).fetchone()
        if not row or row["completed_at"] is not None:
            return False
        conn.execute(
            "DELETE FROM pioneer_round_tokens WHERE pioneer_id = ? AND round_number = ?",
            (pioneer_id, round_number),
        )
        conn.commit()
        return True


def complete_round_token(token: str, response_id: int) -> bool:
    """Mark a pending round token as completed with the given response_id."""
    with _db() as conn:
        cur = conn.execute(
            """UPDATE pioneer_round_tokens
               SET completed_at = CURRENT_TIMESTAMP, response_id = ?
               WHERE token = ? AND completed_at IS NULL""",
            (response_id, token),
        )
        conn.commit()
        return cur.rowcount > 0


def get_pioneer_responses(pioneer_id: int) -> list:
    """Return all responses for a pioneer ordered by round number."""
    with _db() as conn:
        rows = conn.execute(
            "SELECT * FROM expert_responses WHERE pioneer_id = ? ORDER BY round_number ASC",
            (pioneer_id,),
        ).fetchall()
        return [dict(r) for r in rows]


# ── Expert Responses (v1.1 round-based) ─────────────────────────────────────

def create_expert_response(pioneer_id: int, project_id: int, round_number: int, data: dict) -> int:
    """Insert an expert response with pioneer_id and round_number."""
    with _db() as conn:
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
        conn.commit()
        return cur.lastrowid


def update_project_status(project_id: int) -> None:
    """Recompute and update project status based on pioneer completion.

    - ``pending`` if zero responses
    - ``partial`` if 1+ responses but not all pioneers x rounds done
    - ``complete`` if every pioneer has completed all their rounds
    """
    with _db() as conn:
        # Get project default_rounds
        project = conn.execute(
            "SELECT default_rounds FROM projects WHERE id = ?", (project_id,)
        ).fetchone()
        if not project:
            return
        default_rounds = project["default_rounds"] or 1

        # Get all pioneers and their response counts
        pioneers = conn.execute(
            "SELECT id, total_rounds FROM project_pioneers WHERE project_id = ?", (project_id,)
        ).fetchall()

        if not pioneers:
            conn.execute(
                "UPDATE projects SET status = 'pending', updated_at = CURRENT_TIMESTAMP WHERE id = ?",
                (project_id,),
            )
            conn.commit()
            return

        total_responses = conn.execute(
            "SELECT COUNT(*) FROM expert_responses WHERE project_id = ?", (project_id,)
        ).fetchone()[0]

        if total_responses == 0:
            new_status = "pending"
        else:
            # Check if every pioneer has completed all their rounds
            all_complete = True
            for p in pioneers:
                required_rounds = p["total_rounds"] if p["total_rounds"] is not None else default_rounds
                actual = conn.execute(
                    "SELECT COUNT(*) FROM expert_responses WHERE pioneer_id = ?", (p["id"],)
                ).fetchone()[0]
                if actual < required_rounds:
                    all_complete = False
                    break
            new_status = "complete" if all_complete else "partial"

        conn.execute(
            "UPDATE projects SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
            (new_status, project_id),
        )
        conn.commit()


def get_all_project_responses(project_id: int) -> list:
    """Return all responses for a project across all pioneers and rounds."""
    with _db() as conn:
        rows = conn.execute(
            """SELECT er.*, pp.pioneer_name, pp.pioneer_email
               FROM expert_responses er
               LEFT JOIN project_pioneers pp ON er.pioneer_id = pp.id
               WHERE er.project_id = ?
               ORDER BY er.pioneer_id, er.round_number ASC""",
            (project_id,),
        ).fetchall()
        return [dict(r) for r in rows]


# ── Expert Responses ─────────────────────────────────────────────────────────

def get_expert_response(project_id: int) -> Optional[sqlite3.Row]:
    with _db() as conn:
        return conn.execute(
            "SELECT * FROM expert_responses WHERE project_id = ?", (project_id,)
        ).fetchone()



# ── Legacy Norms ──────────────────────────────────────────────────────────────

def list_norms() -> list:
    with _db() as conn:
        rows = conn.execute(
            """SELECT ln.*, pc.name as category_name
               FROM legacy_norms ln
               JOIN project_categories pc ON ln.category_id = pc.id
               ORDER BY pc.name"""
        ).fetchall()
        return [dict(r) for r in rows]


def get_norm_by_category(category_id: int) -> Optional[sqlite3.Row]:
    with _db() as conn:
        return conn.execute(
            "SELECT * FROM legacy_norms WHERE category_id = ?", (category_id,)
        ).fetchone()


def update_norm(category_id: int, data: dict, updated_by: int) -> bool:
    with _db() as conn:
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


# ── Activity Log ──────────────────────────────────────────────────────────────

def log_activity(user_id: int, action: str, project_id: Optional[int] = None, details: Optional[str] = None) -> None:
    with _db() as conn:
        conn.execute(
            "INSERT INTO activity_log (user_id, action, project_id, details) VALUES (?, ?, ?, ?)",
            (user_id, action, project_id, details),
        )
        conn.commit()


def list_activity(limit: int = 100, offset: int = 0) -> list:
    with _db() as conn:
        rows = conn.execute(
            """SELECT a.*, u.username
               FROM activity_log a
               JOIN users u ON a.user_id = u.id
               ORDER BY a.created_at DESC
               LIMIT ? OFFSET ?""",
            (limit, offset),
        ).fetchall()
        return [dict(r) for r in rows]


def get_activity_count() -> int:
    with _db() as conn:
        return conn.execute("SELECT COUNT(*) FROM activity_log").fetchone()[0]


# ── Metrics helpers ───────────────────────────────────────────────────────────

def list_complete_projects() -> list:
    """Return projects with status 'partial' or 'complete' (have at least some responses)."""
    with _db() as conn:
        rows = conn.execute(
            """SELECT DISTINCT p.*, pc.name as category_name
               FROM projects p
               JOIN project_categories pc ON p.category_id = pc.id
               WHERE p.status IN ('partial', 'complete')
               ORDER BY p.created_at ASC"""
        ).fetchall()
        return [dict(r) for r in rows]


def update_project_client_pulse(project_id: int, client_pulse: str) -> bool:
    return update_project(project_id, {"client_pulse": client_pulse})


def list_norm_aggregates() -> list:
    from backend.metrics import compute_averaged_project_metrics

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
        metrics_list = []
        for item in items:
            responses = get_all_project_responses(item["id"])
            metrics_list.append(compute_averaged_project_metrics(item, responses))

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
