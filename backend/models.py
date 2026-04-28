"""
models.py — Pydantic request/response models for xCSG Value Tracker
Realigned to final spec (April 2026).
"""
from __future__ import annotations

from datetime import date
from typing import List, Optional

from pydantic import BaseModel, EmailStr, field_validator, model_validator

from backend.schema import CURRENCIES, PRICING_MODELS


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


# ── Pioneers ─────────────────────────────────────────────────────────────────

class PioneerCreate(BaseModel):
    name: str
    email: Optional[EmailStr] = None
    total_rounds: Optional[int] = None
    day_rate: Optional[float] = None
    role_name: Optional[str] = None

    @field_validator("day_rate")
    @classmethod
    def _non_negative(cls, v):
        if v is not None and v < 0:
            raise ValueError("day_rate must be >= 0")
        return v


class PioneerUpdate(BaseModel):
    pioneer_name: Optional[str] = None
    pioneer_email: Optional[EmailStr] = None
    total_rounds: Optional[int] = None
    show_previous: Optional[bool] = None
    day_rate: Optional[float] = None
    role_name: Optional[str] = None

    @field_validator("day_rate")
    @classmethod
    def _non_negative(cls, v):
        if v is not None and v < 0:
            raise ValueError("day_rate must be >= 0")
        return v


# ── Project Categories ───────────────────────────────────────────────────────

class CategoryCreate(BaseModel):
    name: str
    description: Optional[str] = None


class CategoryUpdate(BaseModel):
    name: str
    description: Optional[str] = None


# ── Practices ────────────────────────────────────────────────────────────────

class PracticeCreate(BaseModel):
    code: str
    name: str
    description: Optional[str] = None


class PracticeUpdate(BaseModel):
    name: str
    description: Optional[str] = None


# ── Projects ─────────────────────────────────────────────────────────────────

def _validate_project_dates(date_started, date_delivered):
    """Shared date validation for ProjectCreate and ProjectUpdate."""
    if date_started and date_delivered:
        try:
            start = date.fromisoformat(date_started)
            end = date.fromisoformat(date_delivered)
            if end < start:
                raise ValueError("date_delivered must be on or after date_started")
        except ValueError as e:
            if "date_delivered" in str(e):
                raise


class ProjectCreate(BaseModel):
    project_name: str
    category_id: int
    practice_id: Optional[int] = None
    client_name: Optional[str] = None
    pioneers: List[PioneerCreate] = []
    default_rounds: int = 1
    show_previous_answers: bool = False
    show_other_pioneers_answers: bool = False
    engagement_stage: Optional[str] = None
    client_contact_email: Optional[EmailStr] = None
    client_pulse: Optional[str] = "Not yet received"
    description: Optional[str] = None
    date_started: Optional[str] = None
    date_expected_delivered: Optional[str] = None
    date_delivered: Optional[str] = None
    xcsg_calendar_days: Optional[str] = None
    working_days: Optional[int] = None
    xcsg_team_size: str
    xcsg_revision_rounds: str
    revision_depth: Optional[str] = None
    xcsg_scope_expansion: Optional[str] = None
    engagement_revenue: Optional[float] = None
    currency: Optional[str] = None
    xcsg_pricing_model: Optional[str] = None
    scope_expansion_revenue: Optional[float] = None
    legacy_calendar_days: Optional[str] = None
    legacy_revision_rounds: Optional[str] = None
    legacy_team: List["LegacyTeamRoleEntry"] = []

    @field_validator("pioneers")
    @classmethod
    def _must_have_pioneer(cls, v):
        if not v:
            raise ValueError("At least one pioneer is required")
        return v

    @field_validator("currency")
    @classmethod
    def _valid_currency(cls, v):
        if v is not None and v not in CURRENCIES:
            raise ValueError(f"currency must be one of {CURRENCIES}")
        return v

    @field_validator("xcsg_pricing_model")
    @classmethod
    def _valid_pricing(cls, v):
        if v is not None and v not in PRICING_MODELS:
            raise ValueError(f"xcsg_pricing_model must be one of {PRICING_MODELS}")
        return v

    @field_validator("engagement_revenue", "scope_expansion_revenue")
    @classmethod
    def _non_negative_econ(cls, v):
        if v is not None and v < 0:
            raise ValueError("economics numeric fields must be >= 0")
        return v

    @model_validator(mode="after")
    def validate_dates(self) -> "ProjectCreate":
        # Also guards against the default empty list case where field_validator
        # doesn't run (validate_default is off by default in Pydantic v2).
        if not self.pioneers:
            raise ValueError("At least one pioneer is required")
        _validate_project_dates(self.date_started, self.date_delivered)
        return self


