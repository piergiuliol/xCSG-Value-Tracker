// config.js — frontend-only constants. Anything that crosses the wire lives in
// backend/schema.py DASHBOARD_CONFIG and is read from window.schema.dashboard.

window.DASHBOARD = {
  palette: {
    indigo: '#4F46E5', blue: '#6EC1E4', navy: '#121F6B', success: '#10b981',
    warning: '#f59e0b', danger: '#ef4444', gray: '#9CA3AF',
    gray200: '#E5E7EB', gray400: '#9CA3AF', gray500: '#6B7280',
    // Convenience aliases + extras previously living in the C object in app.js.
    // Keep this list as the single source of truth for chart colours.
    green: '#10b981', orange: '#f59e0b', red: '#ef4444',
    teal: '#14B8A6', purple: '#8B5CF6',
    gray50: '#F9FAFB', gray100: '#F3F4F6',
    series: ['#4F46E5', '#6EC1E4', '#10b981', '#f59e0b', '#ef4444',
             '#8b5cf6', '#ec4899', '#14b8a6', '#f97316', '#06b6d4'],
  },
  animation: { duration: 400, easing: 'cubicOut' },
  tooltip: {
    backgroundColor: 'rgba(255,255,255,0.96)',
    borderColor: '#E5E7EB',
    borderWidth: 1,
    textStyle: { color: '#111827', fontSize: 12 },
    extraCssText: 'box-shadow: 0 4px 16px rgba(0,0,0,0.08); border-radius: 8px;',
  },
  legend: { textStyle: { fontSize: 12, color: '#6B7280' }, itemWidth: 16, itemHeight: 8, itemGap: 24 },
  bucket: {
    quarterLabel: (y, q) => `${y}-Q${q}`,
    monthLabel:   (y, m) => `${y}-${String(m).padStart(2, '0')}`,
  },
  // Horizontal bar charts auto-resize their card height based on item count.
  // rowHeight = vertical space each bar row consumes; padding = constant top/bottom slack.
  bar: { rowHeight: 38, padding: 40 },
  // Mini-chart cells (e.g. cohort learning-curve grid). Tune if cells feel too short/tall.
  minis: { cellHeight: 180 },
  // Heatmap visualMap floors: ensure colour scale never collapses on sparse data.
  // minFloor = minimum lower bound, minMax = minimum upper bound.
  heatmap: { minFloor: 1, minMax: 2 },
  filterStorageKey: 'xcsg.dashboard.filters.v1',
};
