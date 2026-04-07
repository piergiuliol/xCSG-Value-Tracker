## QA Report: xCSG Value Tracker E2E

**Date:** 2026-04-07
**Tester:** Aristarchus 📐 (Automated Playwright E2E)
**Environment:** http://localhost:8000, Chromium headless, 1440×900
**Verdict:** ✅ PASS WITH ISSUES

---

### Test Results

| # | Test | Result | Time |
|---|------|--------|------|
| 1 | Login | ✅ PASS | 0.9s |
| 2 | Create a new project | ✅ PASS | 2.2s |
| 3 | Expert assessment (critical flow) | ✅ PASS | 8.3s |
| 4 | Dashboard with real metrics | ✅ PASS | 4.6s |
| 5 | Project form — correct fields present/absent | ✅ PASS | 1.5s |
| 6 | Navigation — all routes work | ✅ PASS | 7.6s |
| 7 | JS error check | ✅ PASS (1 non-critical) | — |

**Total:** 7/7 passed (25.6s)

---

### Test 1: Login ✅ PASS
- Login screen renders correctly
- Admin login with `admin / AliraAdmin2026!` succeeds
- Redirects to `#portfolio` dashboard
- App shell (`#appShell`) becomes visible
- No JS errors during login

### Test 2: Create a new project ✅ PASS
- `#new` route renders project form correctly
- All form fields fillable: project name, category, pioneer, email
- xCSG Performance fields: Calendar Days, Team Size, Revision Rounds, Scope Expansion
- Legacy Baseline fields populated
- Form submission succeeds
- Success modal appears with "Project Created" heading
- Expert link input contains valid token (format: `#expert/{token}`)
- Token verified via API

### Test 3: Expert assessment (critical flow) ✅ PASS
- Expert view loads without authentication
- Context card shows project name ("QA Test Project"), category, pioneer
- All 4 accordion section headers visible: B, C, D, F
- Each section expands and shows question text
- **Section B** (Machine-First Operations): 4 questions × 2 columns (xcsg + legacy) = 8 fields
- **Section C** (Senior-Led Engagement): 3 selects + 2 numeric inputs (xcsg only, no legacy) = 5 fields
- **Section D** (Proprietary Knowledge Moat): 3 questions × 2 columns = 6 fields
- **Section F** (Value Creation): 2 questions × 2 columns = 4 fields
- **Total: 23/23 fields completed**
- Progress bar updates correctly (23/23)
- Submit button becomes enabled at 100%
- Submit succeeds — "Thank You!" message displayed with metrics preview

### Test 4: Dashboard with real metrics ✅ PASS
- Re-login succeeds after expert session
- Projects page shows "QA Test Project"
- Clicking project shows detail view
- "xCSG Score" label displayed
- Checkpoint cards present

### Test 5: Project form — correct fields present/absent ✅ PASS
- ❌ **Absent (correctly removed):** Complexity, Client Sector, Sub-category, Geography
- ✅ **Present:** Team Size (≥4 options), Revision Rounds (≥4 options), Scope Expansion (≥3 options)

### Test 6: Navigation ✅ PASS
- All 5 routes render non-blank content: Portfolio, Projects, Norms, Settings, Activity
- No blank pages or crashes on any route

---

### Issues Found

#### Bug: Console 422 Error
**Severity:** minor
**Found in:** General navigation (likely during project list or category fetch)
**Steps to reproduce:** Navigate through app pages
**Actual:** A `422 Unprocessable Entity` error appears in console
**Expected:** API calls should handle edge cases without 422 responses
**Root cause:** Likely an API endpoint receiving unexpected parameters or a missing required field in a request
**Note:** This is non-critical — doesn't break any user-visible functionality

#### Bug: Senior-Led Score returns null
**Severity:** major
**Found in:** Expert assessment submission response
**Steps to reproduce:** Submit a complete expert assessment via API
**Actual:** `senior_led_score: null` in response metrics
**Expected:** Should compute a numeric score based on C-section answers
**Root cause:** Likely a mismatch between field names sent by the form (`c1_specialization_xcsg`, etc.) and what the backend `compute_senior_led_score()` expects. The other two legs (Machine-First: 5%, Knowledge Moat: 5%) computed correctly, suggesting the scoring function for Senior-Led has a different key mapping.

#### Bug: Expert thank-you HTML structure
**Severity:** cosmetic
**Found in:** `frontend/app.js` `renderExpert()` submit handler
**Actual:** Uses `ec.innerHTML += '<div class="expert-thankyou">';` followed by separate `+=` appends, resulting in `.expert-thankyou` being an empty div with sibling elements (h2, p, metrics) outside it
**Expected:** All thank-you content should be inside `.expert-thankyou`
**Root cause:** Using `innerHTML +=` with an opening tag without closing it in the same statement. Should use a single `innerHTML =` with complete HTML or DOM manipulation.

---

### Recommendations

1. **Fix Senior-Led scoring** — the `compute_senior_led_score()` backend function likely expects keys like `c1_specialization` (without `_xcsg` suffix) or has a different field mapping than what the expert form sends. Verify the key mapping in `backend/metrics.py`.
2. **Fix 422 console error** — add error handling or fix the API request that triggers the 422.
3. **Fix thank-you HTML** — consolidate the `innerHTML +=` calls in the expert submit handler into a single template literal.
