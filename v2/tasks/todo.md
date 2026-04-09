# xCSG Value Measurement Tracker V2 Plan

## Todo
- [x] Read Instructions.md, SPEC.md, and FRAMEWORK.md completely
- [x] Inspect existing repo structure and confirm work is limited to v2/
- [x] Create v2 project structure and deployment scaffolding
- [x] Build backend/auth.py with PBKDF2 hashing and JWT auth
- [x] Build backend/models.py with all Pydantic request/response models
- [x] Build backend/database.py with schema, CRUD functions, WAL setup, and seed_data()
- [x] Build backend/metrics.py with all scoring, dashboard, and scaling-gate computations
- [x] Build backend/app.py with all FastAPI routes and static mount last
- [x] Build frontend/styles.css with full Alira brand system
- [x] Build frontend/index.html SPA shell with Chart.js 4.4.0 defer and Roboto
- [x] Build frontend/app.js with login, dashboard, deliverables, expert form, settings, activity, export, inline G2 update
- [x] Add requirements.txt, launch.sh, Dockerfile, docker-compose.yml
- [x] Verify uvicorn starts on port 8765 without errors
- [x] Verify `node --check frontend/app.js` passes
- [x] Run login and root-page smoke tests from the spec

## Review
- Built complete xCSG Value Tracker V2 from scratch in v2/
- Backend: auth.py (PBKDF2+JWT), models.py (all Pydantic models), database.py (SQLite WAL, all CRUD, seed_data with password verify), metrics.py (all scoring maps with em dashes, scaling gates, flywheel legs), app.py (all API routes, static mount last)
- Frontend: index.html (SPA shell, Chart.js 4.4.0 CDN defer, Roboto), styles.css (full Alira brand system), app.js (login, dashboard with checkpoints 1-4 + KPI cards + charts, new deliverable with computed calendar days, deliverables list with inline G2, expert accordion form B1-B5 C1-C3 D1-D3 F1-F2 G1, settings norms CRUD + user registration, activity log, Excel export)
- Deploy: requirements.txt, launch.sh, Dockerfile, docker-compose.yml
- All verification passed: node --check OK, Python compile OK, uvicorn startup OK, login smoke OK, HTML served OK
- Port 8765, em dashes in D3/G1, B5 N/A handling, computed calendar days, seed password verification — all per spec
