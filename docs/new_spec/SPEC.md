# xCSG Value Measurement Tracker V2 — Build Specification

**CONFIDENTIAL** — Alira Health xCSG Initiative

Build a polished, production-quality web application for tracking and analyzing consulting deliverable performance. The app compares xCSG (AI-augmented) delivery against legacy operations using a structured survey framework. See `FRAMEWORK.md` for the measurement methodology and rationale.

**V2 key changes**: Working days replaces calendar days for effort, per-project legacy estimates replace static norms table, revision depth replaces revision count, quality composite (multi-signal) replaces quality ratio, Outcome Rate + Revenue Productivity replace Value Multiplier, project categories for aggregation, expert form expanded to 27 answers, three-tier administration.

---

## Architecture

**Stack**: FastAPI (Python) + SQLite + vanilla HTML/JS/CSS. No React, no framework fingerprints.

```
xCSG_Value_Tracker/
├── backend/
│   ├── __init__.py
│   ├── app.py          # FastAPI routes + static file serving
│   ├── auth.py         # JWT (PyJWT) + PBKDF2 password hashing
│   ├── database.py     # SQLite CRUD, schema, seed data
│   ├── metrics.py      # All metric computations
│   └── models.py       # Pydantic request/response models
├── frontend/
│   ├── index.html      # Single-page app shell
│   ├── app.js          # SPA logic, routing, charts
│   └── styles.css      # Alira Health brand system
├── requirements.txt
├── launch.sh           # One-command startup (macOS + Linux)
├── Dockerfile
└── docker-compose.yml
```

**Run**: `python -m uvicorn backend.app:app --host 0.0.0.0 --port 8765` from project root.

**Frontend served by FastAPI**: Mount `StaticFiles(directory=frontend_dir, html=True)` at `/` as the LAST route (catch-all). All API routes at `/api/*`.

---

## Brand System

Alira Health brand. Apply consistently across every UI surface.

### Colors
| Token | Hex | Usage |
|-------|-----|-------|
| Navy | `#121F6B` | Sidebar bg, headings, table headers, primary buttons |
| Navy Dark | `#0C1550` | Sidebar hover states |
| Navy Light | `#1A2D8A` | Active nav highlight |
| Blue | `#6EC1E4` | Accent bar in login card, chart color 1, active badges |
| Blue Light | `#A8DDF0` | Secondary chart color |
| Blue Pale | `#E8F5FC` | Hover row highlights, info backgrounds |
| Orange | `#FF8300` | Accent sparingly — KPI card accents, chart color 3, warning badges |
| Orange Light | `#FFB366` | Lighter chart accent |
| Gray 50–800 | Standard Tailwind-like gray scale | Backgrounds, borders, text |
| Success | `#10B981` | Pass badges, positive indicators |
| Warning | `#F59E0B` | Pending badges |
| Error | `#EF4444` | Error toasts, fail badges, red flag indicators |

### Typography
- **Font**: `'Roboto', sans-serif` (load from Google Fonts)
- Weights: 300 (light), 400 (regular), 500 (medium), 700 (bold)
- Body text: 14px, line-height 1.5
- Headings: Roboto 700, Navy color

### Component Styling
- **Sidebar**: 240px wide, Navy background, white text. Logo = three colored bars (Blue, Navy, Orange) + "Alira" in white.
- **Nav items**: padding 12px 24px, hover = Navy Dark bg, active = Navy Light bg + left blue accent bar (3px).
- **Buttons**: Primary = Navy bg, white text, 8px radius, 500 weight. Secondary = white bg, navy border/text. Both 12px 24px padding, subtle shadow on hover.
- **Cards**: White bg, 1px gray-200 border, 12px radius, 24px padding, subtle shadow.
- **Form inputs**: 12px padding, gray-200 border, 8px radius, blue border on focus.
- **Tables**: Navy header (white bold text), alternating blue-pale/white rows, gray-300 borders, full width.
- **KPI cards**: 4-column grid, colored left accent bar (4px). Navy default, Blue secondary, Orange tertiary, Green quaternary.
- **Toasts**: Fixed bottom-right, slide in. Green success, red error.
- **Modal**: Dark overlay, centered white card, 16px radius.
- **Red flag indicator**: When AI Survival Rate is low but Machine-First score is high, show a small red warning icon next to the Machine-First gauge.

