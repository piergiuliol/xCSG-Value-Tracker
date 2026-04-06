# Design Recommendations — xCSG Value Tracker Realignment

_Palladio 🎨 — April 6, 2026_

---

## 1. Expert Assessment (Tier 2)

**Recommendation: Single-page accordion with sticky progress bar.**

Not a wizard. Experts are busy senior specialists — a 4-step wizard adds navigation friction for what should be a <3-minute task. An accordion lets them scan the whole thing, skip to sections they're sure about, and submit in one click.

### Layout

```
┌─────────────────────────────────────────────┐
│  xCSG Expert Assessment                      │
│  Competitive Landscape — Acme Pharma         │
│  Started Mar 12 · Pioneer: Dr. Smith         │
├─────────────────────────────────────────────┤
│  ████████░░░░░░░░░░░░ 8/20 answered         │
├─────────────────────────────────────────────┤
│                                               │
│  ▼ B — Machine-First Operations (4/4 ✓)      │
│  ┌─────────────────────────────────────────┐ │
│  │ B1  Starting point                      │ │
│  │ xCSG: [Hypothesis-first      ▼]         │ │
│  │ Legacy: [Discovery-first (norm) ▼]      │ │
│  ├─────────────────────────────────────────┤ │
│  │ B2  Research sources                    │ │
│  │ xCSG: [8-12 sources          ▼]         │ │
│  │ Legacy: [1-3 sources (norm)   ▼]       │ │
│  └─────────────────────────────────────────┘ │
│                                               │
│  ► C — Senior-Led Model (3/5)                 │
│  ► D — Proprietary Knowledge (0/3)            │
│  ► F — Value Creation (0/2)                   │
│                                               │
│            [ Submit Assessment → ]             │
└─────────────────────────────────────────────┘
```

### Key details

