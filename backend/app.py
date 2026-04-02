"""
app.py — FastAPI routes for xCSG Value Tracker

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
    DeliverableCreate,
    DeliverableMetrics,
    DeliverableResponse,
    DeliverableUpdate,
    ExpertContextResponse,
    ExpertResponseCreate,
    LoginRequest,
    LoginResponse,
    MetricsSummary,
    NormResponse,
    NormUpdate,
    RegisterRequest,
    ScalingGates,
    TrendData,
    UserInfo,
)

# ── App init ──────────────────────────────────────────────────────────────────

app = FastAPI(title="xCSG Value Tracker", version="1.0.0")

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
    return {"status": "ok", "version": "1.0.0"}


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


# ── Deliverables ──────────────────────────────────────────────────────────────

@app.get("/api/deliverables")
async def list_deliverables(
    status_filter: Optional[str] = Query(None, alias="status"),
    current_user: dict = Depends(auth.get_current_user),
):
    rows = db.list_deliverables(status_filter=status_filter)
    return rows


@app.post("/api/deliverables", status_code=201)
async def create_deliverable(
    body: DeliverableCreate,
    current_user: dict = Depends(auth.get_current_user),
):
    data = body.model_dump()
    data["created_by"] = current_user["sub"]
    deliverable_id = db.create_deliverable(data)
    row = db.get_deliverable(deliverable_id)
    db.log_activity(
        current_user["sub"],
        "deliverable_created",
        deliverable_id=deliverable_id,
        details=f"Created {data['deliverable_type']} for {data.get('client_name', 'unknown client')}",
    )
    return dict(row)


@app.get("/api/deliverables/{deliverable_id}")
async def get_deliverable(
    deliverable_id: int,
    current_user: dict = Depends(auth.get_current_user),
):
    row = db.get_deliverable(deliverable_id)
    if not row:
        raise HTTPException(status_code=404, detail="Deliverable not found")
    return dict(row)


@app.put("/api/deliverables/{deliverable_id}")
async def update_deliverable(
    deliverable_id: int,
    body: DeliverableUpdate,
    current_user: dict = Depends(auth.get_current_user),
):
    row = db.get_deliverable(deliverable_id)
    if not row:
        raise HTTPException(status_code=404, detail="Deliverable not found")
    data = {k: v for k, v in body.model_dump().items() if v is not None}
    db.update_deliverable(deliverable_id, data)
    db.log_activity(
        current_user["sub"],
        "deliverable_updated",
        deliverable_id=deliverable_id,
        details=f"Updated deliverable #{deliverable_id}",
    )
    updated = db.get_deliverable(deliverable_id)
    return dict(updated)


@app.delete("/api/deliverables/{deliverable_id}", status_code=204)
async def delete_deliverable(
    deliverable_id: int,
    current_user: dict = Depends(auth.get_current_user_admin),
):
    row = db.get_deliverable(deliverable_id)
    if not row:
        raise HTTPException(status_code=404, detail="Deliverable not found")
    db.log_activity(
        current_user["sub"],
        "deliverable_deleted",
        details=f"Deleted deliverable #{deliverable_id} ({row['deliverable_type']})",
    )
    db.delete_deliverable(deliverable_id)


# ── Expert (NO auth — token-based) ───────────────────────────────────────────

@app.get("/api/expert/{token}", response_model=ExpertContextResponse)
async def get_expert_context(token: str):
    row = db.get_deliverable_by_token(token)
    if not row:
        raise HTTPException(status_code=404, detail="Expert link is invalid or has expired")
    already_done = bool(row["expert_completed"])
    return ExpertContextResponse(
        deliverable_id=row["id"],
        deliverable_type=row["deliverable_type"],
        client_name=row["client_name"],
        pioneer_name=row["pioneer_name"],
        date_started=row["date_started"],
        date_delivered=row["date_delivered"],
        xcsg_team_size=row["xcsg_team_size"],
        xcsg_calendar_days=row["xcsg_calendar_days"],
        already_completed=already_done,
    )


@app.post("/api/expert/{token}", status_code=201)
async def submit_expert_response(token: str, body: ExpertResponseCreate):
    row = db.get_deliverable_by_token(token)
    if not row:
        raise HTTPException(status_code=404, detail="Expert link is invalid or has expired")
    if row["expert_completed"]:
        # Return 200 with already_completed flag (not an error)
        return {"already_completed": True, "message": "This assessment has already been submitted"}
    data = body.model_dump()
    db.create_expert_response(row["id"], data)
    # Log as system activity (user_id = 1 = admin, since no auth context here)
    db.log_activity(
        1,
        "expert_submitted",
        deliverable_id=row["id"],
        details=f"Expert assessment submitted for {row['deliverable_type']} (pioneer: {row['pioneer_name']})",
    )
    return {"success": True, "message": "Assessment submitted successfully"}


# ── Legacy Norms ──────────────────────────────────────────────────────────────

@app.get("/api/norms")
async def list_norms(current_user: dict = Depends(auth.get_current_user)):
    return db.list_norms()


@app.get("/api/norms/{deliverable_type}")
async def get_norm(
    deliverable_type: str,
    current_user: dict = Depends(auth.get_current_user),
):
    row = db.get_norm_by_type(deliverable_type)
    if not row:
        raise HTTPException(status_code=404, detail="Norm not found for this deliverable type")
    return dict(row)


@app.put("/api/norms/{deliverable_type}")
async def update_norm(
    deliverable_type: str,
    body: NormUpdate,
    current_user: dict = Depends(auth.get_current_user),
):
    row = db.get_norm_by_type(deliverable_type)
    if not row:
        raise HTTPException(status_code=404, detail="Norm not found")
    data = {k: v for k, v in body.model_dump().items() if v is not None}
    db.update_norm(deliverable_type, data, current_user["sub"])
    db.log_activity(
        current_user["sub"],
        "norm_updated",
        details=f"Updated norm for {deliverable_type}",
    )
    return db.get_norm_by_type(deliverable_type)


# ── Metrics ───────────────────────────────────────────────────────────────────

@app.get("/api/metrics/summary", response_model=MetricsSummary)
async def metrics_summary(current_user: dict = Depends(auth.get_current_user)):
    complete = db.list_complete_deliverables()
    all_d = db.list_deliverables()
    summary = mtx.compute_summary(complete, all_d)
    return MetricsSummary(**summary)


@app.get("/api/metrics/deliverables")
async def metrics_deliverables(current_user: dict = Depends(auth.get_current_user)):
    complete = db.list_complete_deliverables()
    return [mtx.compute_deliverable_metrics(d) for d in complete]


@app.get("/api/metrics/trends", response_model=TrendData)
async def metrics_trends(current_user: dict = Depends(auth.get_current_user)):
    complete = db.list_complete_deliverables()
    points = mtx.compute_trend_data(complete)
    from backend.models import TrendPoint
    return TrendData(points=[TrendPoint(**p) for p in points])


@app.get("/api/metrics/scaling-gates", response_model=ScalingGates)
async def metrics_scaling_gates(current_user: dict = Depends(auth.get_current_user)):
    complete = db.list_complete_deliverables()
    all_d = db.list_deliverables()
    gates = mtx.compute_scaling_gates(complete, all_d)
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
    all_d = db.list_deliverables()
    complete = db.list_complete_deliverables()

    header_font = Font(bold=True, color="FFFFFF")
    header_fill = PatternFill("solid", fgColor="121F6B")

    headers1 = [
        "ID", "Type", "Pioneer", "Client", "Engagement Stage",
        "Date Started", "Date Delivered",
        "xCSG Calendar Days", "xCSG Team Size", "xCSG Revisions",
        "Legacy Calendar Days", "Legacy Team Size", "Legacy Revisions",
        "Status", "Created At",
        "B1", "B2", "B3", "B4", "C1", "C2", "C3",
        "D1", "D2", "D3", "F1", "F2",
    ]
    ws1.append(headers1)
    for cell in ws1[1]:
        cell.font = header_font
        cell.fill = header_fill

    # Build expert_response lookup
    er_by_id = {d["id"]: d for d in complete}

    for d in all_d:
        er = er_by_id.get(d["id"], {})
        ws1.append([
            d["id"], d["deliverable_type"], d["pioneer_name"], d.get("client_name", ""),
            d["engagement_stage"], d.get("date_started", ""), d.get("date_delivered", ""),
            d["xcsg_calendar_days"], d["xcsg_team_size"], d["xcsg_revision_rounds"],
            d["legacy_calendar_days"], d["legacy_team_size"], d["legacy_revision_rounds"],
            d["status"], d["created_at"],
            er.get("b1_starting_point", ""), er.get("b2_research_sources", ""),
            er.get("b3_assembly_ratio", ""), er.get("b4_hypothesis_first", ""),
            er.get("c1_specialization", ""), er.get("c2_directness", ""),
            er.get("c3_judgment_pct", ""),
            er.get("d1_proprietary_data", ""), er.get("d2_knowledge_reuse", ""),
            er.get("d3_moat_test", ""), er.get("f1_feasibility", ""),
            er.get("f2_productization", ""),
        ])

    # ── Sheet 2: Computed Metrics ──
    ws2 = wb.create_sheet("Computed Metrics")
    headers2 = [
        "ID", "Type", "Pioneer", "Client",
        "xCSG Person-Days", "Legacy Person-Days", "Effort Ratio",
        "xCSG Revisions", "Legacy Revisions", "Quality Ratio", "Value Multiplier",
        "Machine-First Score", "Senior-Led Score", "Proprietary Knowledge Score",
        "Created At",
    ]
    ws2.append(headers2)
    for cell in ws2[1]:
        cell.font = header_font
        cell.fill = header_fill

    metrics_list = [mtx.compute_deliverable_metrics(d) for d in complete]
    for m in metrics_list:
        ws2.append([
            m["id"], m["deliverable_type"], m["pioneer_name"], m.get("client_name", ""),
            m["xcsg_person_days"], m["legacy_person_days"], m["effort_ratio"],
            m["xcsg_revisions"], m["legacy_revisions"], m["quality_ratio"], m["value_multiplier"],
            m.get("machine_first_score", ""), m.get("senior_led_score", ""),
            m.get("proprietary_knowledge_score", ""), m["created_at"],
        ])

    # Auto-size columns
    for ws in [ws1, ws2]:
        for col in ws.columns:
            max_len = max((len(str(cell.value or "")) for cell in col), default=0)
            ws.column_dimensions[col[0].column_letter].width = min(max_len + 4, 50)

    # Save to temp file
    tmp = tempfile.NamedTemporaryFile(
        suffix=".xlsx", prefix="xCSG_Export_", delete=False, dir="/tmp"
    )
    wb.save(tmp.name)
    tmp.close()

    filename = os.path.basename(tmp.name)
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
