# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

xCSG Value Measurement Tracker — a web app (FastAPI + SQLite + vanilla HTML/JS/CSS) that tracks consulting deliverable performance for Alira Health. Experts assess projects via token-based links (no login required), and the system computes flywheel metrics, value gain ratios, quality scores, and scaling gates.

## Commands

### Run the dev server
```bash
./launch.sh          # installs deps, starts uvicorn on port 8765 with --reload
```

### Run E2E tests (Playwright)
```bash
# Each suite needs a clean DB — they delete tracker.db on startup via the playwright config
npx playwright test tests/e2e-full.spec.ts --headed --timeout 600000     # 7 tests, ~30s
npx playwright test tests/e2e-realistic.spec.ts --headed --timeout 600000  # 11 tests, ~2m (creates 20 projects + surveys)
```

### Run backend QC suite
```bash
python tests/test_v2_qc.py
```

### Check frontend syntax
```bash
node --check frontend/app.js
```

### Docker
```bash
docker-compose up --build   # port 8765
```

### Login credentials (dev seed)
- admin / AliraAdmin2026!

## Architecture

### Single Source of Truth: `backend/schema.py`

All field definitions, scoring weights, section metadata, and metric definitions live in `schema.py`. Both `metrics.py` and `app.py` import from it. The frontend loads it via `/api/schema` at startup — no hardcoded scoring maps in JS.

When adding/changing a survey field, scoring weight, or metric label, **edit `schema.py` only**. Everything else derives from it.

### Backend (`backend/`)

FastAPI serving both the API and static frontend files.

- `schema.py` — **Single source of truth**. Defines: `SECTIONS`, `SCORES`, `EXPERT_FIELDS`, `METRICS`, `NORMS_COLUMNS`, `build_schema_response()`.
- `auth.py` — JWT auth (PBKDF2-SHA256, HS256, 8h expiry). Roles: admin, analyst, viewer.
- `models.py` — Pydantic request/response models. Expert responses have 35 fields across sections B-G and L.
- `database.py` — SQLite with WAL mode. Tables: users, project_categories (11 seeded), projects, expert_responses, legacy_norms, activity_log. Runs `init_db()` + migrations on startup.
- `metrics.py` — Computation engine. Imports all scoring dicts from `schema.py`. Key metrics:
  - **Delivery Speed**: legacy_person_days / xcsg_person_days
  - **Output Quality**: xcsg_quality_score / legacy_quality_score
  - **xCSG Value Gain**: (xcsg_quality / xcsg_days) / (legacy_quality / legacy_days) — quality per unit of effort
  - **Flywheel scores**: Machine-First (B2/L6 ratio), Senior-Led (avg of C1/L7, C2/L8, C3/L9), Knowledge (avg of D1/L10, D2/L11, D3/L12)
  - **7 Scaling Gates**: multi-engagement, effort reduction, client-invisible quality, transferability, flywheel validation, compounding, adoption confidence
- `app.py` — Routes: `/api/schema`, `/api/auth/*`, `/api/projects/*`, `/api/expert/*`, `/api/dashboard/*`, `/api/norms/*`, `/api/activity`, `/api/export/*`. Static mount is the **last line** (catch-all for SPA).

### Frontend (`frontend/`)

Single-page app, purely vanilla JS. No build step, no bundler.

- `index.html` — Three root containers: `#loginScreen`, `#appShell`, `#expertView`. Loads ECharts 5.6.0 from CDN.
- `app.js` — Hash-based routing (#portfolio, #new, #projects, #norms, #settings, #activity, #expert/, #assess/). Loads schema from `/api/schema` at startup. `getAssessmentFields()` and `getExpertSections()` derive UI from schema — no hardcoded field definitions.
- `styles.css` — Alira Health brand: Navy `#121F6B` primary, Blue `#6EC1E4` accent, Inter font.

### Expert Flow

1. Project created → generates unique `expert_token`
2. Expert link: `/#expert/{token}` or `/#assess/{token}`
3. Expert form shows Section A (context, read-only) then Sections B-G and L (accordion)
4. On submit → backend computes metrics, returns flywheel scores with explanations
5. Project status → `complete`, metrics available in dashboard

### Key Metrics Terminology

| Label | Key | What it measures |
| ----- | --- | --------------- |
| Delivery Speed | `delivery_speed` | Legacy person-days / xCSG person-days |
| Output Quality | `output_quality` | xCSG quality score / legacy quality score |
| xCSG Value Gain | `productivity_ratio` | Quality per person-day, xCSG vs legacy |
| Machine-First Gain | `machine_first_score` | Knowledge synthesis breadth, xCSG vs legacy |
| Senior-Led Gain | `senior_led_score` | Expert involvement depth, xCSG vs legacy |
| Knowledge Gain | `proprietary_knowledge_score` | Proprietary data/reuse/moat, xCSG vs legacy |

All ratios displayed as `Nx` format. Signal metrics (Reuse Intent, AI Survival, Client Pulse) displayed as `N%`.

## Critical Rules

- **No frameworks**: No React, Vue, or Tailwind. Vanilla HTML/JS/CSS only.
- **Schema is the source of truth**: All field definitions, scoring weights, option strings, and metric labels live in `backend/schema.py`. Do not duplicate them in `app.js` or `metrics.py`.
- **String consistency**: Option values in `schema.py` must match exactly across scoring maps and expert form. The D3 moat-test options use em dashes (—).
- **Import paths**: Use `from backend import auth`, `from backend.schema import SCORES`. The app runs from project root via `python -m uvicorn backend.app:app`.
- **Static mount last**: `app.mount("/", StaticFiles(...))` must remain the final line in `app.py`.
- **Seed recovery**: `seed_data()` in `database.py` re-hashes default passwords on every startup.
- **ECharts containers**: Use `<div>` elements (not `<canvas>`) for ECharts chart containers. ECharts creates its own canvas internally.
- **Working days auto-computed**: When `date_started` and `date_delivered` are provided but `working_days` is not, `_normalize_project_payload` computes business days automatically.

## Environment Variables

- `SECRET_KEY` — JWT signing key (has dev default, must change in prod)
- `DATABASE_PATH` — SQLite file location (default: `./data/tracker.db`)
- `JWT_EXPIRY_HOURS` — Token lifetime (default: 8)
- `CORS_ORIGINS` — JSON array of allowed origins

## Docs

- `docs/SPEC.md` — Complete build specification (schema, routes, models, brand system)
- `docs/FRAMEWORK.md` — Measurement methodology (flywheel, scoring, survey design)
- `docs/Instructions.md` — Build order and critical rules
- `docs/DESIGN-palladio-ui.md` — UI design system
- `v2/` — Previous version snapshot for reference
