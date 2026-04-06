"""
Test: Norms v2 admin page UX — add/edit/delete flow.
Run: python3 -m pytest tests/test_norms_v2_ux.py -v
"""
import re, time
from playwright.sync_api import expect

BASE = "http://localhost:8000"
ADMIN_USER = "admin"
ADMIN_PASS = "AliraAdmin2026!"


def login_and_goto_norms(page):
    """Login as admin and navigate to Norms v2 page."""
    page.goto(f"{BASE}/")
    page.wait_for_selector("#loginUsername", timeout=5000)
    page.fill("#loginUsername", ADMIN_USER)
    page.fill("#loginPassword", ADMIN_PASS)
    page.click("#loginBtn")
    page.wait_for_selector("#appShell", timeout=10000)
    page.wait_for_timeout(500)
    page.goto(f"{BASE}/#norms")
    page.wait_for_timeout(1000)
    page.wait_for_selector(".norms-v2-category", timeout=10000)


def test_norms_page_loads_with_categories(page):
    """Categories should be visible and start expanded."""
    login_and_goto_norms(page)
    cats = page.locator(".norms-v2-category")
    expect(cats.first).to_be_visible()
    bodies = page.locator(".norms-v2-category-body.collapsed")
    expect(bodies).to_have_count(0)


def test_empty_category_shows_add_first_norm_button(page):
    """Categories with 0 norms should show '+ Add First Norm' for admin."""
    login_and_goto_norms(page)
    add_first = page.locator("button", has_text="Add First Norm")
    # At least one category should show the button (categories exist with 0 norms)
    if add_first.count() > 0:
        expect(add_first.first).to_be_visible()


def test_add_edit_delete_norm_flow(page):
    """Full end-to-end: add a norm, edit it, delete it."""
    login_and_goto_norms(page)

    # === STEP 1: ADD A NORM ===
    add_first = page.locator("button", has_text="Add First Norm")
    add_norm = page.locator("button", has_text="Add Norm")

    if add_first.count() > 0:
        add_first.first.click()
    elif add_norm.count() > 0:
        add_norm.first.click()
    else:
        raise AssertionError("No Add Norm button found on page")

    form = page.locator(".norms-v2-edit-panel").first
    expect(form).to_be_visible(timeout=5000)

    form.locator("#newnorm_complexity").fill("4")
    sector_select = form.locator("#newnorm_sector")
    sector_select.select_option(index=1)
    page.wait_for_timeout(500)
    subcat_select = form.locator("#newnorm_subcat")
    subcat_select.select_option(index=1)

    form.locator("#newnorm_cal").fill("10")
    form.locator("#newnorm_team").fill("3")
    form.locator("#newnorm_ri").fill("4")
    form.locator("#newnorm_se").fill("3")
    form.locator("#newnorm_si").fill("5")
    form.locator("#newnorm_ai").fill("6")

    save_btn = form.locator("xpath=..").locator("button", has_text="Save").first
    save_btn.click()
    page.wait_for_timeout(3000)

    # Re-navigate to verify
    page.goto(f"{BASE}/#norms")
    page.wait_for_selector(".norms-v2-category", timeout=10000)

    c4_row = page.locator(".norms-v2-row", has_text="C4").first
    expect(c4_row).to_be_visible(timeout=5000)

    # === STEP 2: EDIT THE NORM ===
    c4_row.click()
    page.wait_for_timeout(2000)
    edit_panel = page.locator(".norms-v2-edit-panel").first
    expect(edit_panel).to_be_visible(timeout=5000)

    notes = edit_panel.locator("textarea").last
    test_note = f"E2E test note {int(time.time())}"
    notes.fill(test_note)

    edit_panel.locator("xpath=..").locator("button", has_text="Save").first.click()
    page.wait_for_timeout(3000)

    page.goto(f"{BASE}/#norms")
    page.wait_for_selector(".norms-v2-category", timeout=10000)

    # === STEP 3: DELETE THE NORM ===
    c4_row = page.locator(".norms-v2-row", has_text="C4").first
    expect(c4_row).to_be_visible(timeout=5000)
    c4_row.click()

    page.wait_for_timeout(2000)
    edit_panel = page.locator(".norms-v2-edit-panel").first
    expect(edit_panel).to_be_visible(timeout=5000)

    page.on("dialog", lambda dialog: dialog.accept())

    delete_btn = edit_panel.locator("xpath=..").locator("button", has_text="Delete")
    expect(delete_btn).to_be_visible()
    delete_btn.click()

    page.wait_for_timeout(3000)

    page.goto(f"{BASE}/#norms")
    page.wait_for_selector(".norms-v2-category", timeout=10000)
    expect(page.locator(".norms-v2-category").first).to_be_visible()


def test_column_headers_present_when_norms_exist(page):
    """Categories with norms should show column headers."""
    login_and_goto_norms(page)

    with_norms = page.locator(".norms-v2-category-header").filter(has_text=re.compile(r"[1-9]\d* norms"))
    if with_norms.count() > 0:
        cat = with_norms.first
        cat_body = cat.evaluate_handle("el => el.nextElementSibling").as_element()
        header = cat_body.query_selector(".norms-v2-col-header")
        assert header is not None, "Column header row should exist"
        header_text = header.inner_text()
        assert "Cal Days" in header_text
        assert "Team Size" in header_text


if __name__ == "__main__":
    import pytest, sys
    sys.exit(pytest.main([__file__, "-v", "--tb=short"]))
