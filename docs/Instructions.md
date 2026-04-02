# xCSG Value Measurement Tracker — Instructions

## What to Build

A polished web app (FastAPI + SQLite + vanilla HTML/JS/CSS) that tracks consulting deliverable performance. Read `SPEC.md` for the complete specification and `FRAMEWORK.md` for the measurement methodology.

## Build Order

1. **Backend first**: `auth.py` → `models.py` → `database.py` → `metrics.py` → `app.py`
2. **Frontend second**: `styles.css` → `index.html` → `app.js`
3. **Deployment files**: `requirements.txt`, `launch.sh`, `Dockerfile`, `docker-compose.yml`
4. **Test**: Start the server, verify login works, create a test deliverable, submit expert form, check dashboard renders

## Critical Rules

- **No frameworks**: No React, no Vue, no Tailwind build. Vanilla HTML/JS/CSS only.
- **String consistency**: All dropdown option values must be IDENTICAL across HTML, Python scoring maps, and JS chart logic. Especially D3 moat test options with em dashes (—). Never put apostrophes inside single-quoted JS strings.
- **Import paths**: Use `from backend import auth`, `from backend.models import ...` (not bare imports). The app runs from project root via `python -m uvicorn backend.app:app`.
- **Static mount last**: `app.mount("/", StaticFiles(...))` must be the LAST line in app.py — it's a catch-all.
- **Seed user recovery**: `seed_data()` must verify passwords on every startup and re-hash if stale.
- **Chart.js defer**: Load Chart.js CDN with `defer`. Always check canvas exists before `new Chart()`.
- **UI quality**: Every form has a visible submit button. Clean spacing, two-column layouts, Alira brand colors throughout. The app should look professional, not like a prototype.

## Brand Quick Reference

- Navy `#121F6B` (primary), Blue `#6EC1E4` (accent), Orange `#FF8300` (sparingly)
- Font: Roboto from Google Fonts
- See SPEC.md "Brand System" section for full details

## Testing Checklist

- [ ] `./launch.sh` starts without errors on macOS
- [ ] Login with admin/AliraAdmin2026! succeeds
- [ ] Dashboard shows empty state message (no deliverables yet)
- [ ] "New Deliverable" form has visible submit button, all fields work
- [ ] Selecting deliverable type auto-populates legacy norms
- [ ] Creating deliverable shows modal with expert link
- [ ] Expert link opens standalone form (no login required)
- [ ] Submitting expert form shows thank-you message
- [ ] Dashboard updates with first completed deliverable
- [ ] Deliverables list shows the record with status
- [ ] Legacy Norms view shows editable table
- [ ] Activity Log shows login + create events
- [ ] `node --check frontend/app.js` passes (zero syntax errors)
