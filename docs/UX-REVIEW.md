# xCSG Value Measurement Tracker — UX Review & Gap Analysis

**Reviewer**: Palladio 🎨, Product Designer  
**Date**: 2026-03-31  
**Documents reviewed**: FRAMEWORK.md, Instructions.md, SPEC.md

---

## Executive Summary

The spec is well-structured and the two-tier administration model is smart. But there are **meaningful gaps** between the framework's methodology and the spec's implementation, several **missing user flows**, and some **UX decisions that will frustrate daily users**. This review covers all of them.

---

## 1. Functionality Gaps — Framework vs. Spec

### 1.1 B4 (Hypothesis Approach) Missing from Machine-First Score

**FRAMEWORK.md** defines Machine-First Score as the average of B1, B2, B3, **B4**.  
**SPEC.md** only averages B1, B2, B3.

B4 is a "killer question" per the framework — it's the behavioral signature of the xCSG model. Dropping it from the composite score undermines the measurement. **Must fix.**

### 1.2 Legacy Norms for Expert Judgment Questions (B2, C1-C3) Not Collected

The framework shows **paired columns** (xCSG actual vs. Legacy norm) for B2, C1, C2, and C3. The scoring formulas reference ratios: "B2 (sources ratio: xCSG/Legacy)" and "C3 (judgment concentration ratio: xCSG/Legacy)."

The SPEC only collects xCSG values and maps them to an absolute 0–1 scale. This loses the comparative dimension. Either:
- Add legacy norm defaults for these questions to the norms table, OR
- Document that the simplified scoring is an intentional design choice

**Recommendation**: Add legacy norm defaults for B2 and C1-C3 to the legacy_norms table. The whole point of the framework is comparison.

### 1.3 Checkpoint 3 & 4 Metrics Missing from SPEC

The framework introduces several metrics at later checkpoints that the SPEC doesn't specify:

| Missing Metric | Checkpoint | Description |
|---|---|---|
| **Compound Signal** | 3 | D2 reuse rate trending over time |
| **Implied Margin Improvement** | 4 | (Legacy PD − xCSG PD) × Blended Daily Rate |
| **Revenue Attribution** | 4 | Deliverables at "New business" stage where C5 = "Yes, new engagement" |
| **Seniority Shift panel** | 4 | C1 + C2 comparison: who does the work and how |

The Compound Signal is partially captured (SPEC has Gate 6 checking D2 ≥ 40%), but it's not surfaced as a trend line. The financial metrics (Implied Margin, Revenue Attribution) need a blended daily rate input that doesn't exist anywhere in the schema. **Add a settings/config table or hardcode a configurable rate.**

### 1.4 Checkpoint Summary Snapshots

FRAMEWORK.md describes "Sheet 4: Checkpoint Summaries" — snapshot tables at each checkpoint with key metrics, narrative highlights, and scaling gate status. The web app has no equivalent. 

**Recommendation**: Add a "Checkpoint History" section to the dashboard that auto-generates a summary card when a new checkpoint threshold is crossed. Even just freezing the KPI values at that moment would be valuable for the board package.

### 1.5 Framework Counting Error

FRAMEWORK says "The remaining **14 questions** (B1-B4, C1-C3, D1-D3, F1-F2)." That's 4+3+3+2 = **12**, not 14. Harmless but should be corrected in the framework doc to avoid confusion.

---

## 2. UX Issues & Inconsistencies

### 2.1 Token-in-Memory = Logout on Refresh

The SPEC stores the auth token in `window.__app_token` and explicitly says "tokens don't survive page refresh. This is by design (security)." 

For a PMO helper entering 3-5 deliverables per session, an accidental F5 means re-login + losing any in-progress form data. This is **hostile UX** for a daily-use tool.

**Recommendation**: Use `sessionStorage` instead. Still cleared on tab close (security), but survives refresh. Or at minimum, add a "remember me" option that uses `sessionStorage`.

### 2.2 No Way to Resend or View Expert Links

After creating a deliverable, the expert link appears in a modal once. If the PMO helper closes it without copying, or needs to resend it later, there's no way to retrieve it.

**Must fix**: Show the expert link on the deliverable detail view and in the deliverables list (copy button on each row). The token already exists in the database.

### 2.3 No Edit Flow for Deliverables

The API has `PUT /api/deliverables/{id}` but no frontend view for editing. PMO helpers make data entry mistakes. Without edit, they'd need to delete and recreate, losing the expert link.

**Must fix**: Add an edit mode to the deliverable form, pre-populated with existing data.

### 2.4 No Delete Confirmation

The API has `DELETE /api/deliverables/{id}` (admin only) but the spec doesn't describe a confirmation dialog. Deleting a deliverable cascades to expert_responses. **Add a confirmation modal.**

### 2.5 No Pagination UI

The API supports pagination on deliverables and activity log, but the spec describes no pagination controls in the frontend. At 20-40 deliverables, the list becomes unwieldy.

**Recommendation**: Add simple prev/next pagination with count display. Not critical for pilot (40 max records), but should be there.

### 2.6 No Export Button in UI

`GET /api/export/excel` exists but no UI element triggers it. The whole point of Excel export is the board package.

**Must fix**: Add an "Export to Excel" button on the dashboard (prominent, since this is a key deliverable for the board).

### 2.7 No User Management UI

`POST /api/auth/register` exists (admin only) but there's no frontend view for managing users. For the pilot, seed users may suffice, but it should be documented as a known gap.

