# xCSG Value Tracker v2 — Project-Centric Redesign

**Author:** Archie, Chief of Staff
**Date:** 2026-04-02
**Status:** APPROVED BY PJ — ready to build

---

## Summary

Restructure from deliverable-centric to project-centric. One project = one engagement = one questionnaire = one data point. Deliverables are removed as a concept for the pilot. Legacy baselines are set per project (not from a global lookup).

---

## Data Model

### Tables

```sql
-- NEW: Project categories (admin-configurable labels)
CREATE TABLE project_categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL,           -- e.g., "CDD", "Market Access", "Regulatory Strategy"
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Pre-seed: CDD, Competitive landscape, Financial model, Market access,
--           Proposal, Call prep brief, Presentation, KOL mapping
-- (same as the old deliverable types — they become category names)

-- REPLACES deliverables table
CREATE TABLE projects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    created_by INTEGER NOT NULL,
    
    -- Project info
    project_name TEXT NOT NULL,          -- e.g., "Pfizer EU Market Access Q2"
    category_id INTEGER NOT NULL,        -- FK to project_categories
    client_name TEXT,
    pioneer_name TEXT NOT NULL,
    pioneer_email TEXT,
    description TEXT,
    date_started TEXT,
    date_delivered TEXT,
    status TEXT DEFAULT 'expert_pending', -- expert_pending | complete
    
    -- xCSG Performance (what actually happened)
    xcsg_calendar_days TEXT NOT NULL,     -- same dropdown options as before
    xcsg_team_size TEXT NOT NULL,
    xcsg_revision_rounds TEXT NOT NULL,
    xcsg_scope_expansion TEXT,
    
    -- Legacy Baseline (per THIS project — admin sets, defaults from category)
    legacy_calendar_days TEXT,
    legacy_team_size TEXT,
    legacy_revision_rounds TEXT,
    
    -- Expert assessment
    expert_token TEXT UNIQUE,            -- generated on creation, used for questionnaire URL
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (created_by) REFERENCES users(id),
    FOREIGN KEY (category_id) REFERENCES project_categories(id)
);

-- Expert responses — FK changes from deliverable_id to project_id
CREATE TABLE expert_responses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER UNIQUE NOT NULL,
    b1_starting_point TEXT NOT NULL,
    b2_research_sources TEXT NOT NULL,
    b3_assembly_ratio TEXT NOT NULL,
    b4_hypothesis_first TEXT NOT NULL,
    c1_specialization TEXT NOT NULL,
    c2_directness TEXT NOT NULL,
    c3_judgment_pct TEXT NOT NULL,
    d1_proprietary_data TEXT NOT NULL,
    d2_knowledge_reuse TEXT NOT NULL,
    d3_moat_test TEXT NOT NULL,
    f1_feasibility TEXT NOT NULL,
    f2_productization TEXT NOT NULL,
    submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

-- Legacy norms — stays as suggestion/defaults, keyed by CATEGORY now
CREATE TABLE legacy_norms (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    category_id INTEGER UNIQUE NOT NULL,
    typical_calendar_days TEXT NOT NULL,
    typical_team_size TEXT NOT NULL,
    typical_revision_rounds TEXT NOT NULL,
    notes TEXT,
    updated_by INTEGER,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (category_id) REFERENCES project_categories(id),
    FOREIGN KEY (updated_by) REFERENCES users(id)
);

-- Activity log — unchanged structure, deliverable_id renamed to project_id
CREATE TABLE activity_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    action TEXT NOT NULL,
    project_id INTEGER,
    details TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Users — unchanged
```

### Migration

**Flush all existing test data.** Delete tracker.db and let it recreate on startup with fresh seeds.

Seed data:
- Users: admin / AliraAdmin2026!, pmo / AliraPMO2026! (unchanged)
- Categories: CDD, Competitive Landscape, Financial Model, Market Access, Proposal, Call Prep Brief, Presentation, KOL Mapping
- Legacy norms: one per seeded category (same values as current deliverable-type norms)

---

## API Routes

### Auth (unchanged)
- `POST /api/auth/login`
- `POST /api/auth/register`

### Project Categories
- `GET /api/categories` — list all (any auth)
- `POST /api/categories` — create (admin only) `{ name, description? }`
- `PUT /api/categories/{id}` — update (admin only)
- `DELETE /api/categories/{id}` — delete (admin only, blocked if projects exist)

### Projects (replaces /api/deliverables)
- `GET /api/projects` — list all, supports `?status=`, `?category_id=`, `?pioneer=`, `?client=`
- `POST /api/projects` — create `{ project_name, category_id, client_name, pioneer_name, ... }`
  - Auto-generates expert_token
  - Auto-populates legacy fields from category's norm (if exists), admin can override
  - Returns created project with expert_token
- `GET /api/projects/{id}` — get single
- `PUT /api/projects/{id}` — update
- `DELETE /api/projects/{id}` — delete (admin only, cascades expert_responses, nullifies activity_log)

### Expert (unchanged pattern, new entity)
- `GET /api/expert/{token}` — get project context + check if already completed
- `POST /api/expert/{token}` — submit questionnaire

