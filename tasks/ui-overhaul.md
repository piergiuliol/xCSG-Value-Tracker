# UI/UX Overhaul — xCSG Value Tracker

## Context
This is a FastAPI + vanilla JS/CSS/HTML app at `~/Documents/Projects/xCSG-Value-Tracker/`.
Server runs on port 8000. Login: admin / AliraAdmin2026!
Files to edit: `frontend/styles.css`, `frontend/index.html`, `frontend/app.js`

## Logo Issue (CRITICAL)
The white logo (`frontend/assets/logo-white.png`) in the sidebar is too small — currently `height:32px`.
- Increase sidebar logo to `height:40px` in index.html
- Increase login logo to `height:52px`
- Expert header logo to `height:40px`
- Add `max-width: 160px` and `object-fit: contain` to `.logo-img` class in CSS

## Sidebar Improvements
- Increase sidebar width from 240px to 260px (more breathing room)
- Logo area: increase padding to `28px 24px`, add `margin-bottom: 8px`
- Nav items: use proper SVG-style icons (or Unicode characters that render consistently) instead of emoji icons. Replace: 📊→◉, ＋→+, 📋→☰, ⚙️→⚙, 📝→▣. Or even better, use simple text labels with a left border indicator (no icons, cleaner).
- Actually — keep the current icon approach but use a consistent monospace icon set. The emojis look inconsistent cross-platform. Use these CSS-rendered alternatives OR just remove the `<span class="icon">` entirely and rely on the left border + text.
- "New Deliverable" button: make it more visually distinct — use `background: var(--orange)` with white text, full-width within sidebar padding
- Sidebar footer: more padding, less cramped

## Topbar
- Make topbar height 56px (not 60px — tighter)
- Remove redundant page title from topbar if it matches nav (or keep but make it a breadcrumb)
- User avatar + logout: tighten spacing

## Dashboard
- KPI cards: increase font-size of `.kpi-value` to 28px (from 32 — the numbers are too dominant)
- KPI cards: add a subtle icon or contextual indicator
- Checkpoint progress bar: needs proper CSS (currently it has classes but no actual progress bar styling — add `.progress-track` and `.progress-fill` styles)
- Export button: move it into the dashboard header row (next to "Dashboard" title), not floating between sections
- Scorecard table: improve column proportions — TYPE wider, PIONEER wider, VALUE MULTIPLIER right-aligned

## New Deliverable Form
- Remove the `<h2>` title inside the card (topbar already says "New Deliverable")
- Section legends: change from ALL CAPS to Title Case, reduce letter-spacing
- Form actions: make primary button more prominent (larger padding), keep Cancel subtle
- Add a subtle description under "Legacy Performance" legend explaining auto-population
- Date inputs: set a reasonable default (today for date_started)

## Deliverables List
- Status badges: use colored pill badges (green for Complete, amber for Expert Pending) — the CSS exists (`.badge-green`, `.badge-orange`) but JS uses `.badge-success` / `.badge-warning`. Fix the class names in app.js to match CSS.
- Action icons: make them more visible — increase size, add hover background
- Filter bar: add "New Deliverable" button and status filter on same row, better spacing

## Legacy Norms
- Save buttons: only show on hover or when field changed (too much visual noise showing all at once)
- Add more padding to the info banner
- Make the table more compact

## Activity Log
- Add timestamps (not just dates) — the `formatDate` function strips time. Create a `formatDateTime` function.
- Add action type color coding: green for creates, red for deletes, blue for logins, amber for updates
- Add a visual separator between days

## EXPERT FORM (biggest UX issue — PJ explicitly flagged this)
Current: questions are cramped, dropdowns inconsistent, looks like a spreadsheet not a form.

### Redesign approach:
1. **Card-per-section layout**: Each section (B, C, D, F) gets its own white card with generous padding
2. **Section headers**: Full readable titles, not just letters. "B — Machine-First Operations" → "Section B: How AI-Driven Was This Work?"
3. **Question layout**: Each question in its own block with:
   - Question number badge (B1, B2...) — keep the `.q-id` badges
   - Full question text (keep current)
   - Helper text below the question explaining what this measures (add `<small>` hints)
   - Full-width dropdown below, with generous height (padding: 14px 16px)
   - Spacing between questions: 28px margin-bottom
