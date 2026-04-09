# xCSG Value Measurement Framework — V2

**CONFIDENTIAL** — Alira Health xCSG Initiative

---

## Change Log from V1

| Change | Rationale |
|--------|-----------|
| **Working days replaces calendar days** for effort computation | Calendar days include weekends, holidays, waiting time — working days capture actual effort |
| **Per-project legacy estimates** replace static norms table | A CDD for Phase III oncology ≠ a CDD for pre-clinical rare disease. Expert estimates what legacy would have required for *this specific deliverable* |
| **Project categories** added for aggregation | Admin-managed taxonomy for portfolio views and outlier detection (no impact on per-deliverable scoring) |
| **Revision depth replaces revision count** (C4) | One revision could be a typo fix or a full rewrite. Options: No revisions needed / Cosmetic only / Moderate rework / Major rework |
| **Quality composite** replaces quality ratio | Average of available components: revision depth + scope expansion + expert self-assessment + client pulse. No fixed weights — simple average of available signals |
| **Expert self-assessment** added (C6) | "Compared to your best traditional work of this type: Significantly better / Somewhat better / Comparable / Somewhat worse" |
| **Outcome Rate & Revenue Productivity** replace Value Multiplier | Outcome Rate = Quality Score / Person-Days (value = outcome/time). Revenue Productivity = Revenue / Person-Days (board metric). Disprove matrix uses both |
| **Expert form expanded to 27 answers** | 15 xCSG (including C6 self-assessment and G1 reuse intent) + 12 paired legacy estimates (working days, team size, revision depth, scope expansion likelihood, expected client reaction, B2, C1, C2, C3, D1, D2, D3). ~6-7 min |
| **Norms table demoted** to reasonableness check | Flags expert estimates deviating >1.5× from type average. PMO sees alert, can accept or query. Not primary benchmark |
| **Computed calendar days** from actual dates instead of range dropdowns (xCSG side) | Eliminates midpoint estimation error; dates already collected |
| **Separated reporting** of Effort Ratio and Quality Score as primary metrics | Multiplying independent dimensions inflates headline numbers and is hard to defend under scrutiny |
| **Added B5 — AI Survival Rate** | Captures what % of AI-generated content survived to final; honest friction signal the framework previously lacked |
| **Added G1 — Expert Reuse Intent** | Binary "would you use xCSG again for this type?" — enables a genuine disprove signal (declining reuse intent over time) |
| **Added G2 — Client Pulse** (optional, Tier 3) | One external quality signal from the client contact; addresses the framework's blind spot on client voice |
| **Added Section G — Honest Signal** | New section grouping the failure/friction and external validation questions |
| **B4 scoring revised** | Hypothesis-first scored 1.0 only in Machine-First leg, not as a standalone quality claim |
| **Total questions**: 27 (was 23) | Expert form expanded with paired legacy estimates and self-assessment |
| **Parallel comparison protocol** added | One head-to-head during pilot for board-grade evidence |

---

## First Principle

**Value = Outcome / Time**

In consulting, value improves when the outcome is better OR the time is less. The xCSG model claims to improve both simultaneously through a three-legged flywheel. This framework measures that claim by comparing xCSG delivery against Alira Health legacy operations on both dimensions, per deliverable, over time.

**V2 metric design**: Value is measured through two complementary lenses. *Outcome Rate* (Quality Score / Person-Days) captures intellectual leverage — better outcomes per unit of time. *Revenue Productivity* (Revenue / Person-Days) captures financial efficiency. Together they form a disprove matrix: high on both = thesis validated; high productivity but low outcome rate = cost-cutting only (commodity trap); high outcome rate but low productivity = quality without financial capture; low on both = model failing.

**V2 addition**: The framework must be able to *disprove* the thesis, not only confirm it. Every question design has been tested against the question: "What data pattern would indicate xCSG is NOT working?" If the framework can't produce that pattern, the question is biased.

---

## The Three Flywheel Legs (What We Measure)

| Leg | What it claims | How it improves Value |
|-----|---------------|----------------------|
| **Machine-First Operations** | AI handles assembly; humans handle judgment | Compresses **Time** (denominator) and expands **Scope** (numerator) |
| **Senior-Led Specialized Engagement Ops** | Domain experts author deliverables directly, not through intermediary layers | Improves **Outcome** (numerator) through higher first-pass quality and zero signal dilution |
| **Proprietary Knowledge** | Alira registries, institutional data, and codified methodologies create un-replicable insights | Improves **Outcome** (differentiates) AND compresses **Time** (higher starting point) |

