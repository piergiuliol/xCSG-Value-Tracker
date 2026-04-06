"""
models.py — Pydantic request/response models for xCSG Value Tracker
Realigned to final spec (April 2026).
"""
from __future__ import annotations

from datetime import date
from typing import List, Optional

from pydantic import BaseModel, EmailStr, model_validator


# ── Auth ──────────────────────────────────────────────────────────────────────

class LoginRequest(BaseModel):
    username: str
    password: str


class UserInfo(BaseModel):
    id: int
    username: str
    name: str
    role: str


class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int
    user: UserInfo


class RegisterRequest(BaseModel):
    username: str
    email: EmailStr
    password: str
    role: str = "viewer"


# ── Project Categories ───────────────────────────────────────────────────────

class CategoryCreate(BaseModel):
    name: str
    description: Optional[str] = None


class CategoryUpdate(BaseModel):
    name: str
    description: Optional[str] = None


# ── Projects ─────────────────────────────────────────────────────────────────

class ProjectCreate(BaseModel):
    project_name: str
    category_id: int
    client_name: Optional[str] = None
    pioneer_name: str
    pioneer_email: Optional[EmailStr] = None
    description: Optional[str] = None
    date_started: Optional[str] = None
    date_delivered: Optional[str] = None
    xcsg_calendar_days: str
    xcsg_team_size: str
    xcsg_revision_rounds: str
    xcsg_scope_expansion: Optional[str] = None
    legacy_calendar_days: Optional[str] = None
    legacy_team_size: Optional[str] = None
    legacy_revision_rounds: Optional[str] = None

    @model_validator(mode="after")
    def validate_dates(self) -> "ProjectCreate":
        if self.date_started and self.date_delivered:
            try:
                start = date.fromisoformat(self.date_started)
                end = date.fromisoformat(self.date_delivered)
                if end < start:
                    raise ValueError("date_delivered must be on or after date_started")
            except ValueError as e:
                if "date_delivered" in str(e):
                    raise
        return self


class ProjectUpdate(BaseModel):
    project_name: Optional[str] = None
    category_id: Optional[int] = None
    client_name: Optional[str] = None
    pioneer_name: Optional[str] = None
    pioneer_email: Optional[EmailStr] = None
    description: Optional[str] = None
    date_started: Optional[str] = None
    date_delivered: Optional[str] = None
    xcsg_calendar_days: Optional[str] = None
    xcsg_team_size: Optional[str] = None
    xcsg_revision_rounds: Optional[str] = None
    xcsg_scope_expansion: Optional[str] = None
    legacy_calendar_days: Optional[str] = None
    legacy_team_size: Optional[str] = None
    legacy_revision_rounds: Optional[str] = None

    @model_validator(mode="after")
    def validate_dates(self) -> "ProjectUpdate":
        if self.date_started and self.date_delivered:
            try:
                start = date.fromisoformat(self.date_started)
                end = date.fromisoformat(self.date_delivered)
                if end < start:
                    raise ValueError("date_delivered must be on or after date_started")
            except ValueError as e:
                if "date_delivered" in str(e):
                    raise
        return self


# ── Expert ────────────────────────────────────────────────────────────────────