class ProjectUpdate(BaseModel):
    project_name: Optional[str] = None
    category_id: Optional[int] = None
    practice_id: Optional[int] = None
    client_name: Optional[str] = None
    pioneer_name: Optional[str] = None
    pioneer_email: Optional[EmailStr] = None
    default_rounds: Optional[int] = None
    show_previous_answers: Optional[bool] = None
    show_other_pioneers_answers: Optional[bool] = None
    engagement_stage: Optional[str] = None
    client_contact_email: Optional[EmailStr] = None
    client_pulse: Optional[str] = None
    description: Optional[str] = None
    date_started: Optional[str] = None
    date_expected_delivered: Optional[str] = None
    date_delivered: Optional[str] = None
    xcsg_calendar_days: Optional[str] = None
    working_days: Optional[int] = None
    xcsg_team_size: Optional[str] = None
    xcsg_revision_rounds: Optional[str] = None
    revision_depth: Optional[str] = None
    xcsg_scope_expansion: Optional[str] = None
    engagement_revenue: Optional[float] = None
    currency: Optional[str] = None
    xcsg_pricing_model: Optional[str] = None
    scope_expansion_revenue: Optional[float] = None
    legacy_calendar_days: Optional[str] = None
    legacy_revision_rounds: Optional[str] = None
    legacy_team: Optional[List["LegacyTeamRoleEntry"]] = None
    # Semantics: None = leave unchanged; [] = clear team mix; non-empty = replace.

    @field_validator("currency")
    @classmethod
    def _valid_currency(cls, v):
        if v is not None and v not in CURRENCIES:
            raise ValueError(f"currency must be one of {CURRENCIES}")
        return v

    @field_validator("xcsg_pricing_model")
    @classmethod
    def _valid_pricing(cls, v):
        if v is not None and v not in PRICING_MODELS:
            raise ValueError(f"xcsg_pricing_model must be one of {PRICING_MODELS}")
        return v

    @field_validator("engagement_revenue", "scope_expansion_revenue")
    @classmethod
    def _non_negative_econ(cls, v):
        if v is not None and v < 0:
            raise ValueError("economics numeric fields must be >= 0")
        return v

    @model_validator(mode="after")
    def validate_dates(self) -> "ProjectUpdate":
        _validate_project_dates(self.date_started, self.date_delivered)
        return self


# ── Expert ────────────────────────────────────────────────────────────────────

class ExpertResponseCreate(BaseModel):
    b1_starting_point: Optional[str] = None
    b2_research_sources: Optional[str] = None
    b3_assembly_ratio: Optional[str] = None
    b4_hypothesis_first: Optional[str] = None
    b5_ai_survival: Optional[str] = None
    b6_data_analysis_split: Optional[str] = None
    c1_specialization: Optional[str] = None
    c2_directness: Optional[str] = None
    c3_judgment_pct: Optional[str] = None
    c6_self_assessment: Optional[str] = None
    c7_analytical_depth: Optional[str] = None
    c8_decision_readiness: Optional[str] = None
    d1_proprietary_data: Optional[str] = None
    d2_knowledge_reuse: Optional[str] = None
    d3_moat_test: Optional[str] = None
    e1_client_decision: Optional[str] = None
    f1_feasibility: Optional[str] = None
    f2_productization: Optional[str] = None
    g1_reuse_intent: Optional[str] = None
    l1_legacy_working_days: Optional[int] = None
    l3_legacy_revision_depth: Optional[str] = None
    l4_legacy_scope_expansion: Optional[str] = None
    l5_legacy_client_reaction: Optional[str] = None
    l6_legacy_b2_sources: Optional[str] = None
    l7_legacy_c1_specialization: Optional[str] = None
    l8_legacy_c2_directness: Optional[str] = None
    l9_legacy_c3_judgment: Optional[str] = None
    l10_legacy_d1_proprietary: Optional[str] = None
    l11_legacy_d2_reuse: Optional[str] = None
    l12_legacy_d3_moat: Optional[str] = None
    l13_legacy_c7_depth: Optional[str] = None
    l14_legacy_c8_decision: Optional[str] = None
    l15_legacy_e1_decision: Optional[str] = None
    l16_legacy_b6_data: Optional[str] = None
    notes: Optional[str] = None


class ExpertAssessmentMetrics(BaseModel):
    machine_first_score: Optional[float] = None
    senior_led_score: Optional[float] = None
    proprietary_knowledge_score: Optional[float] = None
    client_impact: Optional[float] = None
    data_independence: Optional[float] = None
    ai_survival_rate: Optional[float] = None
    reuse_intent_score: Optional[float] = None


