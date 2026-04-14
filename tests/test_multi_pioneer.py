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

import sqlite3
import tempfile, os

def get_test_db():
    """Create a fresh temp DB and init it."""
    tmp = tempfile.NamedTemporaryFile(suffix=".db", delete=False)
    tmp.close()
    os.environ["DATABASE_PATH"] = tmp.name
    import importlib
    from backend import database as db
    importlib.reload(db)
    db.init_db()
    db.migrate()
    db.migrate_v2()
    db.migrate_v11()
    return db, tmp.name

def test_project_pioneers_table_exists():
    db, db_path = get_test_db()
    conn = db.get_connection()
    try:
        tables = [r[0] for r in conn.execute("SELECT name FROM sqlite_master WHERE type='table'").fetchall()]
        assert "project_pioneers" in tables, f"project_pioneers not in {tables}"
    finally:
        conn.close()
        os.unlink(db_path)

def test_project_pioneers_columns():
    db, db_path = get_test_db()
    conn = db.get_connection()
    try:
        cols = [r[1] for r in conn.execute("PRAGMA table_info(project_pioneers)").fetchall()]
        for c in ["id", "project_id", "pioneer_name", "pioneer_email", "total_rounds", "show_previous", "expert_token"]:
            assert c in cols, f"{c} not in {cols}"
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
        assert "project_id" in cols
    finally:
        conn.close()
        os.unlink(db_path)

def _create_test_project(db, pioneers=None, default_rounds=2):
    from backend.auth import hash_password
    try:
        db.create_user("admin", "a@b.com", hash_password("pass"), "admin")
    except Exception:
        pass
    if pioneers is None:
        pioneers = [{"name": "Alice"}, {"name": "Bob"}]
    return db.create_project({
        "created_by": 1,
        "project_name": "Test",
        "category_id": 1,
        "xcsg_team_size": "2",
        "xcsg_revision_rounds": "1",
        "default_rounds": default_rounds,
        "pioneers": pioneers,
    })

def test_create_pioneer():
    db, db_path = get_test_db()
    try:
        project_id = _create_test_project(db, pioneers=[
            {"name": "Alice", "email": "alice@test.com"},
            {"name": "Bob", "email": "bob@test.com", "total_rounds": 3},
        ])
        pioneers = db.list_pioneers(project_id)
        assert len(pioneers) == 2
        alice = next(p for p in pioneers if p["pioneer_name"] == "Alice")
        bob = next(p for p in pioneers if p["pioneer_name"] == "Bob")
        assert alice["total_rounds"] is None
        assert bob["total_rounds"] == 3
        assert alice["expert_token"] is not None
        assert alice["expert_token"] != bob["expert_token"]
    finally:
        os.unlink(db_path)

def test_add_pioneer_to_existing_project():
    db, db_path = get_test_db()
    try:
        project_id = _create_test_project(db, pioneers=[{"name": "Alice"}])
        pioneer_id = db.add_pioneer(project_id, "Charlie", "charlie@test.com")
        assert pioneer_id > 0
        assert len(db.list_pioneers(project_id)) == 2
    finally:
        os.unlink(db_path)

def test_remove_pioneer_no_responses():
    db, db_path = get_test_db()
    try:
        project_id = _create_test_project(db)
        pioneers = db.list_pioneers(project_id)
        bob = next(p for p in pioneers if p["pioneer_name"] == "Bob")
        assert db.remove_pioneer(bob["id"]) is True
        assert len(db.list_pioneers(project_id)) == 1
    finally:
        os.unlink(db_path)

def test_get_pioneer_by_token():
    db, db_path = get_test_db()
    try:
        project_id = _create_test_project(db, pioneers=[{"name": "Alice"}])
        pioneers = db.list_pioneers(project_id)
        token = pioneers[0]["expert_token"]
        pioneer = db.get_pioneer_by_token(token)
        assert pioneer is not None
        assert pioneer["pioneer_name"] == "Alice"
        assert pioneer["project_name"] == "Test"
    finally:
        os.unlink(db_path)

def test_submit_expert_response_round_1():
    db, db_path = get_test_db()
    try:
        project_id = _create_test_project(db)
        pioneers = db.list_pioneers(project_id)
        alice = pioneers[0]
        response_id = db.create_expert_response_v11(
            pioneer_id=alice["id"], project_id=project_id, round_number=1,
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
        project_id = _create_test_project(db)  # 2 pioneers, 2 default rounds
        pioneers = db.list_pioneers(project_id)
        alice, bob = pioneers[0], pioneers[1]

        p = db.get_project(project_id)
        assert p["status"] == "pending"

        db.create_expert_response_v11(pioneer_id=alice["id"], project_id=project_id, round_number=1, data={"b1_starting_point": "From AI draft"})
        db.update_project_status(project_id)
        assert db.get_project(project_id)["status"] == "partial"

        db.create_expert_response_v11(pioneer_id=alice["id"], project_id=project_id, round_number=2, data={"b1_starting_point": "Mixed"})
        db.update_project_status(project_id)
        assert db.get_project(project_id)["status"] == "partial"  # Bob hasn't responded

        db.create_expert_response_v11(pioneer_id=bob["id"], project_id=project_id, round_number=1, data={"b1_starting_point": "Mixed"})
        db.update_project_status(project_id)
        assert db.get_project(project_id)["status"] == "partial"  # Bob needs round 2

        db.create_expert_response_v11(pioneer_id=bob["id"], project_id=project_id, round_number=2, data={"b1_starting_point": "From blank page"})
        db.update_project_status(project_id)
        assert db.get_project(project_id)["status"] == "complete"
    finally:
        os.unlink(db_path)

def test_get_all_project_responses():
    db, db_path = get_test_db()
    try:
        project_id = _create_test_project(db)
        pioneers = db.list_pioneers(project_id)
        alice, bob = pioneers[0], pioneers[1]
        db.create_expert_response_v11(pioneer_id=alice["id"], project_id=project_id, round_number=1, data={"b1_starting_point": "From AI draft"})
        db.create_expert_response_v11(pioneer_id=bob["id"], project_id=project_id, round_number=1, data={"b1_starting_point": "Mixed"})
        responses = db.get_all_project_responses(project_id)
        assert len(responses) == 2
    finally:
        os.unlink(db_path)

if __name__ == "__main__":
    test_project_status_constants()
    test_pioneer_defaults()
    test_monitoring_status_options()
    test_schema_response_includes_pioneer_config()
    print("All schema tests passed.")

    test_project_pioneers_table_exists()
    print("  PASS test_project_pioneers_table_exists")
    test_project_pioneers_columns()
    print("  PASS test_project_pioneers_columns")
    test_projects_has_new_columns()
    print("  PASS test_projects_has_new_columns")
    test_expert_responses_has_pioneer_columns()
    print("  PASS test_expert_responses_has_pioneer_columns")
    test_create_pioneer()
    print("  PASS test_create_pioneer")
    test_add_pioneer_to_existing_project()
    print("  PASS test_add_pioneer_to_existing_project")
    test_remove_pioneer_no_responses()
    print("  PASS test_remove_pioneer_no_responses")
    test_get_pioneer_by_token()
    print("  PASS test_get_pioneer_by_token")
    test_submit_expert_response_round_1()
    print("  PASS test_submit_expert_response_round_1")
    test_submit_multiple_rounds()
    print("  PASS test_submit_multiple_rounds")
    test_project_status_transitions()
    print("  PASS test_project_status_transitions")
    test_get_all_project_responses()
    print("  PASS test_get_all_project_responses")
    print("\nAll multi-pioneer tests passed.")