### UI Quality Standards
- **Every form must have a visible submit button** with clear visual weight
- Two-column form rows where logical (name+email, start+end date)
- Consistent 24px spacing between sections
- Empty states centered with gray text
- Loading states on API calls (button disabled + "Saving..." text)
- Fieldsets with styled legends (navy bottom border, uppercase)

---

## Authentication

### Backend (auth.py)
- **Password hashing**: PBKDF2 with SHA-256, 100K iterations, random 32-byte hex salt. Format: `{salt}${hash_hex}`.
- **JWT tokens**: HS256, configurable secret (env `SECRET_KEY`), 8-hour expiry. Payload: `{sub: user_id, username, role, iat, exp}`.
- **Dependencies**: `get_current_user` (any), `get_current_user_admin` (admin), `get_current_user_analyst` (admin or analyst).

### Seed Users
| Username | Password | Role |
|----------|----------|------|
| `admin` | `AliraAdmin2026!` | admin |
| `pmo` | `AliraPMO2026!` | analyst |

**Critical**: `seed_data()` must verify seed user passwords on every startup. Re-hash if stale.

### Frontend Auth
- Token in `window.__app_token` (NOT localStorage)
- `apiCall()` adds `Authorization: Bearer {token}`
- Auto-logout on 401

---

## Database Schema (SQLite, WAL mode, foreign keys ON)

