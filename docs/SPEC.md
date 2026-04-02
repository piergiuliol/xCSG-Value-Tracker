# xCSG Value Measurement Tracker — Build Specification

**CONFIDENTIAL** — Alira Health xCSG Initiative

Build a polished, production-quality web application for tracking and analyzing consulting deliverable performance. The app compares xCSG (AI-augmented) delivery against legacy operations using a structured survey framework.

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

**Run**: `python -m uvicorn backend.app:app --host 0.0.0.0 --port 8000` from project root.

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
| Error | `#EF4444` | Error toasts, fail badges |

### Typography
- **Font**: `'Roboto', sans-serif` (load from Google Fonts)
- Weights: 300 (light), 400 (regular), 500 (medium), 700 (bold)
- Body text: 14px, line-height 1.5
- Headings: Roboto 700, Navy color

### Component Styling
- **Sidebar**: 240px wide, Navy background, white text. Logo = three colored bars (Blue #6EC1E4, Navy #121F6B, Orange #FF8300) + "Alira" in white.
- **Nav items**: padding 12px 24px, hover = Navy Dark background, active = Navy Light bg + left blue accent bar (3px).
- **Buttons**: Primary = Navy bg, white text, 8px radius, 500 weight. Secondary = white bg, navy border/text. Both 12px 24px padding, subtle shadow on hover.
- **Cards**: White bg, 1px gray-200 border, 12px radius, 24px padding, subtle shadow (`0 1px 3px rgba(0,0,0,0.1)`).
- **Form inputs**: 12px padding, gray-200 border, 8px radius, blue border on focus. Select dropdowns same styling.
- **Tables**: Navy header (white bold text), alternating blue-pale/white rows, gray-300 borders, full width.
- **KPI cards**: 4-column grid. Each has a colored left accent bar (4px wide). Navy for default, Blue for secondary, Orange for tertiary, Green for quaternary.
- **Toasts**: Fixed bottom-right, 400px max-width, slide in from right. Green for success, red for error.
- **Modal overlay**: Dark semi-transparent backdrop, centered white card with 16px radius.

### Layout
- Login screen: Centered card on gradient background (Navy → Navy Light, 135deg)
- App shell: Fixed sidebar (left) + scrollable main content (right)
- Main content: 60px topbar (breadcrumb + user display) + content area with 32px padding
- Responsive form layout: Use CSS grid with `form-row` class for 2-column layouts on forms

### UI Quality Standards
- **Every form must have a visible submit button** — always inside a `form-actions` div at the bottom with clear visual weight
- Form sections should use `<fieldset>` with `<legend>` for grouping, styled with navy bottom border and uppercase legend text
- Two-column form rows where it makes sense (e.g., name + email, start date + end date, multiple selects)
- Consistent 24px spacing between sections
- Empty state messages centered with gray text when no data
- Loading states on API calls (button disabled + "Saving..." text)

---

## Authentication

### Backend (auth.py)
- **Password hashing**: PBKDF2 with SHA-256, 100K iterations, random 32-byte hex salt. Hash format: `{salt}${hash_hex}`.
- **JWT tokens**: HS256, configurable secret key (from env `SECRET_KEY`), 8-hour expiry. Payload: `{sub: user_id, username, role, iat, exp}`.
- **FastAPI dependencies**: `get_current_user` (any authenticated), `get_current_user_admin` (admin role), `get_current_user_analyst` (admin or analyst).
- **HTTPBearer** security scheme.

### Seed Users (database startup)
| Username | Password | Role |
|----------|----------|------|
| `admin` | `AliraAdmin2026!` | admin |
| `pmo` | `AliraPMO2026!` | analyst |

**Critical**: On every startup, `seed_data()` must verify that seed user passwords still validate. If they don't (stale hash from a different SECRET_KEY), re-hash them. This prevents lock-outs when the environment changes.

### Frontend Auth
- Store token in `window.__app_token` (NOT localStorage — security requirement)
- `apiCall()` utility adds `Authorization: Bearer {token}` to all requests
- On any 401 response, auto-logout (clear state, show login screen)
- Login form: username + password, POST to `/api/auth/login`

---

## Database Schema (SQLite, WAL mode, foreign keys ON)

### Tables

**users**
```sql
CREATE TABLE users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT DEFAULT 'viewer',  -- admin, analyst, viewer
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

**deliverables** (Tier 1 — PMO data)
```sql
CREATE TABLE deliverables (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    created_by INTEGER NOT NULL,
    pioneer_name TEXT NOT NULL,
    pioneer_email TEXT,
    deliverable_type TEXT NOT NULL,
    engagement_stage TEXT NOT NULL,
    client_name TEXT,
    description TEXT,
    date_started TEXT,
    date_delivered TEXT,
    xcsg_calendar_days TEXT NOT NULL,
    xcsg_team_size TEXT NOT NULL,
    xcsg_revision_rounds TEXT NOT NULL,
    scope_expansion TEXT,
    legacy_calendar_days TEXT NOT NULL,
    legacy_team_size TEXT NOT NULL,
    legacy_revision_rounds TEXT NOT NULL,
    expert_token TEXT UNIQUE NOT NULL,
    expert_completed BOOLEAN DEFAULT 0,
    status TEXT DEFAULT 'expert_pending',  -- expert_pending, complete
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (created_by) REFERENCES users(id)
);
```

**expert_responses** (Tier 2 — Expert judgment)
```sql
CREATE TABLE expert_responses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    deliverable_id INTEGER UNIQUE NOT NULL,
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
    completed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (deliverable_id) REFERENCES deliverables(id) ON DELETE CASCADE
);
```

**legacy_norms** (reference table)
```sql
CREATE TABLE legacy_norms (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    deliverable_type TEXT UNIQUE NOT NULL,
    typical_calendar_days TEXT NOT NULL,
    typical_team_size TEXT NOT NULL,
    typical_revision_rounds TEXT NOT NULL,
    notes TEXT,
    updated_by INTEGER,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (updated_by) REFERENCES users(id)
);
```

**activity_log**
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

### Seed Data — Legacy Norms

| Type | Calendar Days | Team Size | Revision Rounds |
|------|--------------|-----------|-----------------|
| CDD | 11-20 | 3 | 2 |
| Competitive landscape | 11-20 | 3 | 2 |
| Financial model | 6-10 | 2 | 1 |
| Market access | 11-20 | 3 | 2 |
| Proposal | 4-5 | 2 | 1 |
| Call prep brief | 2-3 | 1 | 1 |
| Presentation | 4-5 | 2 | 2 |
| KOL mapping | 11-20 | 3 | 2 |

---

## API Endpoints

### Auth
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/auth/login` | None | Login, returns JWT + user info |
| POST | `/api/auth/register` | Admin | Create new user |

