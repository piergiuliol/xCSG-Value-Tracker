# xCSG Value Tracker — Final Build (Realignment)

_Spec: docs/SPEC-final-build.md | Framework: docs/REFERENCE-framework.md | Design: docs/DESIGN-palladio-ui.md_

---

## Phase 0: Revert & Simplify ⬜
- [ ] 0.1 Backend: Remove v2 norms routes from app.py (GET/POST/PUT/DELETE /api/norms/v2/*, recalculate, lookup, history)
- [ ] 0.2 Backend: Remove v2 norms functions from database.py (list/get/create/update/delete/recalculate/lookup/history, complete_project)
- [ ] 0.3 Backend: Remove v2 Pydantic models from models.py (LegacyNormV2Response, LegacyNormV2Update, NormLookupRequest, NormHistoryEntry, ProjectCompleteRequest, v2 fields from ProjectCreate/Update/MetricsSummary)
- [ ] 0.4 Backend: Remove v2 metric functions from metrics.py (compute_machine_first_v2, _compute_ai_adoption_rate, _compute_senior_leverage, _compute_scope_predictability)
- [ ] 0.5 Backend: Remove migrate_v2 from database.py init_db (stop creating legacy_norms_v2 and history tables, stop adding v2 columns)
- [ ] 0.6 Backend: Remove /api/projects/{id}/complete endpoint from app.py
- [ ] 0.7 Frontend: Remove Norms v2 nav item from sidebar
- [ ] 0.8 Frontend: Remove complexity slider, sector/sub-category pickers, geo pickers from new project form
- [ ] 0.9 Frontend: Remove 1-7 sliders (revision intensity, scope expansion) from project form
- [ ] 0.10 Frontend: Remove completion modal (8-slider modal)
- [ ] 0.11 Frontend: Remove AI Adoption Rate, Senior Leverage, Scope Predictability KPI cards from dashboard
- [ ] 0.12 Frontend: Remove complexity filter from portfolio
- [ ] 0.13 Frontend: Remove renderNormsV2Page and all related helper functions
- [ ] 0.14 Frontend: Remove SECTORS, GEOGRAPHIES constants and related helpers
- [ ] 0.15 Test: server starts, login works, basic CRUD works
- [ ] 0.16 Commit: clean revert

## Phase 1: Expert Assessment (New 23-field model) ⬜
- [ ] 1.1 Backend: New expert_responses table schema (23 fields: B×8, C×5, D×6, F×4)
- [ ] 1.2 Backend: New ExpertResponseCreate Pydantic model with 23 fields
- [ ] 1.3 Backend: Update create_expert_response in database.py
- [ ] 1.4 Backend: Update scoring maps in metrics.py to match new 5-level options
- [ ] 1.5 Backend: Update ExpertContextResponse to include legacy norms for pre-fill
- [ ] 1.6 Frontend: New accordion form for expert assessment with sticky progress bar
- [ ] 1.7 Frontend: localStorage auto-save on every change
- [ ] 1.8 Frontend: Legacy selects pre-filled from norms
- [ ] 1.9 Frontend: Native selects, 48px touch targets, mobile responsive
- [ ] 1.10 Test: expert link works, form submits, data saves
- [ ] 1.11 Commit: new expert assessment

## Phase 2: Computed Metrics ⬜
- [ ] 2.1 Backend: Update machine-first score (avg of B1-B4 xcsg, scale 1-5)
- [ ] 2.2 Backend: Update senior-led score (avg of C1-C3 xcsg, scale 1-5)
- [ ] 2.3 Backend: Update proprietary knowledge score (avg of D1-D3 xcsg, scale 1-5)
- [ ] 2.4 Backend: Flywheel health (avg of all leg scores across portfolio)
- [ ] 2.5 Backend: Scaling gates evaluation (5 gates from spec)
- [ ] 2.6 Backend: Update compute_summary and compute_project_metrics
- [ ] 2.7 Test: metrics compute correctly with new field names
- [ ] 2.8 Commit: computed metrics

## Phase 3: Progressive Dashboard ⬜
- [ ] 3.1 Frontend: Checkpoint card component (locked/unlocked visual)
- [ ] 3.2 Frontend: Vertical card stack layout
- [ ] 3.3 Frontend: Celebration animation on unlock
- [ ] 3.4 Frontend: CP1 content: scorecard table
- [ ] 3.5 Frontend: CP2 content: effort/quality comparison charts
- [ ] 3.6 Frontend: CP3 content: trend line
- [ ] 3.7 Frontend: CP4 content: scaling gates
- [ ] 3.8 Test: dashboard renders, checkpoints unlock correctly
- [ ] 3.9 Commit: progressive dashboard

## Phase 4: Simplified Project Form ⬜
- [ ] 4.1 Frontend: ~10 field form with smart grouping
- [ ] 4.2 Frontend: Auto-compute calendar days from dates
- [ ] 4.3 Frontend: Auto-populate legacy norms from category selection
- [ ] 4.4 Frontend: Scope expansion as simple select (None/Minor/Major)
- [ ] 4.5 Test: create/edit project works end-to-end
- [ ] 4.6 Commit: simplified project form