### users
```sql
CREATE TABLE users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT DEFAULT 'viewer',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### deliverables (Tier 1 — PMO data)
```sql
CREATE TABLE deliverables (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    created_by INTEGER NOT NULL,
    pioneer_name TEXT NOT NULL,
    pioneer_email TEXT,
    deliverable_type TEXT NOT NULL,
    project_category TEXT,                -- V2: admin-managed category for aggregation
    engagement_stage TEXT NOT NULL,
    client_name TEXT,
    client_contact_email TEXT,
    description TEXT,
    date_started TEXT NOT NULL,
    date_delivered TEXT NOT NULL,
    xcsg_working_days INTEGER NOT NULL,   -- V2: actual working days on this deliverable
    xcsg_team_size TEXT NOT NULL,
    xcsg_revision_depth TEXT NOT NULL,    -- V2: replaces revision_rounds
    scope_expansion TEXT,
    engagement_revenue REAL,              -- V2: revenue allocated to this deliverable
    client_pulse TEXT,
    expert_token TEXT UNIQUE NOT NULL,
    expert_completed BOOLEAN DEFAULT 0,
    status TEXT DEFAULT 'expert_pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (created_by) REFERENCES users(id)
);
```

**V2 changes**: Replaced `xcsg_revision_rounds` with `xcsg_revision_depth` (options: "No revisions needed", "Cosmetic only", "Moderate rework", "Major rework"). Added `xcsg_working_days` (integer, actual working days team spent). Added `engagement_revenue` (optional, revenue allocated to deliverable). Added `project_category` (admin-managed). Removed legacy estimate fields from Tier 1 (moved to expert responses).

### expert_responses (Tier 2 — Expert judgment)
```sql
CREATE TABLE expert_responses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    deliverable_id INTEGER UNIQUE NOT NULL,
    -- xCSG assessment (15 questions)
    b1_starting_point TEXT NOT NULL,
    b2_research_sources TEXT NOT NULL,
    b3_assembly_ratio TEXT NOT NULL,
    b4_hypothesis_first TEXT NOT NULL,
    b5_ai_survival TEXT NOT NULL,
    c1_specialization TEXT NOT NULL,
    c2_directness TEXT NOT NULL,
    c3_judgment_pct TEXT NOT NULL,
    c6_self_assessment TEXT NOT NULL,     -- V2: expert self-assessment vs best traditional work
    d1_proprietary_data TEXT NOT NULL,
    d2_knowledge_reuse TEXT NOT NULL,
    d3_moat_test TEXT NOT NULL,
    f1_feasibility TEXT NOT NULL,
    f2_productization TEXT NOT NULL,
    g1_reuse_intent TEXT NOT NULL,
    -- Paired legacy estimates (12 fields)
    legacy_working_days INTEGER NOT NULL,      -- V2: expert estimate for this specific deliverable
    legacy_team_size TEXT NOT NULL,             -- V2: expert estimate
    legacy_revision_depth TEXT NOT NULL,        -- V2: expert estimate
    legacy_scope_expansion TEXT NOT NULL,       -- V2: expert estimate (Yes/No)
    legacy_client_reaction TEXT NOT NULL,       -- V2: expert estimate (Exceeded/Met/Below)
    legacy_b2_research_sources TEXT NOT NULL,   -- V2: paired legacy estimate
    legacy_c1_specialization TEXT NOT NULL,
    legacy_c2_directness TEXT NOT NULL,
    legacy_c3_judgment_pct TEXT NOT NULL,
    legacy_d1_proprietary_data TEXT NOT NULL,
    legacy_d2_knowledge_reuse TEXT NOT NULL,
    legacy_d3_moat_test TEXT NOT NULL,
    completed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (deliverable_id) REFERENCES deliverables(id) ON DELETE CASCADE
);
```

**V2 changes**: Added `c6_self_assessment` (expert self-assessment). Added 12 paired legacy estimate fields moving all legacy data to expert responses (away from Tier 1).

### project_categories (NEW)
```sql
CREATE TABLE project_categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL,
    description TEXT,
    created_by INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (created_by) REFERENCES users(id)
);
```

### category_norms (COMPUTED — auto-aggregated, no seed data)
```sql
CREATE TABLE category_norms (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    category_id INTEGER NOT NULL,
    avg_legacy_working_days REAL,           -- mean of all L1 answers in category
    avg_legacy_team_size REAL,              -- mean of all L2 answers in category
    modal_legacy_revision_depth TEXT,       -- most frequent L3 answer in category
    sample_count INTEGER DEFAULT 0,         -- completed deliverables feeding the average
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (category_id) REFERENCES project_categories(id)
);
```

**Not seeded.** Table starts empty. Auto-populated after each expert submission by recalculating the running averages for the deliverable's project category. Outlier flag activates only when `sample_count >= 3`.

### activity_log (unchanged)
```sql
CREATE TABLE activity_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    action TEXT NOT NULL,
    deliverable_id INTEGER,
    details TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (deliverable_id) REFERENCES deliverables(id)
);
```

### Seed Data — Project Categories

| # | Name |
|---|------|
| 1 | CDD |
| 2 | Strategic Planning |
| 3 | Portfolio Management & Opportunity Assessment |
| 4 | Pricing & Reimbursement |
| 5 | Market Access Strategy |
| 6 | New Product Strategy |
| 7 | Strategic Surveillance & Competitive Intelligence |
| 8 | Evidence Generation & HEOR |
| 9 | Transaction Advisory |
| 10 | Market Research |
| 11 | Regulatory Strategy |

**No legacy norms seed data.** Category norms are computed from expert submissions. Table starts empty.

---

## API Endpoints

### Auth
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/auth/login` | None | Login, returns JWT + user info |
| POST | `/api/auth/register` | Admin | Create new user |

### Deliverables (Tier 1 + Tier 3)
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/deliverables` | Any | List with pagination + status filter |
| POST | `/api/deliverables` | Any | Create new deliverable |
| GET | `/api/deliverables/{id}` | Any | Get single deliverable |
| PUT | `/api/deliverables/{id}` | Any | Update Tier 1 fields (includes client_pulse for Tier 3) |
| DELETE | `/api/deliverables/{id}` | Admin | Delete deliverable |

### Project Categories
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/categories` | Any | List all categories |
| POST | `/api/categories` | Admin | Create category |
| PUT | `/api/categories/{id}` | Admin | Update category |
| DELETE | `/api/categories/{id}` | Admin | Delete category |

### Expert Self-Service (NO auth — token-based)
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/expert/{token}` | None | Get deliverable context |
| POST | `/api/expert/{token}` | None | Submit expert assessment (Tier 2, now 27 answers) |

### Category Norms (computed, read-only)
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/category-norms` | Any | All category averages (auto-computed from expert submissions) |
| GET | `/api/category-norms/{category_id}` | Any | Single category averages + sample count |

