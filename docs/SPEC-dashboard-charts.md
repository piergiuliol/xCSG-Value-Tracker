# Dashboard Charts Spec (ADD to SPEC-metrics-overhaul.md Section "Frontend Dashboard Rebuild")

## Chart Library
Chart.js v4 via CDN: `<script src="https://cdn.jsdelivr.net/npm/chart.js@4"></script>` in index.html before app.js.

## Dashboard Layout (6 sections, card-based, light mode)

### Section 1: Hero Row
- **xCSG Advantage** — big hero number with trend arrow (↑ green if improving, ↓ red if declining)
- **Total engagements** count
- **Scaling stage** badge: <5 projects = "Pilot", 5-19 = "Scaling", 20+ = "At Scale"

### Section 2: Thesis Validation
**Disprove Matrix — scatter chart**
- X = Delivery Speed, Y = Output Quality
- Each dot = one project (fixed size, or revenue-proportional if revenue available)
- 4 quadrants with labels:
  - Top-right (speed>1, quality>1): "✓ Thesis Validated" (green bg)
  - Bottom-right (speed>1, quality<1): "⚠ Cost-cutting Only" (amber bg)
  - Top-left (speed<1, quality>1): "⚠ Quality Without Efficiency" (amber bg)
  - Bottom-left (speed<1, quality<1): "✗ Model Failing" (red bg)
- Reference lines at x=1.0, y=1.0 (dashed gray)
- Tooltip: project name, pioneer, client, category, both values

**Gains Radar — radar chart**
- 6 axes: Machine-First Gain, Senior-Led Gain, Knowledge Gain, Rework Efficiency, Client Impact, Data Independence
- Dataset 1: "xCSG Average" (colored fill, blue/teal)
- Dataset 2: "Baseline" (gray dashed line at 1.0)
- Skip axes where avg is null (not enough data)

### Section 3: Trends
**xCSG Advantage trend — line chart**
- X = project created_at date, Y = xCSG Advantage value
- Line with dot markers, subtle fill below
- Reference line at y=1.0 (dashed gray)

**Speed vs Quality — dual line chart**
- Two lines: Delivery Speed (blue), Output Quality (navy)
- X = project created_at date
- Legend distinguishing the two

**AI Survival trend — line chart**
- X = project date, Y = AI survival rate (show as %)
- Reference line at y=50% (dashed)

### Section 4: Breakdowns
**By Category — horizontal bar chart**
- Y = category names, X = average xCSG Advantage
- Only categories with 2+ projects
- Color: >1.5 green, 1.0-1.5 blue, <1.0 red

**By Pioneer — horizontal bar chart**
- Y = pioneer names, X = average xCSG Advantage
- Same color rules
- Only pioneers with 2+ projects

**Client Pulse — doughnut chart**
- Segments: "Exceeded expectations" (green), "Met expectations" (blue), "Below expectations" (red)
- Center text: total project count
- Legend below

### Section 5: Flywheel
**Reuse Intent — horizontal stacked bar or progress bar**
- Green segment: "Yes without hesitation" %
- Amber segment: "Yes with reservations" %
- Red segment: "No" %
- Label: "Reuse Intent"

**Scaling Gates — visual progress stepper**
- Horizontal stepper with circles for each gate
- Passed = green checkmark, Pending = gray circle
- Gate names below circles

### Section 6: Project Table
- Columns: Project | Category | Pioneer | Client | Speed | Quality | xCSG Advantage | Status | Actions
- Sortable by clicking column headers
- Click row → project detail card with all 9 metrics + expert summary

## Data Sources (client-side aggregation from existing APIs)
- `/api/dashboard/metrics` → hero numbers, scaling gates, aggregate averages
- `/api/projects` → per-project data for scatter, trends, breakdowns
- No new API endpoints needed — aggregate client-side

## Style Rules
- Light mode (use existing CSS vars --navy, --blue, --orange, --green)
- Cards with subtle border, rounded corners (matching existing style)
- Charts responsive (Chart.js responsive: true, maintainAspectRatio: false with fixed card heights)
- Chart.js defaults: font family = system-ui, no grid lines on radar, subtle grid on line/bar