The flywheel thesis: each leg feeds the others. AI makes the specialist more productive, the specialist's judgment makes the AI output better, and both generate proprietary knowledge that makes the next engagement start from a higher baseline. The measurement framework tests whether this compounding is actually happening.

---

## Survey Design

**Administration**: Human-collected (external tracker, not AI-triggered). Per-deliverable, administered upon delivery acceptance.

**Principles**:
- Zero free text. All categorical or quantitative.
- Every question either captures an observable fact (xCSG actual) or a calibrated professional norm (legacy baseline).
- Every question maps to the value equation or a flywheel leg.
- **V2**: At least one question per section can produce a negative signal — the framework can disprove, not only confirm.

**Total**: 27 expert answers + PMO administrative fields (15 xCSG including C6 self-assessment and G1 reuse intent + 12 paired legacy estimates).

---

### SECTION A — CONTEXT

| # | Question | Options | Collected by | Maps to |
|---|----------|---------|--------------|---------|
| A1 | What type of deliverable was produced? | CDD / Competitive landscape / Financial model / Market access / Proposal / Call prep brief / Presentation / KOL mapping | PMO | Grouping variable |
| A2 | What stage is this engagement in? | New business (pre-mandate) / Active engagement / Post-engagement (follow-on) | PMO | Commercial context |

---

### SECTION B — MACHINE-FIRST OPERATIONS

Tests whether AI compresses the assembly layer.

| # | Question | Options | Collected by | Maps to |
|---|----------|---------|--------------|---------|
| B1 | What was the starting point for this deliverable? | From AI draft / Mixed / From blank page | Expert | Machine-First adoption |
| B2 | How many distinct research sources were synthesized into this deliverable? | 1-3 / 4-7 / 8-12 / 13+ | Expert | Scope x Machine-First |
| B3 | What percentage of the deliverable assembly was performed by AI? | >75% AI / 50-75% / 25-50% / <25% | Expert | Time x Machine-First |
| B4 | How was the analytical approach structured? | Hypothesis-first / Hybrid / Discovery-first | Expert | Machine-First x Outcome framing |
| **B5** | What percentage of the initial AI-generated content survived to the final deliverable substantially unchanged? | >75% / 50-75% / 25-50% / <25% / Did not use AI draft | Expert | **Honest friction signal** |

**Why B5 matters**: This is the honesty check on B1 and B3. An expert who starts from an AI draft (B1) but keeps <25% of it (B5) reveals that the AI draft was scaffolding, not substance. The gap between B3 (assembly ratio) and B5 (survival rate) measures *real* AI contribution vs. *perceived* AI contribution. If survival rates consistently decline over time, the AI draft quality isn't keeping pace — a genuine disprove signal.

**Disprove pattern**: B5 survival rates declining while B1 shows "From AI draft" = experts are using AI out of habit but rewriting everything. Machine-First leg isn't delivering value.

---

### SECTION C — SENIOR-LED SPECIALIZED ENGAGEMENT OPERATIONS

Tests whether domain experts author deliverables directly, with judgment concentrated on high-value work.

| # | Question | Options | Collected by | Maps to |
|---|----------|---------|--------------|---------|
| C1 | How closely does your specialization match this deliverable's therapeutic or functional domain? | Deep specialist / Adjacent expertise / Generalist | Expert | Senior-Led x Outcome quality |
| C2 | What was your level of direct authorship on this deliverable? | Expert authored / Expert co-authored / Expert reviewed only | Expert | Senior-Led x Signal dilution |
| C3 | What percentage of your time on this deliverable was spent on high-value judgment work (vs. formatting, searching, assembly)? | >75% judgment / 50-75% / 25-50% / <25% | Expert | Senior-Led x Expert leverage |
| C6 | Compared to your best traditional work of this type, how would you rate the quality of this deliverable? | Significantly better / Somewhat better / Comparable / Somewhat worse | Expert (Tier 2) | Quality composite |

**Context fields** (PMO-collected, factual):

| # | Field | Options | Collected by | Maps to |
|---|-------|---------|--------------|---------|
| C4 | What level of revision was required after the first client submission? | No revisions needed / Cosmetic only (formatting, typos) / Moderate rework (1-2 sections rewritten) / Major rework (fundamental restructure) | PMO | Quality signal |
| C5 | Did this deliverable lead to expanded scope or a new engagement? | Yes expanded scope / Yes new engagement / No / Not yet delivered | PMO | Commercial proof |