### Metrics (Dashboard)
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/metrics/summary` | Any | Aggregate summary (V2: includes reuse_intent_rate) |
| GET | `/api/metrics/deliverables` | Any | Per-deliverable metrics (V2: includes ai_survival_rate) |
| GET | `/api/metrics/trends` | Any | Trend data (V2: includes adoption_health_trend) |
| GET | `/api/metrics/scaling-gates` | Any | Scaling gates (V2: 7 gates) |

### Other
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/activity` | Any | Activity log |
| GET | `/api/export/excel` | Any | Export to XLSX |
| GET | `/api/export/file/{name}` | Any | Download export |
| GET | `/api/health` | None | Health check |

### Login Response Shape
```json
{
    "access_token": "eyJ...",
    "token_type": "bearer",
    "expires_in": 28800,
    "user": { "id": 1, "username": "admin", "name": "Admin", "role": "admin" }
}
```

### Create Deliverable Request (V2)
```json
{
    "pioneer_name": "Bob Delise",
    "pioneer_email": "bob@alira.health",
    "deliverable_type": "CDD",
    "project_category": "CDD",
    "engagement_stage": "Active engagement",
    "client_name": "Apposite Capital",
    "client_contact_email": "john@apposite.com",
    "description": "Full commercial due diligence",
    "date_started": "2026-01-15",
    "date_delivered": "2026-02-01",
    "xcsg_working_days": 10,
    "xcsg_team_size": "2",
    "xcsg_revision_depth": "Cosmetic only",
    "scope_expansion": "Yes expanded scope",
    "engagement_revenue": 120000
}
```

**V2**: Changed `xcsg_revision_rounds` → `xcsg_revision_depth`. Added `xcsg_working_days` (integer). Removed legacy estimate fields from Tier 1. Added `project_category` and `engagement_revenue`.

### Expert Submit Request (V2 — 27 answers)
```json
{
    "b1_starting_point": "From AI draft",
    "b2_research_sources": "8-12",
    "b3_assembly_ratio": ">75% AI",
    "b4_hypothesis_first": "Hypothesis-first",
    "b5_ai_survival": "50-75%",
    "c1_specialization": "Deep specialist",
    "c2_directness": "Expert authored",
    "c3_judgment_pct": ">75% judgment",
    "c6_self_assessment": "Somewhat better",
    "d1_proprietary_data": "Yes",
    "d2_knowledge_reuse": "Yes directly reused and extended",
    "d3_moat_test": "No — proprietary inputs decisive",
    "f1_feasibility": "Not feasible",
    "f2_productization": "Yes largely as-is",
    "g1_reuse_intent": "Yes without hesitation",
    "legacy_working_days": 18,
    "legacy_team_size": "4",
    "legacy_revision_depth": "Moderate rework",
    "legacy_scope_expansion": "No",
    "legacy_client_reaction": "Met expectations",
    "legacy_b2_research_sources": "4-7",
    "legacy_c1_specialization": "Adjacent expertise",
    "legacy_c2_directness": "Expert reviewed only",
    "legacy_c3_judgment_pct": "25-50%",
    "legacy_d1_proprietary_data": "No",
    "legacy_d2_knowledge_reuse": "No built from scratch",
    "legacy_d3_moat_test": "Yes — all inputs publicly available"
}
```

**V2**: Added `c6_self_assessment`. Added 12 paired legacy estimate fields.

---

## Survey Questions — Complete Reference

### Deliverable Types (A1)
CDD, Competitive landscape, Financial model, Market access, Proposal, Call prep brief, Presentation, KOL mapping

### Engagement Stages (A2)
New business (pre-mandate), Active engagement, Post-engagement (follow-on)

### Tier 1 Fields (PMO)

| Field | Options |
|-------|---------|
| Deliverable Type | CDD, Competitive landscape, Financial model, Market access, Proposal, Call prep brief, Presentation, KOL mapping |
| Project Category | (dropdown from admin-managed list) |
| Engagement Stage | New business (pre-mandate), Active engagement, Post-engagement (follow-on) |
| Pioneer Name | Free text |
| Pioneer Email | Free text |
| Client Name | Free text |
| Client Contact Email | Free text, optional |
| Description | Free text |
| Date Started | Date picker (required) |
| Date Delivered | Date picker (required) |
| Working Days (xCSG) | Integer input — "How many working days did the team spend on this deliverable?" |
| Team Size (xCSG) | 1, 2, 3, 4+ |
| Revision Depth (xCSG) | No revisions needed, Cosmetic only, Moderate rework, Major rework |
| Scope Expansion | Yes expanded scope, Yes new engagement, No |
| Engagement Revenue | Currency input, optional |
| Client Pulse (G2, Tier 3) | Exceeded expectations, Met expectations, Below expectations, Not yet received |

