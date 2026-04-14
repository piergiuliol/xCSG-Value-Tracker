# v1.1 — Multi-Pioneer Longitudinal Surveys

## Overview

Evolve the tracker from one-pioneer-one-survey to multiple pioneers per project, each assessed over multiple rounds. Metrics are averaged across all responses. PMO gets monitoring tools to track response progress.

### Constraints

- UI, branding (Alira Health), and vanilla JS/CSS are unchanged from v1.0
- All formulas, scoring maps, and schema definitions stay identical
- Existing v1.0 data and expert links must survive migration

---

## 1. Data Model

### `projects` table changes

Remove: `pioneer_name`, `pioneer_email`, `expert_token`

Add:

| Column | Type | Default | Description |
|--------|------|---------|-------------|
| `default_rounds` | INTEGER | 1 | Default number of survey rounds for all pioneers |
| `show_previous_answers` | INTEGER | 0 | Whether pioneers see their prior round answers (0=no, 1=yes) |

Status values change from `expert_pending`/`complete` to:

| Status | Meaning |
|--------|---------|
| `pending` | Zero responses received |
| `partial` | At least 1 response, but not all pioneers x rounds completed |
| `complete` | Every pioneer has completed all their rounds |

### New `project_pioneers` table

```sql
CREATE TABLE project_pioneers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER NOT NULL,
    pioneer_name TEXT NOT NULL,
    pioneer_email TEXT,
    total_rounds INTEGER,          -- null = use project default_rounds
    show_previous INTEGER,         -- null = use project show_previous_answers
    expert_token TEXT UNIQUE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (project_id) REFERENCES projects(id)
);
```

One token per pioneer per project. The same token is used for all rounds.

### `expert_responses` table changes

Remove: `UNIQUE` constraint on `project_id` (keep the column for efficient querying)

Add:

| Column | Type | Description |
|--------|------|-------------|
| `pioneer_id` | INTEGER NOT NULL | References `project_pioneers(id)` |
| `round_number` | INTEGER NOT NULL DEFAULT 1 | Which round this response is for |

Add unique constraint: `UNIQUE(pioneer_id, round_number)` — one response per pioneer per round.

`project_id` is kept as a denormalized column for efficient dashboard queries (avoids joining through `project_pioneers` on every metrics call).

All survey fields (B1-G1, L1-L16) remain unchanged.

### Relationship chain

```
projects
  └── project_pioneers (1:many)
        └── expert_responses (1:many, one per round)
```

---

## 2. Global Constants

New constants in `schema.py`:

```python
# Project status values
PROJECT_STATUS_PENDING = "pending"
PROJECT_STATUS_PARTIAL = "partial"
PROJECT_STATUS_COMPLETE = "complete"

# Pioneer defaults
DEFAULT_ROUNDS = 1
MAX_ROUNDS_PER_PIONEER = 10
MAX_PIONEERS_PER_PROJECT = 20
SHOW_PREVIOUS_ANSWERS_DEFAULT = False

# Monitoring filters
MONITORING_STATUS_OPTIONS = ["pending", "partial", "complete"]
```

Added to `build_schema_response()`: `project_statuses`, `default_rounds`, `max_rounds`, `max_pioneers` — so the frontend enforces limits without hardcoding.

Unchanged: `SCORES`, `EXPERT_FIELDS`, `METRICS`, `NORMS_COLUMNS`, `SECTIONS`, team midpoints, auth constants, dashboard checkpoint thresholds (3, 8, 20).

---

## 3. Project Creation & Pioneer Management

### Project creation form

- Remove single pioneer name/email fields
- Add "Pioneers" section with a dynamic list:
  - Each row: name (required), email (optional), rounds override (optional)
  - "Add pioneer" button to add rows
  - Minimum 1 pioneer required, maximum `MAX_PIONEERS_PER_PROJECT`
- Add "Default rounds" field at project level (default: 1)
- Add "Show previous answers" toggle at project level (default: off)

### Expert tokens

- One unique token generated per pioneer assignment
- Token URL: `/#expert/{token}` (format unchanged from v1.0)
- PMO sees all pioneer links on project detail page with copy buttons

### Editing pioneers after creation

- PMO can add new pioneers to an existing project
- PMO can remove a pioneer only if they have zero responses
- PMO can change round count up or down, but not below the number of rounds already completed by that pioneer

### New round triggering

No automated triggers. When a pioneer completes a round and has remaining rounds, the same token works — they land on the form again for the next round. No new link needed.

---

## 4. Expert Flow

### When a pioneer opens their link (`/#expert/{token}`)

System looks up the pioneer assignment and determines state:

| State | What they see |
|-------|--------------|
| No responses yet | Survey form for round 1 |
| Round N completed, more rounds remaining | Survey form for round N+1 |
| All rounds completed | Results page (read-only) |

### Show previous answers

- **On**: previous round answers displayed read-only above the form, collapsible
- **Off**: clean form, no prior answers

Per-pioneer `show_previous` overrides project-level `show_previous_answers`. If per-pioneer is null, project default applies.

### After submitting

- System computes metrics and shows flywheel scores with explanations (same as v1.0)
- If more rounds remain: message says "Round N of M complete. You'll use this same link for your next round."
- If all rounds done: "All rounds complete. Thank you."

### Other pioneers' results

