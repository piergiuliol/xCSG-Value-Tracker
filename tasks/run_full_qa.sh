#!/usr/bin/env bash
# ============================================================
# xCSG Value Tracker v2 — Full QA Runner (Master Script)
# ============================================================
# Usage:
#   cd ~/Documents/Projects/xCSG-Value-Tracker
#   bash tasks/run_full_qa.sh
# ============================================================

set -e
cd "$(dirname "$0")/.."
PROJECT_DIR="$(pwd)"

echo ""
echo "============================================"
echo " xCSG Value Tracker v2 — Full QA"
echo " $(date)"
echo "============================================"
echo ""

# ── 1. Ensure directories ─────────────────────────────────────────────────────
mkdir -p test-results/screenshots tasks

# ── 2. Install Python deps ────────────────────────────────────────────────────
echo "📦 Installing Python dependencies..."
pip install -r requirements.txt -q
pip install requests -q

# ── 3. Start server (if not running) ──────────────────────────────────────────
SERVER_PID=""
if curl -s http://localhost:8000/api/health > /dev/null 2>&1; then
  echo "✅ Server already running on port 8000"
else
  echo "🚀 Starting server..."
  python -m uvicorn backend.app:app --host 0.0.0.0 --port 8000 --log-level warning &
  SERVER_PID=$!
  echo "   Server PID: $SERVER_PID"
  
  # Wait for server to be ready
  echo "   Waiting for server..."
  for i in {1..20}; do
    if curl -s http://localhost:8000/api/health > /dev/null 2>&1; then
      echo "✅ Server ready"
      break
    fi
    sleep 1
    if [ $i -eq 20 ]; then
      echo "❌ Server failed to start"
      exit 1
    fi
  done
fi

echo ""

# ── 4. Install Playwright if needed ───────────────────────────────────────────
echo "📦 Checking Playwright..."
if ! npx playwright --version > /dev/null 2>&1; then
  echo "Installing Playwright..."
  npx playwright install chromium --quiet
else
  echo "✅ Playwright available"
fi

echo ""

# ── 5. Run API QA (Phase 1-6) ─────────────────────────────────────────────────
echo "============================================"
echo " Running API QA (Phase 1-6)..."
echo "============================================"
python tasks/qa_runner.py
echo ""

# ── 6. Run Visual QA (Playwright screenshots) ─────────────────────────────────
echo "============================================"
echo " Running Visual QA (Playwright)..."
echo "============================================"
node tasks/visual_qa.mjs
echo ""

# ── 7. Merge visual results into report ───────────────────────────────────────
echo "============================================"
echo " Finalizing Report..."
echo "============================================"

if [ -f "test-results/visual-qa-results.json" ]; then
  python3 - <<'PYEOF'
import json
from pathlib import Path

report_path = Path("tasks/qa-v2-report.md")
visual_path = Path("test-results/visual-qa-results.json")

with open(visual_path) as f:
    visual = json.load(f)

with open(report_path, "a") as f:
    f.write("\n\n---\n\n## Phase Visual QA (Playwright)\n\n")
    f.write(f"**Timestamp:** {visual['timestamp']}\n\n")
    f.write(f"### Screenshots Taken ({len(visual['screenshots'])})\n")
    for s in visual['screenshots']:
        f.write(f"- `{s}`\n")
    
    f.write(f"\n### Visual Issues Found: {len(visual['issues'])}\n")
    if visual['issues']:
        for issue in visual['issues']:
            f.write(f"\n#### Bug: {issue['title']}\n")
            f.write(f"**Severity:** {issue['severity']}\n")
            f.write(f"**Detail:** {issue['detail']}\n")
    else:
        f.write("No visual issues found.\n")
    
    f.write("\n---\n\n## Verdict\n\n")
    critical = [i for i in visual['issues'] if i['severity'] == 'critical']
    major = [i for i in visual['issues'] if i['severity'] == 'major']
    
    if critical:
        f.write("**VERDICT: FAIL** — Critical issues found.\n\n")
    elif major:
        f.write("**VERDICT: PASS WITH ISSUES** — Major issues found, no blockers.\n\n")
    else:
        f.write("**VERDICT: PASS** ✅ — All phases completed successfully.\n\n")

print("✅ Report finalized: tasks/qa-v2-report.md")
PYEOF
fi

# ── 8. Print summary ──────────────────────────────────────────────────────────
echo ""
echo "============================================"
echo " QA Complete!"
echo "============================================"
echo ""
echo "📄 Report: $(pwd)/tasks/qa-v2-report.md"
echo "📸 Screenshots: $(pwd)/test-results/screenshots/"
echo ""
echo "Screenshots:"
ls test-results/screenshots/ 2>/dev/null | while read f; do
  echo "  - test-results/screenshots/$f"
done

# ── 9. Cleanup: stop server if we started it ──────────────────────────────────
if [ -n "$SERVER_PID" ]; then
  echo ""
  echo "Stopping server (PID $SERVER_PID)..."
  kill "$SERVER_PID" 2>/dev/null || true
fi

echo ""
echo "✅ Done"
