# v2 UX Specs — Project-Centric Redesign

**Author:** Palladio 🎨, Product Designer  
**Date:** 2026-04-02  
**For:** Dedalus ⚡ (implementation)  
**Reference:** `tasks/v2-project-centric.md` (approved brief)

---

## Design Principle

The v2 shift is conceptual, not cosmetic. "Project" replaces "Deliverable" as the atomic unit. Legacy baselines are per-project overrides with category norms as suggestions. The UX must make this mental model obvious without explaining it.

---

## 1. New Project Form (`#new`)

### 1.1 Form Structure

Same `<form>` inside `.card`, same fieldset pattern. Four sections:

1. **Project Information** — project name, category, pioneer, email, client, description
2. **Timeline** — date started, target delivery
3. **xCSG Performance** — calendar days, team size, revisions, scope expansion
4. **Legacy Baseline** — calendar days, team size, revisions (auto-populated from norms)

### 1.2 Legacy Baseline Section — The Core UX Problem

**Goal:** Communicate "these values came from category defaults — override them for accuracy."

**Solution: Three-layer visual distinction**

#### A. Section banner (replaces current `.legacy-note`)

```html
<div class="legacy-banner">
  <svg class="legacy-banner-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="16" height="16">
    <circle cx="12" cy="12" r="10"/>
    <line x1="12" y1="16" x2="12" y2="12"/>
    <line x1="12" y1="8" x2="12.01" y2="8"/>
  </svg>
  <div>
    <strong>Category defaults loaded.</strong>
    Adjust these values to match this specific project's legacy context. Overriding improves metric accuracy.
  </div>
</div>
```

CSS class `.legacy-banner`:
```css
.legacy-banner {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 12px 16px;
  background: var(--blue-pale);
  border: 1px solid var(--blue-light);
  border-radius: var(--radius);
  font-size: 13px;
  color: var(--navy);
  margin-bottom: 20px;
  line-height: 1.5;
}
.legacy-banner strong {
  display: block;
  font-size: 13px;
  margin-bottom: 2px;
}
.legacy-banner-icon {
  flex-shrink: 0;
  margin-top: 2px;
  color: var(--blue);
}
```

#### B. Input styling — dashed border + pale blue background

Keep existing `.legacy-auto` class (already has `background: var(--blue-pale)` and `border-style: dashed`). This is correct and sufficient.

**When admin changes a value:** Remove `.legacy-auto` class from that specific input. The input reverts to solid border + white background, signaling "this was overridden." Add a small checkmark indicator.

```javascript
// On each legacy select change:
legacySelect.addEventListener('change', function() {
  this.classList.remove('legacy-auto');
  this.classList.add('legacy-overridden');
});
```

```css
.legacy-overridden {
  background: #fff !important;
  border-style: solid !important;
  border-color: var(--success) !important;
}
```

#### C. Per-field label annotation

Each legacy field label gets a small parenthetical:

```html
<label>Calendar Days <span class="legacy-source">(from CDD defaults)</span></label>
```

```css
.legacy-source {
  font-weight: 400;
  color: var(--gray-400);
  font-size: 11px;
}
```

When the category changes (on the category dropdown `change` event), update the `.legacy-source` text to reflect the new category name. When the admin overrides a value, change the text to `(overridden)` in green:

```css
.legacy-source.overridden {
  color: var(--success);
}
```

### 1.3 Category Picker Behavior