### Deliverables (Tier 1)
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/deliverables` | Any | List with pagination + status filter |
| POST | `/api/deliverables` | Any | Create new deliverable |
| GET | `/api/deliverables/{id}` | Any | Get single deliverable |
| PUT | `/api/deliverables/{id}` | Any | Update Tier 1 fields |
| DELETE | `/api/deliverables/{id}` | Admin | Delete deliverable |

### Expert Self-Service (NO auth — token-based)
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/expert/{token}` | None | Get deliverable context for expert |
| POST | `/api/expert/{token}` | None | Submit expert assessment (Tier 2) |

### Legacy Norms
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/norms` | Any | List all norms |
| GET | `/api/norms/{type}` | Any | Get norm for deliverable type |
| PUT | `/api/norms/{type}` | Any | Update norm |

### Metrics (Dashboard)
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/metrics/summary` | Any | Aggregate summary |
| GET | `/api/metrics/deliverables` | Any | Per-deliverable metrics |
| GET | `/api/metrics/trends` | Any | Trend data for charts |
| GET | `/api/metrics/scaling-gates` | Any | Scaling gate assessment |

### Other
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/activity` | Any | Activity log with pagination |
| GET | `/api/export/excel` | Any | Export all data to XLSX |
| GET | `/api/export/file/{name}` | Any | Download exported file |
| GET | `/api/health` | None | Health check |

### Login Response Shape
```json
{
    "access_token": "eyJ...",
    "token_type": "bearer",
    "expires_in": 28800,
    "user": {
        "id": 1,
        "username": "admin",
        "name": "Admin",
        "role": "admin"
    }
}
```

### Create Deliverable Request
```json
{
    "pioneer_name": "Bob Delise",
    "pioneer_email": "bob@alira.health",
    "deliverable_type": "CDD",
    "engagement_stage": "Active engagement",
    "client_name": "Apposite Capital",
    "description": "Full commercial due diligence",
    "date_started": "2026-01-15",
    "date_delivered": "2026-02-01",
    "xcsg_calendar_days": "4-5",
    "xcsg_team_size": "1",
    "xcsg_revision_rounds": "0",
    "scope_expansion": "Yes expanded scope",
    "legacy_calendar_days": null,
    "legacy_team_size": null,
    "legacy_revision_rounds": null
}
```
When `legacy_*` fields are null, auto-populate from legacy norms table.

---

## Survey Questions — Complete Reference

### Deliverable Types (A1)
CDD, Competitive landscape, Financial model, Market access, Proposal, Call prep brief, Presentation, KOL mapping

### Engagement Stages (A2)
New business (pre-mandate), Active engagement, Post-engagement (follow-on)

### Tier 1 Fields (PMO collects — observable facts)

| Field | Options |
|-------|---------|
| Calendar Days (xCSG + Legacy) | 1, 2-3, 4-5, 6-10, 11-20, 20+ |
| Team Size (xCSG + Legacy) | 1, 2, 3, 4+ |
| Revision Rounds (xCSG + Legacy) | 0, 1, 2, 3+ |
| Scope Expansion | Yes expanded scope, Yes new engagement, No, Not yet delivered |

### Tier 2 Fields (Expert self-reports — judgment required)

| ID | Question | Options |
|----|----------|---------|
| B1 | Starting point | From AI draft, Mixed, From blank page |
| B2 | Research sources | 1-3, 4-7, 8-12, 13+ |
| B3 | Assembly ratio | >75% AI, 50-75%, 25-50%, <25% |
| B4 | Hypothesis approach | Hypothesis-first, Hybrid, Discovery-first |
| C1 | Specialization level | Deep specialist, Adjacent expertise, Generalist |
| C2 | Level of directness | Expert authored, Expert co-authored, Expert reviewed only |
| C3 | Judgment content % | >75% judgment, 50-75%, 25-50%, <25% |
| D1 | Proprietary data used | Yes, No |
| D2 | Knowledge reuse | Yes directly reused and extended, Yes provided useful starting context, No built from scratch |
| D3 | Moat test | No — proprietary inputs decisive, Partially — they would miss key insights, Yes — all inputs publicly available |
| F1 | Legacy feasibility | Not feasible, Feasible but 2x+ cost, Feasible similar cost, Legacy more effective |
| F2 | Productization potential | Yes largely as-is, Yes with moderate customization, No fully bespoke |

**IMPORTANT**: The D3 options use em dashes (—). Ensure exact string match between HTML `<option value="">`, backend scoring maps, and frontend chart logic. Do NOT use smart quotes or apostrophes inside single-quoted JS strings.

---

## Metrics Computation (metrics.py)

### Midpoint Mappings
```python
DAYS_MIDPOINTS = {"1": 1, "2-3": 2.5, "4-5": 4.5, "6-10": 8, "11-20": 15, "20+": 25}
TEAM_MIDPOINTS = {"1": 1, "2": 2, "3": 3, "4+": 5}
REVISION_NUMBERS = {"0": 0, "1": 1, "2": 2, "3+": 3.5}
```

### Per-Deliverable
```
Person-Days = midpoint(calendar_days) × midpoint(team_size)
Effort Ratio = Legacy Person-Days / xCSG Person-Days
Quality Ratio = Legacy Revisions / xCSG Revisions  (if xCSG=0, use 0.5 as denominator)
Value Multiplier = Effort Ratio × Quality Ratio
```

### Flywheel Leg Scores (each 0.0–1.0)

**Machine-First** = average of:
- B1: From AI draft=1.0, Mixed=0.5, From blank page=0.0
- B2: 1-3=0.25, 4-7=0.5, 8-12=0.75, 13+=1.0
- B3: >75% AI=1.0, 50-75%=0.75, 25-50%=0.5, <25%=0.25

**Senior-Led** = average of:
- C1: Deep specialist=1.0, Adjacent expertise=0.5, Generalist=0.0
- C2: Expert authored=1.0, Expert co-authored=0.5, Expert reviewed only=0.0
- C3: >75% judgment=1.0, 50-75%=0.75, 25-50%=0.5, <25%=0.25

**Proprietary Knowledge** = average of:
- D1: Yes=1.0, No=0.0
- D2: Directly reused=1.0, Useful context=0.5, From scratch=0.0
- D3: No (proprietary decisive)=1.0, Partially=0.5, Yes (all public)=0.0

### Scaling Gates (6 total)
1. **Multi-engagement**: ≥2 deliverable types completed
2. **Time reduction**: Average effort ratio > 1.3 (>30% reduction)
3. **Client-invisible quality**: ≥1 deliverable with 0 revision rounds
4. **Transferability**: Placeholder (requires non-pioneer data)
5. **Flywheel validation**: Placeholder (requires registry-integrated AI delivery)
6. **Compounding**: D2 reuse rate ≥40% across completed deliverables

---

## Frontend — SPA Structure

### Views (hash-based routing)

| Hash | View | Description |
|------|------|-------------|
| `#dashboard` | Dashboard | KPI cards + progressive checkpoint panels |
| `#new` | New Deliverable | Tier 1 form (PMO) |
| `#deliverables` | Deliverables List | Table with status/type/date filters |
| `#norms` | Legacy Norms | Editable norms table |
| `#activity` | Activity Log | Timestamped action log |
| `#expert/{token}` | Expert Form | Standalone Tier 2 form (no sidebar, no auth) |

