"""
database.py — SQLite CRUD, schema, and seed data for xCSG Value Tracker
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

            CREATE TABLE IF NOT EXISTS deliverables (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                created_by INTEGER NOT NULL,
                pioneer_name TEXT NOT NULL,
                pioneer_email TEXT,
                deliverable_type TEXT NOT NULL,
                engagement_stage TEXT NOT NULL,
                client_name TEXT,
                description TEXT,
                date_started TEXT,
                date_delivered TEXT,
                xcsg_calendar_days TEXT NOT NULL,
                xcsg_team_size TEXT NOT NULL,
                xcsg_revision_rounds TEXT NOT NULL,
                scope_expansion TEXT,
                legacy_calendar_days TEXT NOT NULL,
                legacy_team_size TEXT NOT NULL,
                legacy_revision_rounds TEXT NOT NULL,
                expert_token TEXT UNIQUE NOT NULL,
                expert_completed BOOLEAN DEFAULT 0,
                status TEXT DEFAULT 'expert_pending',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (created_by) REFERENCES users(id)
            );

            CREATE TABLE IF NOT EXISTS expert_responses (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                deliverable_id INTEGER UNIQUE NOT NULL,
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
                completed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (deliverable_id) REFERENCES deliverables(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS legacy_norms (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                deliverable_type TEXT UNIQUE NOT NULL,
                typical_calendar_days TEXT NOT NULL,
                typical_team_size TEXT NOT NULL,
                typical_revision_rounds TEXT NOT NULL,
                notes TEXT,
                updated_by INTEGER,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (updated_by) REFERENCES users(id)
            );

            CREATE TABLE IF NOT EXISTS activity_log (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                action TEXT NOT NULL,
                deliverable_id INTEGER,
                details TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id),
                FOREIGN KEY (deliverable_id) REFERENCES deliverables(id)
            );
        """)
        conn.commit()
    finally:
        conn.close()

    seed_data()


def seed_data() -> None:
    """Create seed users (with password re-hash verification) and legacy norms."""
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
                # Create user for the first time
                hashed = _auth.hash_password(password)
                conn.execute(
                    "INSERT INTO users (username, email, password_hash, role) VALUES (?, ?, ?, ?)",
                    (username, email, hashed, role),
                )
            else:
                # Verify password still validates — re-hash if not
                if not _auth.verify_password(password, row["password_hash"]):
                    new_hash = _auth.hash_password(password)
                    conn.execute(
                        "UPDATE users SET password_hash = ? WHERE id = ?",
                        (new_hash, row["id"]),
                    )

        SEED_NORMS = [
            ("CDD", "11-20", "3", "2", "Full commercial due diligence"),
            ("Competitive landscape", "11-20", "3", "2", "Competitive analysis and market mapping"),
            ("Financial model", "6-10", "2", "1", "Financial modelling and projections"),
            ("Market access", "11-20", "3", "2", "Market access and reimbursement strategy"),
            ("Proposal", "4-5", "2", "1", "Client proposal or pitch document"),
            ("Call prep brief", "2-3", "1", "1", "KOL or expert interview preparation"),
            ("Presentation", "4-5", "2", "2", "Slide deck or presentation"),
            ("KOL mapping", "11-20", "3", "2", "Key opinion leader identification and mapping"),
        ]
        for norm in SEED_NORMS:
            conn.execute(
                """INSERT OR IGNORE INTO legacy_norms
                   (deliverable_type, typical_calendar_days, typical_team_size, typical_revision_rounds, notes)
                   VALUES (?, ?, ?, ?, ?)""",
                norm,
            )

        conn.commit()
    finally:
        conn.close()


# ── Users ─────────────────────────────────────────────────────────────────────

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


# ── Deliverables ──────────────────────────────────────────────────────────────

