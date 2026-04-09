# Single Source of Truth + Assessment Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminate metric/field duplication by making the backend the single source of truth, fix missing assessment sections in project detail, fix norms table labels, and use quality ratio instead of raw score.

**Architecture:** Create a new `/api/schema` endpoint that serves all field definitions, scoring weights, section metadata, and metric definitions. The frontend reads this at startup and derives ASSESSMENT_FIELDS, KPI configs, and norms columns from it. Remove all hardcoded scoring maps from JS.

**Tech Stack:** Python (FastAPI), vanilla JS, SQLite

---

### Task 1: Create the schema module (backend single source of truth)

**Files:**
- Create: `backend/schema.py`

This new file centralizes ALL field definitions, scoring weights, section metadata, and metric definitions in one place. Both `metrics.py` and `app.py` will import from here.

- [ ] **Step 1: Create `backend/schema.py` with all field definitions**

```python
"""
schema.py — Single source of truth for all field definitions, scoring weights,
section metadata, and metric definitions. Every other module imports from here.
"""

# ── Section metadata ────────────────────────────────────────────────────────

SECTIONS = {
    "A": {"title": "Context", "desc": "Baseline for like-with-like comparison", "icon": "\U0001F4CB"},
    "B": {"title": "Machine-First Operations", "desc": "How AI-driven was the approach?", "icon": "\U0001F916"},
    "C": {"title": "Senior-Led Operations", "desc": "How deeply was senior expertise involved?", "icon": "\U0001F454"},
    "D": {"title": "Proprietary Knowledge", "desc": "How unique was the knowledge advantage?", "icon": "\U0001F3F0"},
    "E": {"title": "Client Impact", "desc": "Did the work drive a real decision or action?", "icon": "\U0001F4A5"},
    "F": {"title": "Value Creation", "desc": "What value did xCSG create beyond legacy?", "icon": "\U0001F48E"},
    "G": {"title": "Honest Signal", "desc": "Would you reuse this approach?", "icon": "\U0001F4C8"},
    "L": {"title": "Legacy Estimates", "desc": "Estimate traditional delivery performance for this specific deliverable.", "icon": "\U0001F4DD"},
}

# ── Scoring weights per option ──────────────────────────────────────────────
# Each field maps option text -> numeric score (0.0 to 1.0, or None for N/A)

SCORES = {
    "b1_starting_point": {
        "From AI draft": 1.0, "Mixed": 0.5, "From blank page": 0.0,
    },
    "b2_research_sources": {
        "1-3": 0.25, "4-7": 0.5, "8-12": 0.75, "13+": 1.0,
    },
    "b3_assembly_ratio": {
        ">75% AI": 1.0, "50-75%": 0.75, "25-50%": 0.5, "<25%": 0.25,
    },
    "b4_hypothesis_first": {
        "Hypothesis-first": 1.0, "Hybrid": 0.5, "Discovery-first": 0.0,
    },
    "b5_ai_survival": {
        ">75%": 1.0, "50-75%": 0.75, "25-50%": 0.5, "<25%": 0.25,
        "Did not use AI draft": None,
    },
    "b6_data_analysis_split": {
        "<25% on data": 1.0, "25-50%": 0.75, "50-75%": 0.4, ">75% on data": 0.1,
    },
    "c1_specialization": {
        "Deep specialist": 1.0, "Deep specialist in this TA/methodology": 1.0,
        "Adjacent expertise": 0.5, "Generalist": 0.0,
    },
    "c2_directness": {
        "Expert authored": 1.0, "Expert authored (with AI assist)": 1.0,
        "Expert co-authored": 0.5, "Expert co-authored (shared with team)": 0.5,
        "Expert reviewed only": 0.0,
    },
    "c3_judgment_pct": {
        ">75% judgment": 1.0, "50-75%": 0.75, "25-50%": 0.5, "<25%": 0.25,
    },
    "c6_self_assessment": {
        "Significantly better": 1.0, "Somewhat better": 0.7, "Comparable": 0.4, "Somewhat worse": 0.1,
    },
    "c7_analytical_depth": {
        "Exceptional": 1.0, "Strong": 0.75, "Adequate": 0.4, "Superficial": 0.1,
    },
    "c8_decision_readiness": {
        "Yes without caveats": 1.0, "Yes with minor caveats": 0.7, "Needs significant additional work": 0.2,
    },
    "d1_proprietary_data": {"Yes": 1.0, "No": 0.0},
    "d2_knowledge_reuse": {
        "Yes directly reused and extended": 1.0, "Yes, directly reused and extended": 1.0,
        "Yes provided useful starting context": 0.5, "Yes, provided useful starting context": 0.5,
        "No built from scratch": 0.0, "No, built from scratch": 0.0,
    },
    "d3_moat_test": {
        "No \u2014 proprietary inputs decisive": 1.0,
        "Partially \u2014 they would miss key insights": 0.5,
        "Yes \u2014 all inputs publicly available": 0.0,
    },
    "e1_client_decision": {
        "Yes \u2014 informed a specific decision": 1.0,
        "Yes \u2014 referenced in internal discussions": 0.6,
        "Too early to tell": None,
        "No": 0.1,
    },
    "f1_feasibility": {
        "Not feasible": 1.0, "Feasible but at 2x+ the cost and time": 0.7,
        "Feasible at similar cost": 0.3, "Legacy would have been more effective": 0.0,
    },
    "f2_productization": {
        "Yes largely as-is": 1.0, "Yes with moderate customization": 0.5, "No fully bespoke": 0.0,
    },
    "g1_reuse_intent": {
        "Yes without hesitation": 1.0, "Yes with reservations": 0.5,
        "No \u2014 legacy would have been better": 0.0,
        "No \u2014 legacy would have been worse": 0.0,
    },
    "client_pulse": {
        "Exceeded expectations": 1.0, "Met expectations": 0.6, "Below expectations": 0.1,
    },
    "revision_depth": {
        "No revisions needed": 1.0, "Cosmetic only": 0.85, "Moderate rework": 0.55, "Major rework": 0.2,
    },
    "scope_expansion": {
        "Yes expanded scope": 1.0, "Yes new engagement": 1.0, "Yes": 1.0, "No": 0.0,
    },
}

# ── Expert survey field definitions ─────────────────────────────────────────
# Canonical list. Every field used in the survey is defined here once.
# `has_legacy` is historical; `legacy_pair` links xCSG field to its L-section counterpart.

EXPERT_FIELDS = {
    # Section B — Machine-First Operations
    "b1_starting_point":    {"label": "Starting point: Did you build from an AI draft or blank page?", "section": "B", "options": ["From AI draft", "Mixed", "From blank page"]},
    "b2_research_sources":  {"label": "How many distinct sources were synthesized?", "section": "B", "options": ["1-3", "4-7", "8-12", "13+"]},
    "b3_assembly_ratio":    {"label": "What % of the final deliverable was AI-assembled vs manual?", "section": "B", "options": [">75% AI", "50-75%", "25-50%", "<25%"]},
    "b4_hypothesis_first":  {"label": "Was the approach hypothesis-led or discovery-first?", "section": "B", "options": ["Hypothesis-first", "Hybrid", "Discovery-first"]},
    "b5_ai_survival":       {"label": "What % of the AI draft survived into the final deliverable?", "section": "B", "options": [">75%", "50-75%", "25-50%", "<25%", "Did not use AI draft"]},
    "b6_data_analysis_split": {"label": "What % of effort went to data sourcing vs analysis/insight?", "section": "B", "options": ["<25% on data", "25-50%", "50-75%", ">75% on data"]},
    # Section C — Senior-Led Operations
    "c1_specialization":    {"label": "What level of domain expertise led this deliverable?", "section": "C", "options": ["Deep specialist", "Adjacent expertise", "Generalist"]},
    "c2_directness":        {"label": "How directly was the senior expert involved?", "section": "C", "options": ["Expert authored", "Expert co-authored", "Expert reviewed only"]},
    "c3_judgment_pct":      {"label": "What % of the final content reflects expert judgment vs data compilation?", "section": "C", "options": [">75% judgment", "50-75%", "25-50%", "<25%"]},
    "c6_self_assessment":   {"label": "How does xCSG output quality compare to traditional?", "section": "C", "options": ["Significantly better", "Somewhat better", "Comparable", "Somewhat worse"]},
    "c7_analytical_depth":  {"label": "Rate the analytical depth of the deliverable.", "section": "C", "options": ["Exceptional", "Strong", "Adequate", "Superficial"]},
    "c8_decision_readiness": {"label": "Was the deliverable decision-ready for the client?", "section": "C", "options": ["Yes without caveats", "Yes with minor caveats", "Needs significant additional work"]},
    # Section D — Proprietary Knowledge
    "d1_proprietary_data":  {"label": "Did this deliverable use proprietary data or datasets?", "section": "D", "options": ["Yes", "No"]},
    "d2_knowledge_reuse":   {"label": "Did you reuse knowledge, templates, or data assets from prior engagements?", "section": "D", "options": ["Yes directly reused and extended", "Yes provided useful starting context", "No built from scratch"]},
    "d3_moat_test":         {"label": "Could a competitor with public data replicate this deliverable?", "section": "D", "options": ["No \u2014 proprietary inputs decisive", "Partially \u2014 they would miss key insights", "Yes \u2014 all inputs publicly available"]},
    # Section E — Client Impact
    "e1_client_decision":   {"label": "Did the deliverable directly inform a client decision?", "section": "E", "options": ["Yes \u2014 informed a specific decision", "Yes \u2014 referenced in internal discussions", "Too early to tell", "No"]},
    # Section F — Value Creation
    "f1_feasibility":       {"label": "Could this deliverable have been produced without the xCSG approach?", "section": "F", "options": ["Not feasible", "Feasible but at 2x+ the cost and time", "Feasible at similar cost", "Legacy would have been more effective"]},
    "f2_productization":    {"label": "Could this deliverable be reused or productized for similar future engagements?", "section": "F", "options": ["Yes largely as-is", "Yes with moderate customization", "No fully bespoke"]},
    # Section G — Honest Signal
    "g1_reuse_intent":      {"label": "For this type of deliverable, would you choose the xCSG approach again over traditional methods?", "section": "G", "options": ["Yes without hesitation", "Yes with reservations", "No \u2014 legacy would have been better"]},
    # Section L — Legacy Estimates
    "l1_legacy_working_days":     {"label": "How many working days would this deliverable have taken using traditional methods?", "section": "L", "type": "integer"},
    "l2_legacy_team_size":        {"label": "What team size would traditional delivery have required?", "section": "L", "options": ["1", "2", "3", "4+"]},
    "l3_legacy_revision_depth":   {"label": "What level of rework would traditional delivery have needed?", "section": "L", "options": ["No revisions needed", "Cosmetic only", "Moderate rework", "Major rework"]},
    "l4_legacy_scope_expansion":  {"label": "Would the scope have expanded under traditional delivery?", "section": "L", "options": ["Yes", "No"]},
    "l5_legacy_client_reaction":  {"label": "How would the client have reacted to traditional delivery?", "section": "L", "options": ["Exceeded expectations", "Met expectations", "Below expectations"]},
    "l6_legacy_b2_sources":       {"label": "How many research sources would traditional delivery have used?", "section": "L", "options": ["1-3", "4-7", "8-12", "13+"]},
    "l7_legacy_c1_specialization": {"label": "What specialization level would traditional delivery have had?", "section": "L", "options": ["Deep specialist", "Adjacent expertise", "Generalist"]},
    "l8_legacy_c2_directness":    {"label": "How directly would the senior expert have been involved in traditional delivery?", "section": "L", "options": ["Expert authored", "Expert co-authored", "Expert reviewed only"]},
    "l9_legacy_c3_judgment":      {"label": "What % of traditional output would reflect expert judgment?", "section": "L", "options": [">75% judgment", "50-75%", "25-50%", "<25%"]},
    "l10_legacy_d1_proprietary":  {"label": "Would proprietary data have been used in traditional delivery?", "section": "L", "options": ["Yes", "No"]},
    "l11_legacy_d2_reuse":        {"label": "Would prior knowledge assets have been reused in traditional delivery?", "section": "L", "options": ["Yes directly reused and extended", "Yes provided useful starting context", "No built from scratch"]},
    "l12_legacy_d3_moat":         {"label": "Could a competitor replicate the traditional version?", "section": "L", "options": ["No \u2014 proprietary inputs decisive", "Partially \u2014 they would miss key insights", "Yes \u2014 all inputs publicly available"]},
    "l13_legacy_c7_depth":        {"label": "Rate the analytical depth of traditional delivery.", "section": "L", "options": ["Exceptional", "Strong", "Adequate", "Superficial"]},
    "l14_legacy_c8_decision":     {"label": "Would a traditionally-produced version have been decision-ready?", "section": "L", "options": ["Yes without caveats", "Yes with minor caveats", "Needs significant additional work"]},
    "l15_legacy_e1_decision":     {"label": "Would a traditional deliverable have led to the same client decision?", "section": "L", "options": ["Yes \u2014 informed a specific decision", "Yes \u2014 referenced in internal discussions", "Too early to tell", "No"]},
    "l16_legacy_b6_data":         {"label": "What % of time would traditional delivery spend on data sourcing?", "section": "L", "options": ["<25% on data", "25-50%", "50-75%", ">75% on data"]},
}

# ── Metric definitions (for KPI tiles, chart tooltips, norms headers) ───────

METRICS = {
    "delivery_speed":           {"label": "Delivery Speed", "format": "ratio", "icon": "\u26A1", "tip": "Legacy person-days \u00F7 xCSG person-days. Above 1\u00D7 means xCSG delivered faster."},
    "output_quality":           {"label": "Output Quality", "format": "ratio", "icon": "\u2B50", "tip": "xCSG quality score \u00F7 legacy quality score. Above 1\u00D7 means xCSG output scored higher."},
    "rework_efficiency":        {"label": "Rework Efficiency", "format": "ratio", "icon": "\U0001F527", "tip": "xCSG smoothness \u00F7 legacy smoothness. Higher means fewer rework cycles with xCSG."},
    "machine_first_score":      {"label": "Machine-First Gain", "format": "ratio", "icon": "\U0001F916", "tip": "xCSG research breadth \u00F7 legacy research breadth. Measures automation leverage."},
    "senior_led_score":         {"label": "Senior-Led Gain", "format": "ratio", "icon": "\U0001F454", "tip": "Average of specialization, directness, and judgment ratios vs legacy. Higher means more expert judgment applied."},
    "proprietary_knowledge_score": {"label": "Knowledge Gain", "format": "ratio", "icon": "\U0001F3F0", "tip": "Average of proprietary data, reuse, and moat ratios vs legacy. Measures competitive moat."},
    "client_impact":            {"label": "Client Impact", "format": "ratio", "icon": "\U0001F4A5", "tip": "xCSG client decision impact \u00F7 legacy. 1\u00D7 = same impact, higher = xCSG drove more decisions."},
    "data_independence":        {"label": "Data Independence", "format": "ratio", "icon": "\U0001F4CA", "tip": "xCSG data efficiency \u00F7 legacy. Higher means more proprietary insight, less time on data sourcing."},
    "reuse_intent_avg":         {"label": "Reuse Intent", "format": "pct", "icon": "\U0001F504", "tip": "Would experts choose the xCSG approach again? 100% = all said yes without hesitation."},
    "ai_survival_avg":          {"label": "AI Survival", "format": "pct", "icon": "\U0001F30D", "tip": "How much of the AI-generated draft survived into the final deliverable. Higher = better initial quality."},
    "client_pulse_avg":         {"label": "Client Pulse", "format": "pct", "icon": "\u2764", "tip": "Client satisfaction score. 100% = all clients exceeded expectations."},
}

# ── Norms column definitions ────────────────────────────────────────────────

NORMS_COLUMNS = [
    {"key": "avg_effort_ratio", "label": "Avg Speed (xCSG/Legacy)", "format": "ratio", "tip": "Average delivery speed ratio across completed projects. >1\u00D7 means xCSG is faster."},
    {"key": "avg_quality_ratio", "label": "Avg Quality (xCSG/Legacy)", "format": "ratio", "tip": "Average output quality ratio. >1\u00D7 means xCSG output is higher quality."},
    {"key": "avg_advantage", "label": "Avg Advantage", "format": "ratio", "tip": "Speed \u00D7 Quality. The composite xCSG advantage ratio."},
    {"key": "completed_surveys", "label": "Completed Surveys", "format": "int", "tip": "Number of expert questionnaires submitted for this category."},
    {"key": "total_projects", "label": "Total Projects", "format": "int", "tip": "All projects (including pending) in this category."},
]

# ── Helper: build the /api/schema response ──────────────────────────────────

def build_schema_response() -> dict:
    """Returns the full schema for the frontend to consume."""
    return {
        "sections": SECTIONS,
        "fields": {
            key: {
                **defn,
                "scores": SCORES.get(key, {}),
            }
            for key, defn in EXPERT_FIELDS.items()
        },
        "metrics": METRICS,
        "norms_columns": NORMS_COLUMNS,
    }
```

