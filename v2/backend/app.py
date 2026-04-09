"""app.py — FastAPI routes for xCSG Value Tracker V2."""
import json
import os
import tempfile
from datetime import date
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
    ActivityLogEntry, DeliverableCreate, DeliverableUpdate, ExpertResponseCreate,
    ExpertContextResponse, LoginRequest, LoginResponse, MetricsSummary,
    NormUpdate, RegisterRequest, ScalingGates, TrendData, TrendPoint, UserInfo,
)

app = FastAPI(title="xCSG Value Tracker V2", version="2.0.0")

_raw_origins = os.environ.get("CORS_ORIGINS", '["http://localhost:3000", "http://localhost:8765"]')
try:
    CORS_ORIGINS = json.loads(_raw_origins)
except Exception:
    CORS_ORIGINS = ["http://localhost:8765"]
app.add_middleware(CORSMiddleware, allow_origins=CORS_ORIGINS, allow_credentials=True, allow_methods=["*"], allow_headers=["*"])

frontend_dir = Path(__file__).resolve().parent.parent / "frontend"


@app.on_event("startup")
async def startup_event():
    db.init_db()


# ── Health ────────────────────────────────────────────────────────────────────

@app.get("/api/health")
async def health():
    return {"status": "ok", "version": "2.0.0"}


# ── Auth ──────────────────────────────────────────────────────────────────────

@app.post("/api/auth/login", response_model=LoginResponse)
async def login(body: LoginRequest):
    user_row = db.get_user_by_username(body.username)
    if not user_row or not auth.verify_password(body.password, user_row["password_hash"]):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid username or password")
    token = auth.create_token(user_row["id"], user_row["username"], user_row["role"])
    name = user_row["username"].capitalize()
    return LoginResponse(
        access_token=token, token_type="bearer", expires_in=28800,
        user=UserInfo(id=user_row["id"], username=user_row["username"], name=name, role=user_row["role"]),
    )


@app.post("/api/auth/register")
async def register(body: RegisterRequest, user: dict = Depends(auth.get_current_user_admin)):
    existing = db.get_user_by_username(body.username)
    if existing:
        raise HTTPException(status_code=400, detail="Username already exists")
    uid = db.create_user(body.username, body.email, body.password, body.role)
    db.log_activity(user["sub"], "user_created", details=f"Created user {body.username}")
    return {"id": uid, "username": body.username, "role": body.role}


# ── Deliverables ──────────────────────────────────────────────────────────────

@app.get("/api/deliverables")
async def list_delivs(status_filter: Optional[str] = Query(None, alias="status"),
                      offset: int = 0, limit: int = 50, user: dict = Depends(auth.get_current_user)):
    items = db.list_deliverables(status_filter, offset, limit)
    total = db.count_deliverables(status_filter)
    return {"items": items, "total": total}


@app.post("/api/deliverables")
async def create_deliv(body: DeliverableCreate, user: dict = Depends(auth.get_current_user)):
    data = body.model_dump()
    data.setdefault("client_pulse", "Not yet received")
    deliv_id = db.create_deliverable(int(user["sub"]), data)
    deliv = db.get_deliverable(deliv_id)
    db.log_activity(int(user["sub"]), "deliverable_created", deliv_id, f"Created {body.deliverable_type}")
    return {"id": deliv_id, "expert_token": deliv["expert_token"], "expert_link": f"/#expert/{deliv['expert_token']}"}


@app.get("/api/deliverables/{deliv_id}")
async def get_deliv(deliv_id: int, user: dict = Depends(auth.get_current_user)):
    d = db.get_deliverable(deliv_id)
    if not d:
        raise HTTPException(status_code=404, detail="Deliverable not found")
    return d


@app.put("/api/deliverables/{deliv_id}")
async def update_deliv(deliv_id: int, body: DeliverableUpdate, user: dict = Depends(auth.get_current_user)):
    existing = db.get_deliverable(deliv_id)
    if not existing:
        raise HTTPException(status_code=404, detail="Deliverable not found")
    data = body.model_dump(exclude_none=True)
    db.update_deliverable(deliv_id, data)
    db.log_activity(int(user["sub"]), "deliverable_updated", deliv_id, f"Updated fields: {list(data.keys())}")
    return {"ok": True}