class ExpertResponseCreate(BaseModel):
    """Expert assessment — 23 fields matching the realigned framework (Phase 1).

    B1-B4: machine-first (4 questions × 2 columns: xcsg + legacy) = 8 string fields
    C1-C3: senior-led (3 fields, xcsg only) = 3 string fields
    C4-C5: senior/junior hours = 2 numeric fields
    D1-D3: proprietary knowledge (3 questions × 2 columns) = 6 string fields
    F1-F2: value creation (2 questions × 2 columns) = 4 string fields

    All string fields are 5-level categorical. See /api/expert/options for valid values.
    """
    # B — Machine-First Operations (4 questions × 2 columns = 8 fields)
    b1_starting_point_xcsg: Optional[str] = None
    b1_starting_point_legacy: Optional[str] = None
    b2_research_sources_xcsg: Optional[str] = None
    b2_research_sources_legacy: Optional[str] = None
    b3_assembly_ratio_xcsg: Optional[str] = None
    b3_assembly_ratio_legacy: Optional[str] = None
    b4_hypothesis_first_xcsg: Optional[str] = None
    b4_hypothesis_first_legacy: Optional[str] = None

    # C — Senior-Led Model (5 fields, xCSG only)
    c1_specialization: Optional[str] = None
    c2_directness: Optional[str] = None
    c3_judgment_pct: Optional[str] = None
    c4_senior_hours: Optional[float] = None
    c5_junior_hours: Optional[float] = None

    # D — Proprietary Knowledge (3 questions × 2 columns = 6 fields)
    d1_proprietary_data_xcsg: Optional[str] = None
    d1_proprietary_data_legacy: Optional[str] = None
    d2_knowledge_reuse_xcsg: Optional[str] = None
    d2_knowledge_reuse_legacy: Optional[str] = None
    d3_moat_test_xcsg: Optional[str] = None
    d3_moat_test_legacy: Optional[str] = None

    # F — Value Creation (2 questions × 2 columns = 4 fields)
    f1_feasibility_xcsg: Optional[str] = None
    f1_feasibility_legacy: Optional[str] = None
    f2_productization_xcsg: Optional[str] = None
    f2_productization_legacy: Optional[str] = None


class ExpertAssessmentMetrics(BaseModel):
    """Computed flywheel leg scores from expert assessment."""
    machine_first_score: Optional[float] = None
    senior_led_score: Optional[float] = None
    proprietary_knowledge_score: Optional[float] = None


class ExpertContextResponse(BaseModel):
    project_id: int
    project_name: str
    category_name: str
    description: Optional[str] = None
    client_name: Optional[str]
    pioneer_name: str
    date_started: Optional[str]
    date_delivered: Optional[str]
    xcsg_team_size: str
    xcsg_calendar_days: str
    already_completed: bool


# ── Norms ─────────────────────────────────────────────────────────────────────

class NormUpdate(BaseModel):
    typical_calendar_days: Optional[str] = None
    typical_team_size: Optional[str] = None
    typical_revision_rounds: Optional[str] = None
    notes: Optional[str] = None


# ── Metrics ───────────────────────────────────────────────────────────────────

class ProjectMetrics(BaseModel):
    id: int
    project_name: str
    category_name: str
    pioneer_name: str
    client_name: Optional[str]
    xcsg_person_days: float
    legacy_person_days: float
    effort_ratio: float
    xcsg_revisions: float
    legacy_revisions: float
    quality_ratio: float
    value_multiplier: float
    machine_first_score: Optional[float]
    senior_led_score: Optional[float]
    proprietary_knowledge_score: Optional[float]
    legacy_overridden: bool = False
    created_at: str


class MetricsSummary(BaseModel):
    total_projects: int
    complete_projects: int
    pending_projects: int
    average_value_multiplier: float
    average_effort_ratio: float
    average_quality_ratio: float
    flywheel_health: float
    machine_first_avg: float
    senior_led_avg: float
    proprietary_knowledge_avg: float
    checkpoint: int
    projects_to_next_checkpoint: int


class TrendPoint(BaseModel):
    id: int
    project_name: str
    category_name: str
    pioneer_name: str
    value_multiplier: float
    effort_ratio: float
    quality_ratio: float
    machine_first_score: Optional[float]
    senior_led_score: Optional[float]
    proprietary_knowledge_score: Optional[float]
    created_at: str


class TrendData(BaseModel):
    points: List[TrendPoint]


class ScalingGate(BaseModel):
    id: int
    name: str
    description: str
    status: str  # "pass" or "pending"
    detail: str


class ScalingGates(BaseModel):
    gates: List[ScalingGate]
    passed_count: int
    total_count: int


# ── Activity Log ──────────────────────────────────────────────────────────────

class ActivityLogEntry(BaseModel):
    id: int
    user_id: int
    username: str
    action: str
    project_id: Optional[int]
    details: Optional[str]
    created_at: str