def create_deliverable(data: dict) -> int:
    """Create a deliverable. Auto-populates legacy fields from norms if null."""
    # Auto-populate legacy fields from norms if not provided
    for field in ("legacy_calendar_days", "legacy_team_size", "legacy_revision_rounds"):
        if not data.get(field):
            norm = get_norm_by_type(data["deliverable_type"])
            if norm:
                if field == "legacy_calendar_days":
                    data[field] = norm["typical_calendar_days"]
                elif field == "legacy_team_size":
                    data[field] = norm["typical_team_size"]
                elif field == "legacy_revision_rounds":
                    data[field] = norm["typical_revision_rounds"]
            else:
                data[field] = "6-10"  # fallback

    token = secrets.token_urlsafe(32)
    conn = get_connection()
    try:
        cur = conn.execute(
            """INSERT INTO deliverables
               (created_by, pioneer_name, pioneer_email, deliverable_type, engagement_stage,
                client_name, description, date_started, date_delivered,
                xcsg_calendar_days, xcsg_team_size, xcsg_revision_rounds, scope_expansion,
                legacy_calendar_days, legacy_team_size, legacy_revision_rounds,
                expert_token)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                data["created_by"],
                data["pioneer_name"],
                data.get("pioneer_email"),
                data["deliverable_type"],
                data["engagement_stage"],
                data.get("client_name"),
                data.get("description"),
                data.get("date_started"),
                data.get("date_delivered"),
                data["xcsg_calendar_days"],
                data["xcsg_team_size"],
                data["xcsg_revision_rounds"],
                data.get("scope_expansion"),
                data["legacy_calendar_days"],
                data["legacy_team_size"],
                data["legacy_revision_rounds"],
                token,
            ),
        )
        conn.commit()
        return cur.lastrowid
    finally:
        conn.close()


def get_deliverable(deliverable_id: int) -> Optional[sqlite3.Row]:
    conn = get_connection()
    try:
        return conn.execute(
            "SELECT * FROM deliverables WHERE id = ?", (deliverable_id,)
        ).fetchone()
    finally:
        conn.close()


def list_deliverables(status_filter: Optional[str] = None) -> list:
    conn = get_connection()
    try:
        if status_filter:
            rows = conn.execute(
                "SELECT * FROM deliverables WHERE status = ? ORDER BY created_at DESC",
                (status_filter,),
            ).fetchall()
        else:
            rows = conn.execute(
                "SELECT * FROM deliverables ORDER BY created_at DESC"
            ).fetchall()
        return [dict(r) for r in rows]
    finally:
        conn.close()


def update_deliverable(deliverable_id: int, data: dict) -> bool:
    conn = get_connection()
    try:
        fields = {k: v for k, v in data.items() if v is not None}
        if not fields:
            return False
        set_clause = ", ".join(f"{k} = ?" for k in fields)
        set_clause += ", updated_at = CURRENT_TIMESTAMP"
        values = list(fields.values()) + [deliverable_id]
        conn.execute(
            f"UPDATE deliverables SET {set_clause} WHERE id = ?", values
        )
        conn.commit()
        return True
    finally:
        conn.close()


def delete_deliverable(deliverable_id: int) -> bool:
    conn = get_connection()
    try:
        # Nullify activity_log references (no CASCADE on this FK)
        conn.execute(
            "UPDATE activity_log SET deliverable_id = NULL WHERE deliverable_id = ?",
            (deliverable_id,),
        )
        # expert_responses has ON DELETE CASCADE, but be explicit
        conn.execute(
            "DELETE FROM expert_responses WHERE deliverable_id = ?",
            (deliverable_id,),
        )
        conn.execute("DELETE FROM deliverables WHERE id = ?", (deliverable_id,))
        conn.commit()
        return True
    finally:
        conn.close()


def get_deliverable_by_token(token: str) -> Optional[sqlite3.Row]:
    conn = get_connection()
    try:
        return conn.execute(
            "SELECT * FROM deliverables WHERE expert_token = ?", (token,)
        ).fetchone()
    finally:
        conn.close()


# ── Expert Responses ─────────────────────────────────────────────────────────

def get_expert_response(deliverable_id: int) -> Optional[sqlite3.Row]:
    conn = get_connection()
    try:
        return conn.execute(
            "SELECT * FROM expert_responses WHERE deliverable_id = ?", (deliverable_id,)
        ).fetchone()
    finally:
        conn.close()


def create_expert_response(deliverable_id: int, data: dict) -> int:
    conn = get_connection()
    try:
        cur = conn.execute(
            """INSERT INTO expert_responses
               (deliverable_id, b1_starting_point, b2_research_sources, b3_assembly_ratio,
                b4_hypothesis_first, c1_specialization, c2_directness, c3_judgment_pct,
                d1_proprietary_data, d2_knowledge_reuse, d3_moat_test,
                f1_feasibility, f2_productization)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                deliverable_id,
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
        # Mark deliverable as complete
        conn.execute(
            "UPDATE deliverables SET expert_completed = 1, status = 'complete', updated_at = CURRENT_TIMESTAMP WHERE id = ?",
            (deliverable_id,),
        )
        conn.commit()
        return cur.lastrowid
    finally:
        conn.close()


# ── Legacy Norms ──────────────────────────────────────────────────────────────

def list_norms() -> list:
    conn = get_connection()
    try:
        rows = conn.execute("SELECT * FROM legacy_norms ORDER BY deliverable_type").fetchall()
        return [dict(r) for r in rows]
    finally:
        conn.close()


def get_norm_by_type(deliverable_type: str) -> Optional[sqlite3.Row]:
    conn = get_connection()
    try:
        return conn.execute(
            "SELECT * FROM legacy_norms WHERE deliverable_type = ?", (deliverable_type,)
        ).fetchone()
    finally:
        conn.close()


def update_norm(deliverable_type: str, data: dict, updated_by: int) -> bool:
    conn = get_connection()
    try:
        fields = {k: v for k, v in data.items() if v is not None}
        if not fields:
            return False
        set_clause = ", ".join(f"{k} = ?" for k in fields)
        set_clause += ", updated_by = ?, updated_at = CURRENT_TIMESTAMP"
        values = list(fields.values()) + [updated_by, deliverable_type]
        conn.execute(
            f"UPDATE legacy_norms SET {set_clause} WHERE deliverable_type = ?", values
        )
        conn.commit()
        return True
    finally:
        conn.close()


# ── Activity Log ──────────────────────────────────────────────────────────────

def log_activity(user_id: int, action: str, deliverable_id: Optional[int] = None, details: Optional[str] = None) -> None:
    conn = get_connection()
    try:
        conn.execute(
            "INSERT INTO activity_log (user_id, action, deliverable_id, details) VALUES (?, ?, ?, ?)",
            (user_id, action, deliverable_id, details),
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
               LEFT JOIN deliverables d ON a.deliverable_id = d.id
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

def list_complete_deliverables() -> list:
    """Return all complete deliverables joined with expert_responses."""
    conn = get_connection()
    try:
        rows = conn.execute(
            """SELECT d.*, er.*
               FROM deliverables d
               JOIN expert_responses er ON d.id = er.deliverable_id
               ORDER BY d.created_at ASC"""
        ).fetchall()
        return [dict(r) for r in rows]
    finally:
        conn.close()
