# xCSG Value Measurement Tracker — Build Plan

**Author**: Dedalus ⚡, Tech Lead  
**Date**: 2026-03-31  
**Status**: AWAITING REVIEW — no code written yet

---

## Architecture Overview

```
xCSG-Value-Tracker/
├── backend/
│   ├── __init__.py
│   ├── auth.py          # JWT + PBKDF2 password hashing
│   ├── models.py        # Pydantic request/response models
│   ├── database.py      # SQLite CRUD, schema, seed data
│   ├── metrics.py       # All metric computations
│   └── app.py           # FastAPI routes + static file serving
├── frontend/
│   ├── index.html        # SPA shell
│   ├── app.js            # SPA logic, routing, charts
│   └── styles.css        # Alira Health brand system
├── requirements.txt
├── launch.sh
├── Dockerfile
└── docker-compose.yml
```

**Stack**: FastAPI + SQLite (WAL mode) + vanilla HTML/JS/CSS + Chart.js 4.4.0 CDN  
**Run**: `python -m uvicorn backend.app:app --host 0.0.0.0 --port 8000` from project root

---

## Spec Decisions & Ambiguity Resolution

Before building, these are decisions I'm making based on gaps between FRAMEWORK.md, SPEC.md, and Palladio's UX review:

### Incorporating from Palladio's UX Review

#### Critical (will incorporate — blocks usability)
- [x] **B4 in Machine-First Score** — Add B4 (Hypothesis approach) to the Machine-First composite. FRAMEWORK.md is explicit. SPEC.md omitted it. Fix in `metrics.py`.
- [x] **Expert link in deliverable detail/list** — Show expert link + copy button on deliverable detail view and as a column action in the deliverables list. Token exists in DB, just needs UI surface.
- [x] **Edit deliverable flow** — Pre-populate the new deliverable form with existing data when editing. Route: `#edit/{id}`. Only Tier 1 fields editable.
- [x] **Delete confirmation modal** — Confirmation dialog before cascade delete.
- [x] **Export button on dashboard** — Prominent "Export to Excel" button, top-right of dashboard.
- [x] **Expert form edge cases** — Handle: already-submitted token (show thank-you, not error), invalid token (clear error message), network error (toast + retry guidance).

#### Important (will incorporate — daily workflow)
- [x] **sessionStorage for auth token** — Replace `window.__app_token` with `sessionStorage`. Survives refresh, cleared on tab close. Better UX, same security posture for a pilot.
- [x] **Checkpoint progress indicator** — Top of dashboard: "Checkpoint N — X deliverables complete, Y more to reach Checkpoint N+1."
- [x] **Expert Pending filter** — Status filter on deliverables list (All / Expert Pending / Complete).
- [x] **Date validation** — Client-side + server-side: `date_started` ≤ `date_delivered`.
- [x] **Meaningful empty states** — Dashboard empty state with welcome message + CTA to create first deliverable.

#### Deferred (nice-to-have, out of pilot scope)
- [ ] Dashboard filtering by type/pioneer/date — defer to v1.1
- [ ] Legacy norm override audit trail (`legacy_overridden` flag) — defer
- [ ] Checkpoint history snapshots — defer
- [ ] Pagination controls — 40 records max in pilot, simple scroll is fine
- [ ] User management UI — seed users suffice for pilot
- [ ] Legacy norms for B2, C1-C3 (comparative scoring) — defer, document as known simplification
- [ ] Compound Signal, Implied Margin, Revenue Attribution — defer to Checkpoint 3/4 enhancement
- [ ] Expert response edit within 24h — defer
- [ ] Bulk import — defer

### My Own Decisions

1. **Scoring simplification**: FRAMEWORK.md describes B2/C3 as xCSG/Legacy ratios. SPEC.md maps them to absolute 0–1 scales. I'll follow the SPEC's absolute scoring since we're not collecting legacy norms for these questions. Documented as intentional simplification.

2. **B4 scoring**: Framework says "Hypothesis-first=1.0, Hybrid=0.5, Discovery-first=0.0". I'll add this to Machine-First as the 4th component (average of B1, B2, B3, B4 — all on 0–1 scale).

3. **KPI cards**: Palladio flagged these weren't specified. I'll use:
   - Total Deliverables (complete/pending)
   - Average Value Multiplier
   - Average Effort Ratio
   - Flywheel Health (average of all 3 leg scores)

