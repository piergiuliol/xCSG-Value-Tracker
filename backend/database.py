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


# Re-export pioneer helpers from backend.pioneers for backward compatibility.
# Anyone calling db.create_pioneer(), db.list_pioneers_with_metrics(), etc.
# continues to work without changes.
from backend.pioneers import (
    PioneerInUseError,
    create_pioneer,
    find_pioneer_by_email,
    update_pioneer_record,
    delete_pioneer,
    list_pioneers_with_metrics,
    get_pioneer_with_metrics,
)


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
                engagement_stage TEXT,
                client_contact_email TEXT,
                client_pulse TEXT DEFAULT 'Not yet received',
                show_other_pioneers_answers INTEGER NOT NULL DEFAULT 0,
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
    migrate_v11()
    migrate_round_tokens()
    migrate_v12()
    migrate_v13()
    migrate_v14()
    migrate_v15()
    migrate_v16()
    migrate_v17()
    migrate_v18()
    migrate_v19()
    migrate_v20()
    migrate_v21_fx_rates()
    _ensure_all_fx_rows_exist()
    migrate_v22_drop_legacy_norms()
    migrate_v23_pioneer_title_home_practice()

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
      wipes existing projects/responses/pioneers/round_tokens and the old
      generic project_categories seed, then reseeds project_categories
      (79 rows) and practices (11 rows) from backend.taxonomy_seed.
    - On subsequent runs, only runs INSERT OR IGNORE for the seed, so
      admin-added categories/practices survive.
    """
    from backend.taxonomy_seed import CATEGORIES, CATEGORY_PRACTICE_PAIRS, PRACTICES

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

        # 1b. Create category_practices junction table (many-to-many).
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS category_practices (
                category_id INTEGER NOT NULL,
                practice_id INTEGER NOT NULL,
                PRIMARY KEY (category_id, practice_id),
                FOREIGN KEY (category_id) REFERENCES project_categories(id) ON DELETE CASCADE,
                FOREIGN KEY (practice_id) REFERENCES practices(id) ON DELETE CASCADE
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

        # 6. Seed category↔practice pairings (idempotent — PK is the pair).
        cat_ids = {row["name"]: row["id"] for row in conn.execute("SELECT id, name FROM project_categories").fetchall()}
        prac_ids = {row["code"]: row["id"] for row in conn.execute("SELECT id, code FROM practices").fetchall()}
        for cat_name, prac_code in CATEGORY_PRACTICE_PAIRS:
            cid = cat_ids.get(cat_name)
            pid = prac_ids.get(prac_code)
            if cid is None or pid is None:
                continue  # defensive; should not happen given seed_taxonomy asserts
            conn.execute(
                "INSERT OR IGNORE INTO category_practices (category_id, practice_id) VALUES (?, ?)",
                (cid, pid),
            )

        conn.commit()


def migrate_v13() -> None:
    """v1.3: add cross-pioneer visibility flag to projects.

    Adds ``projects.show_other_pioneers_answers`` (boolean, default 0). When
    enabled, ``GET /api/expert/{token}`` returns the submitted responses of
    other pioneers on the same project so the current pioneer can read them
    before/while filling in their round.
    """
    with _db() as conn:
        project_columns = {row[1] for row in conn.execute("PRAGMA table_info(projects)").fetchall()}
        if "show_other_pioneers_answers" not in project_columns:
            conn.execute(
                "ALTER TABLE projects ADD COLUMN show_other_pioneers_answers INTEGER NOT NULL DEFAULT 0"
            )
        conn.commit()


def migrate_v14() -> None:
    """v1.4: add expert_responses.notes TEXT column (nullable).

    Experts may attach an optional free-text note to each survey submission.
    Column is nullable so existing rows and callers that omit the field
    continue to work unchanged.
    """
    with _db() as conn:
        cols = {row[1] for row in conn.execute("PRAGMA table_info(expert_responses)").fetchall()}
        if "notes" not in cols:
            conn.execute("ALTER TABLE expert_responses ADD COLUMN notes TEXT")
        conn.commit()


def migrate_v15() -> None:
    """v1.5: add Project Economics fields and app_settings table.

    All new columns are nullable. app_settings is a single-row table seeded
    with default_currency='EUR'. Existing projects/pioneers/practices keep
    NULL economics values until a user fills them in — the project-detail
    Economics card stays hidden when no economics signal is present.
    """
    with _db() as conn:
        proj_cols = {row[1] for row in conn.execute("PRAGMA table_info(projects)").fetchall()}
        for statement in [
            "ALTER TABLE projects ADD COLUMN currency TEXT",
            "ALTER TABLE projects ADD COLUMN xcsg_pricing_model TEXT",
            "ALTER TABLE projects ADD COLUMN scope_expansion_revenue REAL",
            "ALTER TABLE projects ADD COLUMN legacy_day_rate_override REAL",
        ]:
            col = statement.split()[5]
            if col not in proj_cols:
                conn.execute(statement)

        pp_cols = {row[1] for row in conn.execute("PRAGMA table_info(project_pioneers)").fetchall()}
        if "day_rate" not in pp_cols:
            conn.execute("ALTER TABLE project_pioneers ADD COLUMN day_rate REAL")

        prac_cols = {row[1] for row in conn.execute("PRAGMA table_info(practices)").fetchall()}
        if "default_legacy_day_rate" not in prac_cols:
            conn.execute("ALTER TABLE practices ADD COLUMN default_legacy_day_rate REAL")

        conn.execute(
            """CREATE TABLE IF NOT EXISTS app_settings (
                   id INTEGER PRIMARY KEY CHECK (id = 1),
                   default_currency TEXT NOT NULL DEFAULT 'EUR'
               )"""
        )
        conn.execute(
            "INSERT OR IGNORE INTO app_settings (id, default_currency) VALUES (1, 'EUR')"
        )
        conn.commit()


def migrate_v16() -> None:
    """v1.6: create practice_roles table for the per-practice rate catalog.

    Each row is a (practice_id, role_name, day_rate, currency) tuple.
    Multiple rows per (practice_id, role_name) are allowed if currency
    differs — this supports practices that bill in multiple currencies.
    Uniqueness is enforced on (practice_id, role_name, currency).
    Idempotent.
    """
    with _db() as conn:
        conn.execute(
            """CREATE TABLE IF NOT EXISTS practice_roles (
                   id INTEGER PRIMARY KEY AUTOINCREMENT,
                   practice_id INTEGER NOT NULL,
                   role_name TEXT NOT NULL,
                   day_rate REAL NOT NULL,
                   currency TEXT NOT NULL,
                   display_order INTEGER NOT NULL DEFAULT 0,
                   created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                   FOREIGN KEY (practice_id) REFERENCES practices(id) ON DELETE CASCADE,
                   UNIQUE (practice_id, role_name, currency)
               )"""
        )
        conn.execute(
            """CREATE INDEX IF NOT EXISTS idx_practice_roles_practice
                   ON practice_roles(practice_id, display_order)"""
        )
        conn.commit()


def migrate_v17() -> None:
    """v1.7: add project_pioneers.role_name (nullable).

    Phase 2b — pioneer role picker. Stores the role_name string the user
    selected from the practice catalog. The day_rate column from Phase 1
    remains the stored rate snapshot; this column is metadata for the
    audit trail and the role picker UI.
    """
    with _db() as conn:
        cols = {row[1] for row in conn.execute(
            "PRAGMA table_info(project_pioneers)"
        ).fetchall()}
        if "role_name" not in cols:
            conn.execute("ALTER TABLE project_pioneers ADD COLUMN role_name TEXT")
        conn.commit()


def migrate_v18() -> None:
    """v1.8: Phase 2c — replace flat-rate legacy with team-mix model.

    Creates project_legacy_team table, then drops 4 deprecated columns:
    - projects.legacy_day_rate_override
    - practices.default_legacy_day_rate
    - projects.legacy_team_size
    - expert_responses.l2_legacy_team_size

    SQLite supports DROP COLUMN since 3.35 (2021). Idempotent via
    PRAGMA checks before each DROP.
    """
    with _db() as conn:
        # Create the new table first.
        conn.execute(
            """CREATE TABLE IF NOT EXISTS project_legacy_team (
                   id INTEGER PRIMARY KEY AUTOINCREMENT,
                   project_id INTEGER NOT NULL,
                   role_name TEXT NOT NULL,
                   count INTEGER NOT NULL CHECK (count > 0),
                   day_rate REAL NOT NULL,
                   FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
               )"""
        )
        conn.execute(
            """CREATE INDEX IF NOT EXISTS idx_project_legacy_team_project
                   ON project_legacy_team(project_id)"""
        )

        # Drop deprecated columns idempotently.
        proj_cols = {row[1] for row in conn.execute("PRAGMA table_info(projects)").fetchall()}
        if "legacy_day_rate_override" in proj_cols:
            conn.execute("ALTER TABLE projects DROP COLUMN legacy_day_rate_override")
        if "legacy_team_size" in proj_cols:
            conn.execute("ALTER TABLE projects DROP COLUMN legacy_team_size")

        prac_cols = {row[1] for row in conn.execute("PRAGMA table_info(practices)").fetchall()}
        if "default_legacy_day_rate" in prac_cols:
            conn.execute("ALTER TABLE practices DROP COLUMN default_legacy_day_rate")

        expert_cols = {row[1] for row in conn.execute("PRAGMA table_info(expert_responses)").fetchall()}
        if "l2_legacy_team_size" in expert_cols:
            conn.execute("ALTER TABLE expert_responses DROP COLUMN l2_legacy_team_size")

        conn.commit()


def migrate_v19() -> None:
    """v1.9: Phase 3a — first-class pioneers.

    Destructive migration:
    1. Creates `pioneers` table + case-insensitive partial unique email index.
    2. Truncates project_pioneers (cascades to pioneer_round_tokens and
       expert_responses via existing FK CASCADE).
    3. Table-rebuilds project_pioneers: replaces pioneer_name/pioneer_email
       columns with a NOT NULL pioneer_id FK to pioneers.
    4. Drops vestigial v1.0 projects.pioneer_name and projects.pioneer_email.

    Idempotent via PRAGMA checks. Existing pioneer assignments are wiped;
    admins must re-add via the new picker.
    """
    with _db() as conn:
        # 1. Create pioneers table + index.
        conn.execute(
            """CREATE TABLE IF NOT EXISTS pioneers (
                   id INTEGER PRIMARY KEY AUTOINCREMENT,
                   name TEXT NOT NULL,
                   email TEXT,
                   notes TEXT,
                   created_by INTEGER,
                   created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                   FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
               )"""
        )
        conn.execute(
            """CREATE UNIQUE INDEX IF NOT EXISTS idx_pioneers_email_lower
                   ON pioneers(lower(trim(email))) WHERE email IS NOT NULL"""
        )

        # 2. Table-rebuild project_pioneers if pioneer_id column missing.
        pp_cols = {row[1] for row in conn.execute(
            "PRAGMA table_info(project_pioneers)"
        ).fetchall()}
        if "pioneer_id" not in pp_cols:
            # Truncate first (cascades).
            conn.execute("PRAGMA foreign_keys = ON")
            conn.execute("DELETE FROM project_pioneers")
            # Old project_pioneers had: id, project_id, pioneer_name, pioneer_email,
            # total_rounds, expert_token, day_rate, role_name (after Phase 1, 2b).
            # New schema: id, project_id, pioneer_id NOT NULL FK, total_rounds,
            # expert_token, day_rate, role_name.
            conn.execute(
                """CREATE TABLE project_pioneers_new (
                       id INTEGER PRIMARY KEY AUTOINCREMENT,
                       project_id INTEGER NOT NULL,
                       pioneer_id INTEGER NOT NULL,
                       total_rounds INTEGER,
                       expert_token TEXT UNIQUE NOT NULL,
                       day_rate REAL,
                       role_name TEXT,
                       FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
                       FOREIGN KEY (pioneer_id) REFERENCES pioneers(id) ON DELETE RESTRICT
                   )"""
            )
            # Old table is empty (just truncated), so no INSERT needed.
            conn.execute("DROP TABLE project_pioneers")
            conn.execute("ALTER TABLE project_pioneers_new RENAME TO project_pioneers")

        # 3. Drop vestigial v1.0 columns from projects.
        proj_cols = {row[1] for row in conn.execute(
            "PRAGMA table_info(projects)"
        ).fetchall()}
        if "pioneer_name" in proj_cols:
            conn.execute("ALTER TABLE projects DROP COLUMN pioneer_name")
        if "pioneer_email" in proj_cols:
            conn.execute("ALTER TABLE projects DROP COLUMN pioneer_email")

        conn.commit()


def migrate_v20() -> None:
    """v2.0: Phase 3c — split pioneers.name into first_name + last_name.

    Destructive but backfills first:
    1. Adds nullable first_name / last_name columns.
    2. Backfills via SQLite instr/substr to split on the first whitespace
       (last_name = '' for single-word names like "Madonna").
    3. Table-rebuilds pioneers to drop `name` and mark first_name + last_name
       NOT NULL. Preserves the case-insensitive partial unique email index.

    Idempotent via PRAGMA — once `name` is gone the migration becomes a no-op.
    """
    with _db() as conn:
        cols = {row[1] for row in conn.execute(
            "PRAGMA table_info(pioneers)"
        ).fetchall()}

        # If `name` is already gone, the migration has already run.
        if "name" not in cols:
            return

        # 1. Add nullable first_name / last_name columns if missing.
        if "first_name" not in cols:
            conn.execute("ALTER TABLE pioneers ADD COLUMN first_name TEXT")
        if "last_name" not in cols:
            conn.execute("ALTER TABLE pioneers ADD COLUMN last_name TEXT")

        # 2. Backfill: first_name = substring up to first whitespace,
        #    last_name = remainder (or '' when no whitespace).
        #    SQLite expression: when instr(name, ' ') > 0:
        #      first = substr(name, 1, instr(name, ' ') - 1)
        #      last  = substr(name, instr(name, ' ') + 1)
        #    else:
        #      first = name
        #      last  = ''
        #    Use TRIM on name first to collapse leading whitespace.
        conn.execute(
            """UPDATE pioneers
                  SET first_name = CASE
                        WHEN instr(TRIM(name), ' ') > 0
                          THEN substr(TRIM(name), 1, instr(TRIM(name), ' ') - 1)
                        ELSE TRIM(name)
                      END,
                      last_name = CASE
                        WHEN instr(TRIM(name), ' ') > 0
                          THEN TRIM(substr(TRIM(name), instr(TRIM(name), ' ') + 1))
                        ELSE ''
                      END
                WHERE first_name IS NULL OR last_name IS NULL"""
        )
        # Defensive: NULL becomes empty for first_name (impossible if name was NOT NULL).
        conn.execute("UPDATE pioneers SET first_name = '' WHERE first_name IS NULL")
        conn.execute("UPDATE pioneers SET last_name = '' WHERE last_name IS NULL")
        conn.commit()

        # 3. Table-rebuild to drop `name` and mark first_name / last_name NOT NULL.
        #    SQLite cannot ALTER COLUMN, so we copy into a new table.
        conn.execute("PRAGMA foreign_keys = OFF")
        conn.execute(
            """CREATE TABLE pioneers_new (
                   id INTEGER PRIMARY KEY AUTOINCREMENT,
                   first_name TEXT NOT NULL,
                   last_name TEXT NOT NULL,
                   email TEXT,
                   notes TEXT,
                   created_by INTEGER,
                   created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                   FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
               )"""
        )
        conn.execute(
            """INSERT INTO pioneers_new
                   (id, first_name, last_name, email, notes, created_by, created_at)
                   SELECT id, first_name, last_name, email, notes, created_by, created_at
                     FROM pioneers"""
        )
        conn.execute("DROP TABLE pioneers")
        conn.execute("ALTER TABLE pioneers_new RENAME TO pioneers")
        # Recreate the case-insensitive partial unique email index.
        conn.execute(
            """CREATE UNIQUE INDEX IF NOT EXISTS idx_pioneers_email_lower
                   ON pioneers(lower(trim(email))) WHERE email IS NOT NULL"""
        )
        conn.execute("PRAGMA foreign_keys = ON")
        conn.commit()


def migrate_v21_fx_rates() -> None:
    """v2.1: add fx_rates table + app_settings.base_currency.

    fx_rates is a 6-row lookup table keyed by ISO currency code, holding
    the multiplier from each currency to the configured base currency.
    Seeded at rate 1.0 — admin updates real values in Settings.

    app_settings gains base_currency (default 'USD') for the dashboard
    rollup. Kept separate from default_currency (new-project default)
    so the two concerns can diverge.

    Idempotent via PRAGMA table_info.
    """
    with _db() as conn:
        conn.execute(
            """CREATE TABLE IF NOT EXISTS fx_rates (
                   currency_code TEXT PRIMARY KEY,
                   rate_to_base  REAL NOT NULL CHECK (rate_to_base >= 0),
                   updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
               )"""
        )
        # Seed every code in the canonical CURRENCIES list at rate 1.0.
        from backend.schema import CURRENCIES
        for code in CURRENCIES:
            conn.execute(
                "INSERT OR IGNORE INTO fx_rates (currency_code, rate_to_base) VALUES (?, 1.0)",
                (code,),
            )

        # Add base_currency column to app_settings if missing.
        cols = {row[1] for row in conn.execute("PRAGMA table_info(app_settings)").fetchall()}
        if "base_currency" not in cols:
            conn.execute(
                "ALTER TABLE app_settings ADD COLUMN base_currency TEXT NOT NULL DEFAULT 'USD'"
            )
        conn.commit()


def migrate_v22_drop_legacy_norms() -> None:
    """v2.2: drop legacy_norms table + projects.legacy_overridden column.

    The table was dead code — 0 rows in production, 0 helpers actively
    called by the frontend, and the only validation that read from it
    (legacy_overridden flag in POST /api/projects) always evaluated to
    False because nothing populated the table. The user-facing
    'Category Norms' view at /api/norms/aggregates is unaffected — it
    computes aggregates from expert_responses, not this table.

    The projects.legacy_overridden column is dropped alongside the table
    since it was only ever set by the now-deleted validation block.

    Idempotent via sqlite_master + PRAGMA table_info checks.
    """
    with _db() as conn:
        exists = conn.execute(
            "SELECT 1 FROM sqlite_master WHERE type='table' AND name='legacy_norms'"
        ).fetchone()
        if exists:
            conn.execute("DROP TABLE legacy_norms")

        proj_cols = {row[1] for row in conn.execute("PRAGMA table_info(projects)").fetchall()}
        if "legacy_overridden" in proj_cols:
            # SQLite >= 3.35 supports DROP COLUMN. The bundled python sqlite3
            # ships with at least 3.35 on macOS Big Sur+, Linux distros from
            # 2021+, and Docker python:3.11 base images.
            conn.execute("ALTER TABLE projects DROP COLUMN legacy_overridden")

        conn.commit()


def migrate_v23_pioneer_title_home_practice() -> None:
    """v2.3: add pioneers.title + pioneers.home_practice_id; auto-parse the
    "{practice_code} — {title}" notes pattern that _seed_initial_pioneers
    produced before this migration existed.

    Idempotent via PRAGMA table_info — once the columns exist and are
    populated, re-running is a no-op (the WHERE clause filters out already-
    migrated rows).
    """
    import re
    with _db() as conn:
        cols = {row[1] for row in conn.execute("PRAGMA table_info(pioneers)").fetchall()}
        if "title" not in cols:
            conn.execute("ALTER TABLE pioneers ADD COLUMN title TEXT")
        if "home_practice_id" not in cols:
            # Note: SQLite doesn't enforce FK constraint added via ALTER TABLE,
            # but the column reference documents intent.
            conn.execute("ALTER TABLE pioneers ADD COLUMN home_practice_id INTEGER REFERENCES practices(id)")
        conn.commit()

        # Auto-parse the seeded notes pattern — uses an em dash (—, U+2014) and
        # the practice code prefix. Matches: "MAP — Partner", "MCD — Engagement Manager".
        practice_codes = {row[0]: row[1] for row in conn.execute(
            "SELECT code, id FROM practices"
        ).fetchall()}
        # Build code->id lookup; ignore practices with no code.
        code_to_id = {code: pid for code, pid in practice_codes.items() if code}

        # Find rows whose title is still NULL but notes match the pattern.
        candidates = conn.execute(
            "SELECT id, notes FROM pioneers WHERE title IS NULL AND notes IS NOT NULL AND notes != ''"
        ).fetchall()
        pattern = re.compile(r"^([A-Z]{2,5})\s+—\s+(.+)$")
        for cand in candidates:
            m = pattern.match((cand["notes"] or "").strip())
            if not m:
                continue
            code, title = m.group(1), m.group(2).strip()
            pid = code_to_id.get(code)
            if pid is None:
                continue
            conn.execute(
                "UPDATE pioneers SET title=?, home_practice_id=?, notes='' WHERE id=?",
                (title, pid, cand["id"]),
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
    # Create pioneer rows from existing project pioneer_name/email/token.
    # Skip if migrate_v19 already dropped the vestigial columns.
    proj_cols = {row[1] for row in conn.execute("PRAGMA table_info(projects)").fetchall()}
    if "pioneer_name" not in proj_cols:
        # Columns already gone — v19 migration ran first; nothing to migrate.
        conn.execute("UPDATE projects SET status = 'pending' WHERE status = 'expert_pending'")
        return
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
        # Guard against migrate_v19's table-rebuild which drops created_at.
        pp_cols = {row[1] for row in conn.execute("PRAGMA table_info(project_pioneers)").fetchall()}
        if "created_at" not in pp_cols:
            # project_pioneers was rebuilt by migrate_v19 — no legacy rows to seed.
            conn.commit()
            return
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

    _seed_initial_pioneers()


# ── Initial pioneer roster (deploy-time seed) ──────────────────────────────────

# Each entry: (first_name, last_name, email_local, home_practice, home_role).
# `home_practice` is the practice code (FK lookup) and `home_role` is the title.
# The seeder writes these into the structured columns added in v23 — they
# describe where the person typically works, but the project-level pioneer
# assignment can use a different practice/role.
_INITIAL_PIONEERS = [
    # MAP
    ("Giuseppe",  "Gulotta",         "giuseppe.gulotta",   "MAP", "Partner"),
    ("Aaron",     "Grandy",          "aaron.grandy",       "MAP", "Principal"),
    ("Sandra",    "Walsh",           "sandra.walsh",       "MAP", "Senior Consultant"),
    ("Rithvik",   "Badinedi",        "rithvik.badinedi",   "MAP", "Senior Consultant"),
    ("Anastasia", "Amato",           "anastasia.amato",    "MAP", "Engagement Manager"),
    # MCD
    ("Matteo",    "Tolomei",         "matteo.tolomei",     "MCD", "Engagement Manager"),
    ("Elia",      "Lahouiri",        "elia.lahouiri",      "MCD", "Principal"),
    ("Akash",     "Nayak Karopadi",  "akash.nayakkaropadi","MCD", "Principal"),
    ("Florent",   "Chouvy",          "florent.chouvy",     "MCD", "Principal"),
    ("Giorgia",   "Miglietta",       "giorgia.miglietta",  "MCD", "Principal"),
    ("Davide",    "Targa",           "davide.targa",       "MCD", "Senior Consultant"),
    ("Nicola",    "Luise",           "nicola.luise",       "MCD", "Engagement Manager"),
    ("Sahil",     "Chutani",         "sahil.chutani",      "MCD", "Engagement Manager"),
    ("Helena",    "Xu",              "helena.xu",          "MCD", "Engagement Manager"),
]


def _seed_initial_pioneers() -> None:
    """Insert the initial Alira Health pioneer roster on first deployment.

    Idempotent — pioneers whose email is already present are skipped, so
    re-running on subsequent deploys is a no-op. Writes title +
    home_practice_id directly into the structured columns (added in v23);
    notes is left empty for the user to add real bio content later.
    """
    with _db() as conn:
        practice_lookup = {row[0]: row[1] for row in conn.execute(
            "SELECT code, id FROM practices"
        ).fetchall()}
        for first, last, email_local, home_practice, home_role in _INITIAL_PIONEERS:
            email = f"{email_local}@alirahealth.com"
            existing = conn.execute(
                "SELECT id FROM pioneers WHERE lower(trim(email)) = lower(trim(?))",
                (email,),
            ).fetchone()
            if existing:
                continue
            home_practice_id = practice_lookup.get(home_practice)
            conn.execute(
                """INSERT INTO pioneers (first_name, last_name, email, notes,
                                        title, home_practice_id)
                   VALUES (?, ?, ?, ?, ?, ?)""",
                (first, last, email, None, home_role, home_practice_id),
            )
        conn.commit()


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
    """Return all categories with their allowed practice ids + codes."""
    with _db() as conn:
        rows = conn.execute("SELECT * FROM project_categories ORDER BY name").fetchall()
        cats = [dict(r) for r in rows]
        # Attach allowed practices for each category from the junction table.
        pairs = conn.execute("""
            SELECT cp.category_id, p.id AS practice_id, p.code, p.name
            FROM category_practices cp
            JOIN practices p ON p.id = cp.practice_id
            ORDER BY p.code
        """).fetchall()
        by_cat: dict = {}
        for pr in pairs:
            by_cat.setdefault(pr["category_id"], []).append(
                {"id": pr["practice_id"], "code": pr["code"], "name": pr["name"]}
            )
        for c in cats:
            c["practices"] = by_cat.get(c["id"], [])
        return cats


def get_practices_for_category(category_id: int) -> list:
    """Return the practices allowed for a given category (empty list if none)."""
    with _db() as conn:
        rows = conn.execute("""
            SELECT p.id, p.code, p.name
            FROM practices p
            JOIN category_practices cp ON cp.practice_id = p.id
            WHERE cp.category_id = ?
            ORDER BY p.code
        """, (category_id,)).fetchall()
        return [dict(r) for r in rows]


def is_practice_allowed_for_category(category_id: int, practice_id: int) -> bool:
    """Return True iff the (category_id, practice_id) pair is in category_practices."""
    with _db() as conn:
        row = conn.execute(
            "SELECT 1 FROM category_practices WHERE category_id = ? AND practice_id = ?",
            (category_id, practice_id),
        ).fetchone()
        return row is not None


def set_practices_for_category(category_id: int, practice_ids: list) -> None:
    """Replace the practice attributions for a category with the given list."""
    with _db() as conn:
        conn.execute("DELETE FROM category_practices WHERE category_id = ?", (category_id,))
        for pid in practice_ids:
            conn.execute(
                "INSERT OR IGNORE INTO category_practices (category_id, practice_id) VALUES (?, ?)",
                (category_id, int(pid)),
            )
        conn.commit()


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
        conn.execute("DELETE FROM project_categories WHERE id = ?", (category_id,))
        conn.commit()
        return True


def category_has_projects(category_id: int) -> bool:
    with _db() as conn:
        count = conn.execute(
            "SELECT COUNT(*) FROM projects WHERE category_id = ?", (category_id,)
        ).fetchone()[0]
        return count > 0


# ── Practices ────────────────────────────────────────────────────────────────

def list_practices() -> list:
    """Return all practices ordered by code, with project counts."""
    with _db() as conn:
        rows = conn.execute(
            """SELECT pr.*,
                      (SELECT COUNT(*) FROM projects p WHERE p.practice_id = pr.id) AS project_count
               FROM practices pr
               ORDER BY pr.code"""
        ).fetchall()
        return [dict(r) for r in rows]


def get_practice(practice_id: int) -> Optional[sqlite3.Row]:
    with _db() as conn:
        return conn.execute(
            "SELECT * FROM practices WHERE id = ?", (practice_id,)
        ).fetchone()


def create_practice(code: str, name: str, description: Optional[str] = None) -> int:
    with _db() as conn:
        cur = conn.execute(
            "INSERT INTO practices (code, name, description) VALUES (?, ?, ?)",
            (code, name, description),
        )
        conn.commit()
        return cur.lastrowid


def update_practice(
    practice_id: int,
    name: str,
    description: Optional[str] = None,
) -> bool:
    """Update name and description. `code` is immutable once seeded."""
    with _db() as conn:
        conn.execute(
            "UPDATE practices SET name = ?, description = ? WHERE id = ?",
            (name, description, practice_id),
        )
        conn.commit()
        return True


def delete_practice(practice_id: int) -> bool:
    """Delete a practice. Fails if any projects reference it."""
    with _db() as conn:
        count = conn.execute(
            "SELECT COUNT(*) FROM projects WHERE practice_id = ?", (practice_id,)
        ).fetchone()[0]
        if count > 0:
            return False
        conn.execute("DELETE FROM practices WHERE id = ?", (practice_id,))
        conn.commit()
        return True


def practice_has_projects(practice_id: int) -> bool:
    with _db() as conn:
        count = conn.execute(
            "SELECT COUNT(*) FROM projects WHERE practice_id = ?", (practice_id,)
        ).fetchone()[0]
        return count > 0


def list_practice_roles(practice_id: int) -> list[dict]:
    """Return all role rows for a practice, ordered by display_order then id."""
    with _db() as conn:
        rows = conn.execute(
            """SELECT id, practice_id, role_name, day_rate, currency,
                      display_order, created_at
                 FROM practice_roles
                WHERE practice_id = ?
             ORDER BY display_order ASC, id ASC""",
            (practice_id,),
        ).fetchall()
        return [dict(r) for r in rows]


def list_legacy_team(project_id: int) -> list[dict]:
    """Return all legacy team-mix rows for a project, ordered by id."""
    with _db() as conn:
        rows = conn.execute(
            """SELECT id, project_id, role_name, count, day_rate
                 FROM project_legacy_team
                WHERE project_id = ?
             ORDER BY id ASC""",
            (project_id,),
        ).fetchall()
        return [dict(r) for r in rows]


def replace_legacy_team(project_id: int, team: list[dict]) -> None:
    """Bulk-replace the project's legacy team mix in a single transaction."""
    with _db() as conn:
        conn.execute("DELETE FROM project_legacy_team WHERE project_id = ?", (project_id,))
        for r in team:
            conn.execute(
                """INSERT INTO project_legacy_team (project_id, role_name, count, day_rate)
                   VALUES (?, ?, ?, ?)""",
                (project_id, r["role_name"], r["count"], r["day_rate"]),
            )
        conn.commit()


