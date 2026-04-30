import { Page } from '@playwright/test';

/**
 * Inline-create a new pioneer from the project form's pioneer picker.
 * The pioneer card's picker switches to the inline-create form, fills it,
 * saves, and waits for the picker to come back with the new pioneer selected.
 *
 * @param rowSelector - CSS selector for the specific pioneer row (e.g. '.pioneer-row',
 *   '.pioneer-row:nth-of-type(1)', or whatever uniquely identifies the row)
 */
export async function inlineCreatePioneer(
  page: Page,
  rowSelector: string,
  name: string,
  email: string,
): Promise<void> {
  // Resolve to the first matching row to handle multi-row forms predictably.
  const row = page.locator(rowSelector).first();
  await row.locator('.pioneer-picker').selectOption('__new__');
  await row.locator('.pioneer-inline-name').fill(name);
  if (email) {
    await row.locator('.pioneer-inline-email').fill(email);
  }
  await row.locator('.pioneer-inline-save').click();
  // Wait for the picker to come back with a non-empty, non-__new__ value.
  await page.waitForFunction(
    (sel) => {
      const r = document.querySelectorAll(sel)[0];
      const s = r?.querySelector('.pioneer-picker') as HTMLSelectElement | null;
      return !!s && !!s.value && s.value !== '__new__';
    },
    rowSelector,
    { timeout: 10000 },
  );
}
