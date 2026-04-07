# Legacy Norms v2 — Build Spec

_April 6, 2026 — PJ & Archie_

## Overview

Upgrade Legacy Norms from 3 bucketed parameters to 9 contextual parameters with numeric values, cascading lookup, and qualitative sliders. Cost metrics excluded — revisit when finance data available.

---

## Data Model

### `legacy_norms` table

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| id | int PK | ✅ | Auto |
| category_id | int FK | ✅ | Deliverable type |
| complexity | float | ✅ | Pioneer slider 1-5 |
| client_sector | enum | ✅ | Pharma / Pharma Services / Medtech / Financial Sponsor |
| client_sub_category | enum | ✅ | See client segments below |
| geographies | json | ✅ | Multi-select from geography list |
| countries_served | json | ✅ | Multi-select from country list per geography |
| avg_calendar_days | float | ✅ | Auto-avg from completed projects, pioneer can override |
| avg_team_size | float | ✅ | Auto-avg from completed projects, pioneer can override |
| avg_revision_intensity | float | ✅ | Auto-avg 1-7 from completed projects |
| avg_scope_expansion | float | ❌ | Auto-avg 1-7 from completed projects |
| avg_senior_involvement | float | ❌ | Auto-avg 1-7 from completed projects |
| avg_ai_usage | float | ❌ | Auto-avg 1-7 from completed projects |
| sample_size | int | ✅ | Auto (COUNT of matching projects) |
| notes | text | ❌ | Admin notes |
| updated_by | text | ✅ | Who last changed |
| updated_at | timestamp | ✅ | When |

### `legacy_norms_history` table (audit trail)

| Field | Type |
|-------|------|
| id | int PK |
| norm_id | int FK |
| field_changed | text |
| old_value | text |
| new_value | text |
| changed_by | text |
| changed_at | timestamp |

### Changes to `projects` table

**New fields at creation:**
- `complexity` float (1-7 slider)
- `client_sector` enum
- `client_sub_category` enum
- `geographies` json (multi-select)
- `countries_served` json (multi-select)

**Changed fields:**
- `xcsg_calendar_days` → numeric (was bucket string)
- `xcsg_team_size` → numeric (was bucket string)
- `xcsg_revision_rounds` → `xcsg_revision_intensity` float 1-7 (was bucket string)
- `xcsg_scope_expansion` → `xcsg_scope_expansion` float 1-7 (was text)
- `legacy_calendar_days` → numeric (was bucket string)
- `legacy_team_size` → numeric (was bucket string)
- `legacy_revision_rounds` → `legacy_revision_intensity` float 1-7 (was bucket string)

**New fields at completion:**
- `legacy_scope_expansion` float 1-7
- `legacy_senior_involvement` float 1-7
- `legacy_ai_usage` float 1-7
- `xcsg_senior_involvement` float 1-7
- `xcsg_ai_usage` float 1-7

---

## Client Segments

| Sector | Sub-categories |
|--------|---------------|
| **Pharma** | Pre-revenue biotech · Commercial biotech · Specialty pharma · Big pharma · Generic / Biosimilar |
| **Pharma Services** | CRO · CDMO |
| **Medtech** | Diagnostics · Digital health / Health IT · Devices · Digital therapeutics |
| **Financial Sponsor** | VC · Small cap PE · Mid cap PE · Large cap PE · Hedge fund · Sovereign wealth / Family office |

UI: Cascading dropdown — pick sector, then sub-category.

---

## Geographies & Countries

| Geography | Countries (multi-select) |
|-----------|--------------------------|
| **North America** | US · Canada · Mexico |
| **Western Europe** | UK · Ireland · Germany · Austria · Switzerland · France · Italy · Spain · Portugal · Greece · Nordics · Benelux |
| **Emerging Europe** | Poland · Czech Republic · Romania · Hungary · Turkey · Russia · Rest of CEE |
| **Asia Pacific** | Japan · South Korea · China · Hong Kong · Taiwan · Australia · New Zealand · Singapore · India |
| **Latin America** | Brazil · Argentina · Colombia · Chile · Rest of LatAm |
| **Middle East & Africa** | UAE · Saudi Arabia · Israel · South Africa · Nigeria · Rest of MEA |
| **Global** | Multi-regional |

