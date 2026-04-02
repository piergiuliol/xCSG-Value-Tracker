"""
models.py — Pydantic request/response models for xCSG Value Tracker
"""
from __future__ import annotations

from datetime import date
from typing import List, Optional

from pydantic import BaseModel, EmailStr, field_validator, model_validator


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


# ── Deliverables ──────────────────────────────────────────────────────────────

class DeliverableCreate(BaseModel):
    pioneer_name: str
    pioneer_email: Optional[EmailStr] = None
    deliverable_type: str
    engagement_stage: str
    client_name: Optional[str] = None
    description: Optional[str] = None
    date_started: Optional[str] = None
    date_delivered: Optional[str] = None
    xcsg_calendar_days: str
    xcsg_team_size: str
    xcsg_revision_rounds: str
    scope_expansion: Optional[str] = None
    legacy_calendar_days: Optional[str] = None
    legacy_team_size: Optional[str] = None
    legacy_revision_rounds: Optional[str] = None

    @model_validator(mode="after")
    def validate_dates(self) -> "DeliverableCreate":
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


class DeliverableUpdate(BaseModel):
    pioneer_name: Optional[str] = None
    pioneer_email: Optional[EmailStr] = None
    deliverable_type: Optional[str] = None
    engagement_stage: Optional[str] = None
    client_name: Optional[str] = None
    description: Optional[str] = None
    date_started: Optional[str] = None
    date_delivered: Optional[str] = None
    xcsg_calendar_days: Optional[str] = None
    xcsg_team_size: Optional[str] = None
    xcsg_revision_rounds: Optional[str] = None
    scope_expansion: Optional[str] = None
    legacy_calendar_days: Optional[str] = None
    legacy_team_size: Optional[str] = None
    legacy_revision_rounds: Optional[str] = None

    @model_validator(mode="after")
    def validate_dates(self) -> "DeliverableUpdate":
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


class DeliverableResponse(BaseModel):
    id: int
    created_by: int
    pioneer_name: str
    pioneer_email: Optional[str]
    deliverable_type: str
    engagement_stage: str
    client_name: Optional[str]
    description: Optional[str]
    date_started: Optional[str]
    date_delivered: Optional[str]
    xcsg_calendar_days: str
    xcsg_team_size: str
    xcsg_revision_rounds: str
    scope_expansion: Optional[str]
    legacy_calendar_days: str
    legacy_team_size: str
    legacy_revision_rounds: str
    expert_token: str
    expert_completed: bool
    status: str
    created_at: str
    updated_at: str


# ── Expert ────────────────────────────────────────────────────────────────────

class ExpertResponseCreate(BaseModel):
    b1_starting_point: str
    b2_research_sources: str
    b3_assembly_ratio: str
    b4_hypothesis_first: str
    c1_specialization: str
    c2_directness: str
    c3_judgment_pct: str
    d1_proprietary_data: str
    d2_knowledge_reuse: str
    d3_moat_test: str
    f1_feasibility: str
    f2_productization: str


class ExpertContextResponse(BaseModel):
    deliverable_id: int
    deliverable_type: str
    client_name: Optional[str]
    pioneer_name: str
    date_started: Optional[str]
    date_delivered: Optional[str]
    xcsg_team_size: str
    xcsg_calendar_days: str
    already_completed: bool


# ── Norms ─────────────────────────────────────────────────────────────────────

class NormResponse(BaseModel):
    id: int
    deliverable_type: str
    typical_calendar_days: str
    typical_team_size: str
    typical_revision_rounds: str
    notes: Optional[str]
    updated_at: str


class NormUpdate(BaseModel):
    typical_calendar_days: Optional[str] = None
    typical_team_size: Optional[str] = None
    typical_revision_rounds: Optional[str] = None
    notes: Optional[str] = None


# ── Metrics ───────────────────────────────────────────────────────────────────

class DeliverableMetrics(BaseModel):
    id: int
    deliverable_type: str
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
    created_at: str


class MetricsSummary(BaseModel):
    total_deliverables: int
    complete_deliverables: int
    pending_deliverables: int
    average_value_multiplier: float
    average_effort_ratio: float
    average_quality_ratio: float
    flywheel_health: float
    machine_first_avg: float
    senior_led_avg: float
    proprietary_knowledge_avg: float
    checkpoint: int
    deliverables_to_next_checkpoint: int


class TrendPoint(BaseModel):
    id: int
    deliverable_type: str
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
    deliverable_id: Optional[int]
    deliverable_type: Optional[str]
    details: Optional[str]
    created_at: str
