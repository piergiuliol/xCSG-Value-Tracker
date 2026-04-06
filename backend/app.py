"""
app.py — FastAPI routes for xCSG Value Tracker
Phase 1 realignment (April 2026).

IMPORTANT: app.mount("/", StaticFiles(...)) MUST be the LAST line.
"""
import json
import os
import tempfile
from pathlib import Path
from typing import Optional

from fastapi import Depends, FastAPI, HTTPException, Query, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from backend import auth
from backend import database as db
from backend import metrics as mtx
from backend.models import (
    ActivityLogEntry,
    CategoryCreate,
    CategoryUpdate,
    ExpertAssessmentMetrics,
    ExpertContextResponse,
    ExpertResponseCreate,
    LoginRequest,
    LoginResponse,
    MetricsSummary,
    NormUpdate,
    ProjectCreate,
    ProjectUpdate,
    RegisterRequest,
    ScalingGates,
    TrendData,
    UserInfo,
)


# ── Expert field options (canonical source of truth for dropdown values) ──────

EXPERT_FIELD_OPTIONS = {
    "b1_starting_point": {
        "section": "B",
        "label": "Starting point",
        "options": [
            "Raw request",
            "Light brief",
            "Structured brief",
            "Hypothesis",
            "Full hypothesis deck",
        ],
        "has_legacy": True,
        "legacy_default": "Raw request",
    },
    "b2_research_sources": {
        "section": "B",
        "label": "Research sources",
        "options": [
            "General web",
            "Industry databases",
            "Proprietary database",
            "Internal knowledge base",
            "Synthesized firm knowledge",
        ],
        "has_legacy": True,
        "legacy_default": None,
    },
    "b3_assembly_ratio": {
        "section": "B",
        "label": "Assembly ratio",
        "options": [
            ">80% manual",
            "60-80%",
            "40-60%",
            "20-40%",
            "<20% manual",
        ],
        "has_legacy": True,
        "legacy_default": ">80% manual",
    },
    "b4_hypothesis_first": {
        "section": "B",
        "label": "Hypothesis approach",
        "options": [
            "Exploratory",
            "Mostly exploratory",
            "Balanced",
            "Mostly hypothesis-led",
            "Fully hypothesis-led",
        ],
        "has_legacy": True,
        "legacy_default": "Exploratory",
    },
    "c1_specialization": {
        "section": "C",
        "label": "Specialization match",
        "options": [
            "Generalist",
            "Mixed",
            "Specialist",
            "Deep specialist",
            "World-class expert",
        ],
        "has_legacy": False,
    },
    "c2_directness": {
        "section": "C",
        "label": "Directness",
        "options": [
            "Delegated",
            "Partially delegated",
            "Shared",
            "Hands-on",
            "Personally leading",
        ],
        "has_legacy": False,
    },
    "c3_judgment_pct": {
        "section": "C",
        "label": "Judgment concentration",
        "options": [
            "<20%",
            "20-40%",
            "40-60%",
            "60-80%",
            ">80%",
        ],
        "has_legacy": False,
    },
    "c4_senior_hours": {
        "section": "C",
        "label": "Senior hours",
        "type": "numeric",
        "has_legacy": False,
    },
    "c5_junior_hours": {
        "section": "C",
        "label": "Junior hours",
        "type": "numeric",
        "has_legacy": False,
    },
    "d1_proprietary_data": {
        "section": "D",
        "label": "Proprietary data",
        "options": [
            "None",
            "Public data",
            "Some proprietary",
            "Mostly proprietary",
            "Fully proprietary",
        ],
        "has_legacy": True,
        "legacy_default": None,
    },
    "d2_knowledge_reuse": {
        "section": "D",
        "label": "Knowledge reuse",
        "options": [
            "One-time",
            "Some reuse",
            "Moderate",
            "High",
            "Maximum",
        ],
        "has_legacy": True,
        "legacy_default": None,
    },
    "d3_moat_test": {
        "section": "D",
        "label": "Moat test",
        "options": [
            "Easily replicable",
            "Somewhat",
            "Moderately unique",
            "Highly unique",
            "Impossible to replicate",
        ],
        "has_legacy": True,
        "legacy_default": None,
    },
    "f1_feasibility": {
        "section": "F",
        "label": "Feasibility",
        "options": [
            "Not assessed",
            "Basic",
            "Standard",
            "Comprehensive",
            "Exceeds requirements",
        ],
        "has_legacy": True,
        "legacy_default": None,
    },
    "f2_productization": {
        "section": "F",
        "label": "Productization",
        "options": [
            "None",
            "Identified",
            "Designed",
            "Implemented",
            "Scaled",
        ],
        "has_legacy": True,
        "legacy_default": None,
    },
}