4. **Expert form styling**: Will make it visually lighter than the admin app — no sidebar, generous spacing, Alira-branded header only.

5. **CORS**: Will include `http://localhost:8000` and `http://localhost:3000` as defaults. Configurable via env.

6. **Database path**: Default `./data/tracker.db`, auto-create `data/` directory on startup.

---

## Phase 1 — Backend Foundation
**Estimated complexity**: Medium-High (~3-4 hours)  
**Delegation**: Vitruvius 🏛️

### File 1: `backend/__init__.py`
- [ ] Empty init file to make backend a package

### File 2: `backend/auth.py`
- [ ] PBKDF2-SHA256 password hashing (100K iterations, 32-byte hex salt)
- [ ] Hash format: `{salt}${hash_hex}`
- [ ] `hash_password(password) → str`
- [ ] `verify_password(password, hash) → bool`
- [ ] JWT token creation (HS256, 8hr expiry, configurable via env)
- [ ] JWT token verification + decode
- [ ] FastAPI dependencies: `get_current_user`, `get_current_user_admin`, `get_current_user_analyst`
- [ ] HTTPBearer security scheme
- [ ] Env vars: `SECRET_KEY`, `JWT_ALGORITHM`, `JWT_EXPIRY_HOURS`

### File 3: `backend/models.py`
- [ ] `LoginRequest` / `LoginResponse` (with nested user object)
- [ ] `RegisterRequest`
- [ ] `DeliverableCreate` / `DeliverableUpdate` / `DeliverableResponse`
- [ ] `ExpertResponseCreate` / `ExpertContextResponse`
- [ ] `NormResponse` / `NormUpdate`
- [ ] `MetricsSummary` / `DeliverableMetrics` / `TrendData` / `ScalingGates`
- [ ] `ActivityLogEntry`
- [ ] All with proper Optional fields and validation
- [ ] Date validation: `date_started` ≤ `date_delivered` (validator)

### File 4: `backend/database.py`
- [ ] SQLite connection with WAL mode + foreign keys ON
- [ ] `DATABASE_PATH` from env (default `./data/tracker.db`)
- [ ] Auto-create data directory
- [ ] Schema creation (5 tables: users, deliverables, expert_responses, legacy_norms, activity_log)
- [ ] `seed_data()` — create seed users (admin + pmo) with password re-hash verification on startup
- [ ] Seed legacy norms (8 deliverable types per spec)
- [ ] CRUD: deliverables (create, read, update, delete, list with filters)
- [ ] CRUD: expert_responses (create, read by deliverable_id, check if exists)
- [ ] CRUD: legacy_norms (read all, read by type, update)
- [ ] CRUD: activity_log (create, list with pagination)
- [ ] CRUD: users (create, get by username, get by id)
- [ ] Token-based expert lookup (get deliverable by expert_token)
- [ ] Auto-populate legacy fields from norms when null on deliverable creation

### File 5: `backend/metrics.py`
- [ ] Midpoint mappings (DAYS_MIDPOINTS, TEAM_MIDPOINTS, REVISION_NUMBERS)
- [ ] Per-deliverable computation: person-days, effort ratio, quality ratio, value multiplier
- [ ] **Machine-First score**: average of B1 + B2 + B3 + B4 (4 components — includes B4 per Palladio fix)
- [ ] **Senior-Led score**: average of C1 + C2 + C3
- [ ] **Proprietary Knowledge score**: average of D1 + D2 + D3
- [ ] Scoring maps for ALL Tier 2 options (exact string matching, em dashes for D3)
- [ ] Aggregate summary (averages across all complete deliverables)
- [ ] Trend data (per-deliverable metrics over time, ordered by creation)
- [ ] Scaling gates assessment (6 gates, pass/pending logic)
- [ ] Checkpoint determination (1-2 = CP1, 3-7 = CP2, 8-19 = CP3, 20+ = CP4)

