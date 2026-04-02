# xCSG Value Tracker v2 — Build Plan

## Backend (Vitruvius)
- [ ] Add `legacy_overridden` boolean to project responses (compare project legacy values vs category norms)
- [ ] Add `description` field to `ExpertContextResponse` model
- [ ] Add `project_count` to categories list endpoint response
- [ ] Update norms tab info banner copy in any backend-served content
- [ ] Delete `data/tracker.db` to force fresh seed on restart
- [ ] Verify all v2 routes work (start server, hit key endpoints)

## Frontend (Giotto)
- [ ] New Project form: project name as full-width first field, category+client row, pioneer+email row, description as textarea
- [ ] Legacy banner: replace `.legacy-note` with `.legacy-banner` (info icon + copy from spec §1.2A)
- [ ] Legacy field states: `.legacy-overridden` class on change, `.legacy-source` label annotations
- [ ] Category picker: fetch norms on change, update legacy source spans
- [ ] Projects list: category as `.badge-navy` pill, pioneer filter, confidence flag icon
- [ ] Portfolio: styled `.portfolio-filters` container, Clear filters button, status column in scorecard, low-confidence VM de-emphasis, KPI subtitle for low-confidence count
- [ ] Expert context card: title hierarchy (project name heading), 2-col grid, description field
- [ ] Edit form: solid borders on legacy fields, grouped expert responses by section
- [ ] Settings categories tab: project count column, disabled delete if count > 0
- [ ] Settings norms tab: updated info banner copy, "Not configured" badge for missing norms
- [ ] New CSS classes per spec §9
- [ ] Info toast on submit without legacy override

## QA (Dedalus)
- [ ] Delete DB, restart server, verify fresh seed
- [ ] Create project → verify legacy auto-populate
- [ ] Submit expert form → verify completion
- [ ] Check portfolio view renders correctly
- [ ] Check all filters work
- [ ] Verify export still works