- **Progress bar at top** — `answered / 20`. Turns green when 20/20. Motivates completion.
- **Legacy column pre-filled** from norms table. Select shows "(norm)" suffix so expert knows it's auto-populated and doesn't need their input (they CAN override). On sections C and D where both columns need expert input, both are editable.
- **Accordion behavior**: all sections collapsed by default. Clicking expands one, collapses others (single-open). Completed sections show green checkmark + count.
- **Question layout within section**: stacked, not side-by-side. Two labeled selects per question — "xCSG" label in navy (#1B2A4A), "Legacy" label in stone (#C8C0B4). Full-width selects.

### Mobile

Single column naturally. Accordion works perfectly on touch. Selects are native `<select>` elements — no custom dropdowns needed. Progress bar fixed at top on scroll (sticky). Minimum touch target: 48px on selects.

### Interaction

- All dropdowns are `<select>` native elements. No custom JS dropdown components.
- On change, update progress bar count. Save to `localStorage` every change (auto-save/restore on revisit).
- Submit button disabled until 20/20. Shows count: "Submit Assessment (18/20)".
- On submit: POST, show confirmation with computed metrics preview (effort ratio, value multiplier).

### Don't build

- No stepper/wizard navigation. Overhead for a short form.
- No custom dropdown components. Native selects are faster to implement and better on mobile.
- No auto-save to server (localStorage only). Expert submits when ready.

---

## 2. Progressive Checkpoint Dashboard

**Recommendation: Vertical stack with locked panels as translucent cards + lock icon.**

No tabs — tabs hide content and the progression story is about *accumulation*. The user should see what's coming.

### Layout

```
┌─────────────────────────────────────────────┐
│  Dashboard                        8 projects │
│  Next unlock: Checkpoint 2 (3 more)          │
├─────────────────────────────────────────────┤
│                                               │
│  ┌─ CHECKPOINT 1: First Light ✓ ──────────┐ │
│  │  [Active content: scorecard table]       │ │
│  └──────────────────────────────────────────┘ │
│                                               │
│  ┌─ CHECKPOINT 2: Pattern Detection ───────┐ │
│  │  🔒  Unlock at 5 projects               │ │
│  │  Trends · Category comparison · Avg     │ │
│  │  multipliers                             │ │
│  │                                          │ │
│  │  ░░░░░░░░░░░░░░░░░░  8/20 projects     │ │
│  └──────────────────────────────────────────┘ │
│                                               │
│  ┌─ CHECKPOINT 3: Proof of Concept ────────┐ │
│  │  🔒  Unlock at 10 projects              │ │
│  └──────────────────────────────────────────┘ │
│                                               │
│  ┌─ CHECKPOINT 4: At Scale ────────────────┐ │
│  │  🔒  Unlock at 20 projects              │ │
│  └──────────────────────────────────────────┘ │
└─────────────────────────────────────────────┘
```

### Visual language

- **Unlocked**: White card, full border, full content rendered.
- **Locked**: Card with `opacity: 0.5`, border becomes dashed, large 🔒 icon centered. Below the icon: checkpoint name, unlock threshold, and a thin progress bar showing `current / required`.
- **Progress toward next unlock**: Thin accent-colored bar inside the locked card's header. Updates as projects are added.
- **Next unlock callout**: Single line under the dashboard title: "Next unlock: Checkpoint 2 — 3 more projects needed."

### Interaction

- Unlocked panels are collapsible (accordion behavior) to keep the page scannable.
- Locked panels are NOT expandable — they're visual only. Clicking does nothing (or shows a tooltip: "Add X more projects to unlock").
- When a new checkpoint unlocks: brief celebration animation (card border pulses from terracotta to navy, opacity animates from 0.5 to 1.0 over 600ms).

### Responsive

- Desktop: cards full-width, charts render inline within active panels.
- Mobile: same layout, narrower. Charts use `width: 100%` with horizontal scroll if needed.

---

## 3. Project Form (Tier 1 — PMO Helper)

**Recommendation: Clean single-page form with smart grouping and auto-computation.**

~10 fields is a short form. Don't over-design it. Two subtle improvements over a plain form:

### Grouping

```
┌─────────────────────────────────────────────┐
│  New Project                                  │
├─────────────────────────────────────────────┤
│  Project details                              │
│  ┌──────────────────┐ ┌──────────────────┐   │
│  │ Project name     │ │ Client name      │   │
│  └──────────────────┘ └──────────────────┘   │
│  Deliverable type: [CDD                     ▼]│
│                                               │
│  Pioneer info                                 │
│  ┌──────────────────┐ ┌──────────────────┐   │
│  │ Pioneer name     │ │ Pioneer email    │   │
│  └──────────────────┘ └──────────────────┘   │
│                                               │
│  Timeline                                     │
│  ┌──────────────────┐ ┌──────────────────┐   │
│  │ Date started     │ │ Date delivered   │   │
│  └──────────────────┘ └──────────────────┘   │
│  → xCSG calendar days: 12 (auto)              │
│                                               │
│  Team & Revisions                              │
│  ┌────────┐ ┌────────┐ ┌────────┐             │
│  │Team sz │ │Revs    │ │Scope   │             │
│  │  [3]   │ │  [1]   │ │[None ▼]│             │
│  └────────┘ └────────┘ └────────┘             │
│                                               │
│  Legacy Norms (auto-filled — click to edit)   │
│  ┌────────┐ ┌────────┐ ┌────────┐             │
│  │Cal days│ │Team sz │ │Revs    │             │
│  │ [15]   │ │  [3]   │ │  [2]   │             │
│  └────────┘ └────────┘ └────────┘             │
│                                               │
│            [ Create Project → ]                │
└─────────────────────────────────────────────┘
```

### Key details

- **Auto-computed calendar days**: When both dates are filled, compute and display as read-only label ("→ xCSG calendar days: 12"). If they want to override, they edit the dates. Simple.
- **Auto-populated legacy norms**: When deliverable type is selected, legacy fields fill from the reference table. Visually distinct: labeled "Legacy Norms (auto-filled — click to edit)", slightly lighter background (`#FAF7F2` with a dashed border). Fields are editable but the visual cue says "these are defaults."
- **Scope expansion**: Single `<select>` — None / Minor / Major.
- **Field widths**: Two-column grid on desktop (name + client side-by-side), single column on mobile.
- **No sliders, no geo pickers, no complexity score.** Just text inputs, dates, selects, and a number input for team size.

### Don't build

- No multi-step form wizard for 10 fields. One page.
- No complex validation beyond "required fields filled" and "dates are logical (delivered ≥ started)."
- No custom date pickers — native `<input type="date">` is fine.

---

## 4. Implementation Notes (FastAPI + Vanilla JS)

All of the above is achievable without a framework upgrade:

- **Progress bar**: a `<div>` with `width` set by JS counting filled selects.
- **Accordion**: toggle `display:none` / `display:block` on click. ~15 lines of JS.
- **Auto-populate**: `onchange` on deliverable type → fetch norms from API → fill inputs. ~10 lines.
- **localStorage auto-save for expert form**: `JSON.stringify()` the form state on every change, restore on page load.
- **Dashboard checkpoint logic**: API returns `project_count`. Frontend computes which checkpoints are unlocked. Pure conditional rendering.
- **Charts at Checkpoint 2+**: Use Chart.js (CDN, zero build step). Or even SVG built server-side. Don't overthink it.

### Tech constraints

- All styling: CSS custom properties + utility classes. No Tailwind build step needed — use the Tailwind CDN `<script>` tag or just write plain CSS.
- All forms: standard HTML `<form>` with `<select>`, `<input>`. No custom components.
- Responsive: CSS Grid + `@media` breakpoints. No framework needed.

---

## Summary

| Component | Pattern | Why |
|-----------|---------|-----|
| Expert Assessment | Single-page accordion | Fast to fill, scannable, works on mobile |
| Checkpoint Dashboard | Vertical card stack, locked = translucent + lock icon | Shows progression, no hidden content |
| Project Form | Grouped single-page, auto-computed fields | Simple, fast, no wizard overhead |
| All components | Native HTML elements, vanilla JS | No framework upgrade needed |
