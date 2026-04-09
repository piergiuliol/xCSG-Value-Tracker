"""database.py — SQLite CRUD, schema, and seed data for xCSG Value Tracker V2."""
import os
import secrets
import sqlite3
from typing import Optional, List, Dict, Any

DATABASE_PATH = os.environ.get("DATABASE_PATH", "./data/tracker.db")


def get_connection() -> sqlite3.Connection:
    os.makedirs(os.path.dirname(os.path.abspath(DATABASE_PATH)), exist_ok=True)
    conn = sqlite3.connect(DATABASE_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    return conn


def init_db() -> None:
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
                client_contact_email TEXT,
                description TEXT,
                date_started TEXT NOT NULL,
                date_delivered TEXT NOT NULL,
                xcsg_team_size TEXT NOT NULL,
                xcsg_revision_rounds TEXT NOT NULL,
                scope_expansion TEXT,
                legacy_calendar_days TEXT NOT NULL,
                legacy_team_size TEXT NOT NULL,
                legacy_revision_rounds TEXT NOT NULL,
                client_pulse TEXT,
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
                b5_ai_survival TEXT NOT NULL,
                c1_specialization TEXT NOT NULL,
                c2_directness TEXT NOT NULL,
                c3_judgment_pct TEXT NOT NULL,
                d1_proprietary_data TEXT NOT NULL,
                d2_knowledge_reuse TEXT NOT NULL,
                d3_moat_test TEXT NOT NULL,
                f1_feasibility TEXT NOT NULL,
                f2_productization TEXT NOT NULL,
                g1_reuse_intent TEXT NOT NULL,
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
    from backend import auth as _auth
    SEED_USERS = [
        ("admin", "admin@alira.health", "AliraAdmin2026!", "admin"),
        ("pmo", "pmo@alira.health", "AliraPMO2026!", "analyst"),
    ]
    SEED_NORMS = [
        ("CDD", "11-20", "3", "2"),
        ("Competitive landscape", "11-20", "3", "2"),
        ("Financial model", "6-10", "2", "1"),
        ("Market access", "11-20", "3", "2"),
        ("Proposal", "4-5", "2", "1"),
        ("Call prep brief", "2-3", "1", "1"),
        ("Presentation", "4-5", "2", "2"),
        ("KOL mapping", "11-20", "3", "2"),
    ]
    conn = get_connection()
    try:
        # Seed users — verify passwords every startup
        for username, email, password, role in SEED_USERS:
            row = conn.execute("SELECT id, password_hash FROM users WHERE username = ?", (username,)).fetchone()
            if row is None:
                hashed = _auth.hash_password(password)
                conn.execute("INSERT INTO users (username, email, password_hash, role) VALUES (?, ?, ?, ?)",
                             (username, email, hashed, role))
            else:
                if not _auth.verify_password(password, row["password_hash"]):
                    new_hash = _auth.hash_password(password)
                    conn.execute("UPDATE users SET password_hash = ? WHERE id = ?", (new_hash, row["id"]))
        # Seed norms
        for dtype, days, team, revs in SEED_NORMS:
            exists = conn.execute("SELECT id FROM legacy_norms WHERE deliverable_type = ?", (dtype,)).fetchone()
            if not exists:
                conn.execute("INSERT INTO legacy_norms (deliverable_type, typical_calendar_days, typical_team_size, typical_revision_rounds) VALUES (?, ?, ?, ?)",
                             (dtype, days, team, revs))
        conn.commit()
    finally:
        conn.close()


# ── User CRUD ─────────────────────────────────────────────────────────────────

def get_user_by_username(username: str) -> Optional[Dict]:
    conn = get_connection()
    try:
        row = conn.execute("SELECT * FROM users WHERE username = ?", (username,)).fetchone()
        return dict(row) if row else None
    finally:
        conn.close()


def create_user(username: str, email: str, password: str, role: str) -> int:
    from backend import auth as _auth
    conn = get_connection()
    try:
        hashed = _auth.hash_password(password)
        cursor = conn.execute("INSERT INTO users (username, email, password_hash, role) VALUES (?, ?, ?, ?)",
                              (username, email, hashed, role))
        conn.commit()
        return cursor.lastrowid
    finally:
        conn.close()


def get_user_by_id(user_id: int) -> Optional[Dict]:
    conn = get_connection()
    try:
        row = conn.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
        return dict(row) if row else None
    finally:
        conn.close()


# ── Deliverable CRUD ─────────────────────────────────────────────────────────

def create_deliverable(user_id: int, data: dict) -> int:
    conn = get_connection()
    try:
        token = secrets.token_urlsafe(24)
        cursor = conn.execute("""
            INSERT INTO deliverables (created_by, pioneer_name, pioneer_email, deliverable_type, engagement_stage,
                client_name, client_contact_email, description, date_started, date_delivered,
                xcsg_team_size, xcsg_revision_rounds, scope_expansion,
                legacy_calendar_days, legacy_team_size, legacy_revision_rounds, client_pulse, expert_token)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            user_id, data.get("pioneer_name"), data.get("pioneer_email"), data.get("deliverable_type"),
            data.get("engagement_stage"), data.get("client_name"), data.get("client_contact_email"),
            data.get("description"), data.get("date_started"), data.get("date_delivered"),
            data.get("xcsg_team_size"), data.get("xcsg_revision_rounds"), data.get("scope_expansion"),
            data.get("legacy_calendar_days"), data.get("legacy_team_size"),
            data.get("legacy_revision_rounds"), data.get("client_pulse", "Not yet received"), token,
        ))
        conn.commit()
        return cursor.lastrowid
    finally:
        conn.close()


def get_deliverable(deliv_id: int) -> Optional[Dict]:
    conn = get_connection()
    try:
        row = conn.execute("SELECT * FROM deliverables WHERE id = ?", (deliv_id,)).fetchone()
        return dict(row) if row else None
    finally:
        conn.close()


def get_deliverable_by_token(token: str) -> Optional[Dict]:
    conn = get_connection()
    try:
        row = conn.execute("SELECT * FROM deliverables WHERE expert_token = ?", (token,)).fetchone()
        return dict(row) if row else None
    finally:
        conn.close()


def list_deliverables(status_filter: Optional[str] = None, offset: int = 0, limit: int = 50) -> List[Dict]:
    conn = get_connection()
    try:
        if status_filter:
            rows = conn.execute("SELECT * FROM deliverables WHERE status = ? ORDER BY created_at DESC LIMIT ? OFFSET ?",
                                (status_filter, limit, offset)).fetchall()
        else:
            rows = conn.execute("SELECT * FROM deliverables ORDER BY created_at DESC LIMIT ? OFFSET ?",
                                (limit, offset)).fetchall()
        return [dict(r) for r in rows]
    finally:
        conn.close()


def update_deliverable(deliv_id: int, data: dict) -> bool:
    conn = get_connection()
    try:
        fields = []
        values = []
        for key in ["pioneer_name", "pioneer_email", "deliverable_type", "engagement_stage",
                     "client_name", "client_contact_email", "description", "date_started", "date_delivered",
                     "xcsg_team_size", "xcsg_revision_rounds", "scope_expansion",
                     "legacy_calendar_days", "legacy_team_size", "legacy_revision_rounds", "client_pulse"]:
            if key in data and data[key] is not None:
                fields.append(f"{key} = ?")
                values.append(data[key])
        if not fields:
            return False
        fields.append("updated_at = CURRENT_TIMESTAMP")
        values.append(deliv_id)
        conn.execute(f"UPDATE deliverables SET {', '.join(fields)} WHERE id = ?", values)
        conn.commit()
        return True
    finally:
        conn.close()


def delete_deliverable(deliv_id: int) -> bool:
    conn = get_connection()
    try:
        cursor = conn.execute("DELETE FROM deliverables WHERE id = ?", (deliv_id,))
        conn.commit()
        return cursor.rowcount > 0
    finally:
        conn.close()


def count_deliverables(status_filter: Optional[str] = None) -> int:
    conn = get_connection()
    try:
        if status_filter:
            row = conn.execute("SELECT COUNT(*) as cnt FROM deliverables WHERE status = ?", (status_filter,)).fetchone()
        else:
            row = conn.execute("SELECT COUNT(*) as cnt FROM deliverables").fetchone()
        return row["cnt"] if row else 0
    finally:
        conn.close()


# ── Expert Responses CRUD ────────────────────────────────────────────────────

def create_expert_response(deliverable_id: int, data: dict) -> int:
    conn = get_connection()
    try:
        cursor = conn.execute("""
            INSERT INTO expert_responses (deliverable_id, b1_starting_point, b2_research_sources,
                b3_assembly_ratio, b4_hypothesis_first, b5_ai_survival,
                c1_specialization, c2_directness, c3_judgment_pct,
                d1_proprietary_data, d2_knowledge_reuse, d3_moat_test,
                f1_feasibility, f2_productization, g1_reuse_intent)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            deliverable_id, data.get("b1_starting_point"), data.get("b2_research_sources"),
            data.get("b3_assembly_ratio"), data.get("b4_hypothesis_first"), data.get("b5_ai_survival"),
            data.get("c1_specialization"), data.get("c2_directness"), data.get("c3_judgment_pct"),
            data.get("d1_proprietary_data"), data.get("d2_knowledge_reuse"), data.get("d3_moat_test"),
            data.get("f1_feasibility"), data.get("f2_productization"), data.get("g1_reuse_intent"),
        ))
        conn.execute("UPDATE deliverables SET expert_completed = 1, status = 'complete', updated_at = CURRENT_TIMESTAMP WHERE id = ?",
                     (deliverable_id,))
        conn.commit()
        return cursor.lastrowid
    finally:
        conn.close()