Shown after submission, below the pioneer's own results:
- Aggregated scores only (averages across all responses for this project)
- Not individual answers per pioneer
- Only includes data from responses submitted so far

---

## 5. Metrics Computation

### New flow

1. Gather all `expert_responses` for a project (across all pioneers, all rounds)
2. Compute metrics for each individual response (same formulas as v1.0)
3. Average the per-response metrics to get project-level metrics
4. Dashboard, norms, scaling gates all use the averaged project-level metrics

### What stays the same

- All formulas: delivery speed, output quality, value gain, flywheel scores, rework efficiency, client impact, data independence, signal metrics
- Expert data priority over project config for legacy fields
- Scaling gates logic and thresholds
- Dashboard checkpoint thresholds (3, 8, 20)

### Status logic

| Status | Condition |
|--------|-----------|
| `pending` | Zero responses |
| `partial` | At least 1 response, but not all pioneers x rounds completed |
| `complete` | Every pioneer has completed all their rounds |

### Metrics availability

- Dashboard and norms include a project as soon as it has at least 1 response (`partial` or `complete`)
- Project card/row shows response count (e.g., "3 of 6 responses")
- Existing projects with 1 pioneer and 1 response compute identically to v1.0 (average of 1 = same value)

---

## 6. PMO Monitoring

### Project detail page (extended)

New "Pioneers" section with a table:

| Column | Description |
|--------|-------------|
| Pioneer | Name |
| Email | Email address |
| Round | "N of M" progress |
| Status | Completed / Pending |
| Submitted | Date of most recent submission, or "—" |

Controls:
- Copy link button per pioneer
- Add pioneer button
- Remove pioneer button (disabled if pioneer has responses)

### New monitoring page (`#monitoring`)

Accessible to admin and analyst roles. Contains:

**Summary bar:**
- Total projects
- Total pending responses
- Portfolio completion rate (%)

**Table:**

| Column | Description |
|--------|-------------|
| Project | Project name (clickable → project detail) |
| Category | Project category |
| Pioneers | Count of assigned pioneers |
| Responses | "N of M" (completed / total expected) |
| Status | Pending / Partial / Complete |

Features:
- Filterable by status (pending / partial / complete)
- Sortable columns

---

## 7. API Changes

### Modified endpoints

| Endpoint | Change |
|----------|--------|
| `POST /api/projects` | Accepts `pioneers: [{name, email?, total_rounds?}]` instead of `pioneer_name` + `pioneer_email`. Accepts `default_rounds` and `show_previous_answers`. |
| `GET /api/projects/{id}` | Returns `pioneers` array with status instead of single `pioneer_name` |
| `PUT /api/projects/{id}` | Accepts `default_rounds`, `show_previous_answers` |
| `POST /api/expert/{token}` | Unchanged — token resolves to pioneer assignment, system determines round number |
| `GET /api/expert/{token}` | Returns current round number, total rounds, and optionally previous answers |
| `GET /api/dashboard/summary` | Unchanged — uses averaged project metrics |
| `GET /api/dashboard/trend` | Unchanged — uses averaged project metrics |

### New endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/projects/{id}/pioneers` | GET | List pioneer assignments with response status |
| `/api/projects/{id}/pioneers` | POST | Add pioneer to existing project |
| `/api/projects/{id}/pioneers/{pioneer_id}` | DELETE | Remove pioneer (only if zero responses) |
| `/api/projects/{id}/pioneers/{pioneer_id}` | PUT | Update pioneer (name, email, total_rounds, show_previous) |
| `/api/monitoring` | GET | Portfolio-level response progress, filterable by status |

---

## 8. Migration from v1.0

### Steps

SQLite migration uses the rename-recreate pattern for constraint changes.

1. Create `project_pioneers` table
2. Add `default_rounds` and `show_previous_answers` columns to `projects`
3. For each existing project:
   - Create a `project_pioneers` row using the project's `pioneer_name`, `pioneer_email`, `expert_token`
   - Set `total_rounds = NULL` (inherits project default of 1)
4. Recreate `expert_responses` table without `UNIQUE` on `project_id`, adding `pioneer_id` and `round_number` columns, with `UNIQUE(pioneer_id, round_number)`:
   - Rename `expert_responses` → `_expert_responses_old`
   - Create new `expert_responses` with updated schema
   - Copy data from old table, setting `pioneer_id` from the migrated pioneer assignments and `round_number = 1`
   - Drop `_expert_responses_old`
5. Recreate `projects` table without `pioneer_name`, `pioneer_email`, `expert_token`:
   - Rename `projects` → `_projects_old`
   - Create new `projects` with updated schema (includes `default_rounds`, `show_previous_answers`)
   - Copy data from old table
   - Drop `_projects_old`
6. Update project statuses: existing projects with a response → `complete`, without → `pending`

### Guarantees

- All existing expert links continue to work (tokens preserved in `project_pioneers`)
- All existing metrics compute identically (average of 1 response = same value)
- No data loss

---

## 9. Role-Based Access

| Action | Admin | Analyst | Viewer |
|--------|-------|---------|--------|
| View monitoring page | Yes | Yes | Yes |
| Add/remove pioneers | Yes | Yes | No |
| Change round count | Yes | Yes | No |
| Delete pioneer with responses | No | No | No |

Same RBAC rules as v1.0 — extended to pioneer management.