### Three Top-Level Containers
1. `loginScreen` — centered login card
2. `appShell` — sidebar + main content (all authenticated views)
3. `expertView` — standalone expert assessment form (token-based, no auth)

Only one is visible at a time.

### Dashboard — Progressive Checkpoints

Use Chart.js 4.4.0 (loaded via CDN with `defer`).

**Checkpoint 1 (1–2 complete)**: Scorecard table only. Each row = deliverable with type, person-days, effort ratio, revision comparison, value multiplier.

**Checkpoint 2 (3–7 complete)**: Add effort comparison bar chart (legacy vs xCSG person-days), quality comparison chart (revision rounds), three flywheel leg gauges (progress bars, 0–100%).

**Checkpoint 3 (8–19 complete)**: Add value multiplier trend line, quality trend line, compound signal trend.

**Checkpoint 4 (20+ complete)**: Add scaling gates panel (6 gates, pass/pending badges), moat analysis chart, full F1 distribution.

Charts render dynamically inside `#dashboardContent` div. Use `setTimeout(() => initCharts(), 100)` after innerHTML update to ensure canvas elements exist before Chart.js binds to them. Destroy old chart instances before creating new ones.

### New Deliverable Form

Two-column layout where appropriate. Sections:
1. **Deliverable Information**: Type (dropdown), Engagement Stage (dropdown), Pioneer Name, Pioneer Email, Client Name, Description (textarea)
2. **Timeline**: Date Started (date picker), Date Delivered (date picker)
3. **xCSG Performance**: Calendar Days, Team Size, Revision Rounds, Scope Expansion (all dropdowns)
4. **Legacy Performance**: Calendar Days, Team Size, Revision Rounds (auto-populate from norms when type selected, overridable)
5. **Submit button**: "Create Deliverable" (primary) + "Clear" (secondary)

