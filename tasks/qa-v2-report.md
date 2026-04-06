# xCSG Value Tracker v2 — QA Report
**Date:** 2026-04-02T19:52:57.374Z
**Tester:** Archie (automated)

## Results

### Phase 1: Auth ✅
- Login works with admin/AliraAdmin2026!

### Phase 2: Create Projects ✅
- Created 20/20 projects across all 8 categories

### Phase 3: Expert Assessments ✅
- Submitted 20/20 expert assessments
- Already-submitted handling: working
- Invalid token handling: working (404)

### Phase 4: Metrics ✅
- Checkpoint: 4 (CP4 = 20+ projects)
- Avg Value Multiplier: 12.68
- Avg Effort Ratio: 4.44
- Flywheel Health: 0.6618
- Scaling Gates: 4/6 passed
  - ✅ Multi-engagement: 8 categories completed
  - ✅ Time Reduction: Avg effort ratio 4.4× (threshold: >1.3×)
  - ✅ Client-Invisible Quality: 11 projects with 0 revisions
  - ⏳ Transferability: Requires non-pioneer data — deferred to CP3
  - ⏳ Flywheel Validation: Requires registry-integrated AI delivery data
  - ✅ Compounding: D2 reuse rate: 77% (threshold: ≥40%)

### Phase 5: Export ✅
- Excel export: working (13.8 KB)

### Phase 6: Visual QA
Screenshots saved to `test-results/screenshots/`

## Console Log
```
═══ xCSG Value Tracker v2 — Full E2E QA ═══
Started: 2026-04-02T19:52:37.387Z

── Phase 1: Auth ──
✅ Login successful
✅ 8 categories loaded: CDD, Call Prep Brief, Competitive Landscape, Financial Model, KOL Mapping, Market Access, Presentation, Proposal

── Phase 2: Create 20 Projects ──
  ✅ #1 "Pfizer Oncology CDD — EU Launch" (CDD) — token: ST2ZC8Ph...
  ✅ #2 "Novartis CAR-T Commercial Due Diligence" (CDD) — token: UBQc2IrD...
  ✅ #3 "Roche Biosimilar Competitive Landscape" (Competitive Landscape) — token: jnTMGsmE...
  ✅ #4 "AZ IO Competitive Mapping — US" (Competitive Landscape) — token: I4Wx72FK...
  ✅ #5 "Sanofi Rare Disease Financial Model" (Financial Model) — token: xjum1TLn...
  ✅ #6 "BMS Gene Therapy P&L Model" (Financial Model) — token: Ej9arsVr...
  ✅ #7 "Merck EU Market Access Strategy" (Market Access) — token: LsB56CuR...
  ✅ #8 "Lilly GLP-1 Reimbursement Dossier" (Market Access) — token: ugbGMQtP...
  ✅ #9 "Amgen Biosimilar Proposal — DACH" (Proposal) — token: DF-z_y_K...
  ✅ #10 "GSK Vaccine Partnership Pitch" (Proposal) — token: S8vImHcI...
  ✅ #11 "Pfizer KOL Call Prep — Cardiology" (Call Prep Brief) — token: 0vm_4kBV...
  ✅ #12 "Novartis Expert Interview Prep — Neuroscience" (Call Prep Brief) — token: mOn703Bo...
  ✅ #13 "Roche Board Presentation — Pipeline Review" (Presentation) — token: avZTFwPH...
  ✅ #14 "AZ Investor Day Deck — Oncology" (Presentation) — token: Ppaxb3mv...
  ✅ #15 "Sanofi Dermatology KOL Map — Global" (KOL Mapping) — token: LpsAXCC5...
  ✅ #16 "BMS Hematology KOL Mapping — US" (KOL Mapping) — token: Pn2YC-4M...
  ✅ #17 "Merck Respiratory CDD — Japan" (CDD) — token: 1AAB4z3G...
  ✅ #18 "Lilly Obesity Market Access — EU5" (Market Access) — token: F6aMnTB4...
  ✅ #19 "Amgen Rare Disease Competitive Intel" (Competitive Landscape) — token: MplrsCHv...
  ✅ #20 "GSK mRNA Platform Financial Model" (Financial Model) — token: oBkq3foI...

✅ Created 20/20 projects

── Phase 3: Submit Expert Assessments ──
✅ Submitted 20/20 expert assessments
✅ Already-submitted test: status=201, already_completed=true
✅ Invalid token test: status=404 (expected 404)

── Phase 4: Metrics Verification ──
  Total projects: 30
  Complete: 30
  Pending: 0
  Checkpoint: 4
  Avg Value Multiplier: 12.68
  Avg Effort Ratio: 4.44
  Flywheel Health: 0.6618
  Machine-First avg: 0.6854
  Senior-Led avg: 0.65
  Proprietary Knowledge avg: 0.65

  Scaling Gates: 4/6 passed
    ✅ Multi-engagement: 8 categories completed
    ✅ Time Reduction: Avg effort ratio 4.4× (threshold: >1.3×)
    ✅ Client-Invisible Quality: 11 projects with 0 revisions
    ⏳ Transferability: Requires non-pioneer data — deferred to CP3
    ⏳ Flywheel Validation: Requires registry-integrated AI delivery data
    ✅ Compounding: D2 reuse rate: 77% (threshold: ≥40%)

  Trend points: 30

── Phase 5: Export ──
  Export status: 200 (expected 200)
  Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet
  File size: 13.8 KB

── Phase 6: Visual QA (Playwright) ──
  📸 01-login.png
  📸 02-portfolio-cp4.png (Checkpoint 4 — 20 projects)
  📸 03-portfolio-charts.png
  📸 04-portfolio-gates.png
  📸 05-projects-list.png
  📸 06-edit-project.png (via row click)
  📸 07-settings.png
  📸 08-activity-log.png
  📸 09-new-project-form.png
  📸 10-expert-form-submitted.png (already submitted state)
  📸 11-expert-invalid.png

✅ All screenshots captured

═══ QA COMPLETE ═══
```
