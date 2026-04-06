# E2E Playwright Test Suite — Plan

## Goal
10 realistic engagements, full lifecycle: login → create project → capture expert token → fill expert form → verify portfolio metrics. Played as a real user would.

## Test Structure

### Fixture: `test-server`
- Start the FastAPI server on a random port before tests
- Fresh DB each run (delete `data/tracker.db` before start)
- Tear down after all tests

### Test Data: 10 Engagements
Realistic Alira Health consulting projects across all 8 deliverable types + repeats:

| # | Project Name | Category | Client | Pioneer | xCSG Days | Team | Revisions | Expert Profile |
|---|-------------|----------|--------|---------|-----------|------|-----------|---------------|
| 1 | Solventum CDD Q1 | CDD | Solventum | Bob Delise | 4-5 | 1 | 0 | Strong machine-first, deep specialist |
| 2 | Apposite Competitive Intel | Competitive landscape | Apposite Capital | Sarah Chen | 2-3 | 1 | 1 | Mixed approach, adjacent expertise |
| 3 | J&J Market Access EU | Market access | Johnson & Johnson | Luis Korrodi | 6-10 | 2 | 1 | Hypothesis-first, expert authored |
| 4 | BioHaven Call Prep | Call prep brief | BioHaven | Cameron Davidson | 1 | 1 | 0 | Heavy AI, generalist |
| 5 | Pfizer KOL Mapping Onc | KOL mapping | Pfizer | Bob Delise | 6-10 | 1 | 0 | Deep specialist, proprietary data |
| 6 | MediWound Financial Model | Financial model | MediWound | Sarah Chen | 2-3 | 1 | 1 | Mixed, co-authored |
| 7 | Novartis Proposal Lupus | Proposal | Novartis | Luis Korrodi | 2-3 | 1 | 0 | Hypothesis-first, reused knowledge |
| 8 | Solventum Presentation Q2 | Presentation | Solventum | Cameron Davidson | 2-3 | 2 | 1 | Discovery-first, bespoke |
| 9 | Roche CDD Rare Disease | CDD | Roche | Bob Delise | 4-5 | 1 | 0 | Strong all three legs |
| 10 | AstraZeneca Comp Landscape | Competitive landscape | AstraZeneca | Luis Korrodi | 4-5 | 2 | 0 | Max machine-first + proprietary |

### Test Flow (per engagement)

1. **Login** as admin (first time only, reuse session)
2. **Navigate** to New Project (`#new`)
3. **Fill Tier 1 form**: name, category, client, pioneer, email, dates, xCSG metrics
4. **Verify** legacy norms auto-populate on category select
5. **Submit** → capture expert token from modal
6. **Navigate** to expert URL (`#expert/{token}`)
7. **Fill all 12 Tier 2 questions** (B1-B4, C1-C3, D1-D3, F1-F2)
8. **Submit** expert form → verify thank-you screen
9. **Return** to app (login again if needed)

### Verification Tests (after all 10 created)

10. **Projects list**: verify 10 rows, all status "Complete"
11. **Portfolio dashboard**: verify KPI cards (total=10, VM > 1, effort ratio > 1)
12. **Checkpoint progression**: should be at checkpoint 2+ (≥3 complete)
13. **Scorecard table**: all 10 projects visible with metrics
14. **Charts rendered**: effort + quality charts exist (checkpoint 2)
15. **Flywheel gauges**: all three > 0%
16. **Pioneer filter**: filter by "Bob Delise" → 3 projects
17. **Category filter**: filter by "CDD" → 2 projects
18. **Activity log**: verify creation + expert completion entries
19. **Settings**: verify categories show project counts
20. **Export**: trigger Excel export, verify download

## File Structure
```
tests/
├── e2e-lifecycle.spec.ts    # Main test file
├── fixtures/
│   └── test-data.ts         # 10 engagement definitions
└── playwright.config.ts     # Config with server setup
```

## Checklist
- [ ] Write playwright.config.ts
- [ ] Write test data fixtures
- [ ] Write lifecycle tests (create 10 projects + expert forms)
- [ ] Write verification tests (portfolio, filters, charts, export)
- [ ] Run and verify all pass