- [ ] **Step 2: Verify the module imports cleanly**

Run: `python3 -c "from backend.schema import build_schema_response; print('OK:', len(build_schema_response()['fields']), 'fields')"`
Expected: `OK: 35 fields`

- [ ] **Step 3: Commit**

```bash
git add backend/schema.py
git commit -m "feat: create schema.py as single source of truth for all field/metric definitions"
```

---

### Task 2: Wire backend to use schema.py

**Files:**
- Modify: `backend/app.py` (replace EXPERT_FIELD_OPTIONS with import from schema, add /api/schema endpoint)
- Modify: `backend/metrics.py` (import scoring dicts from schema instead of defining locally)

- [ ] **Step 1: Add `/api/schema` endpoint in `app.py`**

Replace the `EXPERT_FIELD_OPTIONS` dict (lines 42-78) with an import and add the endpoint:

```python
# At top of app.py, add:
from backend.schema import EXPERT_FIELDS, SECTIONS, SCORES, build_schema_response

# Replace the EXPERT_FIELD_OPTIONS dict with:
EXPERT_FIELD_OPTIONS = {
    key: {
        "key": key,
        "label": defn["label"],
        "section": defn["section"],
        "options": defn.get("options", []),
        "type": defn.get("type", "categorical"),
        "has_legacy": False,
    }
    for key, defn in EXPERT_FIELDS.items()
}

# Add new endpoint (near the other GET endpoints):
@app.get("/api/schema")
async def get_schema():
    return build_schema_response()
```