**Disprove pattern**: C2 trending toward "Expert reviewed only" while C3 shows <25% judgment = the senior-led model is regressing toward legacy review-and-approve patterns.

---

### SECTION D — PROPRIETARY KNOWLEDGE

Tests whether Alira's institutional data creates un-replicable value — the moat.

| # | Question | Options | Collected by | Maps to |
|---|----------|---------|--------------|---------|
| D1 | Did this deliverable use proprietary Alira data, registries, or codified methodologies? | Yes / No | Expert | Proprietary Knowledge (binary) |
| D2 | Did you reuse knowledge, templates, or data assets from prior engagements? | Yes directly reused and extended / Yes provided useful starting context / No built from scratch | Expert | Knowledge compounding |
| D3 | Could a competitor without access to Alira's proprietary data have produced an equivalent deliverable? | No — proprietary inputs decisive / Partially — they would miss key insights / Yes — all inputs publicly available | Expert | THE MOAT TEST |

**Disprove pattern**: D3 trending toward "Yes — all inputs publicly available" = commodity trap. D2 flat at "No built from scratch" = no compounding.

---

### SECTION E — EFFORT (The Denominator)

| # | Field | xCSG | Legacy | Collected by |
|---|-------|------|--------|--------------|
| E1 | How many working days did the team spend on this deliverable? (actual days worked, not elapsed calendar time) | Integer | PMO (xCSG) / Expert (legacy estimate) |
| E2 | How many people worked on this deliverable? | 1 / 2 / 3 / 4+ | PMO (xCSG) / Expert (legacy estimate) |
| E3 | What is the engagement revenue allocated to this deliverable? | Currency amount | PMO |

**V2 change**: Working days replaces calendar days. PMO field is "Working days your team spent on this deliverable" — actual days worked, not elapsed calendar time. Removes weekend/holiday/waiting noise.

**V2 change**: Legacy effort is expert-estimated per project, not looked up from a norms table. A CDD for a Phase III oncology asset ≠ a CDD for pre-clinical rare disease. The expert who did the work is best positioned to estimate what legacy would have required for *this specific deliverable*.

**Person-days computation**:
```
xCSG_Person_Days   = xcsg_working_days × midpoint(xcsg_team_size)
Legacy_Person_Days = legacy_working_days_estimate × midpoint(legacy_team_size_estimate)
```

Team midpoints: 1→1, 2→2, 3→3, 4+→5.

**Date fields retained**: `date_started` and `date_delivered` are still collected for calendar-day trending and timeline context, but are NOT used in effort computation.

---

### SECTION F — VALUE CREATION

| # | Question | Options | Collected by | Maps to |
|---|----------|---------|--------------|---------|
| F1 | Could this deliverable have been produced using traditional methods (no AI, standard team structure)? | Not feasible / Feasible but at 2x+ the cost and time / Feasible at similar cost / Legacy would have been more effective | Expert | Holistic value comparison |
| F2 | Could this deliverable be reused or productized for similar future engagements? | Yes largely as-is / Yes with moderate customization / No fully bespoke | Expert | AaaS strategic signal |

---

### SECTION G — HONEST SIGNAL (V2 New)

Captures reuse intent and external quality validation.

| # | Question | Options | Collected by | Maps to |
|---|----------|---------|--------------|---------|
| **G1** | For this type of deliverable, would you choose the xCSG approach again over traditional methods? | Yes without hesitation / Yes with reservations / No — legacy would have been better | Expert (Tier 2) | **Adoption health** |
| **G2** | How did the client rate this deliverable? | Exceeded expectations / Met expectations / Below expectations / Not yet received | PMO (Tier 3, optional) | **External validation** |

**Why G1 matters**: The single most important V2 addition. Declining "Yes without hesitation" rates over time is the strongest disprove signal — the people using xCSG are losing confidence. Conversely, stable or rising rates are stronger evidence than any computed metric because they reflect holistic expert judgment.

**Why G2 matters**: Adds one external data point. Even with low collection rates, "Below expectations" while internal metrics look positive reveals measurement bias. Marked optional — doesn't block completion. Record starts as "Not yet received" and is updated later.

**Disprove patterns**:
- G1 trending toward "No — legacy would have been better" = model failing
- G2 showing "Below expectations" while internal metrics positive = measurement is biased

---

## Three-Tier Administration Design

**Tier 1 — PMO Helper (~5 min, observable facts)**

