# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: e2e-lifecycle.spec.ts >> xCSG Value Tracker — Full Lifecycle >> Edit project — expert responses shown read-only
- Location: tests/e2e-lifecycle.spec.ts:359:7

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: locator('.expert-response-grid')
Expected: visible
Error: strict mode violation: locator('.expert-response-grid') resolved to 4 elements:
    1) <div class="expert-response-grid">…</div> aka getByText('B1 From AI draft B2 13+ B3 >')
    2) <div class="expert-response-grid">…</div> aka getByText('C1 Deep specialist in this TA/methodology C2 Expert authored (with AI assist)')
    3) <div class="expert-response-grid">…</div> aka getByText('D1 Yes D2 Yes, directly')
    4) <div class="expert-response-grid">…</div> aka getByText('F1 Not feasible — scope or timeline was only possible with AI F2 Yes, largely')

Call log:
  - Expect "toBeVisible" with timeout 5000ms
  - waiting for locator('.expert-response-grid')

```

# Page snapshot

```yaml
- generic [ref=e2]:
  - navigation [ref=e3]:
    - img "Alira Health" [ref=e5]
    - generic [ref=e6]:
      - generic [ref=e7] [cursor=pointer]:
        - img [ref=e8]
        - text: Portfolio
      - generic [ref=e13] [cursor=pointer]:
        - img [ref=e14]
        - text: New Project
      - generic [ref=e15] [cursor=pointer]:
        - img [ref=e16]
        - text: Projects
      - generic [ref=e19] [cursor=pointer]:
        - img [ref=e20]
        - text: Settings
      - generic [ref=e23] [cursor=pointer]:
        - img [ref=e24]
        - text: Activity Log
    - generic [ref=e27]: © 2026 Alira Health
  - generic [ref=e28]:
    - generic [ref=e30]:
      - generic [ref=e31]:
        - generic [ref=e32]: Admin
        - generic [ref=e33]: A
      - button "Logout" [ref=e34] [cursor=pointer]
    - generic [ref=e35]:
      - generic [ref=e37]:
        - group "Project Information" [ref=e38]:
          - generic [ref=e39]: Project Information
          - generic [ref=e41]:
            - generic [ref=e42]: Project Name *
            - textbox "e.g., Pfizer EU Market Access Q2" [ref=e43]: AstraZeneca Competitive Landscape IO
          - generic [ref=e44]:
            - generic [ref=e45]:
              - generic [ref=e46]: Category *
              - combobox [ref=e47] [cursor=pointer]:
                - option "— Select Category —"
                - option "CDD"
                - option "Call Prep Brief"
                - option "Competitive Landscape" [selected]
                - option "Financial Model"
                - option "KOL Mapping"
                - option "Market Access"
                - option "Presentation"
                - option "Proposal"
            - generic [ref=e48]:
              - generic [ref=e49]: Client Name
              - textbox [ref=e50]: AstraZeneca
          - generic [ref=e51]:
            - generic [ref=e52]:
              - generic [ref=e53]: Pioneer Name *
              - textbox [ref=e54]: Luis Korrodi
            - generic [ref=e55]:
              - generic [ref=e56]: Pioneer Email
              - textbox [ref=e57]: luis.korrodi@alirahealth.com
          - generic [ref=e59]:
            - generic [ref=e60]: Description
            - textbox "Brief project description" [ref=e61]: "Immuno-oncology competitive landscape: 18 assets across 4 MOAs with clinical + commercial analysis."
        - group "Timeline" [ref=e62]:
          - generic [ref=e63]: Timeline
          - generic [ref=e64]:
            - generic [ref=e65]:
              - generic [ref=e66]: Date Started
              - textbox [ref=e67]: 2026-03-20
            - generic [ref=e68]:
              - generic [ref=e69]: Target Delivery Date
              - textbox [ref=e70]: 2026-03-24
        - group "xCSG Performance" [ref=e71]:
          - generic [ref=e72]: xCSG Performance
          - generic [ref=e73]:
            - generic [ref=e74]:
              - generic [ref=e75]: Calendar Days *
              - combobox [ref=e76] [cursor=pointer]:
                - option "— Select —"
                - option "1"
                - option "2-3"
                - option "4-5" [selected]
                - option "6-10"
                - option "11-20"
                - option "20+"
            - generic [ref=e77]:
              - generic [ref=e78]: Team Size *
              - combobox [ref=e79] [cursor=pointer]:
                - option "— Select —"
                - option "1"
                - option "2" [selected]
                - option "3"
                - option "4+"
          - generic [ref=e80]:
            - generic [ref=e81]:
              - generic [ref=e82]: Revision Rounds *
              - combobox [ref=e83] [cursor=pointer]:
                - option "— Select —"
                - option "0" [selected]
                - option "1"
                - option "2"
                - option "3+"
            - generic [ref=e84]:
              - generic [ref=e85]: Scope Expansion
              - combobox [ref=e86] [cursor=pointer]:
                - option "— Select —"
                - option "Yes, expanded scope"
                - option "Yes, new engagement" [selected]
                - option "No"
                - option "Not yet delivered"
        - group "Legacy Baseline" [ref=e87]:
          - generic [ref=e88]: Legacy Baseline
          - generic [ref=e89]:
            - generic [ref=e90]:
              - generic [ref=e91]: Calendar Days (overridden)
              - combobox [ref=e92] [cursor=pointer]:
                - option "— Select —"
                - option "1"
                - option "2-3"
                - option "4-5"
                - option "6-10"
                - option "11-20"
                - option "20+" [selected]
            - generic [ref=e93]:
              - generic [ref=e94]: Team Size (overridden)
              - combobox [ref=e95] [cursor=pointer]:
                - option "— Select —"
                - option "1"
                - option "2"
                - option "3"
                - option "4+" [selected]
          - generic [ref=e97]:
            - generic [ref=e98]: Revision Rounds (overridden)
            - combobox [ref=e99] [cursor=pointer]:
              - option "— Select —"
              - option "0"
              - option "1"
              - option "2"
              - option "3+" [selected]
        - generic [ref=e101]:
          - button "Cancel" [ref=e102] [cursor=pointer]
          - button "Save Changes" [ref=e103] [cursor=pointer]
      - generic [ref=e104]:
        - generic [ref=e105]: Expert Assessment (Read-Only)
        - generic [ref=e106]:
          - 'heading "Section B: Machine-First Operations" [level=4] [ref=e107]'
          - generic [ref=e108]:
            - generic [ref=e109]:
              - generic [ref=e110]: B1
              - text: From AI draft
            - generic [ref=e111]:
              - generic [ref=e112]: B2
              - text: 13+
            - generic [ref=e113]:
              - generic [ref=e114]: B3
              - text: ">75% AI"
            - generic [ref=e115]:
              - generic [ref=e116]: B4
              - text: Hypothesis-first (tested a specific thesis)
          - 'heading "Section C: Senior-Led Engagement" [level=4] [ref=e117]'
          - generic [ref=e118]:
            - generic [ref=e119]:
              - generic [ref=e120]: C1
              - text: Deep specialist in this TA/methodology
            - generic [ref=e121]:
              - generic [ref=e122]: C2
              - text: Expert authored (with AI assist)
            - generic [ref=e123]:
              - generic [ref=e124]: C3
              - text: ">75% judgment"
          - 'heading "Section D: Proprietary Knowledge" [level=4] [ref=e125]'
          - generic [ref=e126]:
            - generic [ref=e127]:
              - generic [ref=e128]: D1
              - text: "Yes"
            - generic [ref=e129]:
              - generic [ref=e130]: D2
              - text: Yes, directly reused and extended
            - generic [ref=e131]:
              - generic [ref=e132]: D3
              - text: No — proprietary inputs decisive
          - 'heading "Section F: Value Creation" [level=4] [ref=e133]'
          - generic [ref=e134]:
            - generic [ref=e135]:
              - generic [ref=e136]: F1
              - text: Not feasible — scope or timeline was only possible with AI
            - generic [ref=e137]:
              - generic [ref=e138]: F2
              - text: Yes, largely as-is