- [ ] **Step 2: Update `metrics.py` to import from schema**

At the top of `metrics.py`, replace all the local `*_SCORES` dicts and `OPTION_SCORES` with imports:

```python
from backend.schema import SCORES

# Replace individual dicts with references:
TEAM_MIDPOINTS = {"1": 1.0, "2": 2.0, "3": 3.0, "4+": 5.0}  # keep this, it's a different mapping

REVISION_DEPTH_SCORES = SCORES["revision_depth"]
SCOPE_EXPANSION_SCORES = SCORES["scope_expansion"]
SELF_ASSESSMENT_SCORES = SCORES["c6_self_assessment"]
CLIENT_PULSE_SCORES = SCORES["client_pulse"]
B6_DATA_ANALYSIS_SCORES = SCORES["b6_data_analysis_split"]
C7_ANALYTICAL_DEPTH_SCORES = SCORES["c7_analytical_depth"]
C8_DECISION_READINESS_SCORES = SCORES["c8_decision_readiness"]
E1_CLIENT_DECISION_SCORES = SCORES["e1_client_decision"]

OPTION_SCORES = {key: SCORES[key] for key in [
    "b2_research_sources", "c1_specialization", "c2_directness", "c3_judgment_pct",
    "d1_proprietary_data", "d2_knowledge_reuse", "d3_moat_test",
    "b5_ai_survival", "g1_reuse_intent",
]}
```