### File 6: `backend/app.py`
- [ ] FastAPI app with CORS middleware (configurable origins)
- [ ] Health check endpoint
- [ ] Auth routes: POST `/api/auth/login`, POST `/api/auth/register`
- [ ] Deliverable routes: GET/POST `/api/deliverables`, GET/PUT/DELETE `/api/deliverables/{id}`
- [ ] Expert routes (NO auth): GET/POST `/api/expert/{token}`
  - GET: return deliverable context + check if already submitted
  - POST: validate token, check not already submitted, save response, update status
  - Already-submitted: return 200 with `already_completed: true` (not 4xx)
  - Invalid token: return 404 with clear message
- [ ] Norms routes: GET `/api/norms`, GET/PUT `/api/norms/{type}`
- [ ] Metrics routes: GET `/api/metrics/summary`, `/api/metrics/deliverables`, `/api/metrics/trends`, `/api/metrics/scaling-gates`
- [ ] Activity log: GET `/api/activity` with pagination
- [ ] Export: GET `/api/export/excel` (openpyxl), GET `/api/export/file/{name}`
- [ ] Static file mount: `app.mount("/", StaticFiles(...))` — **LAST LINE**
- [ ] Database init on startup event
- [ ] Activity logging on login, deliverable create/update/delete, expert submit

---

## Phase 2 — Frontend
**Estimated complexity**: High (~4-5 hours)  
**Delegation**: Giotto 🎭

### File 7: `frontend/styles.css`
- [ ] CSS custom properties for all brand tokens (Navy, Blue, Orange, Grays, Success/Warning/Error)
- [ ] Roboto font import (Google Fonts: 300, 400, 500, 700)
- [ ] Base reset + typography (14px body, 1.5 line-height)
- [ ] Layout: login screen (centered on gradient), app shell (fixed sidebar + scrollable main), expert view (standalone)
- [ ] Sidebar: 240px, Navy bg, white text, logo (three bars + "Alira"), nav items with hover/active states
- [ ] Buttons: primary (Navy), secondary (white + navy border), both with hover shadows
- [ ] Cards: white bg, gray-200 border, 12px radius, 24px padding, subtle shadow
- [ ] Form inputs: 12px padding, gray-200 border, 8px radius, blue focus border
- [ ] Form layout: `form-row` 2-column grid, `form-actions` with visible submit button
- [ ] Fieldset styling: navy bottom border, uppercase legend
- [ ] Tables: navy header (white text), alternating rows (blue-pale/white)
- [ ] KPI card grid: 4-column, colored left accent bars
- [ ] Toast notifications: fixed bottom-right, slide-in animation
- [ ] Modal overlay: dark backdrop, centered white card
- [ ] Badge styles: success (green), warning (amber), error (red), info (blue)
- [ ] Checkpoint progress bar
- [ ] Empty state styling
- [ ] Expert form: lighter, more generous spacing, branded microsite feel
- [ ] Responsive touches (nothing complex — desktop-first for internal tool)

### File 8: `frontend/index.html`
- [ ] DOCTYPE + head: meta, Roboto font link, styles.css link, Chart.js 4.4.0 CDN (defer)
- [ ] Three top-level containers (only one visible at a time):
  1. `loginScreen` — centered card on gradient, username/password fields, submit button
  2. `appShell` — sidebar nav + topbar + `#mainContent` area
  3. `expertView` — standalone branded form shell
- [ ] Sidebar: logo (CSS three-bar), 5 nav items (Dashboard, New Deliverable, Deliverables, Legacy Norms, Activity Log)
- [ ] "New Deliverable" as visually prominent nav item (per Palladio)
- [ ] Topbar: breadcrumb area + user display + logout
- [ ] Script: app.js (defer)
- [ ] No inline JS

### File 9: `frontend/app.js`
- [ ] State management: `sessionStorage` for auth token (Palladio fix), app state object
- [ ] `apiCall()` utility with auto-logout on 401
- [ ] `on()` safe event listener helper
- [ ] `showToast()` notification system
- [ ] `showModal()` / `hideModal()` utility
- [ ] Hash-based routing: `#dashboard`, `#new`, `#edit/{id}`, `#deliverables`, `#norms`, `#activity`, `#expert/{token}`
- [ ] Route handler that shows/hides correct container + renders view

#### Login View
- [ ] Login form submit → POST `/api/auth/login`
- [ ] Store token in sessionStorage, store user in state
- [ ] Navigate to `#dashboard` on success
- [ ] Error toast on failure