A1, A2, dates (for timeline context), E1 (working days), E2 (team size), E3 (engagement revenue), C4 (revision depth), C5 (scope expansion).

**Tier 2 — Expert Self-Service (~6-7 min, 27 answers)**

**xCSG assessment (15 questions):** B1–B5, C1–C3, C6, D1–D3, F1–F2, G1 (see sections above for full wording).

**Paired legacy estimates (12 questions):** Expert estimates what traditional delivery would have looked like for *this specific deliverable*.

Helper text shown to expert: *"For each question below, estimate what would have been typical if this deliverable had been done using traditional methods, without AI assistance, for this specific project."*

| # | Question | Options |
|---|----------|---------|
| L1 | How many working days would this deliverable have taken using traditional methods? | Integer |
| L2 | How many people would have been needed using traditional methods? | 1 / 2 / 3 / 4+ |
| L3 | What level of revision would you expect from a traditionally-produced version? | No revisions needed / Cosmetic only / Moderate rework / Major rework |
| L4 | Would a traditionally-produced version have led to scope expansion or new work? | Yes / No |
| L5 | What client reaction would you expect from a traditionally-produced version? | Exceeded expectations / Met expectations / Below expectations |
| L6 | How many research sources would typically be synthesized using traditional methods? (paired with B2) | 1-3 / 4-7 / 8-12 / 13+ |
| L7 | What specialization level would typically be assigned using traditional staffing? (paired with C1) | Deep specialist / Adjacent expertise / Generalist |
| L8 | What would the senior expert's role typically be in traditional delivery? (paired with C2) | Expert authored / Expert co-authored / Expert reviewed only |
| L9 | What percentage of the expert's time would be high-value judgment work in traditional delivery? (paired with C3) | >75% judgment / 50-75% / 25-50% / <25% |
| L10 | Would proprietary Alira data have been used in traditional delivery? (paired with D1) | Yes / No |
| L11 | Would prior knowledge assets have been reused in traditional delivery? (paired with D2) | Yes directly reused and extended / Yes provided useful starting context / No built from scratch |
| L12 | Could a competitor have produced an equivalent deliverable using traditional methods? (paired with D3) | No — proprietary inputs decisive / Partially — they would miss key insights / Yes — all inputs publicly available |

Total: 27 answers (15 xCSG + 12 legacy). Single-page form via unique link.

**Tier 3 — PMO Follow-Up (optional)**

G2 only. Updated on deliverable record.

### Project Categories

Admin-managed taxonomy. Every deliverable is assigned to one category. Categories serve two purposes: (1) portfolio-level dashboard aggregation (average Effort Ratio by category, Outcome Rate distribution), and (2) computing legacy norm baselines for the reasonableness check.

| # | Category |
|---|----------|
| 1 | CDD |
| 2 | Strategic Planning |
| 3 | Portfolio Management & Opportunity Assessment |
| 4 | Pricing & Reimbursement |
| 5 | Market Access Strategy |
| 6 | New Product Strategy |
| 7 | Strategic Surveillance & Competitive Intelligence |
| 8 | Evidence Generation & HEOR |
| 9 | Transaction Advisory |
| 10 | Market Research |
| 11 | Regulatory Strategy |

Admin-editable. New categories can be added as engagement types evolve. Categories do NOT set benchmarks for individual deliverables — all legacy benchmarks come from expert per-project estimates.

### Legacy Norms — Computed Aggregates (not seeded, not manually maintained)

Legacy norms are computed automatically from the aggregate of all expert legacy estimates within each project category. There is no seed data — the norms table starts empty and builds itself as questionnaires are completed.

**Computation**: After each expert submission, the system recalculates per-category running averages:
- Average legacy working days (mean of all L1 answers in the category)
- Average legacy team size (mean of all L2 answers in the category)
- Modal legacy revision depth (most frequent L3 answer in the category)
- Sample count (how many completed deliverables feed the average)

**Outlier flag**: When a category has ≥3 completed deliverables and an expert's legacy estimate deviates >1.5× from the category running average, the system flags it for PMO review. PMO can accept (with reason) or query the expert. Flag is informational — does not block submission. Below 3 deliverables in a category, no flag fires (insufficient data for a meaningful baseline).

**Dashboard use**: Category averages appear in portfolio-level views as context — "the average CDD takes 16 legacy person-days based on 8 completed assessments." This is descriptive, not prescriptive.

---

## Metrics — Computation Reference

