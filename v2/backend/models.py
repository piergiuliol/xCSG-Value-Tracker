"""models.py — Pydantic request/response models for xCSG Value Tracker V2."""
from __future__ import annotations
from typing import List, Optional
from pydantic import BaseModel


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
    email: str
    password: str
    role: str = "viewer"


# ── Deliverables ──────────────────────────────────────────────────────────────

class DeliverableCreate(BaseModel):
    pioneer_name: str
    pioneer_email: Optional[str] = None
    deliverable_type: str
    engagement_stage: str
    client_name: Optional[str] = None
    client_contact_email: Optional[str] = None
    description: Optional[str] = None
    date_started: str
    date_delivered: str
    xcsg_team_size: str
    xcsg_revision_rounds: str
    scope_expansion: Optional[str] = None
    legacy_calendar_days: Optional[str] = None
    legacy_team_size: Optional[str] = None
    legacy_revision_rounds: Optional[str] = None

class DeliverableUpdate(BaseModel):
    pioneer_name: Optional[str] = None
    pioneer_email: Optional[str] = None
    deliverable_type: Optional[str] = None
    engagement_stage: Optional[str] = None
    client_name: Optional[str] = None
    client_contact_email: Optional[str] = None
    description: Optional[str] = None
    date_started: Optional[str] = None
    date_delivered: Optional[str] = None
    xcsg_team_size: Optional[str] = None
    xcsg_revision_rounds: Optional[str] = None
    scope_expansion: Optional[str] = None
    legacy_calendar_days: Optional[str] = None
    legacy_team_size: Optional[str] = None
    legacy_revision_rounds: Optional[str] = None
    client_pulse: Optional[str] = None


# ── Expert ────────────────────────────────────────────────────────────────────

class ExpertResponseCreate(BaseModel):
    b1_starting_point: str
    b2_research_sources: str
    b3_assembly_ratio: str
    b4_hypothesis_first: str
    b5_ai_survival: str
    c1_specialization: str
    c2_directness: str
    c3_judgment_pct: str
    d1_proprietary_data: str
    d2_knowledge_reuse: str
    d3_moat_test: str
    f1_feasibility: str
    f2_productization: str
    g1_reuse_intent: str

class ExpertContextResponse(BaseModel):
    deliverable_id: int
    deliverable_type: str
    client_name: Optional[str]
    pioneer_name: str
    description: Optional[str]
    date_started: str
    date_delivered: str
    xcsg_team_size: str
    already_completed: bool


# ── Norms ─────────────────────────────────────────────────────────────────────

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
    xcsg_calendar_days: int
    legacy_calendar_days: Optional[str]
    effort_ratio: Optional[float]
    xcsg_revisions: Optional[float]
    legacy_revisions: Optional[float]
    quality_ratio: Optional[float]
    value_multiplier: Optional[float]
    machine_first_score: Optional[float]
    senior_led_score: Optional[float]
    proprietary_knowledge_score: Optional[float]
    ai_survival_rate: Optional[float]
    reuse_intent: Optional[str]
    client_pulse: Optional[str]
    created_at: str

class MetricsSummary(BaseModel):
    total_deliverables: int
    complete_deliverables: int
    pending_deliverables: int
    average_effort_ratio: Optional[float]
    average_quality_ratio: Optional[float]
    average_value_multiplier: Optional[float]
    reuse_intent_rate: Optional[float]
    machine_first_avg: Optional[float]
    senior_led_avg: Optional[float]
    proprietary_knowledge_avg: Optional[float]
    checkpoint: int
    deliverables_to_next: int

class TrendPoint(BaseModel):
    id: int
    deliverable_type: str
    pioneer_name: str
    effort_ratio: Optional[float]
    quality_ratio: Optional[float]
    value_multiplier: Optional[float]
    machine_first_score: Optional[float]
    senior_led_score: Optional[float]
    proprietary_knowledge_score: Optional[float]
    ai_survival_rate: Optional[float]
    g1_reuse_intent: Optional[str]
    created_at: str

class TrendData(BaseModel):
    points: List[TrendPoint]

class ScalingGate(BaseModel):
    id: int
    name: str
    description: str
    status: str  # "pass", "pending", or "fail"
    detail: str

class ScalingGates(BaseModel):
    gates: List[ScalingGate]
    passed_count: int

class ActivityLogEntry(BaseModel):
    id: int
    user_id: int
    action: str
    deliverable_id: Optional[int]
    details: Optional[str]
    created_at: str