### Tier 2 Fields (Expert — 27 answers)

**xCSG Assessment (15 questions, including C6 self-assessment and G1 reuse intent):**

| ID | Question | Options |
|----|----------|---------|
| B1 | Starting point | From AI draft, Mixed, From blank page |
| B2 | Research sources | 1-3, 4-7, 8-12, 13+ |
| B3 | Assembly ratio | >75% AI, 50-75%, 25-50%, <25% |
| B4 | Hypothesis approach | Hypothesis-first, Hybrid, Discovery-first |
| B5 | AI survival rate | >75%, 50-75%, 25-50%, <25%, Did not use AI draft |
| C1 | Specialization level | Deep specialist, Adjacent expertise, Generalist |
| C2 | Level of directness | Expert authored, Expert co-authored, Expert reviewed only |
| C3 | Judgment content % | >75% judgment, 50-75%, 25-50%, <25% |
| C6 | Expert self-assessment | Significantly better, Somewhat better, Comparable, Somewhat worse |
| D1 | Proprietary data used | Yes, No |
| D2 | Knowledge reuse | Yes directly reused and extended, Yes provided useful starting context, No built from scratch |
| D3 | Moat test | No — proprietary inputs decisive, Partially — they would miss key insights, Yes — all inputs publicly available |
| F1 | Legacy feasibility | Not feasible, Feasible but 2x+ cost, Feasible similar cost, Legacy more effective |
| F2 | Productization potential | Yes largely as-is, Yes with moderate customization, No fully bespoke |
| G1 | Reuse intent | Yes without hesitation, Yes with reservations, No — legacy would have been better |

**Paired Legacy Estimates (12 questions):**

| Field | Options |
|-------|---------|
| Legacy working days | Integer |
| Legacy team size | 1, 2, 3, 4+ |
| Legacy revision depth | No revisions needed, Cosmetic only, Moderate rework, Major rework |
| Legacy scope expansion | Yes, No |
| Legacy expected client reaction | Exceeded expectations, Met expectations, Below expectations |
| Legacy research sources (B2) | 1-3, 4-7, 8-12, 13+ |
| Legacy specialization (C1) | Deep specialist, Adjacent expertise, Generalist |
| Legacy directness (C2) | Expert authored, Expert co-authored, Expert reviewed only |
| Legacy judgment % (C3) | >75% judgment, 50-75%, 25-50%, <25% |
| Legacy proprietary data (D1) | Yes, No |
| Legacy knowledge reuse (D2) | Yes directly reused and extended, Yes provided useful starting context, No built from scratch |
| Legacy moat test (D3) | No — proprietary inputs decisive, Partially — they would miss key insights, Yes — all inputs publicly available |

**Helper text for legacy section**: "For each question below, estimate what would have been typical if this deliverable had been done using traditional methods, without AI assistance, for this specific project."

**IMPORTANT**: D3 and G1 options use em dashes (—). Ensure exact string match across HTML, backend, and JS. Never use apostrophes inside single-quoted JS strings.

---

## Metrics Computation (metrics.py)

### Team Midpoints (both xCSG and legacy)
```python
TEAM_MIDPOINTS = {"1": 1, "2": 2, "3": 3, "4+": 5}
```