def get_expert_response(deliverable_id: int) -> Optional[Dict]:
    conn = get_connection()
    try:
        row = conn.execute("SELECT * FROM expert_responses WHERE deliverable_id = ?", (deliverable_id,)).fetchone()
        return dict(row) if row else None
    finally:
        conn.close()


# ── Legacy Norms CRUD ────────────────────────────────────────────────────────

def list_norms() -> List[Dict]:
    conn = get_connection()
    try:
        rows = conn.execute("SELECT * FROM legacy_norms ORDER BY deliverable_type").fetchall()
        return [dict(r) for r in rows]
    finally:
        conn.close()


def get_norm(deliverable_type: str) -> Optional[Dict]:
    conn = get_connection()
    try:
        row = conn.execute("SELECT * FROM legacy_norms WHERE deliverable_type = ?", (deliverable_type,)).fetchone()
        return dict(row) if row else None
    finally:
        conn.close()


def update_norm(deliverable_type: str, data: dict, user_id: Optional[int] = None) -> bool:
    conn = get_connection()
    try:
        fields = []
        values = []
        for key in ["typical_calendar_days", "typical_team_size", "typical_revision_rounds", "notes"]:
            if key in data and data[key] is not None:
                fields.append(f"{key} = ?")
                values.append(data[key])
        if not fields:
            return False
        if user_id:
            fields.append("updated_by = ?")
            values.append(user_id)
        fields.append("updated_at = CURRENT_TIMESTAMP")
        values.append(deliverable_type)
        conn.execute(f"UPDATE legacy_norms SET {', '.join(fields)} WHERE deliverable_type = ?", values)
        conn.commit()
        return True
    finally:
        conn.close()


