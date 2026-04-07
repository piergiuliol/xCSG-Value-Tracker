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

## Review

- Replaced the old placeholder metric engine with Phase 2 computed per-project and portfolio metrics.
- Added `GET /api/dashboard/metrics` and `GET /api/projects/{id}/metrics`.
- Updated `GET /api/projects` to attach computed metrics when an expert response exists.
- Verified backend imports and metric helpers with `python3 -m py_compile` and a small database-backed smoke script.
- Rewired the dashboard to use `/api/dashboard/metrics` plus project-level `metrics` from `/api/projects`.
- Replaced placeholder checkpoint content with real portfolio averages, flywheel leg scores, scaling gates, and a completed-project score table.
- Added the requested empty assessment message and multiplier color coding on the dashboard table.
- Verified the frontend bundle syntax with `node --check frontend/app.js`; runtime API verification is still auth-gated from this shell.