- [ ] **Step 3: Verify backend still works**

Run: `python3 -c "from backend.metrics import compute_project_metrics; print('metrics OK')"` and `curl -s http://localhost:8765/api/schema | python3 -c "import sys,json; d=json.load(sys.stdin); print(len(d['fields']), 'fields,', len(d['metrics']), 'metrics')"`
Expected: `35 fields, 11 metrics`

- [ ] **Step 4: Commit**

```bash
git add backend/app.py backend/metrics.py
git commit -m "refactor: wire app.py and metrics.py to import from schema.py"
```

---

### Task 3: Fix norms — use quality ratio, fix labels, rename assessments

**Files:**
- Modify: `backend/database.py` (list_norm_aggregates: add avg_quality_ratio, rename completed_projects -> completed_surveys)
- Modify: `frontend/app.js` (buildNormsAggregatesTable: update column headers and keys)

- [ ] **Step 1: Update `list_norm_aggregates` in `database.py`**

Change the return dict to include `avg_quality_ratio` (the ratio, not raw score) and rename `completed_projects` to `completed_surveys`:

```python
rows.append({
    "category_id": group["category_id"],
    "category_name": cat_name,
    "completed_surveys": len(items),
    "total_projects": total_by_cat.get(cat_name, len(items)),
    "avg_effort_ratio": avg([m["delivery_speed"] for m in metrics_list]),
    "avg_quality_ratio": avg([m["output_quality"] for m in metrics_list]),
    "avg_advantage": avg([m["xcsg_advantage"] for m in metrics_list]),
})
```