On successful creation: show modal with expert link (URL: `{origin}/#expert/{token}`). Copy-to-clipboard button.

### Expert Form (standalone)

- Shows deliverable context at top (type, client, dates, team size)
- Four fieldsets: Section B (4 questions), Section C (3 questions), Section D (3 questions), Section F (2 questions)
- Each question has a label, dropdown, and helper text (`<small>`)
- Submit button at bottom
- On success: hide form, show thank-you message

### Key Frontend Patterns

```javascript
// Safe event listener setup
function on(id, event, handler) {
    const el = document.getElementById(id);
    if (el) el.addEventListener(event, handler);
    else console.warn('Element not found:', id);
}

// API call utility with auto-logout on 401
async function apiCall(method, endpoint, body = null, options = {}) {
    const headers = { 'Content-Type': 'application/json' };
    if (state.authToken && !options.skipAuth) {
        headers['Authorization'] = `Bearer ${state.authToken}`;
    }
    const response = await fetch(API_BASE + endpoint, { method, headers, body: body ? JSON.stringify(body) : null });
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
# Try pip3 first (macOS), then pip, then python3 -m pip
PIP_CMD=""
if command -v pip3 &>/dev/null; then PIP_CMD="pip3"
elif command -v pip &>/dev/null; then PIP_CMD="pip"
else PIP_CMD="python3 -m pip"; fi

$PIP_CMD install -r requirements.txt
python3 -m uvicorn backend.app:app --host 0.0.0.0 --port 8000 --reload
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
EXPOSE 8000
CMD ["python", "-m", "uvicorn", "backend.app:app", "--host", "0.0.0.0", "--port", "8000"]
```