#### Dashboard View (`#dashboard`)
- [ ] Fetch `/api/metrics/summary`, `/api/metrics/deliverables`, `/api/metrics/scaling-gates`
- [ ] **Checkpoint progress indicator** at top (Palladio fix)
- [ ] KPI cards: Total Deliverables, Avg Value Multiplier, Avg Effort Ratio, Flywheel Health
- [ ] **Empty state**: Welcome message + "Create First Deliverable" CTA button (Palladio fix)
- [ ] **Export button**: "Export to Excel" prominent in header area (Palladio fix)
- [ ] Checkpoint 1 (1-2): Scorecard table only
- [ ] Checkpoint 2 (3-7): + effort bar chart + quality comparison + flywheel gauges
- [ ] Checkpoint 3 (8-19): + value multiplier trend + quality trend + compound signal
- [ ] Checkpoint 4 (20+): + scaling gates panel + moat analysis + F1 distribution
- [ ] Chart.js: destroy old instances before creating new, check canvas exists, setTimeout for DOM readiness

#### New Deliverable Form (`#new`)
- [ ] Two-column layout where appropriate
- [ ] Section 1: Deliverable Info (type dropdown, engagement stage, pioneer name/email, client, description)
- [ ] Section 2: Timeline (date started, date delivered) — with date validation (Palladio fix)
- [ ] Section 3: xCSG Performance (calendar days, team size, revision rounds, scope expansion)
- [ ] Section 4: Legacy Performance (auto-populated from norms on type select, overridable)
- [ ] Type selection → fetch `/api/norms/{type}` → populate legacy fields
- [ ] Submit → POST `/api/deliverables` → show modal with expert link + copy-to-clipboard
- [ ] All dropdowns with exact string values matching backend scoring maps
- [ ] **D3 em dashes**: Verify option values use `—` not `–` or `-`
- [ ] Loading state on submit button ("Saving...")

#### Edit Deliverable (`#edit/{id}`) — Palladio fix
- [ ] Same form as New, pre-populated with existing data from GET `/api/deliverables/{id}`
- [ ] Submit → PUT `/api/deliverables/{id}`
- [ ] Only Tier 1 fields editable (expert response is separate)
- [ ] Success toast + navigate to `#deliverables`

#### Deliverables List (`#deliverables`)
- [ ] Fetch GET `/api/deliverables`
- [ ] Table: type, pioneer, client, status badge, date, actions
- [ ] **Status filter**: All / Expert Pending / Complete (Palladio fix)
- [ ] **Expert link column**: copy button per row for pending items (Palladio fix)
- [ ] Edit button → `#edit/{id}`
- [ ] Delete button (admin only) → **confirmation modal** (Palladio fix) → DELETE
- [ ] Click row → detail view or expand

#### Legacy Norms (`#norms`)
- [ ] Fetch GET `/api/norms`
- [ ] Editable table: type, calendar days, team size, revision rounds, notes
- [ ] Inline edit or edit modal per row
- [ ] Save → PUT `/api/norms/{type}`

#### Activity Log (`#activity`)
- [ ] Fetch GET `/api/activity`
- [ ] Table: timestamp, user, action, deliverable, details
- [ ] Simple chronological list (newest first)

#### Expert Form (`#expert/{token}`)
- [ ] No sidebar, no auth — standalone branded view
- [ ] Fetch GET `/api/expert/{token}` for deliverable context
- [ ] **Edge cases** (Palladio fix):
  - Invalid token → clear "link invalid or expired" message
  - Already submitted → show thank-you (not error)
  - Network error → toast with retry guidance
- [ ] Context header: deliverable type, client, dates, team size
- [ ] 4 fieldsets: Section B (B1-B4), Section C (C1-C3), Section D (D1-D3), Section F (F1-F2)
- [ ] Each question: label + dropdown + helper text `<small>`
- [ ] All 12 dropdowns with exact value strings (em dashes on D3!)
- [ ] Submit → POST `/api/expert/{token}` → hide form, show thank-you
- [ ] Lighter styling: generous spacing, branded microsite feel

---

## Phase 3 — Deployment Files
**Estimated complexity**: Low (~30 min)  
**Delegation**: Vitruvius 🏛️ (alongside backend) or self

