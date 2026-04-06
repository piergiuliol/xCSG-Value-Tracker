# xCSG Value Tracker — Realignment Spec

_April 6, 2026 — PJ + Archie_

## Why We're Realigning

The v2 Legacy Norms build (commits 7a01fa4, 7c248f1) over-engineered the norms into a 9-dimensional configurable system. The actual framework is much simpler: norms are **dead-simple reference baselines**. The sophistication belongs in the **20-question survey instrument**, the **two-tier workflow**, and the **progressive checkpoint dashboard**.

Reference: `docs/REFERENCE-framework.md` (confidential Alira document)

---

## Part 1: What to Revert / Simplify

### Legacy Norms → Back to Simple Reference Table

**Current (wrong):** Multi-dimensional norms with complexity, client sector/sub-category, geographies/countries, cascading lookup, 1-7 sliders, full CRUD admin.

**Correct:** 8 rows (one per deliverable type), 3 columns (calendar days, team size, revision rounds). Auto-populate from this table. Pioneer can override per-project.

| Deliverable Type | Calendar Days | Team Size | Revision Rounds |
|-----------------|---------------|-----------|-----------------|
| CDD | 15 | 3 | 2 |
| Competitive Landscape | 15 | 3 | 2 |
| Financial Model | 8 | 2 | 1 |
| Market Access | 15 | 3 | 2 |
| Proposal | 5 | 2 | 1 |
| Call Prep Brief | 3 | 1 | 1 |
| Presentation | 5 | 2 | 2 |
| KOL Mapping | 15 | 3 | 2 |

(Values from framework. May need admin edit capability for recalibration.)

**Action:**
- Drop `legacy_norms_v2` table and related routes
- Keep original `legacy_norms` table structure (one row per category, 3 fields)
- Keep it editable by admin for quarterly recalibration
- Auto-populate on new project, pioneer can override

### Project Fields → Match Framework Exactly

**Remove from today's build:**
- `complexity` (1-7 slider)
- `client_sector`, `client_sub_category` (cascading)
- `geographies`, `countries_served` (multi-select)
- `avg_revision_intensity`, `avg_scope_expansion`, `avg_senior_involvement`, `avg_ai_usage` (from norms)
- Machine-first composite from sliders

**Keep:**
- `xcsg_calendar_days`, `xcsg_team_size` (numeric — already exist)
- `xcsg_revision_rounds` (already exists)
- `legacy_calendar_days`, `legacy_team_size`, `legacy_revision_rounds` (auto-populated from norms, overrideable)
- `xcsg_scope_expansion` (keep but as categorical, not slider)

---

## Part 2: What to Build (Aligned to Framework)

### A. Project Form — Tier 1 (PMO Helper Collects)

Collected when project is created:

| Field | Type | Source |
|-------|------|--------|
| Project name | text | PMO |
| Client name | text | PMO |
| Deliverable type (category) | dropdown (8 options) | PMO |
| Pioneer name | text | PMO |
| Pioneer email | email | PMO |
| Date started | date | PMO |
| Date delivered | date | PMO |
| xCSG calendar days | numeric | PMO (auto from dates) |
| xCSG team size | numeric | PMO |
| xCSG revision rounds | numeric | PMO |
| xCSG scope expansion | dropdown: None / Minor / Major | PMO |
| Legacy calendar days | numeric | Auto from norms, overrideable |
| Legacy team size | numeric | Auto from norms, overrideable |
| Legacy revision rounds | numeric | Auto from norms, overrideable |

### B. Expert Assessment — Tier 2 (Expert Self-Reports)

**20 questions, ALL categorical dropdowns, zero free text.** Expert receives a unique link.

Each question has TWO columns: xCSG Actual + Legacy Baseline.

#### B: Machine-First Score (4 questions)

| # | Question | Options |
|---|----------|---------|
| B1 | Starting point | Raw request → Light brief → Structured brief → Hypothesis → Full hypothesis deck |
| B2 | Research sources | General web → Industry databases → Proprietary database → Internal knowledge base → Synthesized firm knowledge |
| B3 | Assembly ratio | >80% manual → 60-80% → 40-60% → 20-40% → <20% manual |
| B4 | Hypothesis-first approach | Exploratory → Mostly exploratory → Balanced → Mostly hypothesis-led → Fully hypothesis-led |

#### C: Senior-Led Model (5 questions)

| # | Question | Options |
|---|----------|---------|
| C1 | Specialization | Generalist → Mixed → Specialist → Deep specialist → World-class expert |
| C2 | Directness of involvement | Delegated → Partially delegated → Shared → Hands-on → Personally leading |
| C3 | Judgment proportion | <20% → 20-40% → 40-60% → 60-80% → >80% |
| C4 | Senior time multiplier (xCSG only) | Numeric: hours spent |
| C5 | Junior time multiplier (xCSG only) | Numeric: hours spent |