### docker-compose.yml
```yaml
version: '3.8'
services:
  tracker:
    build: .
    ports:
      - "8000:8000"
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
| CORS_ORIGINS | `["http://localhost:3000", "http://localhost:8000"]` | Allowed origins (JSON) |
| ENV | `development` | Environment mode |

---

## Known Pitfalls (Lessons Learned)

1. **String matching**: D3 moat test options contain em dashes (—). HTML `<option>` values, backend scoring maps in metrics.py, and frontend chart logic MUST use identical strings. Never use smart quotes or apostrophes inside single-quoted JS strings (use double quotes or template literals for strings containing apostrophes).

2. **Import paths**: All backend modules use `from backend import auth`, `from backend.models import ...`, etc. (not bare `import auth`). This is required because the app runs via `python -m uvicorn backend.app:app` from the project root.

3. **Stale database**: If the SECRET_KEY changes, old password hashes still verify fine (PBKDF2 doesn't use the JWT secret). But if the hashing algorithm or parameters change, seed_data() must detect and re-hash. Always verify seed users on startup.

4. **Chart.js loading**: Load with `defer` attribute. Charts render into dynamically created `<canvas>` elements — always verify the canvas exists before calling `new Chart()`. Destroy previous chart instances before re-creating.

5. **Frontend field name matching**: The JSON response from `/api/metrics/summary` uses `average_value_multiplier` (not `avg_value_multiplier`). The frontend must match exactly.

6. **Token storage**: Using `window.__app_token` means tokens don't survive page refresh. This is by design (security). Users re-login after refresh.

7. **Static file mount order**: `app.mount("/", StaticFiles(...))` MUST be the last route definition — it's a catch-all that would shadow API routes if placed before them.

8. **Expert form has NO auth**: The `GET/POST /api/expert/{token}` endpoints are deliberately unauthenticated. The UUID token IS the authentication. Don't add auth middleware to these routes.
