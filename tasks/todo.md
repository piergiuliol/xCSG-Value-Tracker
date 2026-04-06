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

## Phase 2-4: Later phases
(Not in scope for this task)
