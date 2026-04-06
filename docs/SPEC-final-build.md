# xCSG Value Tracker — Final Build Spec (Realignment)

_April 6, 2026 — PJ + Archie + Palladio_

Supersedes: `SPEC-legacy-norms-v2.md`
Reference: `REFERENCE-framework.md` (confidential), `SPEC-realignment.md` (analysis), `DESIGN-palladio-ui.md` (UI design)

---

## Phase 0: Revert & Simplify

**Do first. Minimal diffs.**

1. Drop `legacy_norms_v2` table, `legacy_norms_history` table, and all related routes from `backend/app.py` and `backend/database.py`
2. Restore original `legacy_norms` table: one row per category, 3 fields (calendar days, team size, revision rounds)
3. Keep admin editable for quarterly recalibration
4. Remove from frontend: complexity slider, client sector/sub-category pickers, geo/country multi-select, 1-7 sliders for scope/senior/AI, machine-first composite from sliders
5. Remove new dashboard KPI cards (AI Adoption Rate, Senior Leverage, Scope Predictability) — will be replaced in Phase 2
6. Commit as clean revert

---

## Phase 1: Expert Assessment Form (20 Questions)

### Backend

Update `ExpertResponseCreate` model to match framework exactly:

**B: Machine-First (4 questions × 2 columns = 8 fields)**
- `b1_starting_point_xcsg` / `b1_starting_point_legacy`
- `b2_research_sources_xcsg` / `b2_research_sources_legacy`
- `b3_assembly_ratio_xcsg` / `b3_assembly_ratio_legacy`
- `b4_hypothesis_first_xcsg` / `b4_hypothesis_first_legacy`

Options (all 5-level categorical):
- B1: Raw request → Light brief → Structured brief → Hypothesis → Full hypothesis deck
- B2: General web → Industry databases → Proprietary database → Internal knowledge base → Synthesized firm knowledge
- B3: >80% manual → 60-80% → 40-60% → 20-40% → <20% manual
- B4: Exploratory → Mostly exploratory → Balanced → Mostly hypothesis-led → Fully hypothesis-led

**C: Senior-Led (5 questions, mixed columns)**
- `c1_specialization` (xCSG only, 5-level)
- `c2_directness` (xCSG only, 5-level)
- `c3_judgment_pct` (xCSG only, 5-level)
- `c4_senior_hours` (xCSG only, numeric)
- `c5_junior_hours` (xCSG only, numeric)

Options:
- C1: Generalist → Mixed → Specialist → Deep specialist → World-class expert
- C2: Delegated → Partially delegated → Shared → Hands-on → Personally leading
- C3: <20% → 20-40% → 40-60% → 60-80% → >80%

**D: Proprietary Knowledge (3 questions × 2 columns = 6 fields)**
- `d1_proprietary_data_xcsg` / `d1_proprietary_data_legacy`
- `d2_knowledge_reuse_xcsg` / `d2_knowledge_reuse_legacy`
- `d3_moat_test_xcsg` / `d3_moat_test_legacy`

Options:
- D1: None → Public data → Some proprietary → Mostly proprietary → Fully proprietary
- D2: One-time → Some reuse → Moderate → High → Maximum
- D3: Easily replicable → Somewhat → Moderately unique → Highly unique → Impossible to replicate

**F: Value Creation (2 questions × 2 columns = 4 fields)**
- `f1_feasibility_xcsg` / `f1_feasibility_legacy`
- `f2_productization_xcsg` / `f2_productization_legacy`

Options:
- F1: Not assessed → Basic → Standard → Comprehensive → Exceeds requirements
- F2: None → Identified → Designed → Implemented → Scaled

### Frontend (Palladio Design)

**Single-page accordion.** All sections visible, one open at a time. Native `<select>` dropdowns.

```
┌─────────────────────────────────────────────┐
│  xCSG Expert Assessment                      │
│  [Project Name] — [Client]                   │
│  Started [date] · Pioneer: [name]            │
├─────────────────────────────────────────────┤
│  ████████░░░░░░░░░░░░ 8/20 answered         │
├─────────────────────────────────────────────┤
│  ▼ B — Machine-First Operations (4/4 ✓)      │
│    B1 Starting point                         │
│    xCSG:   [select ▼]                        │
│    Legacy: [select ▼] (pre-filled from norm) │
│    B2 Research sources                       │
│    ...                                       │
│  ► C — Senior-Led Model (0/5)                │
│  ► D — Proprietary Knowledge (0/3×2)         │
│  ► F — Value Creation (0/2×2)                │
│                                               │
│            [ Submit Assessment (8/20) ]       │
└─────────────────────────────────────────────┘
```