```

# Test source

```ts
  269 |     await login(page);
  270 |     await page.locator('[data-route="portfolio"]').click();
  271 |     await page.waitForTimeout(1000);
  272 | 
  273 |     const gaugeValues = page.locator('.gauge-value');
  274 |     const count = await gaugeValues.count();
  275 |     expect(count).toBe(3);
  276 | 
  277 |     for (let i = 0; i < 3; i++) {
  278 |       const text = await gaugeValues.nth(i).textContent();
  279 |       const val = parseInt(text!.replace('%', ''));
  280 |       expect(val).toBeGreaterThan(0);
  281 |     }
  282 |   });
  283 | 
  284 |   test('Portfolio — filter by pioneer shows subset', async ({ page }) => {
  285 |     await login(page);
  286 |     await page.locator('[data-route="portfolio"]').click();
  287 |     await page.waitForTimeout(1000);
  288 | 
  289 |     await selectByValue(page, '#portfolioPioneerFilter', 'Bob Delise');
  290 |     await page.waitForTimeout(300);
  291 | 
  292 |     // Clear filters button should appear
  293 |     await expect(page.locator('#portfolioFilterReset')).toBeVisible();
  294 | 
  295 |     // Click clear
  296 |     await page.locator('#portfolioFilterReset').click();
  297 |     await page.waitForTimeout(300);
  298 | 
  299 |     // All rows visible again
  300 |     const visibleRows = page.locator('#scorecardTable tbody tr:visible');
  301 |     await expect(visibleRows).toHaveCount(10);
  302 |   });
  303 | 
  304 |   test('Portfolio — value multiplier trend chart rendered (checkpoint 3+)', async ({ page }) => {
  305 |     await login(page);
  306 |     await page.locator('[data-route="portfolio"]').click();
  307 |     await page.waitForTimeout(1500);
  308 | 
  309 |     // With 10 complete projects, checkpoint should be 3+ and trend chart visible
  310 |     await expect(page.locator('#trendChart')).toBeVisible();
  311 |   });
  312 | 
  313 |   test('Activity log has entries for all creations and completions', async ({ page }) => {
  314 |     await login(page);
  315 |     await page.locator('[data-route="activity"]').click();
  316 |     await page.waitForTimeout(1000);
  317 | 
  318 |     // Should have at least 20 entries (10 creates + 10 expert completions)
  319 |     const rows = page.locator('.data-table tbody tr');
  320 |     const count = await rows.count();
  321 |     expect(count).toBeGreaterThanOrEqual(20);
  322 |   });
  323 | 
  324 |   test('Settings — categories show project counts', async ({ page }) => {
  325 |     await login(page);
  326 |     await page.locator('[data-route="settings"]').click();
  327 |     await page.waitForTimeout(1000);
  328 | 
  329 |     // CDD should show count of 2
  330 |     const tableText = await page.locator('.data-table').textContent();
  331 |     expect(tableText).toContain('CDD');
  332 |   });
  333 | 
  334 |   test('Settings — legacy norms tab loads', async ({ page }) => {
  335 |     await login(page);
  336 |     await page.locator('[data-route="settings"]').click();
  337 |     await page.waitForTimeout(500);
  338 | 
  339 |     await page.locator('#tabNorms').click();
  340 |     await page.waitForTimeout(1000);
  341 | 
  342 |     // Should see norms table
  343 |     const normsContent = page.locator('#settingsContent');
  344 |     await expect(normsContent.locator('.data-table')).toBeVisible();
  345 |   });
  346 | 
  347 |   test('Expert link resubmit shows "already completed"', async ({ page }) => {
  348 |     // Try to access the first expert token again
  349 |     expect(expertTokens[0]).toBeTruthy();
  350 |     await page.goto(`/#expert/${expertTokens[0]}`);
  351 |     await expect(page.locator('#expertView')).toBeVisible({ timeout: 5000 });
  352 | 
  353 |     // Should show thank-you / already completed message
  354 |     await expect(page.locator('.expert-thankyou')).toBeVisible({ timeout: 5000 });
  355 |     const text = await page.locator('.expert-thankyou').textContent();
  356 |     expect(text).toContain('already');
  357 |   });
  358 | 
  359 |   test('Edit project — expert responses shown read-only', async ({ page }) => {
  360 |     await login(page);
  361 |     await page.locator('[data-route="projects"]').click();
  362 |     await expect(page.locator('#projectTable')).toBeVisible({ timeout: 5000 });
  363 | 
  364 |     // Click first project row
  365 |     await page.locator('#projectTable tbody tr').first().click();
  366 |     await page.waitForTimeout(1000);
  367 | 
  368 |     // Should see expert assessment card
> 369 |     await expect(page.locator('.expert-response-grid')).toBeVisible();
      |                                                         ^ Error: expect(locator).toBeVisible() failed
  370 |     // Verify it shows actual values
  371 |     const expertText = await page.locator('.expert-response-grid').first().textContent();
  372 |     expect(expertText!.length).toBeGreaterThan(10);
  373 |   });
  374 | 
  375 |   test('Export to Excel triggers download', async ({ page }) => {
  376 |     await login(page);
  377 |     await page.locator('[data-route="portfolio"]').click();
  378 |     await page.waitForTimeout(1000);
  379 | 
  380 |     // Listen for download
  381 |     const [download] = await Promise.all([
  382 |       page.waitForEvent('download', { timeout: 10000 }),
  383 |       page.locator('.btn-export').click(),
  384 |     ]);
  385 | 
  386 |     expect(download.suggestedFilename()).toContain('.xlsx');
  387 |   });
  388 | 
  389 |   test('Engagement #10 has legacy overrides (not defaults)', async ({ page }) => {
  390 |     await login(page);
  391 |     await page.locator('[data-route="projects"]').click();
  392 |     await expect(page.locator('#projectTable')).toBeVisible({ timeout: 5000 });
  393 | 
  394 |     // Find AstraZeneca row — should NOT have confidence flag (legacy was overridden)
  395 |     const azRow = page.locator('#projectTable tbody tr', { hasText: 'AstraZeneca' });
  396 |     await expect(azRow).toBeVisible();
  397 |     const hasFlag = await azRow.locator('.confidence-flag').count();
  398 |     expect(hasFlag).toBe(0);
  399 |   });
  400 | });
  401 | 
```