- [ ] **Step 2: Update `buildNormsAggregatesTable` in `app.js`**

Update the table headers and data keys to match. Replace old headers:

```
<th>Category</th>
<th>Avg Speed (xCSG/Legacy)</th>
<th>Avg Quality (xCSG/Legacy)</th>
<th>Avg Advantage</th>
<th>Completed Surveys</th>
<th>Total Projects</th>
```

Update the row rendering to use `row.avg_quality_ratio` instead of `row.avg_quality_score`, `row.avg_advantage` instead of `row.avg_outcome_rate_ratio`, and `row.completed_surveys` instead of `row.completed_projects`. Use `n = row.completed_surveys` for the count check.

- [ ] **Step 3: Verify norms tab renders correctly**

Start server, login, navigate to `#norms`. Verify table headers say "Avg Speed (xCSG/Legacy)", column values are ratios (>1x = good), and the count column says "Completed Surveys".

- [ ] **Step 4: Commit**

```bash
git add backend/database.py frontend/app.js
git commit -m "fix: norms table uses quality ratio, clearer labels, rename assessments to completed surveys"
```

---

### Task 4: Frontend reads schema from API — remove hardcoded ASSESSMENT_FIELDS

**Files:**
- Modify: `frontend/app.js` (load schema at startup, replace ASSESSMENT_FIELDS/EXPERT_SECTIONS with schema-driven data, remove hardcoded scoring maps)

