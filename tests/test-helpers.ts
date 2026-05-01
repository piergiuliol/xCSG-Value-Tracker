import { Page } from '@playwright/test';

/**
 * Inline-create a new pioneer from the project form's pioneer picker.
 * The pioneer card's picker switches to the inline-create form, fills first
 * name, last name, and (optionally) email, saves, and waits for the picker
 * to come back with the new pioneer selected.
 *
 * If `name` is passed as a single full name (e.g. "Sofia Romano"), it is
 * split on the first whitespace into first/last so existing callers keep
 * working without per-call updates.
 *
 * @param rowSelector - CSS selector for the specific pioneer row (e.g. '.pioneer-row',
 *   '.pioneer-row:nth-of-type(1)', or whatever uniquely identifies the row)
 * @param firstName - first name OR a full "First Last" string (auto-split)
 * @param lastNameOrEmail - if `email` is omitted, this can be the email (legacy
 *   3-arg form). Otherwise it's the last name.
 * @param email - email (optional)
 */
export async function inlineCreatePioneer(
  page: Page,
  rowSelector: string,
  firstName: string,
  lastNameOrEmail: string,
  email?: string,
): Promise<void> {
  // Resolve the four-arg form. If `email` is undefined, treat the call as
  // (page, rowSelector, fullName, email). This keeps every existing caller
  // working: the helper splits the full name on first whitespace.
  let first = firstName;
  let last = lastNameOrEmail;
  let mail = email;
  if (mail === undefined) {
    // Legacy 3-arg signature: (page, rowSelector, name, email).
    mail = lastNameOrEmail;
    if (firstName.includes(' ')) {
      const idx = firstName.indexOf(' ');
      first = firstName.slice(0, idx);
      last = firstName.slice(idx + 1);
    } else {
      first = firstName;
      last = '';
    }
  }

  const row = page.locator(rowSelector).first();
  await row.locator('.pioneer-picker').selectOption('__new__');
  await row.locator('.pioneer-inline-first-name').fill(first);
  await row.locator('.pioneer-inline-last-name').fill(last);
  if (mail) {
    await row.locator('.pioneer-inline-email').fill(mail);
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
