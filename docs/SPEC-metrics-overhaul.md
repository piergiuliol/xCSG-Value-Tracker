# xCSG Value Tracker — Metrics Overhaul

## New Expert Questions

### Section B
- **B6**: What percentage of time was spent on data sourcing and validation vs analysis?
  - `<25% on data` = 1.0
  - `25-50%` = 0.75
  - `50-75%` = 0.4
  - `>75% on data` = 0.1

### Section C
- **C7**: How would you rate the analytical depth of this deliverable?
  - `Exceptional` = 1.0
  - `Strong` = 0.75
  - `Adequate` = 0.4
  - `Superficial` = 0.1
- **C8**: Could the client make a confident decision based on this deliverable alone?
  - `Yes without caveats` = 1.0
  - `Yes with minor caveats` = 0.7
  - `Needs significant additional work` = 0.2

### Section E
- **E1**: Did this deliverable lead to a client decision or action?
  - `Yes — informed a specific decision` = 1.0
  - `Yes — referenced in internal discussions` = 0.6
  - `Too early to tell` = None
  - `No` = 0.1

### Legacy Pairs
- **L13**: What analytical depth would a traditional team typically deliver?
  - same options as C7
- **L14**: Would a traditionally-produced version have been decision-ready?
  - same options as C8
- **L15**: Would a traditional deliverable have led to the same client decision?
  - same options as E1
- **L16**: What % of time would traditional delivery spend on data sourcing?
  - same options as B6

## Metric System

All ratios follow one rule: **>1 means xCSG is winning**.

| Metric | Formula | Meaning |
|---|---|---|
| Delivery Speed | legacy_person_days / xcsg_person_days | xCSG was Nx faster |
| Output Quality | xcsg_quality / legacy_quality | xCSG quality was Nx higher |
| Rework Efficiency | legacy_smoothness / xcsg_smoothness | xCSG had Nx fewer issues |
| Machine-First Gain | xcsg_B2 / legacy_L6 | xCSG leveraged AI Nx better |
| Senior-Led Gain | xcsg_C_section / legacy_L_section | xCSG extracted Nx more senior value |
| Knowledge Gain | xcsg_D_section / legacy_L_section | xCSG had Nx stronger moat |
| Client Impact | xcsg_E1 / legacy_L15 | xCSG drove Nx more decisions |
| Data Independence | legacy_L16 / xcsg_B6 | xCSG spent Nx less time on data |
| xCSG Advantage | speed * quality | xCSG delivered Nx more value |

### Quality Definitions
- **Output Quality** = average(C6, C7, C8)
- **Legacy Quality** = average(L13, L14)
- C6 has no legacy pair

### Smoothness Definitions
- **xCSG Smoothness** = average(revision_depth_score, scope_expansion_score, client_pulse_score)
- **Legacy Smoothness** = average(legacy_revision, legacy_scope, legacy_pulse)
- AI survival is excluded from smoothness because there is no legacy equivalent
- Rework Efficiency = legacy_smoothness / xcsg_smoothness

### Null Handling
- `Too early to tell` on E1 or L15 maps to `None`
- `None` values are excluded from averages and ratios
- New fields may be null for older projects and must be handled gracefully

## Score Maps
- **B6_DATA_ANALYSIS_SCORES**
  - `<25% on data` = 1.0
  - `25-50%` = 0.75
  - `50-75%` = 0.4
  - `>75% on data` = 0.1
- **C7_ANALYTICAL_DEPTH_SCORES**
  - `Exceptional` = 1.0
  - `Strong` = 0.75
  - `Adequate` = 0.4
  - `Superficial` = 0.1
- **C8_DECISION_READINESS_SCORES**
  - `Yes without caveats` = 1.0
  - `Yes with minor caveats` = 0.7
  - `Needs significant additional work` = 0.2
- **E1_CLIENT_DECISION_SCORES**
  - `Yes — informed a specific decision` = 1.0
  - `Yes — referenced in internal discussions` = 0.6
  - `Too early to tell` = None
  - `No` = 0.1

## Database Changes
Add these TEXT columns to `expert_responses`:
- `b6_data_analysis_split`
- `c7_analytical_depth`
- `c8_decision_readiness`
- `e1_client_decision`
- `l13_legacy_c7_depth`
- `l14_legacy_c8_decision`
- `l15_legacy_e1_decision`
- `l16_legacy_b6_data`

## Frontend Dashboard
- **Top row**: Delivery Speed, Output Quality, xCSG Advantage
- **Second row**: Machine-First Gain, Senior-Led Gain, Knowledge Gain, Rework Efficiency, Client Impact, Data Independence
- **Third row**: Reuse Intent (%), AI Survival (%), Client Pulse
- Color thresholds:
  - `>1.5` green
  - `1.0-1.5` blue
  - `0.8-1.0` amber
  - `<0.8` red

## Portfolio Table
Columns:
- Project
- Category
- Pioneer
- Client
- Speed
- Quality
- xCSG Advantage
- Status
- Actions
