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
  await page.locator(`${rowSelector} .pioneer-picker`).selectOption('__new__');
  await page.locator(`${rowSelector} .pioneer-inline-name`).fill(name);
  if (email) {
    await page.locator(`${rowSelector} .pioneer-inline-email`).fill(email);
  }
  await page.locator(`${rowSelector} .pioneer-inline-save`).click();
  // Wait for the picker to come back with a non-empty, non-__new__ value.
  await page.waitForFunction(
    (sel) => {
      const s = document.querySelector(`${sel} .pioneer-picker`) as HTMLSelectElement | null;
      return !!s && !!s.value && s.value !== '__new__';
    },
    rowSelector,
    { timeout: 15000 },
  );
}