### Per-Deliverable (V2)
```python
# EFFORT
xcsg_person_days = xcsg_working_days * TEAM_MIDPOINTS[xcsg_team_size]
legacy_person_days = legacy_working_days * TEAM_MIDPOINTS[legacy_team_size]
effort_ratio = legacy_person_days / xcsg_person_days

# QUALITY SCORE — composite, average of available
REVISION_DEPTH_SCORES = {
    "No revisions needed": 1.0,
    "Cosmetic only": 0.85,
    "Moderate rework": 0.55,
    "Major rework": 0.2
}
SCOPE_SCORES = {
    "Yes expanded scope": 1.0,
    "Yes new engagement": 1.0,
    "No": 0.0
    # "Not yet delivered" = excluded
}
SELF_ASSESSMENT_SCORES = {
    "Significantly better": 1.0,
    "Somewhat better": 0.7,
    "Comparable": 0.4,
    "Somewhat worse": 0.1
}
CLIENT_PULSE_SCORES = {
    "Exceeded expectations": 1.0,
    "Met expectations": 0.6,
    "Below expectations": 0.1
    # "Not yet received" = excluded
}

# Collect available scores
scores = []
scores.append(REVISION_DEPTH_SCORES[xcsg_revision_depth])
if scope_expansion in SCOPE_SCORES:
    scores.append(SCOPE_SCORES[scope_expansion])
scores.append(SELF_ASSESSMENT_SCORES[c6_self_assessment])
if client_pulse in CLIENT_PULSE_SCORES:
    scores.append(CLIENT_PULSE_SCORES[client_pulse])

quality_score = sum(scores) / len(scores)

# LEGACY QUALITY SCORE — from expert estimates
legacy_scores = []
legacy_scores.append(REVISION_DEPTH_SCORES[legacy_revision_depth])
legacy_scope = 1.0 if legacy_scope_expansion == "Yes" else 0.0
legacy_scores.append(legacy_scope)
legacy_scores.append(CLIENT_PULSE_SCORES[legacy_client_reaction])

legacy_quality = sum(legacy_scores) / len(legacy_scores)

# OUTCOME RATE (value = outcome / time)
outcome_rate_xcsg = quality_score / xcsg_person_days
outcome_rate_legacy = legacy_quality / legacy_person_days
outcome_rate_ratio = outcome_rate_xcsg / outcome_rate_legacy

# REVENUE PRODUCTIVITY
if engagement_revenue:
    rev_per_pd_xcsg = engagement_revenue / xcsg_person_days
    rev_per_pd_legacy = engagement_revenue / legacy_person_days
    productivity_ratio = rev_per_pd_xcsg / rev_per_pd_legacy
```

### Flywheel Leg Scores (each 0.0–1.0)

**Machine-First** = average of B1, B2, B3, B4:
- B1: From AI draft=1.0, Mixed=0.5, From blank page=0.0
- B2: 1-3=0.25, 4-7=0.5, 8-12=0.75, 13+=1.0
- B3: >75% AI=1.0, 50-75%=0.75, 25-50%=0.5, <25%=0.25
- B4: Hypothesis-first=1.0, Hybrid=0.5, Discovery-first=0.0

**AI Survival Rate** (integrity check, NOT part of Machine-First score):
- B5: >75%=1.0, 50-75%=0.75, 25-50%=0.5, <25%=0.25, Did not use AI draft=None
- Display alongside Machine-First gauge. Flag red when Machine-First > 0.7 and Survival < 0.4

**Senior-Led** = average of C1, C2, C3:
- C1: Deep specialist=1.0, Adjacent expertise=0.5, Generalist=0.0
- C2: Expert authored=1.0, Expert co-authored=0.5, Expert reviewed only=0.0
- C3: >75% judgment=1.0, 50-75%=0.75, 25-50%=0.5, <25%=0.25

**Proprietary Knowledge** = average of D1, D2, D3:
- D1: Yes=1.0, No=0.0
- D2: Directly reused=1.0, Useful context=0.5, From scratch=0.0
- D3: No (proprietary decisive)=1.0, Partially=0.5, Yes (all public)=0.0

### Adoption Health
```python
reuse_intent_rate = count(g1 == "Yes without hesitation") / total_completed * 100
```

### Scaling Gates (7 total)
1. **Multi-engagement**: ≥2 deliverable types completed
2. **Time reduction**: Average effort ratio > 1.3
3. **Client-invisible quality**: ≥1 deliverable with revision depth "No revisions needed" or "Cosmetic only" AND (no G2 data OR G2 != "Below expectations")
4. **Transferability**: Placeholder
5. **Flywheel validation**: Placeholder
6. **Compounding**: D2 reuse rate ≥40%
7. **Adoption confidence**: G1 "Yes without hesitation" ≥70%

---

## Frontend — SPA Structure

### Views (hash-based routing)