- [ ] **Step 1: Add schema loading to app startup**

Add a global `schema` variable and load it alongside categories:

```javascript
let schema = null;

async function loadSchema() {
  if (!schema) {
    try {
      const resp = await fetch(API + '/schema');
      if (resp.ok) schema = await resp.json();
    } catch { /* fallback to hardcoded if needed */ }
  }
}
```

Call `loadSchema()` in the `route()` function right after `loadCategories()`, and also call it in `renderExpert()` before building the form.

- [ ] **Step 2: Build ASSESSMENT_FIELDS from schema**

Replace the hardcoded `ASSESSMENT_FIELDS` const with a function that builds it from the schema:

```javascript
function getAssessmentFields() {
  if (!schema) return []; // fallback: empty until schema loads
  const sectionOrder = ['B', 'C', 'D', 'E', 'F', 'G'];
  return sectionOrder.map(sec => {
    const secMeta = schema.sections[sec];
    if (!secMeta) return null;
    const fields = Object.entries(schema.fields)
      .filter(([_, f]) => f.section === sec && !f.key?.startsWith('l'))
      .map(([key, f]) => ({
        id: key.split('_')[0].toUpperCase(),
        key: key,
        label: f.label,
        scores: f.scores || {},
      }));
    if (!fields.length) return null;
    return { section: sec, title: secMeta.title, icon: secMeta.icon, desc: secMeta.desc, fields };
  }).filter(Boolean);
}
```

Update `renderExpertAssessment()` to call `getAssessmentFields()` instead of referencing the const.

- [ ] **Step 3: Replace hardcoded KPI tile definitions**

In the `_renderDashboardView` function, build KPI tiles from `schema.metrics` instead of the hardcoded array. The `tip` (tooltip) comes directly from the schema.

