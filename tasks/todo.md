# xCSG Value Tracker v2 — Build Plan

## Backend (Complete ✅)
- [x] Add `legacy_overridden` boolean to project responses (compare project legacy values vs category norms)
- [x] Add `description` field to `ExpertContextResponse` model
- [x] Add `project_count` to categories list endpoint response
- [x] Delete `data/tracker.db` to force fresh seed on restart
- [x] Verify all v2 routes work (start server, hit key endpoints)

## Frontend (Complete ✅)
- [x] New Project form: project name as full-width first field, category+client row, pioneer+email row, description as textarea
- [x] Legacy banner: replace `.legacy-note` with `.legacy-banner` (info icon + copy from spec §1.2A)
- [x] Legacy field states: `.legacy-overridden` class on change, `.legacy-source` label annotations
- [x] Category picker: fetch norms on change, update legacy source spans
- [x] Projects list: category as `.badge-navy` pill, pioneer filter, confidence flag icon
- [x] Portfolio: styled `.portfolio-filters` container, Clear filters button, status column in scorecard, low-confidence VM de-emphasis, KPI subtitle for low-confidence count
- [x] Expert context card: title hierarchy (project name heading), 2-col grid, description field
- [x] Edit form: solid borders on legacy fields, grouped expert responses by section
- [x] Settings categories tab: project count column, disabled delete if count > 0
- [x] Settings norms tab: updated info banner copy, "Not configured" badge for missing norms
- [x] New CSS classes per spec §9
- [x] Info toast on submit without legacy override

## QA (Complete ✅)
- [x] Delete DB, restart server, verify fresh seed
- [x] Login works (admin/pmo)
- [x] Create project → verify legacy auto-populate
- [x] Create project with overridden legacy → legacy_overridden=true
- [x] Submit expert form → verify completion
- [x] Categories API returns project_count
- [x] Metrics API returns legacy_overridden
- [x] Expert context includes description field
- [x] Activity log records all actions

## Review

### Backend changes (commit c7cce91)
- `database.py`: Added `legacy_overridden INTEGER DEFAULT 0` to projects schema, included in INSERT
- `models.py`: Added `legacy_overridden: bool` to ProjectResponse, ProjectCreate, ProjectMetrics; `description` to ExpertContextResponse
- `app.py`: Compute `legacy_overridden` server-side in create_project by comparing submitted legacy values against category norms; enriched categories with project_count; added description to expert context
- `metrics.py`: Pass through `legacy_overridden` in compute_project_metrics

### Frontend changes (commit 0e12bf9)
- `app.js`: Complete rewrite of renderNewProject (form layout, legacy banner, field state tracking), renderProjects (badge pills, pioneer filter, confidence flags), renderPortfolio (styled filters, clear button, status column, low-confidence flags), renderExpert (title hierarchy context card), renderEditProject (grouped expert responses), renderCategoriesTab (project counts, disabled delete), renderNormsTab (updated copy, unconfigured categories)
- `styles.css`: Added 12 new CSS class families for v2 features
- `index.html`: Sidebar labels updated (Portfolio/Projects/Settings), cache-bust, duplicate class fix