def replace_practice_roles(practice_id: int, roles: list[dict]) -> None:
    """Bulk-replace all roles for a practice in a single transaction.

    Each entry in `roles` must be a dict with keys: role_name, day_rate,
    currency, display_order.
    """
    with _db() as conn:
        conn.execute("DELETE FROM practice_roles WHERE practice_id = ?", (practice_id,))
        for r in roles:
            conn.execute(
                """INSERT INTO practice_roles
                       (practice_id, role_name, day_rate, currency, display_order)
                       VALUES (?, ?, ?, ?, ?)""",
                (
                    practice_id,
                    r["role_name"],
                    r["day_rate"],
                    r["currency"],
                    r.get("display_order", 0),
                ),
            )
        conn.commit()


# ── Projects ─────────────────────────────────────────────────────────────────

def create_project(data: dict) -> int:
    """Create a project with multi-pioneer support.

    Accepts either:
    - ``pioneers`` list: each dict may carry ``pioneer_id`` (reference existing)
      or ``name``+``email`` (inline find-or-create).
    - ``pioneer_name`` string (v1.0 compat): creates a single pioneer from it.
    """
    # Fall back defaults for legacy norms — the legacy_norms table was
    # dropped in v2.2 (it held 0 rows). Apply hard-coded defaults instead.
    for field in ("legacy_calendar_days", "legacy_revision_rounds"):
        if not data.get(field):
            data[field] = "6-10" if "days" in field else "1"

    # Determine pioneers list
    pioneers_input = data.get("pioneers")

    # Generate a legacy token for the project row (backward compat)
    project_token = secrets.token_urlsafe(32)

    default_rounds = data.get("default_rounds", 1)
    show_previous_answers = 1 if data.get("show_previous_answers") else 0
    show_other_pioneers_answers = 1 if data.get("show_other_pioneers_answers") else 0

    with _db() as conn:
        cur = conn.execute(
            """INSERT INTO projects
               (created_by, project_name, category_id, practice_id, client_name,
                description,
                date_started, date_expected_delivered, date_delivered,
                xcsg_calendar_days, working_days, xcsg_team_size, xcsg_revision_rounds, revision_depth, xcsg_scope_expansion, engagement_revenue,
                legacy_calendar_days, legacy_revision_rounds,
                engagement_stage, client_contact_email, client_pulse, expert_token,
                default_rounds, show_previous_answers, show_other_pioneers_answers, status,
                currency, xcsg_pricing_model, scope_expansion_revenue)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                data["created_by"],
                data["project_name"],
                data["category_id"],
                data.get("practice_id"),
                data.get("client_name"),
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
                data["legacy_revision_rounds"],
                data.get("engagement_stage"),
                data.get("client_contact_email"),
                data.get("client_pulse") or "Not yet received",
                project_token,
                default_rounds,
                show_previous_answers,
                show_other_pioneers_answers,
                "pending",
                data.get("currency"),
                data.get("xcsg_pricing_model"),
                data.get("scope_expansion_revenue"),
            ),
        )
        project_id = cur.lastrowid
        conn.commit()

    # Create pioneer rows outside the project INSERT transaction so add_pioneer
    # can open its own connection (it calls find_pioneer_by_email / create_pioneer).
    if pioneers_input:
        for p in pioneers_input:
            add_pioneer(
                project_id=project_id,
                pioneer_id=p.get("pioneer_id"),
                first_name=p.get("first_name"),
                last_name=p.get("last_name"),
                email=p.get("email"),
                total_rounds=p.get("total_rounds"),
                issued_by=data.get("created_by"),
                day_rate=p.get("day_rate"),
                role_name=p.get("role_name"),
            )

    # Persist legacy_team mix (Phase 2c).
    legacy_team = data.get("legacy_team") or []
    if legacy_team:
        with _db() as conn:
            for r in legacy_team:
                conn.execute(
                    """INSERT INTO project_legacy_team (project_id, role_name, count, day_rate)
                       VALUES (?, ?, ?, ?)""",
                    (project_id, r["role_name"], r["count"], r["day_rate"]),
                )
            conn.commit()

    return project_id


def get_project(project_id: int) -> Optional[sqlite3.Row]:
    with _db() as conn:
        return conn.execute(
            """SELECT p.*, pc.name AS category_name,
                      pr.code AS practice_code, pr.name AS practice_name
               FROM projects p
               JOIN project_categories pc ON p.category_id = pc.id
               LEFT JOIN practices pr ON p.practice_id = pr.id
               WHERE p.id = ?""",
            (project_id,),
        ).fetchone()


def list_projects(
    status_filter: Optional[str] = None,
    category_id: Optional[int] = None,
    practice_id: Optional[int] = None,
    pioneer: Optional[str] = None,
    client: Optional[str] = None,
) -> list:
    with _db() as conn:
        query = """SELECT DISTINCT p.*, pc.name AS category_name,
                          pr.code AS practice_code, pr.name AS practice_name
                   FROM projects p
                   JOIN project_categories pc ON p.category_id = pc.id
                   LEFT JOIN practices pr ON p.practice_id = pr.id"""
        params = []
        if pioneer:
            query += (" JOIN project_pioneers pp ON pp.project_id = p.id"
                      " JOIN pioneers pio ON pio.id = pp.pioneer_id")
        query += " WHERE 1=1"
        if status_filter:
            query += " AND p.status = ?"
            params.append(status_filter)
        if category_id:
            query += " AND p.category_id = ?"
            params.append(category_id)
        if practice_id:
            query += " AND p.practice_id = ?"
            params.append(practice_id)
        if pioneer:
            # Match against the computed display name (first + space + last, trimmed).
            query += " AND TRIM(pio.first_name || ' ' || pio.last_name) = ?"
            params.append(pioneer)
        if client:
            query += " AND p.client_name = ?"
            params.append(client)
        query += " ORDER BY p.created_at DESC"
        rows = conn.execute(query, params).fetchall()
        return [dict(r) for r in rows]


def update_project(project_id: int, data: dict) -> bool:
    # Phase 2c: pull legacy_team out before the generic field update.
    # None = leave unchanged; [] = clear; non-empty list = replace.
    legacy_team = data.pop("legacy_team", None)

    with _db() as conn:
        fields = {k: v for k, v in data.items() if v is not None}
        if fields:
            # Coerce booleans to SQLite-friendly ints for known boolean columns.
            for bool_col in ("show_previous_answers", "show_other_pioneers_answers"):
                if bool_col in fields and isinstance(fields[bool_col], bool):
                    fields[bool_col] = 1 if fields[bool_col] else 0
            set_clause = ", ".join(f"{k} = ?" for k in fields)
            set_clause += ", updated_at = CURRENT_TIMESTAMP"
            values = list(fields.values()) + [project_id]
            conn.execute(
                f"UPDATE projects SET {set_clause} WHERE id = ?", values
            )

        # Apply legacy_team if explicitly provided (None means unchanged).
        if legacy_team is not None:
            conn.execute("DELETE FROM project_legacy_team WHERE project_id = ?", (project_id,))
            for r in legacy_team:
                conn.execute(
                    """INSERT INTO project_legacy_team (project_id, role_name, count, day_rate)
                       VALUES (?, ?, ?, ?)""",
                    (project_id, r["role_name"], r["count"], r["day_rate"]),
                )

        conn.commit()
        return True


def delete_project(project_id: int) -> bool:
    with _db() as conn:
        conn.execute(
            "UPDATE activity_log SET project_id = NULL WHERE project_id = ?",
            (project_id,),
        )
        # expert_responses and project_pioneers both have ON DELETE CASCADE from
        # projects — the DB handles them; no need to delete them explicitly.
        conn.execute("DELETE FROM projects WHERE id = ?", (project_id,))
        conn.commit()
        return True


def get_project_by_token(token: str) -> Optional[sqlite3.Row]:
    with _db() as conn:
        return conn.execute(
            """SELECT p.*, pc.name AS category_name,
                      pr.code AS practice_code, pr.name AS practice_name
               FROM projects p
               JOIN project_categories pc ON p.category_id = pc.id
               LEFT JOIN practices pr ON p.practice_id = pr.id
               WHERE p.expert_token = ?""",
            (token,),
        ).fetchone()


# ── Pioneer CRUD ─────────────────────────────────────────────────────────────

def get_pioneer_day_rates(project_id: int) -> list:
    """Return a list of day_rate values for all pioneers on a project.

    None entries are preserved so callers can detect missing rates.
    """
    with _db() as conn:
        rows = conn.execute(
            "SELECT day_rate FROM project_pioneers WHERE project_id = ?",
            (project_id,),
        ).fetchall()
    return [row["day_rate"] for row in rows]


def list_pioneers(project_id: int) -> list:
    """Return all pioneers for a project with response counts and round tokens.

    Each pioneer dict gains a ``rounds`` list containing every round token row
    (issued and/or completed) ordered by round_number. Names and emails are
    resolved from the ``pioneers`` table via JOIN.
    """
    with _db() as conn:
        rows = conn.execute(
            """SELECT pp.id, pp.project_id, pp.pioneer_id,
                      pio.first_name AS pioneer_first_name,
                      pio.last_name  AS pioneer_last_name,
                      TRIM(pio.first_name || ' ' || pio.last_name) AS pioneer_name,
                      TRIM(pio.first_name || ' ' || pio.last_name) AS display_name,
                      pio.email AS pioneer_email,
                      pp.total_rounds, pp.expert_token, pp.day_rate, pp.role_name,
                      COALESCE(stats.response_count, 0) AS response_count,
                      stats.last_round,
                      stats.last_submitted
               FROM project_pioneers pp
               JOIN pioneers pio ON pio.id = pp.pioneer_id
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
               ORDER BY pp.id ASC""",
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


def add_pioneer(
    project_id: int,
    pioneer_id: Optional[int] = None,
    first_name: Optional[str] = None,
    last_name: Optional[str] = None,
    email: Optional[str] = None,
    total_rounds: Optional[int] = None,
    issued_by: Optional[int] = None,
    day_rate: Optional[float] = None,
    role_name: Optional[str] = None,
    title: Optional[str] = None,
    home_practice_id: Optional[int] = None,
) -> int:
    """Add a pioneer-on-project row.

    If pioneer_id is None, find-or-create a pioneer by email (or create new if
    no email match). Returns the new project_pioneers.id.
    """
    # Resolve pioneer_id via find-or-create if not supplied directly.
    if pioneer_id is None:
        if email:
            existing = find_pioneer_by_email(email)
            if existing:
                pioneer_id = existing["id"]
        if pioneer_id is None:
            fn = (first_name or "").strip()
            ln = (last_name or "").strip()
            if not fn and not ln:
                raise ValueError("add_pioneer: pioneer_id or first_name/last_name required")
            pioneer_id = create_pioneer(
                first_name=fn, last_name=ln, email=email, notes=None, created_by=issued_by,
                title=title, home_practice_id=home_practice_id,
            )

    token = secrets.token_urlsafe(32)
    with _db() as conn:
        cur = conn.execute(
            """INSERT INTO project_pioneers (project_id, pioneer_id, total_rounds, expert_token, day_rate, role_name)
               VALUES (?, ?, ?, ?, ?, ?)""",
            (project_id, pioneer_id, total_rounds, token, day_rate, role_name),
        )
        pp_id = cur.lastrowid
        conn.execute(
            """INSERT INTO pioneer_round_tokens (pioneer_id, round_number, token, issued_by)
               VALUES (?, 1, ?, ?)""",
            (pp_id, token, issued_by),
        )
        conn.commit()
        return pp_id




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
    """Update allowed fields on a project_pioneers row."""
    allowed = {"total_rounds", "day_rate", "role_name"}
    fields = {}
    for k, v in data.items():
        if k not in allowed:
            continue
        # role_name allows None (intentional clear from the UI); other fields skip None
        # to mean "leave unchanged" so that omitted-or-null in the request body
        # doesn't accidentally overwrite existing values with NULL.
        if v is None and k != "role_name":
            continue
        fields[k] = v
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
                      pio.first_name AS pioneer_first_name,
                      pio.last_name  AS pioneer_last_name,
                      TRIM(pio.first_name || ' ' || pio.last_name) AS pioneer_name,
                      pio.email AS pioneer_email,
                      pp.total_rounds,
                      pp.project_id,
                      p.project_name, p.category_id, p.practice_id, p.client_name,
                      p.description, p.date_started, p.date_delivered,
                      p.xcsg_calendar_days, p.working_days, p.xcsg_team_size,
                      p.xcsg_revision_rounds, p.revision_depth, p.xcsg_scope_expansion,
                      p.engagement_revenue, p.legacy_calendar_days,
                      p.legacy_revision_rounds, p.engagement_stage,
                      p.default_rounds, p.show_previous_answers,
                      p.show_other_pioneers_answers, p.status,
                      pc.name AS category_name,
                      pr.code AS practice_code, pr.name AS practice_name
               FROM pioneer_round_tokens prt
               JOIN project_pioneers pp ON prt.pioneer_id = pp.id
               JOIN pioneers pio ON pio.id = pp.pioneer_id
               JOIN projects p ON pp.project_id = p.id
               JOIN project_categories pc ON p.category_id = pc.id
               LEFT JOIN practices pr ON p.practice_id = pr.id
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


def get_other_pioneer_responses(project_id: int, exclude_pioneer_id: int) -> list:
    """All submitted responses from pioneers OTHER than the given one.

    Returns a list of dicts, each with the full expert_response row plus the
    pioneer's display name (``pioneer_name``). Only rows that have actually
    been submitted (``submitted_at IS NOT NULL``) are returned. Ordered by
    pioneer name, then round number, for stable rendering.
    """
    with _db() as conn:
        rows = conn.execute(
            """SELECT er.*,
                      pio.first_name AS pioneer_first_name,
                      pio.last_name  AS pioneer_last_name,
                      TRIM(pio.first_name || ' ' || pio.last_name) AS pioneer_name
               FROM expert_responses er
               JOIN project_pioneers pp ON pp.id = er.pioneer_id
               JOIN pioneers pio ON pio.id = pp.pioneer_id
               WHERE er.project_id = ?
                 AND er.pioneer_id != ?
                 AND er.submitted_at IS NOT NULL
               ORDER BY pio.last_name COLLATE NOCASE, pio.first_name COLLATE NOCASE, er.round_number""",
            (project_id, exclude_pioneer_id),
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
                l1_legacy_working_days, l3_legacy_revision_depth, l4_legacy_scope_expansion,
                l5_legacy_client_reaction, l6_legacy_b2_sources, l7_legacy_c1_specialization, l8_legacy_c2_directness,
                l9_legacy_c3_judgment, l10_legacy_d1_proprietary, l11_legacy_d2_reuse, l12_legacy_d3_moat,
                l13_legacy_c7_depth, l14_legacy_c8_decision, l15_legacy_e1_decision, l16_legacy_b6_data,
                notes)
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
                data.get("notes"),
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
            """SELECT er.*,
                      pio.first_name AS pioneer_first_name,
                      pio.last_name  AS pioneer_last_name,
                      TRIM(pio.first_name || ' ' || pio.last_name) AS pioneer_name,
                      pio.email AS pioneer_email
               FROM expert_responses er
               LEFT JOIN project_pioneers pp ON er.pioneer_id = pp.id
               LEFT JOIN pioneers pio ON pio.id = pp.pioneer_id
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


def list_all_notes(
    practice_code: Optional[str] = None,
    category_id: Optional[int] = None,
    pioneer_name: Optional[str] = None,
    delivered_from: Optional[str] = None,
    delivered_to: Optional[str] = None,
    search: Optional[str] = None,
) -> list:
    """Return every submitted expert_response with a non-empty notes field.

    Joins project, category, practice, and pioneer context for display. All
    filters are optional and parametrised (safe against injection). ``search``
    does a case-insensitive substring match on the notes text.
    """
    search_like = f"%{search}%" if search else None
    query = """
        SELECT
          er.id, er.project_id, p.project_name,
          p.category_id, c.name AS category_name,
          pr.code AS practice_code, pr.name AS practice_name,
          pp.id AS pioneer_id,
          TRIM(pio.first_name || ' ' || pio.last_name) AS pioneer_name,
          er.round_number, er.submitted_at, er.notes,
          p.date_delivered
        FROM expert_responses er
        JOIN projects p ON p.id = er.project_id
        LEFT JOIN project_categories c ON c.id = p.category_id
        LEFT JOIN practices pr ON pr.id = p.practice_id
        LEFT JOIN project_pioneers pp ON pp.id = er.pioneer_id
        LEFT JOIN pioneers pio ON pio.id = pp.pioneer_id
        WHERE er.submitted_at IS NOT NULL
          AND er.notes IS NOT NULL AND TRIM(er.notes) != ''
          AND (? IS NULL OR pr.code = ?)
          AND (? IS NULL OR p.category_id = ?)
          AND (? IS NULL OR TRIM(pio.first_name || ' ' || pio.last_name) = ?)
          AND (? IS NULL OR p.date_delivered >= ?)
          AND (? IS NULL OR p.date_delivered <= ?)
          AND (? IS NULL OR LOWER(er.notes) LIKE LOWER(?))
        ORDER BY er.submitted_at DESC
    """
    params = (
        practice_code, practice_code,
        category_id, category_id,
        pioneer_name, pioneer_name,
        delivered_from, delivered_from,
        delivered_to, delivered_to,
        search_like, search_like,
    )
    with _db() as conn:
        rows = conn.execute(query, params).fetchall()
        return [dict(r) for r in rows]



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
            """SELECT DISTINCT p.*, pc.name AS category_name,
                      pr.code AS practice_code, pr.name AS practice_name
               FROM projects p
               JOIN project_categories pc ON p.category_id = pc.id
               LEFT JOIN practices pr ON p.practice_id = pr.id
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
            # Merge legacy_team + pioneer_day_rates before computing — same fix
            # as commit 69b9949 (pioneer aggregator). Without legacy_team,
            # delivery_speed and productivity_ratio both compute to None
            # because legacy_person_days has no count to multiply by l1_days.
            project_dict = dict(item)
            project_dict["pioneer_day_rates"] = get_pioneer_day_rates(item["id"])
            project_dict["legacy_team"] = list_legacy_team(item["id"])
            metrics_list.append(compute_averaged_project_metrics(project_dict, responses))

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


# ── App Settings ──────────────────────────────────────────────────────────────

def get_app_settings() -> dict:
    with _db() as conn:
        row = conn.execute(
            "SELECT default_currency, base_currency FROM app_settings WHERE id=1"
        ).fetchone()
        if row:
            return {
                "default_currency": row["default_currency"],
                "base_currency": row["base_currency"],
            }
        return {"default_currency": "EUR", "base_currency": "USD"}


def update_app_settings(
    *, default_currency: Optional[str] = None, base_currency: Optional[str] = None
) -> None:
    """Update either or both fields. Pass None to leave a field unchanged.

    Note: passing None for both is a silent no-op. Callers expecting at least
    one update should validate before calling.
    """
    with _db() as conn:
        if default_currency is not None:
            conn.execute(
                "UPDATE app_settings SET default_currency = ? WHERE id=1",
                (default_currency,),
            )
        if base_currency is not None:
            conn.execute(
                "UPDATE app_settings SET base_currency = ? WHERE id=1",
                (base_currency,),
            )
        conn.commit()


def get_fx_rates() -> list[dict]:
    """Return the 6-row FX rate table sorted by currency code."""
    with _db() as conn:
        rows = conn.execute(
            "SELECT currency_code, rate_to_base, updated_at FROM fx_rates ORDER BY currency_code"
        ).fetchall()
        return [dict(r) for r in rows]


def update_fx_rates(rates: list[dict]) -> None:
    """Upsert the given rate rows. Each dict needs currency_code + rate_to_base.
    Bumps updated_at to current timestamp. Validates rate_to_base > 0 implicitly
    via the table CHECK constraint (sqlite raises IntegrityError on violation)."""
    with _db() as conn:
        for r in rates:
            conn.execute(
                """INSERT INTO fx_rates (currency_code, rate_to_base, updated_at)
                       VALUES (?, ?, datetime('now'))
                       ON CONFLICT(currency_code) DO UPDATE SET
                         rate_to_base = excluded.rate_to_base,
                         updated_at   = datetime('now')""",
                (r["currency_code"], float(r["rate_to_base"])),
            )
        conn.commit()


def _ensure_all_fx_rows_exist() -> None:
    """Backfill any currencies in schema.CURRENCIES that don't yet have a row.
    Inserted at rate 0.0 — the dashboard's FX-missing path treats 0 as 'unset'
    and excludes affected projects from the normalized total. Called on init_db
    so adding a new currency to the schema later doesn't crash the aggregator."""
    from backend.schema import CURRENCIES
    with _db() as conn:
        existing = {r[0] for r in conn.execute(
            "SELECT currency_code FROM fx_rates"
        ).fetchall()}
        for code in CURRENCIES:
            if code not in existing:
                conn.execute(
                    "INSERT INTO fx_rates (currency_code, rate_to_base) VALUES (?, 0.0)",
                    (code,),
                )
        conn.commit()