# ── Activity Log ─────────────────────────────────────────────────────────────

def log_activity(user_id: int, action: str, deliverable_id: Optional[int] = None, details: Optional[str] = None):
    conn = get_connection()
    try:
        conn.execute("INSERT INTO activity_log (user_id, action, deliverable_id, details) VALUES (?, ?, ?, ?)",
                     (user_id, action, deliverable_id, details))
        conn.commit()
    finally:
        conn.close()


def list_activity(limit: int = 100) -> List[Dict]:
    conn = get_connection()
    try:
        rows = conn.execute("SELECT * FROM activity_log ORDER BY created_at DESC LIMIT ?", (limit,)).fetchall()
        return [dict(r) for r in rows]
    finally:
        conn.close()


# ── Joined queries for metrics ───────────────────────────────────────────────

def get_completed_deliverables_with_responses() -> List[Dict]:
    """Return all completed deliverables joined with expert responses."""
    conn = get_connection()
    try:
        rows = conn.execute("""
            SELECT d.*, 
                e.b1_starting_point, e.b2_research_sources, e.b3_assembly_ratio,
                e.b4_hypothesis_first, e.b5_ai_survival,
                e.c1_specialization, e.c2_directness, e.c3_judgment_pct,
                e.d1_proprietary_data, e.d2_knowledge_reuse, e.d3_moat_test,
                e.f1_feasibility, e.f2_productization, e.g1_reuse_intent
            FROM deliverables d
            LEFT JOIN expert_responses e ON d.id = e.deliverable_id
            WHERE d.expert_completed = 1
            ORDER BY d.created_at ASC
        """).fetchall()
        return [dict(r) for r in rows]
    finally:
        conn.close()