### Per-Deliverable: Effort

```
xCSG_Person_Days   = xcsg_working_days × team_midpoint(xcsg_team_size)
Legacy_Person_Days = legacy_working_days_estimate × team_midpoint(legacy_team_size_estimate)

Effort_Ratio = Legacy_Person_Days / xCSG_Person_Days
```

Team midpoints: 1→1, 2→2, 3→3, 4+→5.

### Per-Deliverable: Quality Score (composite, 0.0–1.0)

Average of all available component scores:

| Component | Source | Score mapping |
|-----------|--------|--------------|
| Revision depth (C4) | PMO (Tier 1) | No revisions=1.0, Cosmetic only=0.85, Moderate rework=0.55, Major rework=0.2 |
| Scope expansion (C5) | PMO (Tier 1) | Yes (either)=1.0, No=0.0, Not yet delivered=excluded |
| Expert self-assessment (C6) | Expert (Tier 2) | Significantly better=1.0, Somewhat better=0.7, Comparable=0.4, Somewhat worse=0.1 |
| Client pulse (G2) | PMO (Tier 3) | Exceeded=1.0, Met=0.6, Below=0.1, Not yet received=excluded |

Quality_Score = sum(available_scores) / count(available_scores)

When G2 is missing (common early on): 3-component average. When G2 arrives: 4-component average. No component ever dominates because another is missing.

**Legacy Quality Score** (from expert per-project estimates):

| Component | Source | Score mapping |
|-----------|--------|--------------|
| Legacy revision depth | Expert estimate | Same mapping as above |
| Legacy scope expansion likelihood | Expert estimate | Yes=1.0, No=0.0 |
| Legacy expected client reaction | Expert estimate | Exceeded=1.0, Met=0.6, Below=0.1 |

Legacy_Quality = sum(scores) / count(scores)

Note: Legacy has 3 components (no self-assessment — that question is inherently comparative). This asymmetry is correct.

### Per-Deliverable: Value Metrics

**Outcome Rate** (intellectual leverage — value = outcome/time):
```
Outcome_Rate_xCSG  = Quality_Score / xCSG_Person_Days
Outcome_Rate_Legacy = Legacy_Quality / Legacy_Person_Days

Outcome_Rate_Ratio = Outcome_Rate_xCSG / Outcome_Rate_Legacy
```

**Revenue Productivity** (financial efficiency):
```
Rev_per_PD_xCSG  = Engagement_Revenue / xCSG_Person_Days
Rev_per_PD_Legacy = Engagement_Revenue / Legacy_Person_Days

Productivity_Ratio = Rev_per_PD_xCSG / Rev_per_PD_Legacy
```

Note: For same-revenue deliverables, Productivity Ratio = Effort Ratio (revenue cancels). Productivity diverges from Effort when xCSG enables higher revenue (bigger scope, new work won). The absolute Rev/PD number (e.g., €6,000/person-day) is trended over time against industry benchmarks.

### Disprove Matrix (engagement/portfolio level)

|  | **Revenue Productivity HIGH** (above practice median) | **Revenue Productivity LOW** |
|--|--|--|
| **Outcome Rate HIGH** | **Thesis validated.** Flywheel compounds quality and captures financial value. | **Pricing problem.** Great work but not translating to revenue. Fix pricing or utilization. |
| **Outcome Rate LOW** | **Cost-cutting only.** Faster and profitable but no quality moat. Commodity trap. | **Model failing.** Neither better nor more profitable. Disproved. |

### Flywheel Leg Scores (each 0.0–1.0)

**Machine-First** = average of B1, B2, B3, B4:
- B1: From AI draft=1.0, Mixed=0.5, From blank page=0.0
- B2: 1-3=0.25, 4-7=0.5, 8-12=0.75, 13+=1.0
- B3: >75% AI=1.0, 50-75%=0.75, 25-50%=0.5, <25%=0.25
- B4: Hypothesis-first=1.0, Hybrid=0.5, Discovery-first=0.0

**AI Survival Rate** (integrity check, displayed alongside Machine-First):
- B5: >75%=1.0, 50-75%=0.75, 25-50%=0.5, <25%=0.25, Did not use AI draft=N/A
- High Machine-First + low Survival = red flag indicator

**Senior-Led** = average of C1, C2, C3:
- C1: Deep specialist=1.0, Adjacent expertise=0.5, Generalist=0.0
- C2: Expert authored=1.0, Expert co-authored=0.5, Expert reviewed only=0.0
- C3: >75% judgment=1.0, 50-75%=0.75, 25-50%=0.5, <25%=0.25