4. **Progress indicator**: Add a simple "Section X of 4" or step dots at top
5. **Section E gap**: Add a note explaining E is skipped (it's not in the framework — E was reserved)
6. **Context card**: improve the grid layout, add subtle background colors per item
7. **Submit button area**: Add estimated time ("Takes ~3 minutes"), larger submit button
8. **Thank-you state**: make the checkmark a green circle with white check, not plain text ✓

### Expert form CSS additions needed:
```css
.expert-section-card {
  background: #fff;
  border: 1px solid var(--gray-200);
  border-radius: var(--radius-lg);
  padding: 32px;
  margin-bottom: 24px;
  box-shadow: var(--shadow);
}

.expert-section-title {
  font-size: 18px;
  font-weight: 600;
  color: var(--navy);
  margin-bottom: 8px;
}

.expert-section-desc {
  font-size: 14px;
  color: var(--gray-500);
  margin-bottom: 28px;
}

.expert-question {
  margin-bottom: 28px;
  padding-bottom: 28px;
  border-bottom: 1px solid var(--gray-100);
}

.expert-question:last-child {
  margin-bottom: 0;
  padding-bottom: 0;
  border-bottom: none;
}
```

## General CSS Fixes
- Add `.progress-track` and `.progress-fill` styles (missing from CSS but used in dashboard):
```css
.progress-track {
  flex: 1;
  height: 6px;
  background: var(--gray-200);
  border-radius: 3px;
  overflow: hidden;
}
.progress-fill {
  height: 100%;
  background: var(--navy);
  border-radius: 3px;
  transition: width 0.5s ease;
}
```

- Add `.info-banner` styles (used in norms but not defined):
```css
.info-banner {
  padding: 14px 20px;
  background: var(--blue-pale);
  color: var(--navy);
  font-size: 13px;
  border-bottom: 1px solid var(--gray-200);
}
```

- Add `.filter-select` styles:
```css
.filter-select {
  padding: 8px 14px;
  border: 1px solid var(--gray-300);
  border-radius: var(--radius);
  font-size: 13px;
  font-family: 'Roboto', sans-serif;
  background: #fff;
  cursor: pointer;
  outline: none;
}
.filter-select:focus { border-color: var(--blue); }
```

- Badge classes: ensure `.badge-success` maps to `.badge-green` colors and `.badge-warning` maps to `.badge-orange` colors (or add the -success/-warning/-error/-info aliases)

- `.flywheel-gauges` and `.gauge` styles are missing — add them:
```css
.flywheel-gauges {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 24px;
  padding: 24px;
}
.gauge { text-align: center; }
.gauge-label { font-size: 13px; font-weight: 500; color: var(--gray-600); margin-bottom: 12px; }
.gauge-track { height: 8px; background: var(--gray-200); border-radius: 4px; overflow: hidden; margin-bottom: 8px; }
.gauge-fill { height: 100%; border-radius: 4px; }
.gauge .gauge-value { font-size: 24px; font-weight: 700; color: var(--navy); }
```

## Testing
After making changes, verify with Playwright:
1. `node -e "..." ` to take screenshots of all views
2. Check that login page renders properly
3. Dashboard KPIs and scorecard render
4. Expert form is usable — dropdowns full width, questions spaced, sections clear
5. Verify all badge classes render correctly (green/orange pills)

## DO NOT
- Do NOT change any backend files
- Do NOT change API endpoints or field names
- Do NOT add any npm dependencies
- Do NOT change dropdown option values (they must match backend exactly)
- Do NOT break the hash routing
- Do NOT change the Chart.js version

## Priority
1. Expert form UX (most impactful, PJ flagged it)
2. Logo sizing
3. Missing CSS classes (progress-track, info-banner, badge aliases, flywheel-gauges)
4. Sidebar + topbar polish
5. Dashboard layout
6. Deliverables list badges
7. Activity log timestamps
8. Norms table polish
