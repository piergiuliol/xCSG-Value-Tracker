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