#### D: Proprietary Knowledge (3 questions)

| # | Question | Options |
|---|----------|---------|
| D1 | Proprietary data used | None → Public data → Some proprietary → Mostly proprietary → Fully proprietary |
| D2 | Knowledge reuse | One-time → Some reuse → Moderate → High → Maximum |
| D3 | Moat test | Easily replicable → Somewhat → Moderately unique → Highly unique → Impossible to replicate |

#### E: Time & Efficiency (already captured)

| # | Question | Source |
|---|----------|--------|
| E1 | Calendar days | PMO form |
| E2 | Team size | PMO form |

#### F: Value Creation (2 questions)

| # | Question | Options |
|---|----------|---------|
| F1 | Feasibility assessment | Not assessed → Basic → Standard → Comprehensive → Exceeds requirements |
| F2 | Productization potential | None → Identified → Designed → Implemented → Scaled |

### C. Computed Metrics (from survey responses)

| Metric | Formula | What It Measures |
|--------|---------|-----------------|
| **Effort Ratio** | legacy_person_days / xcsg_person_days | Time savings |
| **Quality Ratio** | legacy_revisions / xcsg_revisions | Revision reduction |
| **Value Multiplier** | effort_ratio × quality_ratio | Combined value |
| **Machine-First Score** | average of B1-B4 (1-5 scale) | How machine-first was the approach |
| **Senior-Led Score** | average of C1-C3 (1-5 scale) | How senior-driven was the engagement |
| **Proprietary Knowledge Score** | average of D1-D3 (1-5 scale) | How much proprietary knowledge was leveraged |
| **Flywheel Health** | average of all leg scores | Overall system health |
| **Implied Margin Improvement** | (effort_ratio - 1) × blended_daily_rate × xcsg_days | $ saved (at Checkpoint 4, requires finance input for rate) |

### D. Progressive Checkpoint Dashboard

| Checkpoint | Projects | Unlocks |
|------------|----------|---------|
| **1 — First Light** | 1 | Individual project card, basic metrics |
| **2 — Pattern Detection** | 5 | Trend line, category comparison, avg multipliers |
| **3 — Proof of Concept** | 10 | Flywheel leg scores, scatter plots, statistical significance |
| **4 — At Scale** | 20+ | Full dashboard, margin improvement, scaling gate assessment, portfolio view |

**Scaling Gates (at Checkpoint 4):**
| Gate | Pass Criteria |
|------|--------------|
| Value consistency | ≥80% of projects show >2x value multiplier |
| Machine-first maturity | Average B1-B4 score ≥ 3.5 |
| Senior leverage | Average C1-C3 score ≥ 3.5 AND senior time ≤ legacy |
| Knowledge flywheel | Average D1-D3 score ≥ 3.0 |
| Margin improvement | Positive implied margin improvement |

### E. Expert Assessment UX

- PMO creates project → system generates unique expert token
- Email sent to pioneer with link: `/assess/{token}`
- Expert sees project context (name, type, dates, team size)
- Expert fills 20 questions as categorical dropdowns (xCSG column + Legacy column)
- Zero free text, zero sliders — quick and consistent
- Submit → results locked, metrics computed

---

## Part 3: Implementation Plan

| Phase | What | Who | Effort |
|-------|------|-----|--------|
| **0** | Revert norms v2 changes. Restore simple 8-row reference table. | Dedalus | 0.5 day |
| **1** | Expert assessment form: 20 categorical questions matching framework exactly. Both xCSG and Legacy columns. | Palladio (design) → Giotto (build) | 1 day |
| **2** | Computed metrics: machine-first score, senior-led score, proprietary knowledge score, flywheel health. | Dedalus | 0.5 day |
| **3** | Progressive checkpoint dashboard: 4 stages, scaling gates. | Palladio (design) → Giotto (build) | 1 day |
| **4** | Implied margin improvement (requires blended rate config from finance). | Dedalus | 0.5 day |

**Total: ~3.5 days**

---

## Open for Palladio Discussion

1. **Expert assessment UX:** How to present 20 questions × 2 columns without it feeling like a spreadsheet? Wizard/stepper? Card-based? Accordion by section (B/C/D/F)?
2. **Dashboard layout:** How to show progressive checkpoints — grey out locked panels? Tabs? Expandable sections?
3. **Project form:** Tier 1 is simpler now. Any UX improvements while we're simplifying?
4. **Mobile:** Expert assessment link might be opened on phone. Responsive design needed?

---

## Reference Files

- `docs/REFERENCE-framework.md` — Full confidential framework document
- `docs/SPEC-legacy-norms-v2.md` — Previous spec (to be superseded by this one)
- `~/Documents/Projects/xCSG-Value-Tracker/` — Current codebase
