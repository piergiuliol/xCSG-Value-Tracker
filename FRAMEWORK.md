# xCSG Measurement Framework

How the tracker measures whether AI-augmented consulting (xCSG) outperforms traditional (legacy) methods.

## How It Works

1. An internal user creates a project with timeline, team size, and category
2. Legacy defaults (calendar days, team size, revision rounds) are pre-filled from category norms
3. The expert who completed the deliverable fills a structured survey comparing xCSG vs legacy
4. The system computes metrics automatically from survey responses
5. Results feed into a portfolio dashboard with KPIs, charts, and scaling gates

## Survey Structure

The expert assessment has 8 sections. Section A is project context (read-only). Sections B-G assess xCSG performance. Section L estimates what legacy delivery would have looked like.

| Section | Name | What it measures |
| ------- | ---- | ---------------- |
| A | Context | Project baseline (read-only) |
| B | Machine-First Operations | How AI-driven was the approach? (6 questions) |
| C | Senior-Led Operations | How deeply was senior expertise involved? (6 questions) |
| D | Proprietary Knowledge | How unique was the knowledge advantage? (3 questions) |
| E | Client Impact | Did the work drive a real client decision? (1 question) |
| F | Value Creation | What value did xCSG create beyond legacy? (2 questions) |
| G | Honest Signal | Would the expert choose xCSG again? (1 question) |
| L | Legacy Estimates | Traditional delivery estimates for the same deliverable (16 questions) |

Each question uses a fixed set of options. Each option maps to a score between 0.0 and 1.0. These mappings are defined once in `backend/schema.py` and used everywhere.

## Data Priority: Expert Prevails

Legacy estimates exist in two places:

| Source | Set by | Fields |
| ------ | ------ | ------ |
| Project configuration | Internal user (PMO/admin) at project creation | Working days, team size, revision rounds — pre-filled from category norms |
| Section L survey | Expert who did the work | 16 fields covering all legacy dimensions |

**When both exist, expert data always takes precedence.** Project configuration values are only used as fallback when the expert hasn't provided an answer. This ensures metrics reflect the expert's firsthand assessment of what legacy delivery would have looked like for their specific deliverable, not a generic category estimate.

## Legacy Norms

Admins can set default legacy estimates per project category (e.g., "Landscape Assessment" typically takes 15 days with a team of 3). These norms serve two purposes:

1. **Pre-fill convenience** — when creating a project, legacy fields auto-populate from the category norm
2. **Override tracking** — if the internal user changes the pre-filled values, the system flags it as overridden

The norms dashboard shows computed aggregates (average speed, quality, value gain per category) derived from actual completed projects — not from the manually entered defaults.

## Core Metrics

All ratios compare xCSG to legacy. Values above 1.0x mean xCSG outperforms.

### Delivery Speed

**Formula:** Legacy person-days / xCSG person-days

Person-days = working days × team size. A value of 2.0x means xCSG took half the effort.

### Output Quality

**Formula:** xCSG quality score / Legacy quality score

- xCSG quality = average of: self-assessment (C6), analytical depth (C7), decision readiness (C8)
- Legacy quality = average of: legacy analytical depth (L13), legacy decision readiness (L14)

### xCSG Value Gain

**Formula:** (xCSG quality / xCSG person-days) / (Legacy quality / Legacy person-days)

Quality per unit of effort. The primary value metric — combines speed and quality into one number.

### Rework Efficiency

**Formula:** xCSG smoothness / Legacy smoothness

Smoothness = average of: revision depth, scope expansion, client pulse. Higher means smoother delivery with fewer iterations.

## Flywheel Metrics

These measure the three pillars of the xCSG model. Each compares xCSG vs legacy scores for paired questions.

### Machine-First Gain

**Formula:** xCSG research sources score (B2) / Legacy research sources score (L6)

Measures knowledge synthesis breadth. Higher = more automation leverage.

### Senior-Led Gain

**Formula:** Average of three ratios:
- Specialization depth: C1 / L7
- Directness of authorship: C2 / L8
- Expert judgment time: C3 / L9

When legacy scores 0 but xCSG scores above 0, the ratio caps at 10.0x.

### Knowledge Gain

**Formula:** Average of three ratios:
- Proprietary data use: D1 / L10
- Knowledge reuse: D2 / L11
- Competitive moat: D3 / L12

Same 10.0x cap when legacy is zero.

### Client Impact

**Formula:** xCSG client decision score (E1) / Legacy client decision score (L15)

Capped at 10.0x.

### Data Independence

**Formula:** xCSG data analysis split (B6) / Legacy data analysis split (L16)

Less time on data sourcing, more on analysis. Higher = more insight per data effort.

## Signal Metrics

These are displayed as percentages (0-100%), not ratios.

| Metric | Source | What it means |
| ------ | ------ | ------------- |
| Reuse Intent | G1 | Would the expert choose xCSG again? 100% = yes without hesitation |
| AI Survival | B5 | % of AI draft that survived into the final deliverable |
| Client Pulse | Client reaction | Client satisfaction with the deliverable |

## Scaling Gates

Seven criteria that validate whether the xCSG model is ready to scale. Each gate is pass/pending.

| # | Gate | Passes when |
| - | ---- | ----------- |
| 1 | Multi-engagement | At least 2 deliverable types completed |
| 2 | Effort reduction | Average delivery speed ratio > 1.3x |
| 3 | Client-invisible quality | At least 1 deliverable with low revision depth and no negative client pulse |
| 4 | Transferability | F2 productization rate >= 50% AND >= 2 pioneers working across 2+ categories |
| 5 | Flywheel validation | Average xCSG Value Gain of most recent 5 projects >= first 5 projects (need 6+ projects) |
| 6 | Compounding | D2 knowledge reuse rate >= 40% |
| 7 | Adoption confidence | G1 "Yes without hesitation" rate >= 70% |

## Dashboard Checkpoints

The dashboard unlocks progressively based on completed projects:

| Checkpoint | Projects needed | What unlocks |
| ---------- | --------------- | ------------ |
| 1 | 0-2 | Basic KPIs |
| 2 | 3-7 | Charts and trends |
| 3 | 8-19 | Category breakdowns |
| 4 | 20+ | Full scaling gates analysis |

## Scoring Reference

Every survey option maps to a numeric score. The complete mappings are in `backend/schema.py` under the `SCORES` dictionary. Example:

- Analytical depth: Exceptional = 1.0, Strong = 0.75, Adequate = 0.4, Superficial = 0.1
- AI assembly ratio: >75% AI = 1.0, 50-75% = 0.75, 25-50% = 0.5, <25% = 0.25
- Expert directness: Expert authored = 1.0, Expert co-authored = 0.5, Expert reviewed only = 0.0