### 2.8 Dashboard Doesn't Indicate Current Checkpoint

The dashboard progressively shows panels, but never tells the user "You are at Checkpoint 2 (5 of 8 deliverables needed for Checkpoint 3)." The PMO helper needs motivation and context.

**Must fix**: Add a checkpoint progress indicator at the top of the dashboard showing current checkpoint and progress to next.

### 2.9 Empty Dashboard Is Demoralizing

The spec says "empty state message centered with gray text." For a brand-new deployment, the PMO helper opens the app and sees... nothing. 

**Recommendation**: Design an empty state that guides the user. "Welcome to xCSG Value Tracker. Create your first deliverable to begin building evidence." with a CTA button.

---

## 3. Missing User Flows

### 3.1 Expert Reminder Flow

What happens when the expert hasn't filled out their form after 3 days? The PMO helper needs to:
1. See which deliverables are pending expert response
2. Re-access the expert link
3. (Ideally) trigger a reminder

The deliverables list needs a clear **"Expert Pending"** status filter and the expert link must be accessible from the list view.

### 3.2 Deliverable Lifecycle Clarity

The status model is binary: `expert_pending` → `complete`. But the real lifecycle is:

1. **Draft** — PMO is filling in Tier 1 data (partially complete)
2. **Expert Pending** — Tier 1 complete, waiting for expert
3. **Complete** — Both tiers done, metrics computed

No draft state means the PMO can't save partial work. For the pilot this is acceptable (5-minute forms), but worth noting.

### 3.3 Bulk Operations

If a PMO helper needs to enter 5 deliverables from last week, they do it one by one. No bulk import. Acceptable for pilot (low volume), but the Excel-oriented nature of the legacy workflow suggests an import feature would be valued.

### 3.4 Expert Form Error States

The spec says expert form has dropdowns and a submit button. What happens on:
- Network error during submission?
- Token that's already been used (expert submitted, then clicks link again)?
- Invalid/expired token?

**Must handle**: Show clear error states. For already-submitted tokens, show the thank-you message (not an error).

### 3.5 Dashboard Filtering

No way to filter the dashboard by:
- Deliverable type
- Pioneer
- Date range
- Engagement stage

For Checkpoint 4 analysis ("proves it works ACROSS engagement types"), the user needs type-level drill-down. **Add basic filters to the dashboard.**

---

## 4. Data Integrity Concerns

### 4.1 Legacy Norms Override Without Audit Trail

The spec allows overriding auto-populated legacy norms per deliverable, but there's no record of whether a value was auto-populated or manually changed. This matters for data integrity.

**Recommendation**: Add a `legacy_overridden` boolean flag per deliverable, or store both the original norm and the override value.

### 4.2 No Validation on Date Consistency

`date_started` should be before `date_delivered`. The spec doesn't mention client-side or server-side validation for this. Add it.

### 4.3 Expert Response Immutability

Once an expert submits, there's no way to correct an error. If they misclicked a dropdown, the data is locked. Consider allowing one edit within 24 hours, or admin override.

---

## 5. Visual & Interaction Design Notes

### 5.1 Sidebar Navigation Mapping

The spec defines 5 views but the sidebar needs clear information hierarchy:
1. **Dashboard** (home, default view) — 📊 icon
2. **New Deliverable** (primary action) — ➕ icon, should be visually prominent
3. **Deliverables** (list/manage) — 📋 icon
4. **Legacy Norms** (config, less frequent) — ⚙️ icon
5. **Activity Log** (audit, least frequent) — 📝 icon

"New Deliverable" should be either a prominent button in the sidebar (not just a nav item) or accessible from both the sidebar and the deliverables list.

### 5.2 KPI Card Design

The 4-column KPI grid at the top of the dashboard is good, but the spec doesn't specify WHICH 4 KPIs. Based on the framework:
1. **Total Deliverables** (count) — with complete/pending breakdown
2. **Average Value Multiplier** — the headline number
3. **Average Effort Ratio** — the efficiency story
4. **Flywheel Health** — average of all three leg scores (or worst leg)

### 5.3 Expert Form Must Feel Different

The expert form is standalone (no sidebar, no auth). It should feel like a branded microsite, not a subset of the admin app. Lighter, simpler, more generous spacing. The expert is doing the PMO helper a favor — make it pleasant.

---

## 6. Summary of Required Changes

### Critical (blocks usability)
- [ ] Add B4 to Machine-First Score computation
- [ ] Show expert links in deliverables list/detail (resend capability)
- [ ] Add edit deliverable flow
- [ ] Add delete confirmation modal
- [ ] Add Excel export button to dashboard
- [ ] Handle expert form edge cases (already submitted, invalid token, network error)

### Important (blocks daily workflow)
- [ ] Use sessionStorage instead of window variable for auth token
- [ ] Add checkpoint progress indicator to dashboard
- [ ] Add "Expert Pending" filter to deliverables list
- [ ] Add date validation (start before delivered)
- [ ] Design meaningful empty states with CTAs

### Nice-to-have (polish for pilot)
- [ ] Dashboard filtering (type, pioneer, date range)
- [ ] Legacy norm override audit trail
- [ ] Checkpoint history snapshots
- [ ] Pagination controls
- [ ] User management UI
- [ ] Collect legacy norms for B2, C1-C3 (restores framework's comparative design)
- [ ] Add Compound Signal, Implied Margin, Revenue Attribution metrics

---

*Prototypes follow in `/prototypes/` — production-quality HTML showing each major view.*