```javascript
// In _renderDashboardView, replace the hardcoded kpis array:
const ratioMetrics = ['delivery_speed', 'output_quality', 'rework_efficiency',
  'machine_first_score', 'senior_led_score', 'proprietary_knowledge_score',
  'client_impact', 'data_independence'];
const pctMetrics = ['reuse_intent_avg', 'ai_survival_avg', 'client_pulse_avg'];

const kpis = ratioMetrics.map(key => {
  const m = schema?.metrics?.[key] || {};
  return { label: m.label || key, value: localMetrics[key.replace('_score', '_avg')], fmt: fmtRatio, icon: m.icon || '', tip: m.tip || '' };
});
// ... similar for signals
```

Note: The exact mapping of metric keys to dashboard response keys needs care — `machine_first_score` in the schema maps to `machine_first_avg` in the dashboard response. Keep the existing `localMetrics.*_avg` field references but use schema for labels/tips.

- [ ] **Step 4: Replace hardcoded EXPERT_SECTIONS**

Replace `const EXPERT_SECTIONS = {...}` with:

```javascript
function getExpertSections() {
  return schema?.sections || {};
}
```

Update `renderExpert()` to use `getExpertSections()` instead of `EXPERT_SECTIONS`.

- [ ] **Step 5: Remove the old hardcoded ASSESSMENT_FIELDS and EXPERT_SECTIONS consts**

Delete the `const ASSESSMENT_FIELDS = [...]` block (lines 30-49) and `const EXPERT_SECTIONS = {...}` block (lines 1163-1171).

- [ ] **Step 6: Verify no hardcoded scoring maps remain in JS**

Run: `grep -n "scores:" frontend/app.js` — should only find references inside functions that read from schema, not hardcoded objects.

- [ ] **Step 7: Commit**

```bash
git add frontend/app.js
git commit -m "refactor: frontend reads field/metric definitions from /api/schema, no hardcoded scoring maps"
```

---

### Task 5: Fix missing assessment sections in project detail view

**Files:**
- Modify: `frontend/app.js` (renderExpertAssessment now shows all sections B-G using schema-driven getAssessmentFields)

This task is largely solved by Task 4 — once `getAssessmentFields()` returns sections B through G from the schema, `renderExpertAssessment` will display them all. But verify:

- [ ] **Step 1: Verify renderExpertAssessment uses getAssessmentFields()**

The function iterates `ASSESSMENT_FIELDS` (now `getAssessmentFields()`). Confirm it renders sections E, F, G with proper scoring. Check that `e1_client_decision`, `f1_feasibility`, `f2_productization`, `g1_reuse_intent` all have score mappings in the schema so the progress bars render.

- [ ] **Step 2: Verify in browser**

Navigate to `#edit/1`, scroll down to Expert Assessment. Verify all sections B, C, D, E, F, G are visible with field answers and score bars.

- [ ] **Step 3: Commit (if any additional fixes needed)**

```bash
git add frontend/app.js
git commit -m "fix: expert assessment in project detail shows all sections B-G"
```

---

### Task 6: Run full E2E test suite

**Files:**
- Run: `tests/e2e-full.spec.ts` and `tests/e2e-realistic.spec.ts`

- [ ] **Step 1: Run the original E2E test**

```bash
rm -f data/tracker.db && npx playwright test tests/e2e-full.spec.ts --headed --timeout 600000
```

Expected: 7/7 pass

- [ ] **Step 2: Run the realistic 20-project test**

```bash
rm -f data/tracker.db && npx playwright test tests/e2e-realistic.spec.ts --headed --timeout 600000
```

Expected: 11/11 pass. Norms table should show ratio columns. Project detail should show all assessment sections.

- [ ] **Step 3: Fix any test assertions that reference old norms keys**

The realistic test checks `row.avg_effort_ratio` (unchanged), `row.avg_quality_score` (now `avg_quality_ratio`), `row.avg_outcome_rate_ratio` (now `avg_advantage`), `row.completed_projects` (now `completed_surveys`). Update the test assertions.

- [ ] **Step 4: Commit test fixes**

```bash
git add tests/
git commit -m "test: update assertions for new norms column names"
```