| Hash | View | Description |
|------|------|-------------|
| `#dashboard` | Dashboard | KPI cards + progressive checkpoint panels |
| `#new` | New Deliverable | Tier 1 form (PMO) |
| `#deliverables` | Deliverables List | Table with filters + inline G2 update |
| `#categories` | Project Categories | Admin-managed categories + computed norm averages |
| `#activity` | Activity Log | Timestamped action log |
| `#expert/{token}` | Expert Form | Standalone Tier 2 form (no sidebar, no auth) |

### Three Top-Level Containers
1. `loginScreen` — centered login card
2. `appShell` — sidebar + main content
3. `expertView` — standalone expert form (token-based, no auth)

### Dashboard — KPI Cards (V2)

**4 cards, always visible:**
| Card | Metric | Color accent |
|------|--------|-------------|
| Total Deliverables | Count complete | Navy |
| Avg Effort Ratio | e.g., "3.6x faster" | Blue |
| Avg Quality Score | e.g., "0.89" | Orange |
| Reuse Intent | e.g., "85% would reuse" | Green |

**V2 change**: Value Multiplier removed. Quality Score is composite (avg of revision depth, scope, self-assessment, client pulse).

### Dashboard — Progressive Checkpoints

Use Chart.js 4.4.0 (CDN, `defer`).

**Checkpoint 1 (1–2 complete)**: Scorecard table (type, working days, team size, effort ratio, quality score, outcome rate per row). F1 distribution.

**Checkpoint 2 (3–7 complete)**: + Effort comparison bars, quality comparison bars, flywheel leg gauges with AI Survival Rate indicator next to Machine-First gauge.

**Checkpoint 3 (8–19 complete)**: + Effort ratio trend (hero), quality score trend, **outcome rate trend**, flywheel leg trends, compound signal, adoption health trend (G1).

**Checkpoint 4 (20+ complete)**: + Scaling gates (7, with pass/pending/fail), **disprove matrix visualization (2×2 grid)**, per-category breakdowns, **revenue productivity trend**, client signal panel (G2 distribution if data).

### New Deliverable Form (V2)

Sections:
1. **Deliverable Info**: Type, Category (dropdown), Stage, Pioneer Name, Pioneer Email, Client Name, Client Contact Email (optional), Description
2. **Timeline & Effort**: Date Started*, Date Delivered*, Working Days* (integer input — "How many working days did the team spend on this deliverable?"), Engagement Revenue (currency input, optional)
3. **xCSG Performance**: Team Size, Revision Depth (new options), Scope Expansion
4. **Client Pulse (G2)**: Dropdown, defaults to "Not yet received" (editable later)
5. **Submit**: "Create Deliverable" (primary) + "Clear" (secondary)

**REMOVE**: Legacy Performance section entirely from PMO form (legacy estimates now come from expert)

### Expert Form (V2 — 27 answers)

- Context at top (deliverable type, client, dates)
- **Section B**: B1–B5 (5 questions)
- **Section C**: C1–C3, C6 (4 questions)
- **Section D**: D1–D3 (3 questions)
- **Section F**: F1–F2 (2 questions)
- **Section G**: G1 (1 question)
- **Section L — Legacy Estimates**: 12 paired questions (working days, team size, revision depth, scope expansion, client reaction, B2, C1, C2, C3, D1, D2, D3)
- Submit + thank-you

Each question: label, dropdown, helper text (`<small>`)
Helper text for legacy section: "For each question below, estimate what would have been typical if this deliverable had been done using traditional methods, without AI assistance, for this specific project."

### Deliverables List (V2)

Table with columns: ID, Type, Category, Pioneer, Client, Status, Effort Ratio, Quality Score, Outcome Rate, G2 Pulse.

**Inline G2 update**: Each row with status "complete" shows a G2 dropdown that can be updated directly from the list (PATCH to `/api/deliverables/{id}` with `client_pulse` field). This is the Tier 3 workflow — PMO updates G2 when client feedback arrives.

### Key Frontend Patterns