**Proprietary Knowledge** = average of D1, D2, D3:
- D1: Yes=1.0, No=0.0
- D2: Directly reused=1.0, Useful context=0.5, From scratch=0.0
- D3: No (proprietary decisive)=1.0, Partially=0.5, Yes (all public)=0.0

### Flywheel Leg Scores (each 0.0–1.0)

(Existing B1-B4 mappings, AI Survival check, Senior-Led C1-C3, Proprietary Knowledge D1-D3 unchanged from current file)

### Adoption Health Index

```
Reuse_Intent_Rate = count(G1 = "Yes without hesitation") / total_completed × 100
```

### Scaling Gates (7 total)

1. **Multi-engagement**: ≥2 deliverable types completed
2. **Effort reduction**: Average effort ratio > 1.3
3. **Client-invisible quality**: ≥1 deliverable with revision depth "No revisions needed" or "Cosmetic only" AND (no G2 data OR G2 ≠ "Below expectations")
4. **Transferability**: Placeholder
5. **Flywheel validation**: Placeholder
6. **Compounding**: D2 reuse rate ≥40%
7. **Adoption confidence**: G1 "Yes without hesitation" ≥70%

---

## Incremental Dashboard Design

### KPI Cards (always visible)

| Card | Metric | Note |
|------|--------|------|
| Total Deliverables | Count of completed | — |
| Avg Effort Ratio | Mean effort ratio | Primary |
| Avg Quality Score | Mean quality composite (0-1) | Primary |
| Reuse Intent | G1 "Yes without hesitation" % | Adoption health |

### Checkpoint 1 (1-2 complete): Scorecard
Scorecard table. F1 distribution.

### Checkpoint 2 (3-7 complete): First Comparisons
Effort bars, quality bars, flywheel leg gauges + AI survival rate indicator.

### Checkpoint 3 (8-19 complete): Trend Lines
Effort ratio trend (hero), quality score trend, Outcome Rate trend, Revenue Productivity trend, flywheel leg trends, compound signal, adoption health trend.

### Checkpoint 4 (20+ complete): Full Evidence
All checkpoint 3 panels + Disprove matrix visualization, per-category breakdowns, scaling gates (7), moat analysis, F1 distribution, client signal (G2 if available).

---

## Parallel Comparison Protocol

One head-to-head during the pilot: same brief, same deadline, independently executed by xCSG and legacy teams. Outputs assessed by independent reviewer using 5-point rubric (Completeness, Accuracy, Insight Depth, Presentation Quality, Actionability). Documented as a separate case study — NOT tracked in the app.

---

## What This Framework Does NOT Measure

- **Client satisfaction directly**: C4 + G2 are proxies, not NPS
- **Long-term revenue impact**: C5 captures early signals only
- **Individual pioneer performance**: Measures the model, not people
- **Causation**: Legacy is always estimated; parallel comparison partially addresses this
- **Objective legacy baseline**: All legacy estimates are expert judgment for what *would have happened*. They are informed counterfactuals, not observed facts. The reasonableness check flags outliers but cannot eliminate estimation bias.

---

## Summary

| Element | V2 Design |
|---------|-----------|
| Total expert answers | 27 (15 xCSG including C6 self-assessment and G1 reuse intent + 12 paired legacy estimates) |
| PMO fields | Deliverable info + working days + team size + engagement revenue + revision depth + scope expansion + dates + G2 |
| Primary KPIs | Effort Ratio + Quality Score (separate) |
| Value metrics | Outcome Rate (quality/time) + Revenue Productivity (revenue/time) |
| Effort measurement | Working days × team size (not calendar days) |
| Quality measurement | Composite: revision depth + scope expansion + expert self-assessment + client pulse (average of available) |
| Legacy benchmarks | Expert per-project estimates (not static norms table) |
| Project categories | Admin-managed, for aggregation and outlier detection only |
| Disprove mechanism | 2×2 matrix (Outcome Rate × Revenue Productivity) |
| Failure capture | B5 (AI survival) + G1 (reuse intent) + disprove matrix |
| Client voice | G2 (optional, Tier 3) |
| Scaling gates | 7 (updated Gate 3 for revision depth) |
| Administration | 3 tiers (PMO facts, Expert judgment + legacy estimates, PMO follow-up) |
| Norms table | Demoted to reasonableness check / outlier flag |
