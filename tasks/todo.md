# xCSG Value Tracker — Final Build (Realignment)

_Spec: docs/SPEC-final-build.md | Framework: docs/REFERENCE-framework.md | Design: docs/DESIGN-palladio-ui.md_

---

## Phase 0: Revert & Simplify — FIX BROKEN STATE ⬜
Phase 0 was committed (d4dfbb5) but left broken imports — server can't start.

- [ ] 0-fix-1: Remove broken v2 imports from app.py (LegacyNormV2Response, LegacyNormV2Update, NormLookupRequest, ProjectCompleteRequest)
- [ ] 0-fix-2: Remove all v2 route handlers from app.py (norms/v2/*, projects/{id}/complete)
- [ ] 0-fix-3: Remove v2 database functions from database.py (if any remain)
- [ ] 0-fix-4: Remove v2 metric functions from metrics.py (_compute_ai_adoption_rate, _compute_senior_leverage, _compute_scope_predictability, compute_machine_first_v2)
- [ ] 0-fix-5: Remove v2 references from compute_summary (ai_adoption_rate, senior_leverage, scope_predictability)
- [ ] 0-fix-6: Verify server starts

## Phase 1: Expert Assessment (23 fields, 20 categorical selects) ⬜

### 1a — Backend Model & DB Schema
- [ ] 1a-1: Create new expert_responses table with 23 fields (B×8, C×5, D×6, F×4)
- [ ] 1a-2: Update ExpertResponseCreate Pydantic model (23 fields)
- [ ] 1a-3: Update create_expert_response in database.py
- [ ] 1a-4: Update ExpertContextResponse to include legacy norms for pre-fill
- [ ] 1a-5: Update scoring maps in metrics.py to new 5-level options (1-5 scale)

### 1b — Frontend Accordion Form
- [ ] 1b-1: New accordion form with 4 sections (B/C/D/F), single-open behavior
- [ ] 1b-2: Sticky progress bar tracking 20 categorical selects
- [ ] 1b-3: Native <select> dropdowns with 5-level options from spec
- [ ] 1b-4: localStorage auto-save on every change + restore on revisit
- [ ] 1b-5: Legacy selects pre-filled from norms (show "(norm)" suffix)
- [ ] 1b-6: Submit disabled until 20/20, shows count in button
- [ ] 1b-7: Mobile responsive (48px touch targets, single column)

### 1c — Test & Commit
- [ ] 1c-1: Server starts, expert link works, form submits
- [ ] 1c-2: Test with Playwright
- [ ] 1c-3: Commit

## Phase 2: Computed Metrics & Dashboard Backend ⬜

- [x] 2-1: Read Phase 2 spec and current backend metric/data flow
- [x] 2-2: Rebuild backend/metrics.py around pure per-project + portfolio metric helpers
- [x] 2-3: Add /api/dashboard/metrics endpoint
- [x] 2-4: Add /api/projects/{id}/metrics endpoint
- [x] 2-5: Update /api/projects to include computed metrics for each project
- [x] 2-6: Run targeted backend checks
- [x] 2-7: Commit

## Phase 2b — Dashboard wiring ⬜

- [x] 2b-1: Read Phase 2 spec and current frontend dashboard implementation
- [x] 2b-2: Replace placeholder portfolio metric endpoints with `/dashboard/metrics` + `/projects`
- [x] 2b-3: Update checkpoint cards to use real unlocked/locked content and empty states
- [x] 2b-4: Update project table with per-project multiplier, effort ratio, xCSG score, and multiplier color states
- [x] 2b-5: Bump frontend cache buster and verify dashboard renders
- [x] 2b-6: Commit

## Backend bugfix follow-up (April 7) ⬜

- [x] B-1: Inspect dashboard metrics, project metrics enrichment, and database joins against the current DB state
- [x] B-2: Reproduce the broken E2E project metrics case and compare its stored project/expert response data with a working QA project
- [x] B-3: Make metrics parsing tolerant of raw numeric values like `10`, not just bucket labels like `6-10`
- [x] B-4: Add a `completed_count` field alias to dashboard metrics for compatibility with the dashboard client
- [x] B-5: Remove column-name collisions in `list_complete_projects` so project IDs stay stable when joining expert responses
- [x] B-6: Re-run targeted Python smoke checks for `list_projects`, `get_expert_response`, `compute_project_metrics`, and `get_dashboard_metrics`
- [x] B-7: Commit

## Cleanup follow-up (April 7) ⬜

- [x] C-1: Inspect current frontend/backend references for legacy norms v2 UI/routes
- [x] C-2: Rename sidebar/topbar "Norms v2" label back to "Norms"
- [x] C-3: Archive `docs/SPEC-legacy-norms-v2.md` into `docs/archive/`
- [x] C-4: Check `backend/app.py` for leftover `/api/norms/v2` routes
- [x] C-5: Run syntax checks for frontend and backend
- [x] C-6: Assess whether commit squashing is safe without risking working state
- [x] C-7: Commit cleanup changes

## Review

- Replaced the old placeholder metric engine with Phase 2 computed per-project and portfolio metrics.
- Added `GET /api/dashboard/metrics` and `GET /api/projects/{id}/metrics`.
- Updated `GET /api/projects` to attach computed metrics when an expert response exists.
- Verified backend imports and metric helpers with `python3 -m py_compile` and a small database-backed smoke script.
- Rewired the dashboard to use `/api/dashboard/metrics` plus project-level `metrics` from `/api/projects`.
- Replaced placeholder checkpoint content with real portfolio averages, flywheel leg scores, scaling gates, and a completed-project score table.
- Added the requested empty assessment message and multiplier color coding on the dashboard table.
- Verified the frontend bundle syntax with `node --check frontend/app.js`; runtime API verification is still auth-gated from this shell.
- Renamed the remaining visible "Norms v2" UI labels back to "Norms" in the sidebar and top bar.
- Archived the stale legacy norms v2 spec into `docs/archive/`.
- Checked `backend/app.py` and found no remaining `/api/norms/v2` routes to remove.
- Re-ran syntax checks with `node -c frontend/app.js` and `python3 -m py_compile backend/app.py`.
- Did not squash the recent commit history because the branch has a dirty working tree (`data/tracker.db`, `test-results/qa-phase2-dashboard.png`) and preserving the current known-good state was the safer call.
- Investigated the April 7 backend data bugs. Root cause for the new-submission metrics issue was that `metrics.py` only understood bucket labels like `6-10`, while the E2E-created project stored a raw value (`10`) for `xcsg_calendar_days`, which zeroed out person-day math. I made the parsers accept raw numeric strings, range strings, and `+` buckets.
- Added a `completed_count` alias in dashboard metrics so clients expecting that field no longer see a missing/null completed-project count.
- Fixed a subtle `list_complete_projects()` join bug where `er.*` overwrote `p.id` with `expert_responses.id`. The joined query now aliases expert-response identifiers explicitly and keeps project IDs stable.
- Added `SELECT DISTINCT` to `list_projects()` as a low-risk guard against accidental duplicate rows during future query expansion.
- Verified with a Python smoke script that `list_projects()` returns unique project rows, `get_expert_response()` finds the new submission, `compute_project_metrics()` now returns concrete metrics for the E2E test project, and dashboard metrics include `completed_count`.