### File 10: `requirements.txt`
- [ ] fastapi>=0.104.0, uvicorn[standard]>=0.24.0, python-multipart>=0.0.6
- [ ] PyJWT>=2.8.0, openpyxl>=3.1.0, python-dotenv>=1.0.0, email-validator>=2.0.0

### File 11: `launch.sh`
- [ ] Detect pip command (pip3 → pip → python3 -m pip)
- [ ] Install requirements
- [ ] Start uvicorn with --reload
- [ ] Make executable (chmod +x)

### File 12: `Dockerfile`
- [ ] Python 3.11-slim base
- [ ] Install requirements, copy backend + frontend
- [ ] Expose 8000, CMD uvicorn

### File 13: `docker-compose.yml`
- [ ] Single service, port 8000, volume for data, SECRET_KEY env

---

## Phase 4 — Integration Testing & Polish
**Estimated complexity**: Medium (~1-2 hours)  
**Owner**: Dedalus (me)

- [ ] Run `launch.sh`, verify startup without errors
- [ ] Login with admin / AliraAdmin2026!
- [ ] Dashboard shows empty state with welcome CTA
- [ ] Create deliverable → legacy fields auto-populate → modal with expert link
- [ ] Copy expert link → open in incognito → expert form loads with context
- [ ] Submit expert form → thank-you message
- [ ] Revisit expert link → shows thank-you (not error)
- [ ] Dashboard updates: KPI cards, checkpoint 1 scorecard
- [ ] Deliverables list: status badges, expert link copy, status filter
- [ ] Edit deliverable → verify pre-population → save
- [ ] Delete deliverable (as admin) → confirmation modal → cascades properly
- [ ] Legacy Norms view: editable, saves persist
- [ ] Activity Log: shows login + create + expert submit events
- [ ] Export to Excel: generates and downloads XLSX
- [ ] `node --check frontend/app.js` → zero syntax errors
- [ ] Verify em dash strings match across HTML options, Python scoring maps, JS
- [ ] Verify all dropdown values are identical across all three layers

---

## Delegation Plan

| Phase | Assignee | Dependencies |
|-------|----------|-------------|
| Phase 1 (Backend) | **Vitruvius 🏛️** | None — starts first |
| Phase 2 (Frontend) | **Giotto 🎭** | Needs API contract from Phase 1 models.py (can start CSS + HTML structure in parallel) |
| Phase 3 (Deployment) | **Vitruvius 🏛️** | After Phase 1 |
| Phase 4 (Integration) | **Dedalus ⚡** (me) | After Phase 1 + 2 |

**Parallelization strategy**: 
- Vitruvius starts backend immediately
- Giotto starts `styles.css` + `index.html` immediately (brand system is fully specified, no API dependency)
- Giotto starts `app.js` once Vitruvius has `models.py` + `app.py` routes defined (API contract)
- Both commit to the same repo, I integrate

---

## Complexity Summary

| Phase | Effort | Risk |
|-------|--------|------|
| Phase 1 — Backend | 3-4 hours | Medium — metrics scoring maps need exact string matching |
| Phase 2 — Frontend | 4-5 hours | High — SPA routing + Chart.js + 7 views + edge cases |
| Phase 3 — Deployment | 30 min | Low |
| Phase 4 — Integration | 1-2 hours | Medium — string consistency across layers is the #1 bug vector |
| **Total** | **~9-12 hours** | |

**#1 risk**: String mismatch between HTML option values, Python scoring maps, and JS chart logic. Especially D3 moat test em dashes. Will verify with a dedicated cross-check in Phase 4.

---

## What I'm NOT Building (documented deferrals)

Per Palladio's review, these are acknowledged gaps deferred to post-pilot:

1. Dashboard filtering (type/pioneer/date) — v1.1
2. Legacy norm override audit trail — v1.1
3. Checkpoint history snapshots — v1.1
4. Pagination controls — 40 records max, unnecessary for pilot
5. User management UI — seed users are sufficient
6. Comparative scoring for B2, C1-C3 (collecting legacy norms for expert questions) — documented simplification
7. Compound Signal trend, Implied Margin, Revenue Attribution metrics — Checkpoint 3/4 enhancement
8. Expert response edit within 24h — v1.1
9. Bulk import — v1.1
10. Draft deliverable status — 5-minute forms, acceptable for pilot

---

*Plan ready for PJ's review. No code written. Awaiting green light to build.*