class ExpertContextResponse(BaseModel):
    project_id: int
    project_name: str
    category_name: str
    practice_code: Optional[str] = None
    practice_name: Optional[str] = None
    description: Optional[str] = None
    client_name: Optional[str]
    pioneer_name: str
    date_started: Optional[str]
    date_delivered: Optional[str]
    xcsg_team_size: str
    xcsg_calendar_days: Optional[str] = None
    engagement_stage: Optional[str] = None
    already_completed: bool
    pioneer_id: int
    current_round: int
    total_rounds: int
    show_previous: bool
    previous_responses: Optional[list] = None
    show_other_pioneers: bool = False
    other_pioneers_responses: Optional[list] = None


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
    practice_code: Optional[str] = None
    practice_name: Optional[str] = None
    pioneer_name: str
    client_name: Optional[str]
    xcsg_person_days: Optional[float]
    legacy_person_days: Optional[float]
    effort_ratio: Optional[float]
    quality_score: Optional[float]
    legacy_quality_score: Optional[float]
    outcome_rate_ratio: Optional[float]
    productivity_ratio: Optional[float]
    calendar_days: Optional[int] = None
    ai_survival_rate: Optional[float] = None
    reuse_intent_score: Optional[float] = None
    client_pulse_score: Optional[float] = None
    machine_first_score: Optional[float]
    senior_led_score: Optional[float]
    proprietary_knowledge_score: Optional[float]
    legacy_overridden: bool = False
    created_at: str


class MetricsSummary(BaseModel):
    total_projects: int
    complete_projects: int
    pending_projects: int
    average_effort_ratio: float
    average_quality_score: float
    average_outcome_rate_ratio: float
    average_productivity_ratio: Optional[float] = None
    flywheel_health: float
    reuse_intent_avg: float = 0.0
    ai_survival_avg: float = 0.0
    client_pulse_avg: float = 0.0
    machine_first_avg: float
    senior_led_avg: float
    proprietary_knowledge_avg: float
    average_quality_ratio: Optional[float] = None
    rework_efficiency_avg: Optional[float] = None
    client_impact_avg: Optional[float] = None
    data_independence_avg: Optional[float] = None
    checkpoint: int
    projects_to_next_checkpoint: int


class TrendPoint(BaseModel):
    id: int
    project_name: str
    category_name: str
    practice_code: Optional[str] = None
    practice_name: Optional[str] = None
    pioneer_name: str
    effort_ratio: Optional[float]
    quality_score: Optional[float]
    outcome_rate_ratio: Optional[float]
    productivity_ratio: Optional[float]
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
    status: str
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


# ── App settings ──────────────────────────────────────────────────────────────

class AppSettings(BaseModel):
    default_currency: str


class AppSettingsUpdate(BaseModel):
    default_currency: str

    @field_validator("default_currency")
    @classmethod
    def _valid_currency(cls, v):
        if v not in CURRENCIES:
            raise ValueError(f"default_currency must be one of {CURRENCIES}")
        return v


# ── Practice role catalog (Phase 2a) ──────────────────────────────────────────

class PracticeRoleEntry(BaseModel):
    role_name: str
    day_rate: float
    currency: str
    display_order: int = 0

    @field_validator("role_name")
    @classmethod
    def _role_name_non_empty(cls, v: str) -> str:
        s = v.strip() if isinstance(v, str) else ""
        if not s:
            raise ValueError("role_name must not be empty")
        if len(s) > 80:
            raise ValueError("role_name must be at most 80 characters")
        return s

    @field_validator("day_rate")
    @classmethod
    def _day_rate_non_negative(cls, v: float) -> float:
        if v < 0:
            raise ValueError("day_rate must be >= 0")
        return v

    @field_validator("currency")
    @classmethod
    def _currency_valid(cls, v: str) -> str:
        if v not in CURRENCIES:
            raise ValueError(f"currency must be one of {CURRENCIES}")
        return v


class PracticeRolesUpdate(BaseModel):
    roles: List[PracticeRoleEntry]

    @field_validator("roles")
    @classmethod
    def _no_duplicate_role_currency(cls, v: list) -> list:
        seen = set()
        for entry in v:
            key = (entry.role_name, entry.currency)
            if key in seen:
                raise ValueError(
                    f"duplicate (role_name, currency) pair: {entry.role_name!r} / {entry.currency}"
                )
            seen.add(key)
        return v


# ── Legacy team mix (Phase 2c) ────────────────────────────────────────────────

class LegacyTeamRoleEntry(BaseModel):
    role_name: str
    count: int
    day_rate: float

    @field_validator("role_name")
    @classmethod
    def _role_name_non_empty(cls, v: str) -> str:
        s = v.strip() if isinstance(v, str) else ""
        if not s:
            raise ValueError("role_name must not be empty")
        if len(s) > 80:
            raise ValueError("role_name must be at most 80 characters")
        return s

    @field_validator("count")
    @classmethod
    def _count_at_least_one(cls, v: int) -> int:
        if v < 1:
            raise ValueError("count must be >= 1")
        return v

    @field_validator("day_rate")
    @classmethod
    def _day_rate_non_negative(cls, v: float) -> float:
        if v < 0:
            raise ValueError("day_rate must be >= 0")
        return v