### Legacy Norms (keyed by category now)
- `GET /api/norms` — list all
- `GET /api/norms/{category_id}` — get single (used for auto-populate on project creation)
- `PUT /api/norms/{category_id}` — update

### Metrics (same computations, new entity name)
- `GET /api/metrics/summary` — portfolio-level KPIs
- `GET /api/metrics/projects` — per-project metrics (replaces /api/metrics/deliverables)
- `GET /api/metrics/trends` — value multiplier trend over time
- `GET /api/metrics/scaling-gates` — gate assessment

### Activity & Export (unchanged)
- `GET /api/activity?limit=100`
- `GET /api/export/excel`

---

## Frontend — Navigation & Views

### Sidebar
```
◉  Portfolio              → #portfolio (was #dashboard)
+  New Project            → #new
☰  Projects               → #projects (was #deliverables)
⚙  Settings               → #settings (categories + norms)
🕐 Activity Log           → #activity
```

### Portfolio View (#portfolio — was Dashboard)
- KPI cards: Total Projects, Avg Value Multiplier, Avg Effort Ratio, Flywheel Health
- Checkpoint stepper (same logic, count complete projects instead of deliverables)
- Filters bar: category dropdown, client dropdown, pioneer dropdown, status filter
- Scorecard table with project rows (project name, category, client, pioneer, effort ratio, value multiplier)
- Charts at checkpoint 2+ (same as current)
- Export to Excel button

### New Project (#new — replaces New Deliverable)
Form sections:
1. **Project Info**: project name*, category* (dropdown from /api/categories), client name, pioneer name*, pioneer email, description
2. **Timeline**: date started (default today), target delivery date
3. **xCSG Performance**: calendar days*, team size*, revision rounds*, scope expansion
4. **Legacy Baseline**: calendar days, team size, revision rounds
   - Auto-populated from category's norm when category selected
   - Editable — "These are defaults for this category. Adjust for this specific project."
   - Styled as dashed border / blue background (already have `.legacy-auto` class)

On submit → show modal with expert link + copy button (same as current)

### Projects List (#projects — replaces Deliverables)
- Filter bar: status filter (All / Expert Pending / Complete), category filter
- Table: Project Name, Category, Client, Pioneer, Status badge, Created, Actions
- Actions: copy expert link (SVG), edit, delete (admin)
- Click row → #edit/{id}

### Project Detail / Edit (#edit/{id})
- Same form as New, pre-populated
- If expert response exists, show a read-only summary card of the responses below the form

### Settings (#settings — replaces Legacy Norms standalone page)
Two tabs:
1. **Categories** — list/add/edit/delete project categories. Simple table with name + description.
2. **Legacy Norms** — same as current norms table, but keyed by category (auto-updates when categories change)

### Expert Form (#expert/{token})
- Same card-per-section layout (already redesigned, looks good)
- Context card shows: Project Name, Category, Client, Pioneer, Dates, Team Size, Calendar Days
- Questionnaire sections B, C, D, F — unchanged
- Thank-you state — unchanged

---

## Metrics Engine

Identical computations. Just rename internally:
- `deliverable_type` → `category.name` (for display)
- `deliverable_id` → `project_id` (for FK references)
- Everything else (person-days, effort ratio, quality ratio, value multiplier, flywheel scores, scaling gates) computed the same way per project

---

## What Does NOT Change
- Auth system (JWT, users, roles)
- Expert questionnaire fields (B1-B4, C1-C3, D1-D3, F1-F2)
- Scoring maps in metrics.py (all the exact string → score mappings)
- Chart.js integration
- Dropdown option values (calendar days, team sizes, revisions, etc.)
- Export Excel
- Toast/modal/badge CSS
- Tech stack (FastAPI + SQLite + vanilla JS/CSS + Chart.js CDN)

## What Changes
- "Deliverable" → "Project" everywhere (DB, API, UI, metrics)
- Add project_categories table + CRUD
- Add project_name field (deliverables didn't have a name)
- Legacy norms keyed by category_id instead of deliverable_type string
- Sidebar: Portfolio, New Project, Projects, Settings, Activity
- Dashboard becomes Portfolio view with category/client/pioneer filters
- Settings page with tabs (Categories + Norms)
- Flush all test data, fresh DB

## Login Logo
- Display the existing `logo-color.png` at `width: 160px` on login page (already done, verify it renders properly)

---

## Build Plan

| Phase | Assignee | Scope |
|-------|----------|-------|
| 1. Backend | Vitruvius | New DB schema, models, CRUD, API routes, seed data. Flush old DB. |
| 2. Frontend | Vitruvius | Update app.js: routing, views, forms, filters. Update index.html sidebar. |
| 3. CSS | (minimal) | Mostly reuse existing styles. Add settings tabs CSS. |
| 4. QA | Archie | Playwright + API test suite, full flow verification |

**Estimated effort:** Backend ~3h, Frontend ~4h, QA ~1h.

This is a refactor more than a rewrite — the core logic (metrics, questionnaire, auth, charts) is identical. The main work is renaming deliverable→project, adding categories, and updating the form/list/dashboard views.

---

*Brief approved by PJ. Ready to build.*