Pioneer selects one or more geographies → picks countries within those geographies.

---

## Sliders

All sliders are 1-7 with labeled endpoints:

| Slider | Left (1) | Right (5) | When | Side |
|--------|----------|-----------|------|------|
| **Complexity** | Straightforward | Highly complex | Creation | Both |
| **Revision intensity** | Minimal | Exhaustive | Completion | Both |
| **Scope expansion** | Stayed on scope | Blew past scope | Completion | Both |
| **Senior involvement** | Junior-led | Senior-led | Completion | Both |
| **AI / machine usage** | None | Fully machine-first | Completion | Both |

---

## Norm Resolution (Cascading)

System looks up the most specific match, falls back to broader:

```
category + complexity + client_sub_category + geography  (most specific)
→ category + complexity + client_sub_category
→ category + complexity
→ category alone  (always exists)
```

Always display sample size and confidence:
- n ≥ 20: 🟢 "Based on N projects"
- n 5-19: 🟡 "Based on N projects — limited data"
- n < 5: 🔴 "Limited data — generic baseline"

---

## Metrics

### Existing (kept)
- **Value multiplier** — xCSG effort vs legacy effort
- **Effort ratio** — person-days comparison
- **Quality ratio** — revision intensity comparison

### New
- **AI adoption rate** — % of projects with AI usage ≥ 3
- **Senior leverage** — avg senior involvement for xCSG vs legacy
- **Scope predictability** — avg scope expansion for xCSG vs legacy

### Removed from scope
- Cost metrics (blended rates, $ savings) — revisit when finance data available

### Derived: Machine-First Score
Composite score (0-100) calculated from xCSG completion sliders:

```
machine_first_score = (
  (senior_involvement / 7) * 25 +
  (ai_usage / 7) * 25 +
  ((8 - revision_intensity) / 7) * 25 +
  ((8 - scope_expansion) / 7) * 25
) * 100
```

- Senior involvement: higher = better (25 pts)
- AI usage: higher = better (25 pts)
- Revision intensity: lower = better (25 pts, inverted)
- Scope expansion: lower = better (25 pts, inverted)

All four weighted equally. Displayed per-project and averaged on dashboard.

---

## Screens

### Legacy Norms Admin
- Grouped by category, expandable rows for complexity/segment combinations
- Numeric inputs (no more bucket dropdowns)
- Sample size badge per row
- Full edit history with version comparison
- "Recalculate from project data" button

### New Deliverable Form
- New required fields: complexity slider, client sector/sub-category, geographies/countries
- Legacy norms auto-populate from cascading lookup
- Show confidence indicator next to auto-filled values
- Pioneer can override → `legacy_overridden = true`

### Project Completion
- 4 sliders: revision intensity, scope expansion, senior involvement, AI usage
- Both xCSG and legacy sides
- ~20 seconds to complete, all optional

### Dashboard
- Existing charts updated with new parameters
- New: AI adoption over time, senior leverage comparison, scope predictability
- Filterable by complexity, client segment, geography

---

## Implementation Phases

| Phase | What | Effort |
|-------|------|--------|
| **1** | Data model changes (new fields on norms + projects). Numeric values replace buckets. Cascading lookup logic. | ~2 days |
| **2** | UI: admin page redesign, creation form updates, completion sliders. Client sector/geo pickers. | ~2 days |
| **3** | Dashboard updates. New metrics. History/audit trail. Recalculate button. | ~1 day |

---

## Decisions
1. All sliders use 1-7 scale
2. Complexity labels same for all deliverable types
3. Machine-first composite score included in Phase 2
