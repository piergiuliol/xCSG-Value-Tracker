# xCSG Value Measurement Tracker V2 — Instructions

## What to Build

A polished web app (FastAPI + SQLite + vanilla HTML/JS/CSS) that tracks consulting deliverable performance. Read `SPEC.md` for the complete build specification and `FRAMEWORK.md` for the measurement methodology and rationale.

**V2 changes from V1**: Working days replaces calendar days for effort, per-project legacy estimates replace static norms table (expert provides all legacy benchmarks), revision depth replaces revision count, quality composite (multi-signal) replaces quality ratio, Outcome Rate + Revenue Productivity replace Value Multiplier, project categories for aggregation, expert form expanded to 27 answers (15 xCSG including self-assessment and reuse intent + 12 paired legacy estimates), three-tier administration, inline G2 update on deliverables list.

## Build Order

1. **Backend first**: `auth.py` → `models.py` → `database.py` → `metrics.py` → `app.py`
2. **Frontend second**: `styles.css` → `index.html` → `app.js`
3. **Deployment files**: `requirements.txt`, `launch.sh`, `Dockerfile`, `docker-compose.yml`
4. **Test**: Start the server, verify login works, create a test deliverable, submit expert form, check dashboard renders

## Critical Rules

- **No frameworks**: No React, no Vue, no Tailwind build. Vanilla HTML/JS/CSS only.
- **String consistency**: All dropdown option values must be IDENTICAL across HTML, Python scoring maps, and JS chart logic. D3 and G1 options use em dashes (—). Never put apostrophes inside single-quoted JS strings.
- **Import paths**: Use `from backend import auth`, `from backend.models import ...` (not bare imports). The app runs via `python -m uvicorn backend.app:app` from project root.
- **Static mount last**: `app.mount("/", StaticFiles(...))` must be the LAST line in app.py.
- **Seed user recovery**: `seed_data()` must verify passwords on every startup and re-hash if stale.
- **Chart.js defer**: Load Chart.js CDN with `defer`. Check canvas exists before `new Chart()`.
- **Working days for effort**: Effort computation uses `xcsg_working_days` (PMO integer input) × team midpoint. Calendar days from dates are retained for timeline trending only. Both stored; only working days feeds metrics.
- **B5 N/A handling**: "Did not use AI draft" = N/A for AI Survival Rate computation. Exclude from averages.
- **Per-project legacy estimates**: Legacy benchmarks come from expert Tier 2 form (12 paired estimates), NOT from a norms table. Category norms are computed aggregates from all expert submissions in that project category — no seed data. Outlier flag fires when category has ≥3 samples and an estimate deviates >1.5× from the running average.
- **Project categories**: 11 categories (CDD, Strategic Planning, Portfolio Management & Opportunity Assessment, Pricing & Reimbursement, Market Access Strategy, New Product Strategy, Strategic Surveillance & Competitive Intelligence, Evidence Generation & HEOR, Transaction Advisory, Market Research, Regulatory Strategy). Admin-managed, seeded at launch. Every deliverable assigned to one category.
- **Quality composite**: Quality Score = average of available components (revision depth, scope expansion, expert self-assessment, client pulse). When G2 missing, average of 3. When G2 present, average of 4. Never redistribute weight.
- **Revision depth options**: 'No revisions needed', 'Cosmetic only', 'Moderate rework', 'Major rework'. NOT revision count. Score mapping: 1.0, 0.85, 0.55, 0.2.
- **27-answer expert form**: 15 xCSG questions (B1-B5, C1-C3, C6 self-assessment, D1-D3, F1-F2, G1) + 12 paired legacy estimates = 27 total. ~6-7 min. Single page via unique link.
- **Value metrics**: Outcome Rate = Quality Score / Person-Days. Revenue Productivity = Revenue / Person-Days. These are the two value metrics. Value Multiplier is removed entirely.
- **UI quality**: Every form has a visible submit button. Clean spacing, two-column layouts, Alira brand colors throughout. Professional, not prototype.

## Brand Quick Reference

- Navy `#121F6B` (primary), Blue `#6EC1E4` (accent), Orange `#FF8300` (sparingly)
- Font: Roboto from Google Fonts
- See SPEC.md "Brand System" section for full details

## Run the app

From this folder: `./launch.sh`
Or: `cd xCSG_Value_Tracker && ./launch.sh`
Open http://localhost:8765

## Testing Checklist

### Core Flow
- [ ] `./launch.sh` starts without errors on macOS
- [ ] Login with admin/AliraAdmin2026! succeeds
- [ ] Dashboard shows empty state + 4 KPI cards (Total, Effort Ratio, Quality Score, Reuse Intent)
- [ ] `node --check xCSG_Value_Tracker/frontend/app.js` passes (zero syntax errors)

### New Deliverable (Tier 1)
- [ ] Form has visible submit button
- [ ] Working days field is integer input (not dropdown)
- [ ] Engagement revenue field present (optional, currency)
- [ ] Project category dropdown populated from admin-managed list
- [ ] Revision depth dropdown has 4 options (No revisions / Cosmetic / Moderate / Major)
- [ ] NO legacy estimate fields on PMO form (legacy comes from expert)
- [ ] Dates still collected (for timeline context) but not used for effort computation
- [ ] Client Contact Email field present (optional)
- [ ] Client Pulse (G2) dropdown defaults to "Not yet received"
- [ ] Creating deliverable shows modal with expert link

### Expert Form (Tier 2)
- [ ] Expert link opens standalone form (no login required)
- [ ] Form has 27 answer fields total
- [ ] xCSG section: B1-B5, C1-C3, C6 (self-assessment), D1-D3, F1-F2, G1 = 16 questions
- [ ] Legacy section: 12 paired estimates (working days, team size, revision depth, scope expansion, client reaction, B2, C1, C2, C3, D1, D2, D3)
- [ ] Legacy section header explains: "estimate for this specific deliverable using traditional methods"
- [ ] B5 (AI Survival Rate) has "Did not use AI draft" option
- [ ] C6 (Self-assessment) has 4 options: Significantly better / Somewhat better / Comparable / Somewhat worse
- [ ] G1 (Reuse Intent) present with em-dash options
- [ ] Legacy working days is integer input (not dropdown)
- [ ] Submitting shows thank-you message

### Dashboard
- [ ] First completed deliverable shows scorecard
- [ ] KPI cards show Effort Ratio and Quality Score (NOT Value Multiplier)
- [ ] Quality Score displayed as 0.XX (composite, not revision ratio)
- [ ] Reuse Intent KPI shows G1 percentage
- [ ] Outcome Rate shown in scorecard table rows
- [ ] At Checkpoint 4: Disprove matrix visualization present

### Deliverables List
- [ ] Columns include: Type, Category, Pioneer, Client, Status, Effort Ratio, Quality Score, Outcome Rate, G2
- [ ] G2 (Client Pulse) column with inline editable dropdown
- [ ] Updating G2 inline persists and triggers quality score recomputation

### Scaling Gates (at Checkpoint 4)
- [ ] 7 gates displayed (including Gate 7: Adoption Confidence)
- [ ] Gate 3 checks revision depth (not revision count)
- [ ] Gate 7 checks G1 reuse intent rate ≥70%

### Category Norms & Reasonableness Check
- [ ] Category norms table starts empty (no seed data)
- [ ] After expert submission, category running averages auto-recompute
- [ ] Outlier flag only fires when category has ≥3 completed deliverables
- [ ] Flag shown to PMO when legacy estimate >1.5× from category average
- [ ] Flag is informational only — does not block submission
- [ ] Category norms page shows per-category averages and sample counts