```javascript
// Safe event listener setup
function on(id, event, handler) {
    const el = document.getElementById(id);
    if (el) el.addEventListener(event, handler);
    else console.warn('Element not found:', id);
}

// Compute calendar days from dates
function computeCalendarDays(startDate, endDate) {
    if (!startDate || !endDate) return null;
    const diff = (new Date(endDate) - new Date(startDate)) / 86400000;
    return Math.max(Math.round(diff), 1);
}

// API call with auto-logout on 401
async function apiCall(method, endpoint, body = null, options = {}) {
    const headers = { 'Content-Type': 'application/json' };
    if (state.authToken && !options.skipAuth) {
        headers['Authorization'] = `Bearer ${state.authToken}`;
    }
    const response = await fetch(API_BASE + endpoint, {
        method, headers, body: body ? JSON.stringify(body) : null
    });
    if (!response.ok) {
        if (response.status === 401) handleLogout();
        throw new Error(`API error: ${response.status}`);
    }
    return response.json();
}
```

---

## Deployment

### launch.sh (macOS + Linux)
```bash
#!/bin/bash
PIP_CMD=""
if command -v pip3 &>/dev/null; then PIP_CMD="pip3"
elif command -v pip &>/dev/null; then PIP_CMD="pip"
else PIP_CMD="python3 -m pip"; fi

$PIP_CMD install -r requirements.txt
python3 -m uvicorn backend.app:app --host 0.0.0.0 --port 8765 --reload
```

### requirements.txt
```
fastapi>=0.104.0
uvicorn[standard]>=0.24.0
python-multipart>=0.0.6
PyJWT>=2.8.0
openpyxl>=3.1.0
python-dotenv>=1.0.0
email-validator>=2.0.0
```

### Docker
```dockerfile
FROM python:3.11-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY backend/ ./backend/
COPY frontend/ ./frontend/
EXPOSE 8765
CMD ["python", "-m", "uvicorn", "backend.app:app", "--host", "0.0.0.0", "--port", "8765"]
```

### docker-compose.yml
```yaml
version: '3.8'
services:
  tracker:
    build: .
    ports:
      - "8765:8765"
    volumes:
      - tracker_data:/app/data
    environment:
      - SECRET_KEY=change-this-in-production
      - DATABASE_PATH=/app/data/tracker.db
volumes:
  tracker_data:
```

### Environment Variables
| Variable | Default | Description |
|----------|---------|-------------|
| SECRET_KEY | `xCSG-Value-Tracker-dev-key-change-in-production-2026` | JWT signing key |
| JWT_ALGORITHM | `HS256` | JWT algorithm |
| JWT_EXPIRY_HOURS | `8` | Token lifetime |
| DATABASE_PATH | `./data/tracker.db` | SQLite file path |
| CORS_ORIGINS | `["http://localhost:3000", "http://localhost:8765"]` | Allowed origins (JSON) |
| ENV | `development` | Environment mode |

---

## Known Pitfalls (Lessons Learned)

1. **String matching**: D3 and G1 options contain em dashes (—). HTML `<option>` values, backend scoring maps, and frontend chart logic MUST use identical strings. Never use smart quotes or apostrophes inside single-quoted JS strings.

2. **Import paths**: Use `from backend import auth`, `from backend.models import ...` etc. Required when running via `python -m uvicorn backend.app:app`.

3. **Stale database**: `seed_data()` must verify seed user passwords on every startup and re-hash if stale.

4. **Chart.js**: Load with `defer`. Verify canvas exists before `new Chart()`. Destroy previous instances before re-creating.

5. **Field name matching**: JSON response field names must match exactly between backend models and frontend JS.

6. **Token storage**: `window.__app_token` = no refresh survival. By design.

7. **Static mount last**: `app.mount("/", StaticFiles(...))` must be the LAST route.

8. **Expert endpoints have NO auth**: UUID token IS the authentication.

9. **Working days vs calendar days**: The effort computation uses working days (PMO field). Calendar days (from dates) are retained for timeline trending only. Both are stored; only working days feeds metrics.

10. **B5 "Did not use AI draft"**: When computing AI Survival Rate average, exclude records where B5 = "Did not use AI draft" (treat as N/A, not 0).

11. **Legacy estimate bias**: Expert legacy estimates are counterfactuals. Reasonableness check flags outliers >1.5× from type average but cannot eliminate bias. Surface the flag in PMO review.

12. **Quality composite with missing G2**: Use average of available components (3 or 4). Never redistribute weight. When G2 arrives later, recompute quality score for that deliverable.

13. **Revenue cancellation**: For same-revenue deliverables, Productivity Ratio = Effort Ratio. This is mathematically correct. Productivity diverges from Effort only when xCSG changes the revenue (bigger scope, new wins).