- Standard `<select>` dropdown, populated from `GET /api/categories`
- On change: fetch `GET /api/norms/{category_id}` and populate legacy fields
- On change: update `.legacy-source` spans with category name
- If no norms exist for selected category, leave legacy fields empty, show: "No defaults available for this category. Enter values manually."
- On edit mode (`#edit/{id}`): do NOT auto-populate on category change (existing values are the project's own)

### 1.4 Project Name Field

- First field in the form, full-width row by itself for prominence:
```html
<div class="form-row full">
  <div class="form-group">
    <label>Project Name <span class="required">*</span></label>
    <input type="text" id="fName" required placeholder="e.g., Pfizer EU Market Access Q2">
  </div>
</div>
```

- Placeholder text: `"e.g., Pfizer EU Market Access Q2"`
- This is the primary identifier now. Make it visually the most prominent field.

### 1.5 Form Layout Update

Row 1 (full): Project Name  
Row 2: Category | Client Name  
Row 3: Pioneer Name | Pioneer Email  
Row 4 (full): Description (textarea, not input)

This puts the project identity fields (name, category, client) at the top before operational fields.

---

## 2. Settings Page (`#settings`)

### 2.1 Tab Bar

Already implemented with `.settings-tabs` and `.settings-tab` classes. Two tabs:

1. **Categories** — CRUD for project categories
2. **Legacy Norms** — per-category default baselines

Current implementation is correct. No structural changes needed.

### 2.2 Categories Tab

Current implementation is good. Keep:
- Inline add form at top (name + description + Add button)
- Table with Name, Description, Actions columns
- Edit via modal, delete with confirmation
- Delete blocked if projects reference the category (backend enforces this)

**One addition:** Show project count per category.

Add a column "Projects" between Description and Actions:

```html
<th>Projects</th>
```

Each row shows the count. If > 0, delete button gets `disabled` attribute and tooltip: `"Cannot delete — ${count} projects use this category"`.

Fetch project counts from `GET /api/projects` (client-side count by `category_id`) or add a count field to the categories API response.

### 2.3 Legacy Norms Tab

Current implementation is good. Keep:
- Info banner explaining purpose
- Inline editing with select dropdowns
- Save button per row (visible on hover)

**One addition:** Visual indicator for "norm not set."

If a category has no norm entry yet, show a row with empty dropdowns and a subtle `.badge-gray` tag: `"Not configured"`. The save button creates the norm on first save.

**Copy change for info banner:**
> These norms pre-fill legacy baseline fields when creating new projects. Pioneers can override them per-project. Think of these as starting suggestions, not fixed values.

---

## 3. Portfolio View (`#portfolio`)

### 3.1 Filters Bar

Current implementation has 4 dropdowns (Category, Client, Pioneer, Status) in a flex row. This is correct.

**Improvements:**

#### A. Filter bar container

Wrap filters in a dedicated styled container:

```html
<div class="portfolio-filters">
  <span class="filters-label">Filter by</span>
  <select id="portfolioCatFilter" class="filter-select">...</select>
  <select id="portfolioClientFilter" class="filter-select">...</select>
  <select id="portfolioPioneerFilter" class="filter-select">...</select>
  <select id="portfolioStatusFilter" class="filter-select">...</select>
  <button class="filter-reset" id="portfolioFilterReset" style="display:none">Clear filters</button>
</div>
```

```css
.portfolio-filters {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 16px;
  background: #fff;
  border: 1px solid var(--gray-200);
  border-radius: var(--radius-lg);
  margin-bottom: 20px;
  flex-wrap: wrap;
  box-shadow: var(--shadow-sm);
}

.filters-label {
  font-size: 12px;
  font-weight: 600;
  color: var(--gray-400);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-right: 4px;
}

.filter-reset {
  padding: 6px 14px;
  background: transparent;
  border: 1px solid var(--gray-300);
  border-radius: var(--radius-sm);
  font-size: 12px;
  color: var(--gray-500);
  cursor: pointer;
  font-family: 'Roboto', sans-serif;
  margin-left: auto;
}
.filter-reset:hover {
  background: var(--error-bg);
  color: var(--error);
  border-color: var(--error);
}
```

#### B. Filter interaction

- Filters are AND-combined (current behavior is correct)
- When any filter is active, show the "Clear filters" button
- Filters apply to the scorecard table rows (client-side filtering via `data-*` attributes — current approach is correct)
- Status filter also applies: hide/show rows based on `data-status`

#### C. Filter position

Place the filters bar between the KPI cards and the scorecard table. Order:
1. Dashboard header (with Export button)
2. Checkpoint progress bar
3. KPI cards
4. Filter bar
5. Scorecard table
6. Charts (checkpoint 2+)

### 3.2 Scorecard Table Updates

Add "Status" column to scorecard between Pioneer and Effort Ratio:

```html
<th>Status</th>
```

Render as badge (same as Projects list): `.badge-green` for Complete, `.badge-orange` for Expert Pending.

### 3.3 Empty Filter State

When filters result in zero visible rows, show inline message inside the table:

```html
<tr class="filter-empty-row"><td colspan="7" style="text-align:center;padding:32px;color:var(--gray-400)">No projects match the selected filters.</td></tr>
```

Show/hide this row based on whether any `<tbody tr>` (non-empty-row) is visible.

---

## 4. Low Confidence Flag

### 4.1 Definition

A project has "low confidence" metrics when its legacy baseline values were NOT overridden from the category defaults. This means the admin accepted the generic norms without tailoring them.

**Detection logic (frontend):** Compare project's `legacy_calendar_days`, `legacy_team_size`, `legacy_revision_rounds` against the category's norm values. If all three match exactly → low confidence.

**Alternative (preferred — backend):** Add a boolean field `legacy_overridden` to the projects table (or compute it in the API response). Set to `true` if admin changed any legacy field from the auto-populated default during creation. This is more reliable than comparison (norms can change after project creation).

**Recommendation to Dedalus:** Add `legacy_overridden: boolean` to the `GET /api/projects` and `GET /api/metrics/projects` response objects. Default `false`. Set `true` in `POST /api/projects` if the submitted legacy values differ from the norm values fetched during creation.

### 4.2 Visual Treatment — Project List

In the Projects table (`#projects`), add a subtle icon next to the project name when `legacy_overridden === false`:

```html
<td>
  ${esc(p.project_name)}
  ${!p.legacy_overridden ? '<span class="confidence-flag" title="Legacy baseline uses category defaults — not project-specific"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg></span>' : ''}
</td>
```

```css
.confidence-flag {
  display: inline-flex;
  align-items: center;
  margin-left: 6px;
  color: var(--warning);
  vertical-align: middle;
  cursor: help;
}
```

**Tooltip text:** `"Legacy baseline uses category defaults — not project-specific"`

### 4.3 Visual Treatment — Portfolio Scorecard

Same icon next to the project name in the scorecard table. Additionally, the Value Multiplier cell gets a subtle visual de-emphasis:

```css
.vm-cell.low-confidence {
  color: var(--gray-400);
  font-weight: 500;
}
.vm-cell.low-confidence::after {
  content: '~';
  font-size: 11px;
  margin-left: 2px;
  color: var(--warning);
}
```

The tilde (`~`) suffix on the value multiplier communicates "approximate." Combined with the warning icon on the project name, this is a clear but non-disruptive signal.

### 4.4 Portfolio KPI Impact

Add a subtitle to the "Avg Value Multiplier" KPI card when any projects have low confidence:

```html
<div class="kpi-sub">${lowConfCount} of ${total} using category defaults</div>
```

This goes in the existing `.kpi-sub` div of the second KPI card.

### 4.5 Low Confidence in New Project Form

When submitting a new project without changing any legacy values, show a confirmation toast (not a blocker):

```
showToast('Tip: Legacy baseline uses category defaults. Edit the project to set project-specific values for more accurate metrics.', 'info');
```

This is informational, not a validation error. The project still saves.

---

## 5. Projects List (`#projects`)

### 5.1 Column Layout

| Column | Width | Align | Content |
|--------|-------|-------|---------|
| Project Name | flex | left | Primary identifier + confidence flag |
| Category | 140px | left | Category name as `.badge-navy` pill |
| Client | 120px | left | Text or em dash |
| Pioneer | 120px | left | Text |
| Status | 120px | center | `.badge-green` / `.badge-orange` pill |
| Created | 110px | left | Date (short format) |
| Actions | 80px | center | Icon buttons |

### 5.2 Project Name as Primary

The project name column gets slightly heavier styling:

```css
#projectTable td:first-child {
  font-weight: 500;
  color: var(--navy);
}
```

### 5.3 Category as Badge

Display category as a subtle navy pill badge instead of plain text:

```html
<td><span class="badge badge-navy">${esc(p.category_name)}</span></td>
```

This visually distinguishes category from freeform text fields (client, pioneer).

### 5.4 Filter Bar

Current implementation has Status filter + Category filter + "New Project" button. This is correct.

**Add:** Pioneer filter dropdown (same pattern as portfolio filters).

```html
<select id="pioneerFilter" class="filter-select">
  <option value="">All Pioneers</option>
  ${pioneers.map(p => `<option value="${esc(p)}">${esc(p)}</option>`).join('')}
</select>
```

Filter bar order: Status | Category | Pioneer | [spacer] | + New Project button

### 5.5 Row Click

Current behavior: click row → navigate to `#edit/{id}`. Keep this.

### 5.6 Actions

- **Copy expert link** — show only when `status !== 'complete'`. Link icon SVG (current implementation is fine).
- **Delete** — show only for admin role. Trash icon SVG with `.btn-danger-icon` hover.
- Both use `event.stopPropagation()` to prevent row click navigation.

No changes to current action implementation.

---

## 6. Expert Form Context Card (`#expert/{token}`)

### 6.1 Current State

The context card already shows: Project Name, Category, Client, Pioneer, Dates, Team Size, Calendar Days. This was built in v1 — the code already renders `ctx.project_name` and `ctx.category_name`.

### 6.2 Updates

#### A. Title hierarchy

The context card should lead with the project name as a heading:

```html
<div class="expert-section-card">
  <div class="context-title">${esc(ctx.project_name)}</div>
  <div class="context-subtitle">${esc(ctx.category_name)} ${ctx.client_name ? '· ' + esc(ctx.client_name) : ''}</div>
  <div class="context-grid">
    <div class="context-item">
      <span class="label">Pioneer</span>
      <span class="value">${esc(ctx.pioneer_name)}</span>
    </div>
    <div class="context-item">
      <span class="label">Timeline</span>
      <span class="value">${esc(ctx.date_started || '?')} → ${esc(ctx.date_delivered || '?')}</span>
    </div>
    <div class="context-item">
      <span class="label">Team Size</span>
      <span class="value">${esc(ctx.xcsg_team_size)}</span>
    </div>
    <div class="context-item">
      <span class="label">Calendar Days</span>
      <span class="value">${esc(ctx.xcsg_calendar_days)}</span>
    </div>
  </div>
</div>
```

This gives the expert clear context: "I'm assessing **Pfizer EU Market Access Q2** (a Market Access project for Pfizer)."

#### B. Context grid layout

Change from `grid-template-columns: repeat(4, 1fr)` to `repeat(2, 1fr)` on the context grid for the expert view. Four columns is too cramped at 720px max-width.

```css
.expert-container .context-grid {
  grid-template-columns: repeat(2, 1fr);
  gap: 16px;
}
```

#### C. Description field

If the project has a description, show it between the subtitle and the context grid:

```html
${ctx.description ? `<p class="context-description">${esc(ctx.description)}</p>` : ''}
```

```css
.context-description {
  font-size: 14px;
  color: var(--gray-500);
  margin-bottom: 20px;
  line-height: 1.5;
}
```

---

## 7. Edit Project Form (`#edit/{id}`)

### 7.1 Legacy Section Behavior

On edit, the legacy fields should show their current saved values with **solid borders** (not dashed). The dashed `.legacy-auto` style only appears on new project creation when values are auto-populated from norms.

On edit, the `.legacy-source` spans should read:
- `(project-specific)` if the value was overridden (green text)
- `(from category defaults)` if it matches the norm (gray text, with warning icon)

### 7.2 Expert Response Card

Current implementation shows a read-only grid of all 12 expert response values below the form. This is good but dense.

**Improvement:** Group responses by section with section headers:

```html
<div class="card" style="margin-top:24px">
  <div class="card-header">Expert Assessment (Read-Only)</div>
  <div class="card-body">
    <h4 style="font-size:13px;font-weight:600;color:var(--gray-500);margin-bottom:12px">Section B: Machine-First Operations</h4>
    <div class="context-grid" style="grid-template-columns:repeat(2,1fr);margin-bottom:20px">
      <div><span class="q-id">B1</span> ${esc(er.b1_starting_point)}</div>
      <div><span class="q-id">B2</span> ${esc(er.b2_research_sources)}</div>
      <div><span class="q-id">B3</span> ${esc(er.b3_assembly_ratio)}</div>
      <div><span class="q-id">B4</span> ${esc(er.b4_hypothesis_first)}</div>
    </div>
    <h4 style="...">Section C: Senior-Led Engagement</h4>
    ...
    <h4 style="...">Section D: Proprietary Knowledge</h4>
    ...
    <h4 style="...">Section F: Value Creation</h4>
    ...
  </div>
</div>
```

---

## 8. Sidebar Navigation

### 8.1 Current State (v1 already updated)

```
◉  Portfolio
+  New Project        (orange button)
☰  Projects
⚙  Settings
🕐  Activity Log
```

This is already correct for v2. The sidebar in `index.html` uses SVG icons and has the correct labels. No changes needed.

### 8.2 Active State

Verify that `data-route="portfolio"` activates on `#portfolio` hash (not `#dashboard`). Current `app.js` routing already does this correctly.

---

## 9. New CSS Classes Summary

Classes to add to `styles.css`:

```css
/* Legacy baseline banner */
.legacy-banner { ... }           /* See §1.2A */
.legacy-banner-icon { ... }

/* Legacy field states */
.legacy-overridden { ... }       /* See §1.2B */
.legacy-source { ... }           /* See §1.2C */
.legacy-source.overridden { ... }

/* Portfolio filters */
.portfolio-filters { ... }       /* See §3.1A */
.filters-label { ... }
.filter-reset { ... }

/* Low confidence flag */
.confidence-flag { ... }         /* See §4.2 */
.vm-cell.low-confidence { ... }  /* See §4.3 */

/* Expert context (override) */
.expert-container .context-grid { ... }  /* See §6.2B */
.context-description { ... }             /* See §6.2C */
```

---

## 10. Copy Text Reference

All user-facing copy for Dedalus to use exactly:

| Location | Copy |
|----------|------|
| Legacy banner (new project) | **Category defaults loaded.** Adjust these values to match this specific project's legacy context. Overriding improves metric accuracy. |
| Legacy source label (auto) | `(from {CategoryName} defaults)` |
| Legacy source label (overridden) | `(overridden)` |
| No norms available | No defaults available for this category. Enter values manually. |
| Confidence flag tooltip | Legacy baseline uses category defaults — not project-specific |
| Info toast on submit without override | Tip: Legacy baseline uses category defaults. Edit the project to set project-specific values for more accurate metrics. |
| Norms info banner | These norms pre-fill legacy baseline fields when creating new projects. Pioneers can override them per-project. Think of these as starting suggestions, not fixed values. |
| Project name placeholder | e.g., Pfizer EU Market Access Q2 |
| Filter empty state | No projects match the selected filters. |

---

## 11. Implementation Priority

1. **New Project form** — legacy banner, auto-populate behavior, field state transitions (§1)
2. **Low confidence flag** — backend `legacy_overridden` field + frontend rendering (§4)
3. **Projects list** — column layout, category badge, pioneer filter (§5)
4. **Portfolio filters** — styled container, clear button, status in scorecard (§3)
5. **Expert context card** — title hierarchy, 2-col grid (§6)
6. **Edit form** — legacy state display, grouped expert responses (§7)
7. **Settings** — project count on categories, norms copy update (§2)

---

## 12. What NOT to Change

- Expert questionnaire fields (B1–F2) — content unchanged
- Chart.js integration — unchanged
- Auth flow — unchanged
- Toast/modal system — unchanged
- Sidebar structure — already correct
- KPI card design — unchanged (only add subtitle for low confidence)
- Export functionality — unchanged

---

*Specs ready for implementation. Dedalus builds, Aristarchus tests, Palladio reviews.*