@app.delete("/api/deliverables/{deliv_id}")
async def delete_deliv(deliv_id: int, user: dict = Depends(auth.get_current_user_admin)):
    ok = db.delete_deliverable(deliv_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Deliverable not found")
    db.log_activity(int(user["sub"]), "deliverable_deleted", deliv_id)
    return {"ok": True}


# ── Expert Self-Service (NO auth — token-based) ──────────────────────────────

@app.get("/api/expert/{token}", response_model=ExpertContextResponse)
async def get_expert_context(token: str):
    d = db.get_deliverable_by_token(token)
    if not d:
        raise HTTPException(status_code=404, detail="Invalid expert link")
    return ExpertContextResponse(
        deliverable_id=d["id"], deliverable_type=d["deliverable_type"],
        client_name=d.get("client_name"), pioneer_name=d["pioneer_name"],
        description=d.get("description"), date_started=d["date_started"],
        date_delivered=d["date_delivered"], xcsg_team_size=d["xcsg_team_size"],
        already_completed=bool(d.get("expert_completed")),
    )


@app.post("/api/expert/{token}")
async def submit_expert(token: str, body: ExpertResponseCreate):
    d = db.get_deliverable_by_token(token)
    if not d:
        raise HTTPException(status_code=404, detail="Invalid expert link")
    if d.get("expert_completed"):
        raise HTTPException(status_code=400, detail="Assessment already submitted")
    data = body.model_dump()
    db.create_expert_response(d["id"], data)
    db.log_activity(d["created_by"], "expert_assessment_submitted", d["id"], f"Expert assessment for {d['deliverable_type']}")
    return {"ok": True, "message": "Thank you for your assessment!"}


# ── Legacy Norms ──────────────────────────────────────────────────────────────

@app.get("/api/norms")
async def list_norms(user: dict = Depends(auth.get_current_user)):
    return db.list_norms()


@app.get("/api/norms/{deliverable_type}")
async def get_norm(deliverable_type: str, user: dict = Depends(auth.get_current_user)):
    n = db.get_norm(deliverable_type)
    if not n:
        raise HTTPException(status_code=404, detail="Norm not found")
    return n


@app.put("/api/norms/{deliverable_type}")
async def update_norm(deliverable_type: str, body: NormUpdate, user: dict = Depends(auth.get_current_user)):
    data = body.model_dump(exclude_none=True)
    ok = db.update_norm(deliverable_type, data, int(user["sub"]))
    if not ok:
        raise HTTPException(status_code=404, detail="Norm not found")
    db.log_activity(int(user["sub"]), "norm_updated", details=f"Updated norm for {deliverable_type}")
    return {"ok": True}


# ── Metrics ───────────────────────────────────────────────────────────────────

@app.get("/api/metrics/summary", response_model=MetricsSummary)
async def metrics_summary(user: dict = Depends(auth.get_current_user)):
    completed = db.get_completed_deliverables_with_responses()
    all_delivs = db.list_deliverables(limit=10000)
    total = len(all_delivs)
    complete = len(completed)
    pending = total - complete

    effort_ratios = []
    quality_ratios = []
    vm_multipliers = []
    for d in completed:
        er = mtx.compute_effort_ratio(d["date_started"], d["date_delivered"], d["xcsg_team_size"],
                                       d.get("legacy_calendar_days"), d.get("legacy_team_size"))
        qr = mtx.compute_quality_ratio(d.get("xcsg_revision_rounds"), d.get("legacy_revision_rounds"))
        if er is not None:
            effort_ratios.append(er)
        if qr is not None:
            quality_ratios.append(qr)
        if er is not None and qr is not None:
            vm_multipliers.append(mtx.round2(er * qr))

    avg_er = mtx._avg(effort_ratios) if effort_ratios else None
    avg_qr = mtx._avg(quality_ratios) if quality_ratios else None
    avg_vm = mtx._avg(vm_multipliers) if vm_multipliers else None

    mf_scores, sl_scores, pk_scores = [], [], []
    for d in completed:
        mf = mtx.compute_machine_first_score(d)
        sl = mtx.compute_senior_led_score(d)
        pk = mtx.compute_proprietary_knowledge_score(d)
        if mf is not None: mf_scores.append(mf)
        if sl is not None: sl_scores.append(sl)
        if pk is not None: pk_scores.append(pk)

    ri_rate = mtx.compute_reuse_intent_rate(completed)
    checkpoint = mtx.get_checkpoint(complete)

    next_thresholds = {1: 3, 2: 8, 3: 20}
    to_next = next_thresholds.get(checkpoint, 0) - complete if checkpoint < 4 else 0

    return MetricsSummary(
        total_deliverables=total, complete_deliverables=complete, pending_deliverables=pending,
        average_effort_ratio=avg_er, average_quality_ratio=avg_qr, average_value_multiplier=avg_vm,
        reuse_intent_rate=ri_rate,
        machine_first_avg=mtx._avg(mf_scores) if mf_scores else None,
        senior_led_avg=mtx._avg(sl_scores) if sl_scores else None,
        proprietary_knowledge_avg=mtx._avg(pk_scores) if pk_scores else None,
        checkpoint=checkpoint, deliverables_to_next=max(to_next, 0),
    )


@app.get("/api/metrics/deliverables")
async def metrics_deliverables(user: dict = Depends(auth.get_current_user)):
    completed = db.get_completed_deliverables_with_responses()
    results = []
    for d in completed:
        xcsg_days = mtx.compute_xcsg_calendar_days(d["date_started"], d["date_delivered"])
        er = mtx.compute_effort_ratio(d["date_started"], d["date_delivered"], d["xcsg_team_size"],
                                       d.get("legacy_calendar_days"), d.get("legacy_team_size"))
        qr = mtx.compute_quality_ratio(d.get("xcsg_revision_rounds"), d.get("legacy_revision_rounds"))
        vm = mtx.round2(er * qr) if er is not None and qr is not None else None
        mf = mtx.compute_machine_first_score(d)
        sl = mtx.compute_senior_led_score(d)
        pk = mtx.compute_proprietary_knowledge_score(d)
        ai_surv = mtx.compute_ai_survival_rate(d)
        results.append({
            "id": d["id"], "deliverable_type": d["deliverable_type"], "pioneer_name": d["pioneer_name"],
            "client_name": d.get("client_name"), "xcsg_calendar_days": xcsg_days,
            "legacy_calendar_days": d.get("legacy_calendar_days"),
            "effort_ratio": er, "xcsg_revisions": mtx.REVISION_NUMBERS.get(d.get("xcsg_revision_rounds")),
            "legacy_revisions": mtx.REVISION_NUMBERS.get(d.get("legacy_revision_rounds")),
            "quality_ratio": qr, "value_multiplier": vm,
            "machine_first_score": mf, "senior_led_score": sl, "proprietary_knowledge_score": pk,
            "ai_survival_rate": ai_surv, "reuse_intent": d.get("g1_reuse_intent"),
            "client_pulse": d.get("client_pulse"), "created_at": d["created_at"],
        })
    return results


@app.get("/api/metrics/trends", response_model=TrendData)
async def metrics_trends(user: dict = Depends(auth.get_current_user)):
    completed = db.get_completed_deliverables_with_responses()
    points = []
    for d in completed:
        er = mtx.compute_effort_ratio(d["date_started"], d["date_delivered"], d["xcsg_team_size"],
                                       d.get("legacy_calendar_days"), d.get("legacy_team_size"))
        qr = mtx.compute_quality_ratio(d.get("xcsg_revision_rounds"), d.get("legacy_revision_rounds"))
        vm = mtx.round2(er * qr) if er is not None and qr is not None else None
        mf = mtx.compute_machine_first_score(d)
        sl = mtx.compute_senior_led_score(d)
        pk = mtx.compute_proprietary_knowledge_score(d)
        ai_surv = mtx.compute_ai_survival_rate(d)
        points.append(TrendPoint(
            id=d["id"], deliverable_type=d["deliverable_type"], pioneer_name=d["pioneer_name"],
            effort_ratio=er, quality_ratio=qr, value_multiplier=vm,
            machine_first_score=mf, senior_led_score=sl, proprietary_knowledge_score=pk,
            ai_survival_rate=ai_surv, g1_reuse_intent=d.get("g1_reuse_intent"), created_at=d["created_at"],
        ))
    return TrendData(points=points)


@app.get("/api/metrics/scaling-gates", response_model=ScalingGates)
async def metrics_scaling_gates(user: dict = Depends(auth.get_current_user)):
    completed = db.get_completed_deliverables_with_responses()
    all_delivs = db.list_deliverables(limit=10000)
    effort_ratios = []
    for d in completed:
        er = mtx.compute_effort_ratio(d["date_started"], d["date_delivered"], d["xcsg_team_size"],
                                       d.get("legacy_calendar_days"), d.get("legacy_team_size"))
        if er is not None:
            effort_ratios.append(er)
    avg_er = mtx._avg(effort_ratios) if effort_ratios else None
    gates = mtx.compute_scaling_gates(completed, avg_er)
    passed = sum(1 for g in gates if g["status"] == "pass")
    return ScalingGates(gates=gates, passed_count=passed)


# ── Activity ──────────────────────────────────────────────────────────────────

@app.get("/api/activity")
async def get_activity(limit: int = 100, user: dict = Depends(auth.get_current_user)):
    return db.list_activity(limit)


# ── Export ────────────────────────────────────────────────────────────────────

@app.get("/api/export/excel")
async def export_excel(user: dict = Depends(auth.get_current_user)):
    try:
        import openpyxl
    except ImportError:
        raise HTTPException(status_code=500, detail="openpyxl not installed")
    completed = db.get_completed_deliverables_with_responses()
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Deliverables"
    headers = ["ID", "Type", "Pioneer", "Client", "Date Started", "Date Delivered",
               "xCSG Calendar Days", "Effort Ratio", "Quality Ratio", "Value Multiplier",
               "Machine-First", "Senior-Led", "Proprietary Knowledge", "AI Survival Rate",
               "Reuse Intent", "Client Pulse"]
    ws.append(headers)
    for d in completed:
        xcsg_days = mtx.compute_xcsg_calendar_days(d["date_started"], d["date_delivered"])
        er = mtx.compute_effort_ratio(d["date_started"], d["date_delivered"], d["xcsg_team_size"],
                                       d.get("legacy_calendar_days"), d.get("legacy_team_size"))
        qr = mtx.compute_quality_ratio(d.get("xcsg_revision_rounds"), d.get("legacy_revision_rounds"))
        vm = mtx.round2(er * qr) if er is not None and qr is not None else None
        mf = mtx.compute_machine_first_score(d)
        sl = mtx.compute_senior_led_score(d)
        pk = mtx.compute_proprietary_knowledge_score(d)
        ai = mtx.compute_ai_survival_rate(d)
        ws.append([d["id"], d["deliverable_type"], d["pioneer_name"], d.get("client_name"),
                    d["date_started"], d["date_delivered"], xcsg_days, er, qr, vm, mf, sl, pk, ai,
                    d.get("g1_reuse_intent"), d.get("client_pulse")])
    os.makedirs(tempfile.gettempdir(), exist_ok=True)
    fname = f"xcsg_export_{date.today().isoformat()}.xlsx"
    fpath = os.path.join(tempfile.gettempdir(), fname)
    wb.save(fpath)
    return {"filename": fname}


@app.get("/api/export/file/{name}")
async def download_export(name: str, user: dict = Depends(auth.get_current_user)):
    fpath = os.path.join(tempfile.gettempdir(), name)
    if not os.path.exists(fpath):
        raise HTTPException(status_code=404, detail="File not found")
    return FileResponse(fpath, filename=name, media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")


# ── Static files (MUST BE LAST) ──────────────────────────────────────────────

app.mount("/", StaticFiles(directory=str(frontend_dir), html=True), name="frontend")