- Sticky progress bar at top. Turns green at 20/20.
- Completed sections show ✓ + count.
- Legacy selects pre-filled from norms where applicable, show "(norm)" suffix.
- `localStorage` auto-save on every change. Restore on revisit.
- Submit disabled until 20/20. Shows count in button.
- Mobile: native selects, single column, 48px touch targets.

---

## Phase 2: Computed Metrics & Dashboard

### Computed from Survey Responses

| Metric | Formula | Where |
|--------|---------|-------|
| Machine-First Score | avg(B1-B4 xcsg values, 1-5) | Per project |
| Senior-Led Score | avg(C1-C3 xcsg values, 1-5) | Per project |
| Proprietary Knowledge Score | avg(D1-D3 xcsg values, 1-5) | Per project |
| Effort Ratio | legacy_person_days / xcsg_person_days | Per project |
| Quality Ratio | legacy_revisions / xcsg_revisions | Per project |
| Value Multiplier | effort_ratio × quality_ratio | Per project |
| Flywheel Health | avg(all leg scores across portfolio) | Portfolio |
| Implied Margin Improvement | (effort_ratio - 1) × blended_rate × xcsg_days | Per project (Checkpoint 4) |

### Progressive Checkpoint Dashboard (Palladio Design)

**Vertical card stack.** Locked = translucent + lock icon + progress bar. No tabs.

| Checkpoint | Projects | Shows |
|------------|----------|-------|
| 1 — First Light | 1+ | Individual project scorecard, basic metrics |
| 2 — Pattern Detection | 5+ | Trend line, category comparison, avg multipliers |
| 3 — Proof of Concept | 10+ | Flywheel leg scores, scatter plots |
| 4 — At Scale | 20+ | Full dashboard, margin improvement, scaling gates |

**Scaling Gates (at Checkpoint 4):**
- Value consistency: ≥80% of projects >2x multiplier
- Machine-first maturity: avg B1-B4 ≥ 3.5
- Senior leverage: avg C1-C3 ≥ 3.5 AND senior time ≤ legacy
- Knowledge flywheel: avg D1-D3 ≥ 3.0
- Margin improvement: positive

**Locked card visual:** `opacity: 0.5`, dashed border, 🔒 icon, thin progress bar. Unlocked card: white, full content. Celebration animation on unlock (border pulse 600ms).

---

## Phase 3: Project Form Simplification

**Clean single-page form. ~10 fields.**

Groupings:
- Project details (name, client, deliverable type)
- Pioneer info (name, email)
- Timeline (start date, end date → auto-compute calendar days)
- Team & revisions (team size, revision rounds, scope expansion)
- Legacy norms (auto-filled from reference table on type selection, editable, lighter background)

Scope expansion: simple `<select>` — None / Minor / Major.

No sliders, no geo pickers, no complexity. Just inputs, dates, selects.

---

## Files to Change

### Backend
- `backend/database.py` — revert norms v2 tables, update expert response schema
- `backend/models.py` — new ExpertResponseCreate with 30 fields (20 questions, some × 2 columns)
- `backend/app.py` — revert norms v2 routes, update expert assessment endpoints
- `backend/metrics.py` — new computed metrics (leg scores, flywheel health, scaling gates)

### Frontend
- `frontend/app.js` — revert norms v2 UI, rebuild expert assessment as accordion, rebuild dashboard as checkpoint cards
- `frontend/styles.css` — new styles for accordion, checkpoint cards, progress bar
- `frontend/index.html` — cache buster bump

### Data
- `data/tracker.db` — may need manual cleanup of norms v2 tables

---

## Implementation Order

| Step | What | Effort |
|------|------|--------|
| 0 | Revert norms v2. Restore simple reference table. | 0.5 day |
| 1a | Backend: new expert response model (30 fields matching framework) | 0.5 day |
| 1b | Frontend: expert assessment accordion form | 1 day |
| 2 | Backend: computed metrics (leg scores, flywheel, scaling gates) | 0.5 day |
| 3 | Frontend: progressive checkpoint dashboard | 1 day |
| 4 | Frontend: simplified project form | 0.5 day |

**Total: ~4 days**