# ── App init ──────────────────────────────────────────────────────────────────

app = FastAPI(title="xCSG Value Tracker", version="2.1.0")

# CORS
_raw_origins = os.environ.get(
    "CORS_ORIGINS",
    '["http://localhost:3000", "http://localhost:8000", "http://127.0.0.1:8000"]',
)
try:
    CORS_ORIGINS = json.loads(_raw_origins)
except Exception:
    CORS_ORIGINS = ["http://localhost:8000"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def startup_event():
    db.init_db()


# ── Health ────────────────────────────────────────────────────────────────────

@app.get("/api/health")
async def health():
    return {"status": "ok", "version": "2.1.0"}


# ── Auth ──────────────────────────────────────────────────────────────────────

@app.post("/api/auth/login", response_model=LoginResponse)
async def login(body: LoginRequest):
    user_row = db.get_user_by_username(body.username)
    if not user_row or not auth.verify_password(body.password, user_row["password_hash"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username or password",
        )
    token = auth.create_token(user_row["id"], user_row["username"], user_row["role"])
    db.log_activity(user_row["id"], "login", details=f"User {user_row['username']} logged in")

    return LoginResponse(
        access_token=token,
        expires_in=auth.JWT_EXPIRY_HOURS * 3600,
        user=UserInfo(
            id=user_row["id"],
            username=user_row["username"],
            name=user_row["username"].title(),
            role=user_row["role"],
        ),
    )


@app.post("/api/auth/register", status_code=201)
async def register(body: RegisterRequest, current_user: dict = Depends(auth.get_current_user_admin)):
    existing = db.get_user_by_username(body.username)
    if existing:
        raise HTTPException(status_code=400, detail="Username already exists")
    hashed = auth.hash_password(body.password)
    user_id = db.create_user(body.username, body.email, hashed, body.role)
    return {"id": user_id, "username": body.username, "role": body.role}


# ── Project Categories ───────────────────────────────────────────────────────

@app.get("/api/categories")
async def list_categories(current_user: dict = Depends(auth.get_current_user)):
    cats = db.list_categories()
    conn = db.get_connection()
    try:
        counts = {}
        for row in conn.execute("SELECT category_id, COUNT(*) as cnt FROM projects GROUP BY category_id").fetchall():
            counts[row["category_id"]] = row["cnt"]
    finally:
        conn.close()
    for c in cats:
        c["project_count"] = counts.get(c["id"], 0)
    return cats


@app.post("/api/categories", status_code=201)
async def create_category(
    body: CategoryCreate,
    current_user: dict = Depends(auth.get_current_user_admin),
):
    try:
        cat_id = db.create_category(body.name, body.description)
    except Exception:
        raise HTTPException(status_code=400, detail="Category name already exists")
    cat = db.get_category(cat_id)
    db.log_activity(
        current_user["sub"],
        "category_created",
        details=f"Created category '{body.name}'",
    )
    return dict(cat)


@app.put("/api/categories/{category_id}")
async def update_category(
    category_id: int,
    body: CategoryUpdate,
    current_user: dict = Depends(auth.get_current_user_admin),
):
    cat = db.get_category(category_id)
    if not cat:
        raise HTTPException(status_code=404, detail="Category not found")
    try:
        db.update_category(category_id, body.name, body.description)
    except Exception:
        raise HTTPException(status_code=400, detail="Category name already exists")
    db.log_activity(
        current_user["sub"],
        "category_updated",
        details=f"Updated category '{body.name}'",
    )
    return dict(db.get_category(category_id))


@app.delete("/api/categories/{category_id}", status_code=204)
async def delete_category(
    category_id: int,
    current_user: dict = Depends(auth.get_current_user_admin),
):
    cat = db.get_category(category_id)
    if not cat:
        raise HTTPException(status_code=404, detail="Category not found")
    if db.category_has_projects(category_id):
        raise HTTPException(status_code=400, detail="Cannot delete category with existing projects")
    db.delete_category(category_id)
    db.log_activity(
        current_user["sub"],
        "category_deleted",
        details=f"Deleted category '{cat['name']}'",
    )


# ── Projects ─────────────────────────────────────────────────────────────────

@app.get("/api/projects")
async def list_projects(
    status_filter: Optional[str] = Query(None, alias="status"),
    category_id: Optional[int] = Query(None),
    pioneer: Optional[str] = Query(None),
    client: Optional[str] = Query(None),
    current_user: dict = Depends(auth.get_current_user),
):
    return db.list_projects(
        status_filter=status_filter,
        category_id=category_id,
        pioneer=pioneer,
        client=client,
    )


@app.post("/api/projects", status_code=201)
async def create_project(
    body: ProjectCreate,
    current_user: dict = Depends(auth.get_current_user),
):
    cat = db.get_category(body.category_id)
    if not cat:
        raise HTTPException(status_code=400, detail="Invalid category_id")

    data = body.model_dump()
    data["created_by"] = current_user["sub"]

    norm = db.get_norm_by_category(body.category_id)
    if norm:
        data["legacy_overridden"] = (
            data.get("legacy_calendar_days") != norm["typical_calendar_days"]
            or data.get("legacy_team_size") != norm["typical_team_size"]
            or data.get("legacy_revision_rounds") != norm["typical_revision_rounds"]
        )
    else:
        data["legacy_overridden"] = False

    project_id = db.create_project(data)
    row = db.get_project(project_id)
    db.log_activity(
        current_user["sub"],
        "project_created",
        project_id=project_id,
        details=f"Created project '{data['project_name']}' ({cat['name']})",
    )
    return dict(row)


@app.get("/api/projects/{project_id}")
async def get_project(
    project_id: int,
    current_user: dict = Depends(auth.get_current_user),
):
    row = db.get_project(project_id)
    if not row:
        raise HTTPException(status_code=404, detail="Project not found")
    result = dict(row)
    er = db.get_expert_response(project_id)
    if er:
        result["expert_response"] = dict(er)
    if row["status"] == "complete":
        merged = dict(row)
        if er:
            merged.update({k: v for k, v in dict(er).items() if k != "id"})
        result["metrics"] = mtx.compute_project_metrics(merged)
    return result


@app.put("/api/projects/{project_id}")
async def update_project(
    project_id: int,
    body: ProjectUpdate,
    current_user: dict = Depends(auth.get_current_user),
):
    row = db.get_project(project_id)
    if not row:
        raise HTTPException(status_code=404, detail="Project not found")
    data = {k: v for k, v in body.model_dump().items() if v is not None}
    db.update_project(project_id, data)
    db.log_activity(
        current_user["sub"],
        "project_updated",
        project_id=project_id,
        details=f"Updated project #{project_id}",
    )
    updated = db.get_project(project_id)
    return dict(updated)


@app.delete("/api/projects/{project_id}", status_code=204)
async def delete_project(
    project_id: int,
    current_user: dict = Depends(auth.get_current_user_admin),
):
    row = db.get_project(project_id)
    if not row:
        raise HTTPException(status_code=404, detail="Project not found")
    db.log_activity(
        current_user["sub"],
        "project_deleted",
        details=f"Deleted project #{project_id} ({row['project_name']})",
    )
    db.delete_project(project_id)


# ── Expert (NO auth — token-based) ───────────────────────────────────────────

@app.get("/api/expert/options")
async def get_expert_options():
    """Return all field definitions for building the expert assessment form."""
    return EXPERT_FIELD_OPTIONS


@app.get("/api/expert/{token}", response_model=ExpertContextResponse)
async def get_expert_context(token: str):
    row = db.get_project_by_token(token)
    if not row:
        raise HTTPException(status_code=404, detail="Expert link is invalid or has expired")
    already_done = row["status"] == "complete"
    return ExpertContextResponse(
        project_id=row["id"],
        project_name=row["project_name"],
        category_name=row["category_name"],
        description=row["description"],
        client_name=row["client_name"],
        pioneer_name=row["pioneer_name"],
        date_started=row["date_started"],
        date_delivered=row["date_delivered"],
        xcsg_team_size=row["xcsg_team_size"],
        xcsg_calendar_days=row["xcsg_calendar_days"],
        already_completed=already_done,
    )


@app.get("/api/expert/{token}/metrics", response_model=ExpertAssessmentMetrics)
async def get_expert_metrics(token: str):
    """Return computed flywheel leg scores for a submitted expert assessment."""
    row = db.get_project_by_token(token)
    if not row:
        raise HTTPException(status_code=404, detail="Expert link is invalid or has expired")
    if row["status"] != "complete":
        raise HTTPException(status_code=404, detail="Assessment not yet submitted")

    er = db.get_expert_response(row["id"])
    if not er:
        raise HTTPException(status_code=404, detail="No response found")

    er_dict = dict(er)
    return ExpertAssessmentMetrics(
        machine_first_score=mtx.compute_machine_first_score(er_dict),
        senior_led_score=mtx.compute_senior_led_score(er_dict),
        proprietary_knowledge_score=mtx.compute_proprietary_knowledge_score(er_dict),
    )


@app.post("/api/expert/{token}", status_code=201)
async def submit_expert_response(token: str, body: ExpertResponseCreate):
    row = db.get_project_by_token(token)
    if not row:
        raise HTTPException(status_code=404, detail="Expert link is invalid or has expired")
    if row["status"] == "complete":
        return {"already_completed": True, "message": "This assessment has already been submitted"}
    data = body.model_dump()
    db.create_expert_response(row["id"], data)
    db.log_activity(
        1,
        "expert_submitted",
        project_id=row["id"],
        details=f"Expert assessment submitted for '{row['project_name']}' (pioneer: {row['pioneer_name']})",
    )

    # Compute and return metrics on successful submission
    er = db.get_expert_response(row["id"])
    metrics = {
        "machine_first_score": mtx.compute_machine_first_score(dict(er)),
        "senior_led_score": mtx.compute_senior_led_score(dict(er)),
        "proprietary_knowledge_score": mtx.compute_proprietary_knowledge_score(dict(er)),
    }
    return {"success": True, "message": "Assessment submitted successfully", "metrics": metrics}


# ── Legacy Norms ──────────────────────────────────────────────────────────────

@app.get("/api/norms")
async def list_norms(current_user: dict = Depends(auth.get_current_user)):
    return db.list_norms()


@app.get("/api/norms/{category_id}")
async def get_norm(
    category_id: int,
    current_user: dict = Depends(auth.get_current_user),
):
    row = db.get_norm_by_category(category_id)
    if not row:
        raise HTTPException(status_code=404, detail="Norm not found for this category")
    return dict(row)


@app.put("/api/norms/{category_id}")
async def update_norm(
    category_id: int,
    body: NormUpdate,
    current_user: dict = Depends(auth.get_current_user),
):
    cat = db.get_category(category_id)
    if not cat:
        raise HTTPException(status_code=404, detail="Category not found")
    data = {k: v for k, v in body.model_dump().items() if v is not None}
    db.update_norm(category_id, data, current_user["sub"])
    db.log_activity(
        current_user["sub"],
        "norm_updated",
        details=f"Updated norm for category '{cat['name']}'",
    )
    return db.get_norm_by_category(category_id)


# ── Metrics ───────────────────────────────────────────────────────────────────

@app.get("/api/metrics/summary", response_model=MetricsSummary)
async def metrics_summary(current_user: dict = Depends(auth.get_current_user)):
    complete = db.list_complete_projects()
    all_p = db.list_projects()
    summary = mtx.compute_summary(complete, all_p)
    return MetricsSummary(**summary)


@app.get("/api/metrics/projects")
async def metrics_projects(current_user: dict = Depends(auth.get_current_user)):
    complete = db.list_complete_projects()
    return [mtx.compute_project_metrics(d) for d in complete]


@app.get("/api/metrics/trends", response_model=TrendData)
async def metrics_trends(current_user: dict = Depends(auth.get_current_user)):
    complete = db.list_complete_projects()
    points = mtx.compute_trend_data(complete)
    from backend.models import TrendPoint
    return TrendData(points=[TrendPoint(**p) for p in points])


@app.get("/api/metrics/scaling-gates", response_model=ScalingGates)
async def metrics_scaling_gates(current_user: dict = Depends(auth.get_current_user)):
    complete = db.list_complete_projects()
    all_p = db.list_projects()
    gates = mtx.compute_scaling_gates(complete, all_p)
    from backend.models import ScalingGate
    passed = sum(1 for g in gates if g["status"] == "pass")
    return ScalingGates(
        gates=[ScalingGate(**g) for g in gates],
        passed_count=passed,
        total_count=len(gates),
    )


# ── Activity Log ──────────────────────────────────────────────────────────────

@app.get("/api/activity")
async def list_activity(
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
    current_user: dict = Depends(auth.get_current_user),
):
    rows = db.list_activity(limit=limit, offset=offset)
    total = db.get_activity_count()
    return {"items": rows, "total": total, "limit": limit, "offset": offset}


# ── Export ────────────────────────────────────────────────────────────────────

@app.get("/api/export/excel")
async def export_excel(current_user: dict = Depends(auth.get_current_user)):
    try:
        import openpyxl
        from openpyxl.styles import Font, PatternFill, Alignment
    except ImportError:
        raise HTTPException(status_code=500, detail="openpyxl not installed")

    wb = openpyxl.Workbook()

    # ── Sheet 1: Raw Data ──
    ws1 = wb.active
    ws1.title = "Raw Data"
    all_p = db.list_projects()
    complete = db.list_complete_projects()

    header_font = Font(bold=True, color="FFFFFF")
    header_fill = PatternFill("solid", fgColor="121F6B")

    headers1 = [
        "ID", "Project Name", "Category", "Pioneer", "Client",
        "Date Started", "Date Delivered",
        "xCSG Calendar Days", "xCSG Team Size", "xCSG Revisions",
        "Legacy Calendar Days", "Legacy Team Size", "Legacy Revisions",
        "Status", "Created At",
        # B — Machine-First (xcsg / legacy)
        "B1 xcsg", "B1 legacy", "B2 xcsg", "B2 legacy",
        "B3 xcsg", "B3 legacy", "B4 xcsg", "B4 legacy",
        # C — Senior-Led (xcsg only)
        "C1", "C2", "C3", "C4 senior hrs", "C5 junior hrs",
        # D — Proprietary Knowledge (xcsg / legacy)
        "D1 xcsg", "D1 legacy", "D2 xcsg", "D2 legacy",
        "D3 xcsg", "D3 legacy",
        # F — Value Creation (xcsg / legacy)
        "F1 xcsg", "F1 legacy", "F2 xcsg", "F2 legacy",
    ]
    ws1.append(headers1)
    for cell in ws1[1]:
        cell.font = header_font
        cell.fill = header_fill

    er_by_id = {d["id"]: d for d in complete}

    for p in all_p:
        er = er_by_id.get(p["id"], {})
        ws1.append([
            p["id"], p["project_name"], p.get("category_name", ""),
            p["pioneer_name"], p.get("client_name", ""),
            p.get("date_started", ""), p.get("date_delivered", ""),
            p["xcsg_calendar_days"], p["xcsg_team_size"], p["xcsg_revision_rounds"],
            p.get("legacy_calendar_days", ""), p.get("legacy_team_size", ""),
            p.get("legacy_revision_rounds", ""),
            p["status"], p["created_at"],
            # B
            er.get("b1_starting_point_xcsg", ""), er.get("b1_starting_point_legacy", ""),
            er.get("b2_research_sources_xcsg", ""), er.get("b2_research_sources_legacy", ""),
            er.get("b3_assembly_ratio_xcsg", ""), er.get("b3_assembly_ratio_legacy", ""),
            er.get("b4_hypothesis_first_xcsg", ""), er.get("b4_hypothesis_first_legacy", ""),
            # C
            er.get("c1_specialization", ""), er.get("c2_directness", ""), er.get("c3_judgment_pct", ""),
            er.get("c4_senior_hours", ""), er.get("c5_junior_hours", ""),
            # D
            er.get("d1_proprietary_data_xcsg", ""), er.get("d1_proprietary_data_legacy", ""),
            er.get("d2_knowledge_reuse_xcsg", ""), er.get("d2_knowledge_reuse_legacy", ""),
            er.get("d3_moat_test_xcsg", ""), er.get("d3_moat_test_legacy", ""),
            # F
            er.get("f1_feasibility_xcsg", ""), er.get("f1_feasibility_legacy", ""),
            er.get("f2_productization_xcsg", ""), er.get("f2_productization_legacy", ""),
        ])

    # ── Sheet 2: Computed Metrics ──
    ws2 = wb.create_sheet("Computed Metrics")
    headers2 = [
        "ID", "Project Name", "Category", "Pioneer", "Client",
        "xCSG Person-Days", "Legacy Person-Days", "Effort Ratio",
        "xCSG Revisions", "Legacy Revisions", "Quality Ratio", "Value Multiplier",
        "Machine-First Score", "Senior-Led Score", "Proprietary Knowledge Score",
        "Created At",
    ]
    ws2.append(headers2)
    for cell in ws2[1]:
        cell.font = header_font
        cell.fill = header_fill

    metrics_list = [mtx.compute_project_metrics(d) for d in complete]
    for m in metrics_list:
        ws2.append([
            m["id"], m["project_name"], m["category_name"],
            m["pioneer_name"], m.get("client_name", ""),
            m["xcsg_person_days"], m["legacy_person_days"], m["effort_ratio"],
            m["xcsg_revisions"], m["legacy_revisions"], m["quality_ratio"], m["value_multiplier"],
            m.get("machine_first_score", ""), m.get("senior_led_score", ""),
            m.get("proprietary_knowledge_score", ""), m["created_at"],
        ])

    for ws in [ws1, ws2]:
        for col in ws.columns:
            max_len = max((len(str(cell.value or "")) for cell in col), default=0)
            ws.column_dimensions[col[0].column_letter].width = min(max_len + 4, 50)

    tmp = tempfile.NamedTemporaryFile(
        suffix=".xlsx", prefix="xCSG_Export_", delete=False, dir="/tmp"
    )
    wb.save(tmp.name)
    tmp.close()

    return FileResponse(
        tmp.name,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        filename="xCSG_Value_Export.xlsx",
    )


@app.get("/api/export/file/{name}")
async def download_export_file(
    name: str,
    current_user: dict = Depends(auth.get_current_user),
):
    path = f"/tmp/{name}"
    if not os.path.exists(path):
        raise HTTPException(status_code=404, detail="Export file not found")
    return FileResponse(path, media_type="application/octet-stream", filename=name)


# ── Static file mount — MUST BE LAST ─────────────────────────────────────────
_frontend_dir = Path(__file__).parent.parent / "frontend"
if _frontend_dir.exists():
    app.mount("/", StaticFiles(directory=str(_frontend_dir), html=True), name="static")
